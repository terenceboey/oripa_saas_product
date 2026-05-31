import { Router } from "express";
import { createPackSchema, updatePackSchema } from "@oripa/shared";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { getRequestUserId, getVendorMembershipRole, hasRole } from "../../lib/rbac";
import {
  CatalogPrizeResolutionError,
  resolvePackPrizeRows,
  type CatalogItemLookup,
  type CatalogItemSnapshotSource,
  type ResolvedPackPrizeRow,
} from "./prize-snapshots";
import { packPrizeMutationErrorResponse, shouldRejectPackPrizeMutation } from "./immutability";
import {
  PackPublishFreezeError,
  publishFreezeErrorResponse,
  resolvePublishFreezeData,
} from "./pool-snapshot";
import {
  PackInventoryAllocationError,
  packInventoryAllocationErrorResponse,
  releaseHeldInventoryForPack,
  reserveInventoryForPackPublish,
} from "./inventory-allocation";

export const packRouter = Router();
const csvUpload = multer({
  storage: multer.memoryStorage(),
  // CSV is text-only; keep this strict to prevent oversized uploads.
  limits: { fileSize: 512 * 1024, files: 1 },
});
const uploadCsvSingle = csvUpload.single("file") as any;
const DEFAULT_POKEMON_CARD_IMAGE = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const DEFAULT_PACK_BANNER_IMAGE = "/default-pack-banner-desktop.webp";

type CreatePrizeRow = ResolvedPackPrizeRow;

const catalogItemSelect = {
  id: true,
  source: true,
  sourceItemId: true,
  itemType: true,
  game: true,
  language: true,
  name: true,
  setId: true,
  setName: true,
  localId: true,
  cardNumber: true,
  rarity: true,
  imageBaseUrl: true,
  imageThumbUrl: true,
  imageLargeUrl: true,
} as const;

const prismaCatalogLookup: CatalogItemLookup = {
  async findCatalogItemsByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.catalogItem.findMany({ where: { id: { in: ids }, isActive: true }, select: catalogItemSelect });
  },
  async findCatalogItemBySourceRef(ref: { source: string; sourceItemId: string; language?: string }) {
    return prisma.catalogItem.findFirst({
      where: { source: ref.source, sourceItemId: ref.sourceItemId, language: ref.language ?? "en", isActive: true },
      select: catalogItemSelect,
    });
  },
};

const packPrizeCreateData = (row: CreatePrizeRow) => ({
  label: row.label,
  imageUrl: row.imageUrl,
  imageLargeUrl: row.imageLargeUrl,
  setId: row.setId,
  setName: row.setName,
  localId: row.localId,
  cardNumber: row.cardNumber,
  rarity: row.rarity,
  catalogItemId: row.catalogItemId,
  catalogSource: row.catalogSource,
  catalogSourceItemId: row.catalogSourceItemId,
  ...(row.catalogSnapshot ? { catalogSnapshot: row.catalogSnapshot as Prisma.InputJsonValue } : {}),
  weight: row.weight,
  stock: row.stock,
  remainingStock: row.remainingStock,
  estimatedValue: row.estimatedValue,
});

type CsvImportRow = {
  rowNumber: number;
  tierName: string;
  tierPercentage?: number;
  itemLabel: string;
  estimatedValue: number;
  stock: number;
  setId?: string;
  cardNumber?: string;
  catalogItemId?: string;
  catalogSource?: string;
  sourceItemId?: string;
  language?: string;
  imageUrl?: string;
  game: string;
};

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function pickField(record: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (record[key] !== undefined) return String(record[key] ?? "").trim();
  }
  return "";
}

function toOptionalPositiveNumber(value: string) {
  if (!value) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num;
}

