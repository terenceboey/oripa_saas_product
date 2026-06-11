import crypto from "crypto";
import fs from "node:fs/promises";
import multer from "multer";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import {
  createCampaignCreativeSchema,
  createGptImage2CreativeGenerationSchema,
  createManualCreativeCandidatesSchema,
  publishCampaignCreativeSchema,
  reviewCreativeAssetSchema,
} from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { fetchAndPersistCardImage, findHermesHandoffOutputImages, persistCreativeCandidateImage, persistGeneratedCreativeImage, persistVendorSourceImage, readCachedCardImage, resolveCreativeStorageRoot } from "../../lib/creative-storage";
import { generateGptImage2 } from "../../lib/gpt-image2-provider";
import { startHermesGptWebHandoff } from "../../lib/hermes-web-handoff";
import { VendorRequest } from "../../middleware/vendor";
import { requireVendorAccess } from "../../lib/rbac";
import {
  BANNER_TEMPLATE_REGISTRY,
  CREATIVE_PUBLISH_BLOCKERS,
  assertPromptSafe,
  buildForbiddenTerms,
  buildSafeCreativePrompt,
  buildBannerCardAssetsFromPack,
  buildGptImage2GenerationRequest,
  compileBannerTemplatePrompt,
  createBannerTemplateDraftAsset,
  createManualCreativeCandidateAsset,
  createProviderGeneratedCreativeCandidateAsset,
  markCreativeCandidateReviewed,
  snapshotPackForCreative,
  snapshotPrizesForCreative,
} from "./service";

export const creativeRouter = Router();

const creativeCandidateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 4 },
});
const uploadCreativeCandidateFiles = creativeCandidateUpload.array("files", 4) as any;
const sourceImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
});
const uploadSourceImageFiles = sourceImageUpload.array("files", 5) as any;

async function requireCreativeRole(req: VendorRequest, res: any, allowStaffReadOnly = false) {
  return requireVendorAccess(req, res, allowStaffReadOnly ? ["OWNER", "MANAGER", "STAFF"] : ["OWNER", "MANAGER"]);
}

async function requireCreativeUploadRole(req: VendorRequest, res: any, next: any) {
  const auth = await requireCreativeRole(req, res);
  if (!auth) return;
  (req as any).creativeAuth = auth;
  next();
}

function uploadAuth(req: VendorRequest) {
  return (req as any).creativeAuth;
}

function safeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "unknown";
}

