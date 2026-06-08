import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireVendorAccess } from "../../lib/rbac";
import { VendorRequest } from "../../middleware/vendor";
import {
  PackTemplatePublishError,
  assertTemplateVersionSlotsEditable,
  buildPackCreateDataFromTemplateVersion,
  packTemplatePublishErrorResponse,
} from "./templates";
import {
  PackInventoryAllocationError,
  packInventoryAllocationErrorResponse,
  reserveInventoryForPackPublish,
} from "./inventory-allocation";

export const packTemplateRouter = Router();

const templateCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
});

const versionCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  pricePoints: z.number().int().positive(),
  totalStock: z.number().int().positive(),
  isNew: z.boolean().optional().default(true),
  limitedLabel: z.string().trim().min(2).max(80).optional().nullable(),
  importantNotes: z.string().trim().max(2000).optional().nullable(),
  drawLimitMode: z.enum(["NONE", "ONCE_PER_CUSTOMER", "DAILY_RESET"]).optional().default("NONE"),
  drawLimitValue: z.number().int().positive().optional().nullable(),
  drawLimitResetTimezone: z.string().trim().max(80).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

const slotSchema = z.object({
  sortOrder: z.number().int().min(0).optional().default(0),
  label: z.string().trim().min(1).max(120),
  imageUrl: z.string().url().optional().nullable(),
  imageLargeUrl: z.string().url().optional().nullable(),
  setId: z.string().trim().max(120).optional().nullable(),
  setName: z.string().trim().max(160).optional().nullable(),
  localId: z.string().trim().max(80).optional().nullable(),
  cardNumber: z.string().trim().max(80).optional().nullable(),
  rarity: z.string().trim().max(120).optional().nullable(),
  catalogItemId: z.string().trim().max(120).optional().nullable(),
  catalogSource: z.string().trim().max(80).optional().nullable(),
  catalogSourceItemId: z.string().trim().max(160).optional().nullable(),
  catalogSnapshot: z.unknown().optional().nullable(),
  estimatedValue: z.number().int().nonnegative(),
  weight: z.number().int().positive(),
  stock: z.number().int().positive(),
});

const slotsUpdateSchema = z.object({
  slots: z.array(slotSchema).min(1).max(5000),
});

async function requireTemplateRole(req: VendorRequest, res: any, allowStaffReadOnly = false) {
  return requireVendorAccess(req, res, allowStaffReadOnly ? ["OWNER", "MANAGER", "STAFF"] : ["OWNER", "MANAGER"]);
}

function routeParam(value: unknown) {
  return String(value || "").trim();
}

function optionalIdempotencyKey(req: VendorRequest) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const bodyIdempotencyKey = typeof body.publishIdempotencyKey === "string" ? body.publishIdempotencyKey : undefined;
  const headerIdempotencyKey = typeof req.headers["x-idempotency-key"] === "string" ? req.headers["x-idempotency-key"] : undefined;
  return (headerIdempotencyKey ?? bodyIdempotencyKey ?? "").trim() || null;
}

function nullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function slotCreateManyData(templateVersionId: string, slots: z.infer<typeof slotsUpdateSchema>["slots"]) {
  return slots.map((slot, index) => ({
    templateVersionId,
    sortOrder: slot.sortOrder ?? index,
    label: slot.label,
    imageUrl: slot.imageUrl ?? null,
    imageLargeUrl: slot.imageLargeUrl ?? null,
    setId: slot.setId ?? null,
    setName: slot.setName ?? null,
    localId: slot.localId ?? null,
    cardNumber: slot.cardNumber ?? null,
    rarity: slot.rarity ?? null,
    catalogItemId: slot.catalogItemId ?? null,
    catalogSource: slot.catalogSource ?? null,
    catalogSourceItemId: slot.catalogSourceItemId ?? null,
    catalogSnapshot: nullableJson(slot.catalogSnapshot),
    estimatedValue: slot.estimatedValue,
    weight: slot.weight,
    stock: slot.stock,
  }));
}

const versionInclude = {
  slots: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] },
};

packTemplateRouter.get("/v1/vendor/templates", async (req: VendorRequest, res) => {
  const auth = await requireTemplateRole(req, res, true);
  if (!auth) return;

  const templates = await prisma.packTemplate.findMany({
    where: { vendorId: auth.vendorId, isActive: true },
    include: { versions: { orderBy: { version: "desc" }, include: versionInclude } },
    orderBy: { updatedAt: "desc" },
  });
  return res.json({ templates });
});

packTemplateRouter.post("/v1/vendor/templates", async (req: VendorRequest, res) => {
  const auth = await requireTemplateRole(req, res);
  if (!auth) return;

  const parsed = templateCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

  const template = await prisma.packTemplate.create({
    data: {
      vendorId: auth.vendorId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    },
    include: { versions: true },
  });
  return res.status(201).json({ template });
});

packTemplateRouter.get("/v1/vendor/templates/:templateId", async (req: VendorRequest, res) => {
  const auth = await requireTemplateRole(req, res, true);
  if (!auth) return;
  const templateId = routeParam(req.params.templateId);
  if (!templateId) return res.status(400).json({ error: "templateId is required" });

  const template = await prisma.packTemplate.findFirst({
    where: { id: templateId, vendorId: auth.vendorId, isActive: true },
    include: { versions: { orderBy: { version: "desc" }, include: versionInclude } },
  });
  if (!template) return res.status(404).json({ error: "Template not found" });
  return res.json({ template });
});

