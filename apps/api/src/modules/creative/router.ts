import crypto from "crypto";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { createCampaignCreativeSchema, publishCampaignCreativeSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { requireVendorAccess } from "../../lib/rbac";
import {
  assertPromptSafe,
  buildForbiddenTerms,
  buildPrivateDraftAsset,
  buildSafeCreativePrompt,
  CREATIVE_PUBLISH_BLOCKERS,
  snapshotPackForCreative,
  snapshotPrizesForCreative,
} from "./service";

export const creativeRouter = Router();

async function requireCreativeRole(req: VendorRequest, res: any, allowStaffReadOnly = false) {
  return requireVendorAccess(req, res, allowStaffReadOnly ? ["OWNER", "MANAGER", "STAFF"] : ["OWNER", "MANAGER"]);
}

function responseForJob(job: any) {
  return { creativeJob: job, publishBlockers: CREATIVE_PUBLISH_BLOCKERS };
}

creativeRouter.get("/v1/vendor/creative-jobs", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res, true);
  if (!auth) return;

  const creativeJobs = await prisma.creativeJob.findMany({
    where: { vendorId: auth.vendorId },
    include: { assets: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return res.json({ creativeJobs, publishBlockers: CREATIVE_PUBLISH_BLOCKERS });
});

creativeRouter.post("/v1/vendor/packs/:packId/creative-jobs", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res);
  if (!auth) return;

  const packId = String(req.params.packId || "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });

  const parsed = createCampaignCreativeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const rawIdemKey = String(req.header("x-idempotency-key") ?? "").trim();
  const requestHash = crypto.createHash("sha256").update(JSON.stringify({ packId, body: parsed.data })).digest("hex");
  const idempotencyScopeKey = rawIdemKey ? `${auth.vendorId}:creative:${auth.actorUserId}:${rawIdemKey}` : null;

  if (idempotencyScopeKey) {
    const existing = await prisma.idempotencyKey.findUnique({ where: { scopeKey: idempotencyScopeKey } });
    if (existing?.responseJson) {
      const payload = JSON.parse(existing.responseJson);
      if (payload.requestHash !== requestHash) {
        return res.status(409).json({ error: "idempotency key reused with different creative request" });
      }
      return res.status(existing.statusCode ?? 201).json(payload.response);
    }
  }

  const pack = await prisma.pack.findFirst({
    where: { id: packId, vendorId: auth.vendorId, isActive: true, status: { not: "ARCHIVED" } },
    include: { prizes: true },
  });
  if (!pack) return res.status(404).json({ error: "Pack not found" });
  if (pack.prizes.length === 0) return res.status(400).json({ error: "Pack has no prizes to anchor creative" });

  const safePrompt = buildSafeCreativePrompt(parsed.data.stylePreset);
  const forbiddenTerms = buildForbiddenTerms(pack);
  assertPromptSafe(safePrompt, forbiddenTerms);

  const packSnapshot = snapshotPackForCreative(pack) as Prisma.InputJsonObject;
  const prizeSnapshot = snapshotPrizesForCreative(pack) as Prisma.InputJsonArray;
  const assetDraft = buildPrivateDraftAsset(pack, parsed.data.stylePreset);

  const creativeJob = await prisma.creativeJob.create({
    data: {
      vendorId: auth.vendorId,
      packId: pack.id,
      status: "COMPLETED",
      stylePreset: parsed.data.stylePreset,
      aspectRatio: parsed.data.aspectRatio,
      safePrompt,
      forbiddenTerms: forbiddenTerms as Prisma.InputJsonArray,
      packSnapshot,
      prizeSnapshot,
      actorUserId: auth.actorUserId,
      requestId: String(req.header("x-request-id") ?? "").trim() || null,
      assets: {
        create: {
          vendorId: auth.vendorId,
          status: "PRIVATE_DRAFT",
          title: assetDraft.title,
          imageUrl: assetDraft.imageUrl,
          targetUrl: assetDraft.targetUrl,
          contentHash: assetDraft.contentHash,
          width: assetDraft.width,
          height: assetDraft.height,
          metadata: assetDraft.metadata as Prisma.InputJsonObject,
        },
      },
    },
    include: { assets: true },
  });

  const response = responseForJob(creativeJob);

  if (idempotencyScopeKey && rawIdemKey) {
    await prisma.idempotencyKey.create({
      data: {
        key: rawIdemKey,
        operation: "CREATE_CREATIVE_JOB",
        scopeKey: idempotencyScopeKey,
        vendorId: auth.vendorId,
        userId: auth.actorUserId,
        statusCode: 201,
        responseJson: JSON.stringify({ requestHash, response }),
      },
    });
  }

  return res.status(201).json(response);
});

creativeRouter.post("/v1/vendor/creative-jobs/:jobId/publish", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res);
  if (!auth) return;

  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "creative job id is required" });

  const parsed = publishCampaignCreativeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const asset = await prisma.creativeAsset.findFirst({
    where: {
      id: parsed.data.assetId,
      creativeJobId: jobId,
      vendorId: auth.vendorId,
      status: "PRIVATE_DRAFT",
    },
    include: { creativeJob: true },
  });
  if (!asset) return res.status(404).json({ error: "Private draft asset not found" });

  await prisma.creativeJob.update({
    where: { id: jobId },
    data: { status: "PUBLISH_BLOCKED", errorMessage: CREATIVE_PUBLISH_BLOCKERS.join(",") },
  });

  return res.status(409).json({
    error: "creative publish blocked by MVP gates",
    assetId: asset.id,
    creativeJobId: jobId,
    blockers: CREATIVE_PUBLISH_BLOCKERS,
  });
});