function creativeStoragePathname(imageUrl: string) {
  const raw = String(imageUrl ?? "").trim();
  const pathname = raw.startsWith("http://") || raw.startsWith("https://")
    ? new URL(raw).pathname
    : raw.split(/[?#]/)[0];
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function expectedSourcePrefix(source: string, vendorId: string, packId: string) {
  if (source === "upload") return `/creative-storage/private/source-assets/${safeStorageSegment(vendorId)}/`;
  if (source === "pack_prize") return `/creative-storage/private/card-assets/pack-prizes/${safeStorageSegment(packId)}/`;
  return null;
}

function validateSourceImageHandles(input: { images: Array<{ imageUrl?: string | null; source?: string | null; label?: string | null }>; vendorId: string; packId: string }) {
  for (const image of input.images) {
    const source = String(image.source ?? "");
    const expectedPrefix = expectedSourcePrefix(source, input.vendorId, input.packId);
    const pathname = creativeStoragePathname(String(image.imageUrl ?? ""));
    if (pathname.includes("..") || !expectedPrefix || !pathname.startsWith(expectedPrefix)) {
      return `source image ${image.label ?? "image"} must be a private ${source || "known"} creative-storage handle for this vendor/pack`;
    }
  }
  return null;
}

function validateCandidateImageHandles(input: { candidates: Array<{ imageUrl: string; title?: string | null }>; creativeJobId: string }) {
  const expectedPrefix = `/creative-storage/private/creative-jobs/${safeStorageSegment(input.creativeJobId)}/`;
  for (const candidate of input.candidates) {
    const pathname = creativeStoragePathname(candidate.imageUrl);
    if (pathname.includes("..") || !pathname.startsWith(expectedPrefix)) {
      return `manual candidate ${candidate.title ?? "image"} must be a private creative-storage handle for this creative job`;
    }
  }
  return null;
}

async function hydrateCachedPackPrizeHeroAssets(payload: any, pack: any, publicBaseUrl?: string) {
  if (Array.isArray(payload.heroAssets) && payload.heroAssets.length > 0) return { payload };
  const heroCardIds = Array.isArray(payload.heroCardIds) ? payload.heroCardIds.slice(0, 5).map((id: unknown) => String(id)) : [];
  if (!heroCardIds.length) return { error: "Choose uploaded source assets or cached pack-prize hero cards" };
  const prizeById = new Map<string, any>(pack.prizes.map((prize: any) => [prize.id, prize]));
  const heroAssets = [] as Array<Record<string, unknown>>;
  for (const prizeId of heroCardIds) {
    const prize = prizeById.get(prizeId);
    if (!prize) return { error: `pack prize ${prizeId} does not belong to this pack` };
    const cached = await readCachedCardImage({ packId: pack.id, packPrizeId: prizeId, publicBaseUrl });
    if (!cached?.publicUrl) return { error: `pack prize ${prize.label} must be cached before creative generation` };
    heroAssets.push({
      assetId: `pack_prize:${prizeId}`,
      source: "pack_prize",
      imageUrl: cached.publicUrl,
      displayName: prize.label,
      snapshotHash: cached.contentHash,
      contentHash: cached.contentHash,
    });
  }
  const primaryHeroAssetId = payload.primaryCardId && heroCardIds.includes(payload.primaryCardId)
    ? `pack_prize:${payload.primaryCardId}`
    : String(heroAssets[0]?.assetId ?? "");
  return {
    payload: {
      ...payload,
      heroCardIds: undefined,
      primaryCardId: undefined,
      heroAssets,
      primaryHeroAssetId,
    },
  };
}

function responseForJob(job: any) {
  return { creativeJob: job, publishBlockers: CREATIVE_PUBLISH_BLOCKERS };
}

creativeRouter.get("/v1/vendor/banner-templates", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res, true);
  if (!auth) return;

  return res.json({ templates: BANNER_TEMPLATE_REGISTRY });
});
creativeRouter.post("/v1/vendor/creative-source-assets/upload", requireCreativeUploadRole as any, uploadSourceImageFiles, async (req: VendorRequest, res) => {
  const auth = uploadAuth(req);

  const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
  if (files.length === 0) return res.status(400).json({ error: "at least one source image is required" });

  const appUrl = String(process.env.APP_URL ?? "").trim() || undefined;
  try {
    const stored = await Promise.all(files.slice(0, 5).map((file) => persistVendorSourceImage({
      fileBuffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      vendorId: auth.vendorId,
      publicBaseUrl: appUrl,
    })));
    return res.status(201).json({
      source: "upload",
      assets: stored.map((asset) => ({
        assetId: asset.id,
        source: asset.source,
        imageUrl: asset.publicUrl,
        displayName: asset.displayName,
        snapshotHash: asset.snapshotHash,
        contentHash: asset.contentHash,
        width: asset.width,
        height: asset.height,
        storage: {
          relativeUrl: asset.relativeUrl,
          contentHash: asset.contentHash,
          bytesUploaded: asset.bytesUploaded,
          originalName: asset.originalName,
          mimeType: asset.mimeType,
        },
      })),
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "failed to store source images" });
  }
});

creativeRouter.get("/v1/vendor/banner-card-assets", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res, true);
  if (!auth) return;

  const packId = String(req.query.packId ?? "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });

  const pack = await prisma.pack.findFirst({
    where: { id: packId, vendorId: auth.vendorId, status: { not: "ARCHIVED" } },
    include: { prizes: true },
  });
  if (!pack) return res.status(404).json({ error: "Pack not found" });

  const appUrl = String(process.env.APP_URL ?? "").trim() || undefined;
  const assets = await Promise.all(buildBannerCardAssetsFromPack(pack).map(async (asset) => {
    const cached = await readCachedCardImage({ packId: pack.id, packPrizeId: asset.packPrizeId, publicBaseUrl: appUrl });
    return cached ? {
      ...asset,
      originalImageUrl: asset.imageUrl,
      imageUrl: cached.publicUrl,
      localImageUrl: cached.publicUrl,
      cardImageCached: true,
      cardImageStorage: {
        relativeUrl: cached.relativeUrl,
        contentHash: cached.contentHash,
        cachedAt: cached.cachedAt,
      },
    } : { ...asset, cardImageCached: false };
  }));

  return res.json({
    source: "pack_prize",
    packId: pack.id,
    assets,
  });
});