packTemplateRouter.post("/v1/vendor/templates/:templateId/versions", async (req: VendorRequest, res) => {
  const auth = await requireTemplateRole(req, res);
  if (!auth) return;
  const templateId = routeParam(req.params.templateId);
  if (!templateId) return res.status(400).json({ error: "templateId is required" });

  const parsed = versionCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

  const template = await prisma.packTemplate.findFirst({ where: { id: templateId, vendorId: auth.vendorId, isActive: true } });
  if (!template) return res.status(404).json({ error: "Template not found" });

  const latest = await prisma.packTemplateVersion.findFirst({
    where: { templateId, vendorId: auth.vendorId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = await prisma.packTemplateVersion.create({
    data: {
      templateId,
      vendorId: auth.vendorId,
      version: (latest?.version ?? 0) + 1,
      title: parsed.data.title,
      pricePoints: parsed.data.pricePoints,
      totalStock: parsed.data.totalStock,
      isNew: parsed.data.isNew,
      limitedLabel: parsed.data.limitedLabel ?? null,
      importantNotes: parsed.data.importantNotes ?? null,
      drawLimitMode: parsed.data.drawLimitMode,
      drawLimitValue: parsed.data.drawLimitValue ?? null,
      drawLimitResetTimezone: parsed.data.drawLimitResetTimezone ?? null,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    },
    include: versionInclude,
  });
  return res.status(201).json({ version });
});

packTemplateRouter.patch("/v1/vendor/templates/:templateId/versions/:versionId/slots", async (req: VendorRequest, res) => {
  const auth = await requireTemplateRole(req, res);
  if (!auth) return;
  const templateId = routeParam(req.params.templateId);
  const versionId = routeParam(req.params.versionId);
  if (!templateId) return res.status(400).json({ error: "templateId is required" });
  if (!versionId) return res.status(400).json({ error: "versionId is required" });

  const parsed = slotsUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });

  const version = await prisma.packTemplateVersion.findFirst({
    where: { id: versionId, templateId, vendorId: auth.vendorId },
    select: { id: true, status: true },
  });
  if (!version) return res.status(404).json({ error: "Template version not found" });
  try {
    assertTemplateVersionSlotsEditable(version);
  } catch {
    return res.status(409).json({
      error: "Template version is immutable",
      message: "Published or archived template versions cannot have their slots edited.",
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.packTemplateSlot.deleteMany({ where: { templateVersionId: versionId } });
    await tx.packTemplateSlot.createMany({ data: slotCreateManyData(versionId, parsed.data.slots) });
    return tx.packTemplateVersion.findUniqueOrThrow({ where: { id: versionId }, include: versionInclude });
  });

  return res.json({ version: updated });
});

packTemplateRouter.post("/v1/vendor/templates/:templateId/versions/:versionId/publish", async (req: VendorRequest, res) => {
  const auth = await requireTemplateRole(req, res);
  if (!auth) return;
  const templateId = routeParam(req.params.templateId);
  const versionId = routeParam(req.params.versionId);
  if (!templateId) return res.status(400).json({ error: "templateId is required" });
  if (!versionId) return res.status(400).json({ error: "versionId is required" });

  const idempotencyKey = optionalIdempotencyKey(req);

  if (idempotencyKey) {
    const existingPack = await prisma.pack.findFirst({
      where: {
        vendorId: auth.vendorId,
        sourceTemplateType: "VENDOR_TEMPLATE",
        sourceTemplateVersionId: versionId,
        publishIdempotencyKey: idempotencyKey,
        isActive: true,
      },
      include: { prizes: true },
    });
    if (existingPack) return res.json({ pack: existingPack, published: false, idempotent: true });
  }

  const version = await prisma.packTemplateVersion.findFirst({
    where: { id: versionId, templateId, vendorId: auth.vendorId },
    include: versionInclude,
  });
  if (!version) return res.status(404).json({ error: "Template version not found" });
  if (version.status !== "DRAFT") {
    return res.status(409).json({
      error: "Template version already published",
      message: "Create a new draft version to publish another frozen pack snapshot.",
    });
  }

  try {
    const publishData = buildPackCreateDataFromTemplateVersion(version, {
      actorUserId: auth.actorUserId,
      now: new Date(),
      idempotencyKey,
    });

    const pack = await prisma.$transaction(async (tx) => {
      const createdPack = await tx.pack.create({ data: publishData, include: { prizes: true } });

      if (createdPack.pricePoints > 0) {
        await reserveInventoryForPackPublish(tx, {
          vendorId: auth.vendorId,
          packId: createdPack.id,
          prizes: createdPack.prizes,
          now: new Date(),
        });
      }

      await tx.packTemplateVersion.update({ where: { id: versionId }, data: { status: "PUBLISHED" } });
      await tx.packTemplate.update({ where: { id: templateId }, data: { activeVersionId: versionId } });

      return tx.pack.findUniqueOrThrow({ where: { id: createdPack.id }, include: { prizes: true } });
    });

    return res.status(201).json({ pack, published: true, idempotent: false });
  } catch (error) {
    if (error instanceof PackTemplatePublishError) {
      return res.status(400).json(packTemplatePublishErrorResponse(error.reason));
    }
    if (error instanceof PackInventoryAllocationError) {
      const status = error.reason === "concurrent_inventory_conflict" ? 409 : 400;
      return res.status(status).json(packInventoryAllocationErrorResponse(error.reason));
    }
    throw error;
  }
});