function parseCsvRows(fileBuffer: Buffer) {
  const raw = parse(fileBuffer, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return raw.map((row, index) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }

    const tierName = pickField(normalized, ["tier_name", "tier"]);
    const itemLabel = pickField(normalized, ["item_label", "item_name", "name"]);
    const estimatedValue = Number(pickField(normalized, ["estimated_value", "est_value", "value"]));
    const stock = Number(pickField(normalized, ["stock", "qty", "quantity"]));
    const tierPercentage = toOptionalPositiveNumber(pickField(normalized, ["tier_percentage", "percentage", "rate"]));
    const setId = pickField(normalized, ["set_id", "set"]) || undefined;
    const cardNumber = pickField(normalized, ["card_number", "number"]) || undefined;
    const catalogItemId = pickField(normalized, ["catalog_item_id"]) || undefined;
    const catalogSource = pickField(normalized, ["catalog_source", "source"]) || undefined;
    const sourceItemId = pickField(normalized, ["source_item_id"]) || undefined;
    const language = pickField(normalized, ["language", "lang"]) || undefined;
    const imageUrl = pickField(normalized, ["image_url"]) || undefined;
    const game = (pickField(normalized, ["game"]) || "POKEMON").toUpperCase();

    return {
      rowNumber: index + 2,
      tierName,
      tierPercentage,
      itemLabel,
      estimatedValue,
      stock,
      setId,
      cardNumber,
      catalogItemId,
      catalogSource: catalogSource || (sourceItemId ? "tcgtracking" : undefined),
      sourceItemId,
      language: language || undefined,
      imageUrl,
      game,
    } as CsvImportRow;
  });
}

async function resolveCatalogItemForRow(
  row: CsvImportRow,
  cache: Map<string, CatalogItemSnapshotSource | null>
): Promise<{ item: CatalogItemSnapshotSource | null; error?: string }> {
  const key = JSON.stringify({
    catalogItemId: row.catalogItemId,
    catalogSource: row.catalogSource,
    sourceItemId: row.sourceItemId,
    language: row.language,
    setId: row.setId,
    cardNumber: row.cardNumber,
    itemLabel: row.itemLabel,
    game: row.game,
  });
  if (cache.has(key)) return { item: cache.get(key) ?? null };

  let byCatalogId: CatalogItemSnapshotSource | null = null;
  if (row.catalogItemId) {
    byCatalogId = await prisma.catalogItem.findUnique({
      where: { id: row.catalogItemId },
      select: catalogItemSelect,
    });
    if (!byCatalogId) {
      return { item: null, error: `Catalog item not found: ${row.catalogItemId}` };
    }
  }

  let bySourceRef: CatalogItemSnapshotSource | null = null;
  if (row.sourceItemId) {
    const catalogSource = row.catalogSource ?? "tcgtracking";
    bySourceRef = await prisma.catalogItem.findFirst({
      where: {
        source: catalogSource,
        sourceItemId: row.sourceItemId,
        language: row.language ?? "en",
        isActive: true,
      },
      select: catalogItemSelect,
    });
    if (!bySourceRef) {
      return { item: null, error: `Catalog item not found: ${catalogSource}/${row.sourceItemId}/${row.language ?? "en"}` };
    }
  }

  if (byCatalogId && bySourceRef && byCatalogId.id !== bySourceRef.id) {
    return {
      item: null,
      error: `catalog_item_id ${row.catalogItemId} conflicts with ${row.catalogSource ?? "tcgtracking"}/${row.sourceItemId}/${row.language ?? "en"}`,
    };
  }

  let found = byCatalogId ?? bySourceRef;

  if (!found && row.setId && row.cardNumber) {
    found = await prisma.catalogItem.findFirst({
      where: { game: row.game, setId: row.setId, cardNumber: row.cardNumber, isActive: true },
      select: catalogItemSelect,
    });
  }

  if (!found && row.setId) {
    found = await prisma.catalogItem.findFirst({
      where: { game: row.game, setId: row.setId, name: { equals: row.itemLabel, mode: "insensitive" }, isActive: true },
      select: catalogItemSelect,
    });
  }

  if (!found) {
    found = await prisma.catalogItem.findFirst({
      where: { game: row.game, name: { equals: row.itemLabel, mode: "insensitive" }, isActive: true },
      select: catalogItemSelect,
    });
  }

  cache.set(key, found);
  return { item: found };
}

function decoratePackWithRates(pack: { prizes: Array<{ weight: number }> } & Record<string, unknown>) {
  const totalWeight = pack.prizes.reduce((sum, prize) => sum + prize.weight, 0);
  return {
    ...pack,
    prizes: pack.prizes.map((prize) => ({
      ...prize,
      dropRatePercent: totalWeight > 0 ? Number(((prize.weight / totalWeight) * 100).toFixed(4)) : 0,
    })),
  };
}