creativeRouter.post("/v1/vendor/banner-card-assets/cache", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res);
  if (!auth) return;

  const packId = String(req.body?.packId ?? "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });
  const requestedPrizeIds = Array.isArray(req.body?.packPrizeIds)
    ? new Set(req.body.packPrizeIds.map((id: unknown) => String(id)))
    : null;

  const pack = await prisma.pack.findFirst({
    where: { id: packId, vendorId: auth.vendorId, status: { not: "ARCHIVED" } },
    include: { prizes: true },
  });
  if (!pack) return res.status(404).json({ error: "Pack not found" });

  const appUrl = String(process.env.APP_URL ?? "").trim() || undefined;
  const prizes = pack.prizes.filter((prize) => (!requestedPrizeIds || requestedPrizeIds.has(prize.id)) && Boolean(prize.imageUrl));
  const cached: any[] = [];
  const failed: Array<{ packPrizeId: string; label: string; error: string }> = [];

  for (const prize of prizes.slice(0, 50)) {
    try {
      const existing = await readCachedCardImage({ packId: pack.id, packPrizeId: prize.id, publicBaseUrl: appUrl });
      if (existing?.publicUrl) {
        cached.push({ packPrizeId: prize.id, label: prize.label, localImageUrl: existing.publicUrl, contentHash: existing.contentHash, skipped: true });
        continue;
      }
      const stored = await fetchAndPersistCardImage({
        sourceImageUrl: String(prize.imageUrl),
        packId: pack.id,
        packPrizeId: prize.id,
        vendorId: auth.vendorId,
        label: prize.label,
        publicBaseUrl: appUrl,
      });
      cached.push({ packPrizeId: prize.id, label: prize.label, localImageUrl: stored.publicUrl, contentHash: stored.contentHash, bytesUploaded: stored.bytesUploaded });
    } catch (error) {
      failed.push({ packPrizeId: prize.id, label: prize.label, error: error instanceof Error ? error.message : "failed to cache card image" });
    }
  }

  return res.status(failed.length && !cached.length ? 400 : 200).json({
    packId: pack.id,
    cached,
    failed,
    storageRoot: resolveCreativeStorageRoot(),
  });
});

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

  const appUrl = String(process.env.APP_URL ?? "").trim() || undefined;
  const sourcePayloadResult = await hydrateCachedPackPrizeHeroAssets(parsed.data, pack, appUrl);
  if (sourcePayloadResult.error || !sourcePayloadResult.payload) return res.status(400).json({ error: sourcePayloadResult.error ?? "invalid creative source images" });
  const sourceHandleError = validateSourceImageHandles({ images: sourcePayloadResult.payload.heroAssets ?? [], vendorId: auth.vendorId, packId: pack.id });
  if (sourceHandleError) return res.status(400).json({ error: sourceHandleError });

  const creativePayload = sourcePayloadResult.payload;
  const compiledTemplate = compileBannerTemplatePrompt(creativePayload, pack);
  const safePrompt = compiledTemplate.prompt;
  const forbiddenTerms = buildForbiddenTerms(pack);
  assertPromptSafe(buildSafeCreativePrompt(creativePayload.stylePreset), forbiddenTerms);

  const packSnapshot = snapshotPackForCreative(pack) as Prisma.InputJsonObject;
  const prizeSnapshot = snapshotPrizesForCreative(pack) as Prisma.InputJsonArray;
  const assetDraft = createBannerTemplateDraftAsset(pack, parsed.data, compiledTemplate);

  const creativeJob = await prisma.creativeJob.create({
    data: {
      vendorId: auth.vendorId,
      packId: pack.id,
      status: "COMPLETED",
      stylePreset: creativePayload.stylePreset,
      aspectRatio: creativePayload.aspectRatio,
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


creativeRouter.post("/v1/vendor/creative-jobs/:jobId/generate-gpt-image-2", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res);
  if (!auth) return;

  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "creative job id is required" });
  const parsed = createGptImage2CreativeGenerationSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

  const creativeJob = await prisma.creativeJob.findFirst({
    where: { id: jobId, vendorId: auth.vendorId },
    include: { assets: true },
  });
  if (!creativeJob) return res.status(404).json({ error: "Creative job not found" });

  const promptAsset = creativeJob.assets.find((asset) => {
    const metadata = asset.metadata as any;
    return metadata?.compiledPrompt && metadata?.assetManifest?.heroCards;
  });
  const metadata = promptAsset?.metadata as any;
  const compiledPrompt = String(metadata?.compiledPrompt ?? creativeJob.safePrompt ?? "");
  const negativePrompt = typeof metadata?.negativePrompt === "string" ? metadata.negativePrompt : undefined;
  const heroCards = Array.isArray(metadata?.assetManifest?.heroCards) ? metadata.assetManifest.heroCards : [];
  const generationRequest = buildGptImage2GenerationRequest({
    creativeJobId: creativeJob.id,
    prompt: compiledPrompt,
    negativePrompt,
    heroCards,
    imageCount: parsed.data.imageCount,
  });
  if (generationRequest.images.length === 0) {
    return res.status(400).json({ error: "creative job has no uploaded source images for GPT Image 2", generationRequest });
  }
  const sourceHandleError = validateSourceImageHandles({ images: generationRequest.images, vendorId: auth.vendorId, packId: creativeJob.packId });
  if (sourceHandleError) return res.status(400).json({ error: sourceHandleError, generationRequest: { ...generationRequest, prompt: undefined } });

  try {
    const providerResult = await generateGptImage2({
      model: generationRequest.model,
      prompt: generationRequest.prompt,
      images: generationRequest.images,
      imageCount: generationRequest.imageCount,
      appUrl: String(process.env.APP_URL ?? "").trim() || undefined,
    });
    const appUrl = String(process.env.APP_URL ?? "").trim() || undefined;
    const existingProviderCount = creativeJob.assets.filter((asset) => ["direct_gpt_image_2", "oracle_gpt_image_2"].includes(String((asset.metadata as any)?.providerMode ?? ""))).length;
    const stored = await Promise.all((providerResult.images as Array<{ fileBuffer: Buffer }>).map((image) => persistGeneratedCreativeImage({
      fileBuffer: image.fileBuffer,
      creativeJobId: creativeJob.id,
      vendorId: auth.vendorId,
      publicBaseUrl: appUrl,
    })));
    const createdAssets = await prisma.$transaction(stored.map((storedImage, index) => {
      const assetDraft = createProviderGeneratedCreativeCandidateAsset({
        creativeJobId: creativeJob.id,
        vendorId: auth.vendorId,
        packId: creativeJob.packId,
        imageUrl: storedImage.publicUrl,
        contentHash: storedImage.contentHash,
        width: storedImage.width,
        height: storedImage.height,
        promptHash: generationRequest.promptHash,
        providerRequestId: providerResult.providerRequestId,
        candidateIndex: existingProviderCount + index + 1,
      });
      return prisma.creativeAsset.create({
        data: {
          vendorId: auth.vendorId,
          creativeJobId: creativeJob.id,
          status: "PRIVATE_DRAFT",
          title: assetDraft.title,
          imageUrl: assetDraft.imageUrl,
          targetUrl: assetDraft.targetUrl,
          contentHash: assetDraft.contentHash,
          width: assetDraft.width,
          height: assetDraft.height,
          metadata: {
            ...assetDraft.metadata,
            storage: {
              storageRoot: storedImage.storageRoot,
              relativeUrl: storedImage.relativeUrl,
              absolutePath: storedImage.absolutePath,
              format: storedImage.format,
              bytesUploaded: storedImage.bytesUploaded,
            },
          } as Prisma.InputJsonObject,
        },
      });
    }));
    const updatedJob = await prisma.creativeJob.findUnique({ where: { id: creativeJob.id }, include: { assets: true } });
    return res.status(201).json({ creativeJob: updatedJob, candidates: createdAssets, generationRequest: { ...generationRequest, prompt: undefined }, publishBlockers: CREATIVE_PUBLISH_BLOCKERS });
  } catch (error) {
    return res.status(424).json({
      error: error instanceof Error ? error.message : "GPT Image 2 generation failed",
      generationRequest,
      publishBlockers: CREATIVE_PUBLISH_BLOCKERS,
    });
  }
});

creativeRouter.post("/v1/vendor/creative-jobs/:jobId/hermes-gpt-web-handoff", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res);
  if (!auth) return;

  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "creative job id is required" });
  const imageCount = Math.max(1, Math.min(4, Number(req.body?.imageCount ?? 1) || 1));
  const creativeJob = await prisma.creativeJob.findFirst({
    where: { id: jobId, vendorId: auth.vendorId },
    include: { assets: true },
  });
  if (!creativeJob) return res.status(404).json({ error: "Creative job not found" });

  const promptAsset = creativeJob.assets.find((asset) => {
    const metadata = asset.metadata as any;
    return metadata?.compiledPrompt && metadata?.assetManifest?.heroCards;
  });
  const metadata = promptAsset?.metadata as any;
  const compiledPrompt = String(metadata?.compiledPrompt ?? creativeJob.safePrompt ?? "");
  const negativePrompt = typeof metadata?.negativePrompt === "string" ? metadata.negativePrompt : undefined;
  const heroCards = Array.isArray(metadata?.assetManifest?.heroCards) ? metadata.assetManifest.heroCards : [];
  const generationRequest = buildGptImage2GenerationRequest({
    creativeJobId: creativeJob.id,
    prompt: compiledPrompt,
    negativePrompt,
    heroCards,
    imageCount,
  });
  if (generationRequest.images.length === 0) {
    return res.status(400).json({ error: "creative job has no uploaded source images for Hermes GPT web handoff", generationRequest });
  }
  const sourceHandleError = validateSourceImageHandles({ images: generationRequest.images, vendorId: auth.vendorId, packId: creativeJob.packId });
  if (sourceHandleError) return res.status(400).json({ error: sourceHandleError, generationRequest: { ...generationRequest, prompt: undefined } });

  try {
    const handoff = await startHermesGptWebHandoff({
      creativeJobId: creativeJob.id,
      vendorId: auth.vendorId,
      prompt: generationRequest.prompt,
      negativePrompt,
      images: generationRequest.images,
      appUrl: String(process.env.APP_URL ?? "").trim() || undefined,
      imageCount: generationRequest.imageCount,
    });
    return res.status(202).json({ handoff, generationRequest: { ...generationRequest, prompt: undefined }, publishBlockers: CREATIVE_PUBLISH_BLOCKERS });
  } catch (error) {
    return res.status(424).json({
      error: error instanceof Error ? error.message : "failed to start Hermes GPT web handoff",
      generationRequest: { ...generationRequest, prompt: undefined },
      publishBlockers: CREATIVE_PUBLISH_BLOCKERS,
    });
  }
});