async function buildPrizeRows(data: {
  tiers?: Array<{
    name: string;
    percentage?: number;
    items: Array<{
      label: string;
      estimatedValue: number;
      stock: number;
      imageUrl?: string;
      catalogItemId?: string;
      catalogSource?: string;
      catalogSourceItemId?: string;
      language?: string;
    }>;
  }>;
  prizes?: Array<{
    label: string;
    imageUrl?: string;
    weight: number;
    stock: number;
    estimatedValue: number;
    catalogItemId?: string;
    catalogSource?: string;
    catalogSourceItemId?: string;
    language?: string;
  }>;
}) {
  return resolvePackPrizeRows(data, prismaCatalogLookup);
}

function catalogPrizeResolutionResponse(error: unknown) {
  if (!(error instanceof CatalogPrizeResolutionError)) return null;
  return {
    error: "Invalid catalog prize reference",
    message: error.message,
  };
}

async function requirePackRole(req: VendorRequest, res: any, allowStaffReadOnly = false) {
  if (!req.vendorId) {
    res.status(400).json({ error: "Vendor not resolved" });
    return null;
  }
  const actorUserId = getRequestUserId(req);
  if (!actorUserId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const role = await getVendorMembershipRole({ vendorId: req.vendorId, userId: actorUserId });
  if (!role) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }
  if (!allowStaffReadOnly && !hasRole(role, ["OWNER", "MANAGER"])) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }
  return { vendorId: req.vendorId, actorUserId, role };
}

packRouter.get("/v1/packs", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const now = new Date();
  const packRows = await prisma.pack.findMany({
    where: {
      vendorId: req.vendorId,
      isActive: true,
      status: "LIVE",
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    include: { prizes: true },
    orderBy: { createdAt: "desc" },
  });

  const packs = packRows.map((pack) => decoratePackWithRates(pack));

  return res.json({ packs });
});

packRouter.get("/v1/vendor/packs", async (req: VendorRequest, res) => {
  const auth = await requirePackRole(req, res, true);
  if (!auth) return;

  const packRows = await prisma.pack.findMany({
    where: { vendorId: auth.vendorId, isActive: true },
    include: { prizes: true },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ packs: packRows.map((pack) => decoratePackWithRates(pack)) });
});

packRouter.get("/v1/packs/:packId", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const packId = String(req.params.packId || "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });

  const pack = await prisma.pack.findFirst({
    where: { id: packId, vendorId: req.vendorId, isActive: true, status: { not: "ARCHIVED" } },
    include: { prizes: true },
  });

  if (!pack) return res.status(404).json({ error: "Pack not found" });
  return res.json({ pack: decoratePackWithRates(pack) });
});