creativeRouter.post("/v1/vendor/creative-jobs/:jobId/hermes-handoffs/:handoffId/ingest", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res);
  if (!auth) return;

  const jobId = String(req.params.jobId || "").trim();
  const handoffId = String(req.params.handoffId || "").trim();
  if (!jobId) return res.status(400).json({ error: "creative job id is required" });
  if (!handoffId) return res.status(400).json({ error: "handoff id is required" });

  const creativeJob = await prisma.creativeJob.findFirst({
    where: { id: jobId, vendorId: auth.vendorId },
    include: { assets: true },
  });
  if (!creativeJob) return res.status(404).json({ error: "Creative job not found" });

  const outputs = await findHermesHandoffOutputImages({ creativeJobId: creativeJob.id, handoffId });
  if (outputs.length === 0) {
    return res.status(404).json({
      error: "No Oracle/Hermes downloaded image found for this handoff yet",
      handoffId,
      hint: "Wait for the browser handoff to finish, or use manual candidate upload as fallback.",
    });
  }

  const existingHashes = new Set(creativeJob.assets
    .map((asset) => asset.metadata as any)
    .filter((metadata) => metadata?.providerMode === "oracle_gpt_web_handoff" && metadata?.handoffId === handoffId)
    .map((metadata) => String(metadata?.handoffOutputHash ?? ""))
    .filter(Boolean));
  const newOutputs = outputs.filter((output) => !existingHashes.has(output.contentHash)).slice(0, 4);
  if (newOutputs.length === 0) {
    const updatedJob = await prisma.creativeJob.findUnique({ where: { id: creativeJob.id }, include: { assets: true } });
    return res.status(200).json({ creativeJob: updatedJob, candidates: [], ingested: 0, skippedExisting: outputs.length, publishBlockers: CREATIVE_PUBLISH_BLOCKERS });
  }

  const appUrl = String(process.env.APP_URL ?? "").trim();
  const candidateProviderModes = new Set(["manual_gpt_image_2", "direct_gpt_image_2", "oracle_gpt_image_2", "oracle_gpt_web_handoff"]);
  const existingCandidateCount = creativeJob.assets.filter((asset) => candidateProviderModes.has(String((asset.metadata as any)?.providerMode ?? ""))).length;

  try {
    const stored = await Promise.all(newOutputs.map(async (output) => persistCreativeCandidateImage({
      fileBuffer: await fs.readFile(output.absolutePath),
      originalName: output.fileName,
      mimeType: output.format === "jpeg" ? "image/jpeg" : `image/${output.format}`,
      creativeJobId: creativeJob.id,
      vendorId: auth.vendorId,
      publicBaseUrl: appUrl || undefined,
    })));

    const createdAssets = await prisma.$transaction(stored.map((storedImage, index) => {
      const output = newOutputs[index];
      const candidateIndex = existingCandidateCount + index + 1;
      const assetDraft = createManualCreativeCandidateAsset({
        creativeJobId: creativeJob.id,
        vendorId: auth.vendorId,
        packId: creativeJob.packId,
        candidate: {
          imageUrl: storedImage.publicUrl,
          title: `Oracle web handoff candidate ${candidateIndex}`,
          width: storedImage.width ?? output.width ?? undefined,
          height: storedImage.height ?? output.height ?? undefined,
          notes: `Imported from Hermes handoff ${handoffId}`,
        },
        candidateIndex,
        actorUserId: auth.actorUserId,
      });
      return prisma.creativeAsset.create({
        data: {
          vendorId: auth.vendorId,
          creativeJobId: creativeJob.id,
          status: "PRIVATE_DRAFT",
          title: assetDraft.title,
          imageUrl: assetDraft.imageUrl,
          targetUrl: assetDraft.targetUrl,
          contentHash: storedImage.contentHash,
          width: assetDraft.width,
          height: assetDraft.height,
          metadata: {
            ...assetDraft.metadata,
            renderer: "oripa-hermes-gpt-web-handoff",
            providerMode: "oracle_gpt_web_handoff",
            aiProvider: "chatgpt_web_gpt_image",
            source: "hermes_browser_download",
            handoffId,
            handoffOutputHash: output.contentHash,
            sourceFileName: output.fileName,
            sourceAbsolutePath: output.absolutePath,
            importedByUserId: auth.actorUserId ?? null,
            importedAt: new Date().toISOString(),
            storage: {
              storageRoot: storedImage.storageRoot,
              relativeUrl: storedImage.relativeUrl,
              absolutePath: storedImage.absolutePath,
              format: storedImage.format,
              bytesUploaded: storedImage.bytesUploaded,
              originalName: storedImage.originalName,
              mimeType: storedImage.mimeType,
            },
          } as Prisma.InputJsonObject,
        },
      });
    }));

    const updatedJob = await prisma.creativeJob.findUnique({ where: { id: creativeJob.id }, include: { assets: true } });
    return res.status(201).json({ creativeJob: updatedJob, candidates: createdAssets, ingested: createdAssets.length, handoffId, publishBlockers: CREATIVE_PUBLISH_BLOCKERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ingest Hermes handoff output";
    return res.status(400).json({ error: message, handoffId });
  }
});

creativeRouter.post("/v1/vendor/creative-jobs/:jobId/candidates/manual", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res);
  if (!auth) return;

  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "creative job id is required" });

  const parsed = createManualCreativeCandidatesSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const creativeJob = await prisma.creativeJob.findFirst({
    where: { id: jobId, vendorId: auth.vendorId },
    include: { pack: true, assets: true },
  });
  if (!creativeJob) return res.status(404).json({ error: "Creative job not found" });
  const candidateHandleError = validateCandidateImageHandles({ candidates: parsed.data.candidates, creativeJobId: creativeJob.id });
  if (candidateHandleError) return res.status(400).json({ error: candidateHandleError });

  const existingManualCount = creativeJob.assets.filter((asset) => {
    const metadata = asset.metadata as any;
    return metadata?.providerMode === "manual_gpt_image_2";
  }).length;

  const createdAssets = await prisma.$transaction(parsed.data.candidates.map((candidate, index) => {
    const assetDraft = createManualCreativeCandidateAsset({
      creativeJobId: creativeJob.id,
      vendorId: auth.vendorId,
      packId: creativeJob.packId,
      candidate,
      candidateIndex: existingManualCount + index + 1,
      actorUserId: auth.actorUserId,
    });
    return prisma.creativeAsset.create({
      data: {
        vendorId: auth.vendorId,
        creativeJobId: creativeJob.id,
        status: "PRIVATE_DRAFT",
        title: assetDraft.title,
        imageUrl: assetDraft.imageUrl,
        targetUrl: assetDraft.targetUrl,
        contentHash: assetDraft.contentHash,
        width: assetDraft.width,
        height: assetDraft.height,
        metadata: assetDraft.metadata as Prisma.InputJsonObject,
      },
    });
  }));

  const updatedJob = await prisma.creativeJob.findUnique({ where: { id: creativeJob.id }, include: { assets: true } });
  return res.status(201).json({ creativeJob: updatedJob, candidates: createdAssets, publishBlockers: CREATIVE_PUBLISH_BLOCKERS });
});