packRouter.post("/v1/vendor/packs/import-csv", uploadCsvSingle, async (req: VendorRequest, res) => {
  const auth = await requirePackRole(req, res);
  if (!auth) return;
  const file = req.file as Express.Multer.File | undefined;
  if (!file?.buffer) return res.status(400).json({ error: "CSV file is required" });

  let rows: CsvImportRow[] = [];
  try {
    rows = parseCsvRows(file.buffer);
  } catch {
    return res.status(400).json({ error: "Failed to parse CSV. Ensure UTF-8 CSV with headers." });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: "CSV is empty" });
  }

  const validationErrors: Array<{ rowNumber: number; message: string }> = [];
  for (const row of rows) {
    if (!row.tierName) validationErrors.push({ rowNumber: row.rowNumber, message: "tier_name is required" });
    if (!row.itemLabel) validationErrors.push({ rowNumber: row.rowNumber, message: "item_label is required" });
    if (!Number.isFinite(row.estimatedValue) || row.estimatedValue < 0) validationErrors.push({ rowNumber: row.rowNumber, message: "estimated_value must be >= 0" });
    if (!Number.isInteger(row.stock) || row.stock <= 0) validationErrors.push({ rowNumber: row.rowNumber, message: "stock must be a positive integer" });
  }
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: "Invalid CSV rows", validationErrors });
  }

  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
  const maxPackItems = settings?.maxPackItems ?? 50;
  const maxPackTiers = settings?.maxPackTiers ?? 5;
  const distinctTierCount = new Set(rows.map((row) => row.tierName)).size;

  if (rows.length > maxPackItems) {
    return res.status(400).json({ error: `vendor limit exceeded: max ${maxPackItems} items allowed` });
  }
  if (distinctTierCount > maxPackTiers) {
    return res.status(400).json({ error: `plan limit exceeded: max ${maxPackTiers} tiers allowed` });
  }

  const tierMap = new Map<
    string,
    {
      name: string;
      percentage?: number;
      items: Array<{
        label: string;
        estimatedValue: number;
        stock: number;
        imageUrl: string;
        catalogItemId?: string;
        catalogSource?: string;
        catalogSourceItemId?: string;
        language?: string;
      }>;
    }
  >();
  const unmatchedRows: Array<{ rowNumber: number; itemLabel: string; setId?: string; cardNumber?: string; reason: string }> = [];
  const cache = new Map<string, CatalogItemSnapshotSource | null>();
  let matchedCount = 0;

  for (const row of rows) {
    const resolved = await resolveCatalogItemForRow(row, cache);
    if (resolved.error) {
      validationErrors.push({ rowNumber: row.rowNumber, message: resolved.error });
      continue;
    }
    const found = resolved.item;
    const imageUrl = found?.imageThumbUrl || found?.imageBaseUrl || found?.imageLargeUrl || row.imageUrl || DEFAULT_POKEMON_CARD_IMAGE;
    if (!found) {
      unmatchedRows.push({
        rowNumber: row.rowNumber,
        itemLabel: row.itemLabel,
        setId: row.setId,
        cardNumber: row.cardNumber,
        reason: row.imageUrl
          ? "No exact catalog match found. Keeping provided image as manual prize."
          : "No exact catalog match found. Using default image.",
      });
    } else {
      matchedCount += 1;
    }

    const currentTier = tierMap.get(row.tierName) ?? {
      name: row.tierName,
      percentage: row.tierPercentage,
      items: [],
    };
    if (typeof currentTier.percentage !== "number" && typeof row.tierPercentage === "number") {
      currentTier.percentage = row.tierPercentage;
    }
    currentTier.items.push({
      label: row.itemLabel,
      estimatedValue: row.estimatedValue,
      stock: row.stock,
      imageUrl,
      ...(found
        ? {
            catalogItemId: found.id,
            catalogSource: found.source,
            catalogSourceItemId: found.sourceItemId,
            language: found.language,
          }
        : {}),
    });
    tierMap.set(row.tierName, currentTier);
  }
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: "Invalid CSV rows", validationErrors });
  }

  const tiers = Array.from(tierMap.values());
  return res.json({
    tiers,
    summary: {
      totalRows: rows.length,
      matchedRows: matchedCount,
      unmatchedRows: unmatchedRows.length,
      tierCount: tiers.length,
    },
    unmatchedRows,
    csvTemplate: {
      requiredHeaders: ["tier_name", "item_label", "estimated_value", "stock"],
      optionalHeaders: [
        "tier_percentage",
        "set_id",
        "card_number",
        "catalog_item_id",
        "catalog_source",
        "source_item_id",
        "language",
        "image_url",
        "game",
      ],
    },
  });
});

async function createVendorPack(req: VendorRequest, res: any) {
  const auth = await requirePackRole(req, res);
  if (!auth) return;

  const parsed = createPackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  if (parsed.data.status === "LIVE") {
    return res.status(400).json({ error: "Use the publish endpoint to freeze and publish packs" });
  }

  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
  const maxPackItems = settings?.maxPackItems ?? 50;
  const maxPackTiers = settings?.maxPackTiers ?? 5;

  const tierCount = parsed.data.tiers?.length ?? 0;
  if (tierCount > maxPackTiers) {
    return res.status(400).json({ error: `plan limit exceeded: max ${maxPackTiers} tiers` });
  }

  let prizeRows: CreatePrizeRow[];
  try {
    prizeRows = await buildPrizeRows(parsed.data);
  } catch (error) {
    const catalogError = catalogPrizeResolutionResponse(error);
    if (catalogError) return res.status(400).json(catalogError);
    throw error;
  }

  if (prizeRows.length > maxPackItems) {
    return res.status(400).json({ error: `vendor limit exceeded: max ${maxPackItems} items allowed in one draw pool` });
  }

  const pack = await prisma.pack.create({
    data: {
      vendorId: auth.vendorId,
      title: parsed.data.title,
      packBannerImageUrl: parsed.data.packBannerImageUrl ?? DEFAULT_PACK_BANNER_IMAGE,
      pricePoints: parsed.data.pricePoints,
      totalStock: parsed.data.totalStock,
      remainingStock: parsed.data.totalStock,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      isNew: parsed.data.isNew,
      limitedLabel: parsed.data.limitedLabel,
      status: parsed.data.status ?? "DRAFT",
      importantNotes: parsed.data.importantNotes,
      drawLimitMode: parsed.data.drawLimitMode ?? "NONE",
      drawLimitValue: parsed.data.drawLimitValue,
      drawLimitResetTimezone: parsed.data.drawLimitResetTimezone,
      prizes: {
        createMany: {
          data: prizeRows.map(packPrizeCreateData),
        },
      },
    },
    include: { prizes: true },
  });

  return res.status(201).json({ pack });
}