creativeRouter.post("/v1/vendor/creative-jobs/:jobId/candidates/upload", requireCreativeUploadRole as any, uploadCreativeCandidateFiles, async (req: VendorRequest, res) => {
  const auth = uploadAuth(req);

  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "creative job id is required" });

  const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
  if (files.length === 0) return res.status(400).json({ error: "at least one file is required" });

  const creativeJob = await prisma.creativeJob.findFirst({
    where: { id: jobId, vendorId: auth.vendorId },
    include: { assets: true },
  });
  if (!creativeJob) return res.status(404).json({ error: "Creative job not found" });

  const appUrl = String(process.env.APP_URL ?? "").trim();
  const notes = String(req.body?.notes ?? "").trim();
  const existingManualCount = creativeJob.assets.filter((asset) => {
    const metadata = asset.metadata as any;
    return metadata?.providerMode === "manual_gpt_image_2";
  }).length;

  try {
    const stored = await Promise.all(files.map((file) => persistCreativeCandidateImage({
      fileBuffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      creativeJobId: creativeJob.id,
      vendorId: auth.vendorId,
      publicBaseUrl: appUrl || undefined,
    })));

    const createdAssets = await prisma.$transaction(stored.map((storedImage, index) => {
      const assetDraft = createManualCreativeCandidateAsset({
        creativeJobId: creativeJob.id,
        vendorId: auth.vendorId,
        packId: creativeJob.packId,
        candidate: {
          imageUrl: storedImage.publicUrl,
          title: `GPT Image 2 uploaded candidate ${existingManualCount + index + 1}`,
          width: storedImage.width ?? undefined,
          height: storedImage.height ?? undefined,
          notes,
        },
        candidateIndex: existingManualCount + index + 1,
        actorUserId: auth.actorUserId,
      });
      return prisma.creativeAsset.create({
        data: {
          vendorId: auth.vendorId,
          creativeJobId: creativeJob.id,
          status: "PRIVATE_DRAFT",
          title: assetDraft.title,
          imageUrl: assetDraft.imageUrl,
          targetUrl: assetDraft.targetUrl,
          contentHash: storedImage.contentHash,
          width: assetDraft.width,
          height: assetDraft.height,
          metadata: {
            ...assetDraft.metadata,
            storage: {
              storageRoot: storedImage.storageRoot,
              relativeUrl: storedImage.relativeUrl,
              absolutePath: storedImage.absolutePath,
              format: storedImage.format,
              bytesUploaded: storedImage.bytesUploaded,
              originalName: storedImage.originalName,
              mimeType: storedImage.mimeType,
            },
          } as Prisma.InputJsonObject,
        },
      });
    }));

    const updatedJob = await prisma.creativeJob.findUnique({ where: { id: creativeJob.id }, include: { assets: true } });
    return res.status(201).json({ creativeJob: updatedJob, candidates: createdAssets, publishBlockers: CREATIVE_PUBLISH_BLOCKERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to store creative candidate image";
    return res.status(400).json({ error: message });
  }
});