packRouter.post("/v1/packs", createVendorPack);
packRouter.post("/v1/vendor/packs", createVendorPack);

packRouter.patch("/v1/vendor/packs/:packId", async (req: VendorRequest, res) => {
  const auth = await requirePackRole(req, res);
  if (!auth) return;
  const packId = String(req.params.packId || "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });

  const parsed = updatePackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const existing = await prisma.pack.findFirst({
    where: { id: packId, vendorId: auth.vendorId, isActive: true, status: { not: "ARCHIVED" } },
  });
  if (!existing) return res.status(404).json({ error: "Pack not found" });

  if (shouldRejectPackPrizeMutation(existing.status, parsed.data)) {
    return res.status(409).json(packPrizeMutationErrorResponse(existing.status));
  }

  if (existing.status === "DRAFT" && parsed.data.status === "LIVE") {
    return res.status(400).json({ error: "Use the publish endpoint to freeze and publish packs" });
  }

  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
  const maxPackItems = settings?.maxPackItems ?? 50;
  const maxPackTiers = settings?.maxPackTiers ?? 5;

  let replacementPrizeRows: CreatePrizeRow[] | null = null;

  if ((parsed.data.tiers && parsed.data.tiers.length > 0) || (parsed.data.prizes && parsed.data.prizes.length > 0)) {
    const tierCount = parsed.data.tiers?.length ?? 0;
    if (tierCount > maxPackTiers) {
      return res.status(400).json({ error: `plan limit exceeded: max ${maxPackTiers} tiers` });
    }
    try {
      replacementPrizeRows = await buildPrizeRows(parsed.data);
    } catch (error) {
      const catalogError = catalogPrizeResolutionResponse(error);
      if (catalogError) return res.status(400).json(catalogError);
      throw error;
    }
    if (replacementPrizeRows.length > maxPackItems) {
      return res.status(400).json({ error: `vendor limit exceeded: max ${maxPackItems} items allowed in one draw pool` });
    }
  }

  let updatedPack;
  try {
    updatedPack = await prisma.$transaction(async (tx) => {
      if (replacementPrizeRows) {
        const committedAllocationCount = await tx.packPrizeInventoryAllocation.count({
          where: { vendorId: auth.vendorId, packId: existing.id, status: "COMMITTED" },
        });
        if (committedAllocationCount > 0) {
          throw new PackInventoryAllocationError(
            "partial_existing_allocation",
            `Pack ${existing.id} has committed inventory allocation rows and cannot replace prizes`
          );
        }
        await releaseHeldInventoryForPack(tx, { vendorId: auth.vendorId, packId: existing.id });
        await tx.packPrize.deleteMany({ where: { packId: existing.id } });
        await tx.packPrize.createMany({
          data: replacementPrizeRows.map((row) => ({
            packId: existing.id,
            ...packPrizeCreateData(row),
          })),
        });
      }

      return tx.pack.update({
        where: { id: existing.id },
        data: {
          title: parsed.data.title,
          packBannerImageUrl: parsed.data.packBannerImageUrl,
          pricePoints: parsed.data.pricePoints,
          totalStock: parsed.data.totalStock,
          remainingStock: parsed.data.totalStock,
          startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
          endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
          isNew: parsed.data.isNew,
          limitedLabel: parsed.data.limitedLabel,
          status: parsed.data.status,
          importantNotes: parsed.data.importantNotes,
          drawLimitMode: parsed.data.drawLimitMode,
          drawLimitValue: parsed.data.drawLimitValue,
          drawLimitResetTimezone: parsed.data.drawLimitResetTimezone,
        },
        include: { prizes: true },
      });
    });
  } catch (error) {
    if (error instanceof PackInventoryAllocationError) {
      const status = error.reason === "concurrent_inventory_conflict" ? 409 : 400;
      return res.status(status).json(packInventoryAllocationErrorResponse(error.reason));
    }
    throw error;
  }

  return res.json({ pack: decoratePackWithRates(updatedPack) });
});

packRouter.patch("/v1/vendor/packs/:packId/publish", async (req: VendorRequest, res) => {
  const auth = await requirePackRole(req, res);
  if (!auth) return;
  const packId = String(req.params.packId || "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const bodyIdempotencyKey = typeof body.publishIdempotencyKey === "string" ? body.publishIdempotencyKey : undefined;
  const headerIdempotencyKey = typeof req.headers["x-idempotency-key"] === "string" ? req.headers["x-idempotency-key"] : undefined;
  const idempotencyKey = (headerIdempotencyKey ?? bodyIdempotencyKey ?? "").trim() || null;

  const pack = await prisma.pack.findFirst({
    where: { id: packId, vendorId: auth.vendorId, isActive: true },
    include: { prizes: true },
  });
  if (!pack) return res.status(404).json({ error: "Pack not found" });

  try {
    const publishData = resolvePublishFreezeData(pack, pack.prizes, {
      actorUserId: auth.actorUserId,
      now: new Date(),
      idempotencyKey,
    });

    if (!publishData) {
      return res.json({ pack: decoratePackWithRates(pack), published: false, idempotent: true });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (pack.pricePoints > 0) {
        await reserveInventoryForPackPublish(tx, {
          vendorId: auth.vendorId,
          packId: pack.id,
          prizes: pack.prizes,
          now: new Date(),
        });
      }

      return tx.pack.update({
        where: { id: pack.id },
        data: publishData,
        include: { prizes: true },
      });
    });

    return res.json({ pack: decoratePackWithRates(updated), published: true, idempotent: false });
  } catch (error) {
    if (error instanceof PackPublishFreezeError) {
      const status = error.reason === "already_published" || error.reason === "pool_hash_mismatch" ? 409 : 400;
      return res.status(status).json(publishFreezeErrorResponse(error.reason));
    }
    if (error instanceof PackInventoryAllocationError) {
      const status = error.reason === "concurrent_inventory_conflict" ? 409 : 400;
      return res.status(status).json(packInventoryAllocationErrorResponse(error.reason));
    }
    throw error;
  }
});

packRouter.patch("/v1/vendor/packs/:packId/archive", async (req: VendorRequest, res) => {
  const auth = await requirePackRole(req, res);
  if (!auth) return;
  const packId = String(req.params.packId || "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });

  const pack = await prisma.pack.findFirst({ where: { id: packId, vendorId: auth.vendorId, isActive: true } });
  if (!pack) return res.status(404).json({ error: "Pack not found" });

  const updated = await prisma.$transaction(async (tx) => {
    await releaseHeldInventoryForPack(tx, { vendorId: auth.vendorId, packId });
    return tx.pack.update({
      where: { id: packId },
      data: { status: "ARCHIVED" },
      include: { prizes: true },
    });
  });

  return res.json({ pack: decoratePackWithRates(updated) });
});

packRouter.delete("/v1/vendor/packs/:packId", async (req: VendorRequest, res) => {
  const auth = await requirePackRole(req, res);
  if (!auth) return;
  const packId = String(req.params.packId || "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });

  const pack = await prisma.pack.findFirst({ where: { id: packId, vendorId: auth.vendorId } });
  if (!pack) return res.status(404).json({ error: "Pack not found" });

  const drawOrderCount = await prisma.drawOrder.count({ where: { packId } });
  if (drawOrderCount > 0) {
    const retired = await prisma.$transaction(async (tx) => {
      await releaseHeldInventoryForPack(tx, { vendorId: auth.vendorId, packId });
      return tx.pack.update({
        where: { id: packId },
        data: { status: "ARCHIVED", isActive: false },
        include: { prizes: true },
      });
    });
    return res.status(200).json({
      mode: "retired",
      message: "Pack has draw history and cannot be hard-deleted. It has been archived and hidden.",
      pack: decoratePackWithRates(retired),
    });
  }

  try {
    await prisma.pack.delete({ where: { id: packId } });
    return res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      const retired = await prisma.$transaction(async (tx) => {
        await releaseHeldInventoryForPack(tx, { vendorId: auth.vendorId, packId });
        return tx.pack.update({
          where: { id: packId },
          data: { status: "ARCHIVED", isActive: false },
          include: { prizes: true },
        });
      });
      return res.status(200).json({
        mode: "retired",
        message: "Pack is referenced by transactions and cannot be hard-deleted. It has been archived and hidden.",
        pack: decoratePackWithRates(retired),
      });
    }
    throw error;
  }
});