creativeRouter.post("/v1/vendor/creative-assets/:assetId/review", async (req: VendorRequest, res) => {
  const auth = await requireCreativeRole(req, res);
  if (!auth) return;

  const assetId = String(req.params.assetId || "").trim();
  if (!assetId) return res.status(400).json({ error: "creative asset id is required" });

  const parsed = reviewCreativeAssetSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const asset = await prisma.creativeAsset.findFirst({
    where: { id: assetId, vendorId: auth.vendorId, status: "PRIVATE_DRAFT" },
    include: { creativeJob: true },
  });
  if (!asset) return res.status(404).json({ error: "Private creative asset not found" });

  const metadata = markCreativeCandidateReviewed(asset.metadata, parsed.data.reviewStatus, parsed.data.reviewNotes, auth.actorUserId);
  const updatedAsset = await prisma.creativeAsset.update({
    where: { id: asset.id },
    data: {
      status: parsed.data.reviewStatus === "REJECTED" ? "REJECTED" : "PRIVATE_DRAFT",
      metadata: metadata as Prisma.InputJsonObject,
    },
  });

  if (parsed.data.reviewStatus === "APPROVED_PRIVATE") {
    await prisma.creativeJob.update({
      where: { id: asset.creativeJobId },
      data: { status: "PUBLISH_BLOCKED", errorMessage: CREATIVE_PUBLISH_BLOCKERS.join(",") },
    });
  }

  return res.json({ asset: updatedAsset, publishBlockers: CREATIVE_PUBLISH_BLOCKERS });
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
