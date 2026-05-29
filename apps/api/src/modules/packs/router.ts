import { Router } from "express";
import { createPackSchema, updatePackSchema } from "@oripa/shared";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { getRequestUserId, getVendorMembershipRole, hasRole } from "../../lib/rbac";

export const packRouter = Router();
const csvUpload = multer({
  storage: multer.memoryStorage(),
  // CSV is text-only; keep this strict to prevent oversized uploads.
  limits: { fileSize: 512 * 1024, files: 1 },
});
const uploadCsvSingle = csvUpload.single("file") as any;
const DEFAULT_POKEMON_CARD_IMAGE = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const DEFAULT_PACK_BANNER_IMAGE = "/default-pack-banner-desktop.webp";

type CreatePrizeRow = {
  label: string;
  imageUrl: string;
  weight: number;
  stock: number;
  remainingStock: number;
  estimatedValue: number;
};

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
  sourceItemId?: string;
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
    const sourceItemId = pickField(normalized, ["source_item_id"]) || undefined;
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
      sourceItemId,
      imageUrl,
      game,
    } as CsvImportRow;
  });
}

async function resolveCatalogItemForRow(
  row: CsvImportRow,
  cache: Map<string, { imageLargeUrl: string | null; imageThumbUrl: string | null; imageBaseUrl: string | null } | null>
) {
  const key = JSON.stringify({
    catalogItemId: row.catalogItemId,
    sourceItemId: row.sourceItemId,
    setId: row.setId,
    cardNumber: row.cardNumber,
    itemLabel: row.itemLabel,
    game: row.game,
  });
  if (cache.has(key)) return cache.get(key) ?? null;

  let found = null as { imageLargeUrl: string | null; imageThumbUrl: string | null; imageBaseUrl: string | null } | null;
  if (row.catalogItemId) {
    found = await prisma.catalogItem.findUnique({
      where: { id: row.catalogItemId },
      select: { imageLargeUrl: true, imageThumbUrl: true, imageBaseUrl: true },
    });
  }

  if (!found && row.sourceItemId) {
    found = await prisma.catalogItem.findFirst({
      where: { source: "tcgtracking", sourceItemId: row.sourceItemId, game: row.game, isActive: true },
      select: { imageLargeUrl: true, imageThumbUrl: true, imageBaseUrl: true },
    });
  }

  if (!found && row.setId && row.cardNumber) {
    found = await prisma.catalogItem.findFirst({
      where: { game: row.game, setId: row.setId, cardNumber: row.cardNumber, isActive: true },
      select: { imageLargeUrl: true, imageThumbUrl: true, imageBaseUrl: true },
    });
  }

  if (!found && row.setId) {
    found = await prisma.catalogItem.findFirst({
      where: { game: row.game, setId: row.setId, name: { equals: row.itemLabel, mode: "insensitive" }, isActive: true },
      select: { imageLargeUrl: true, imageThumbUrl: true, imageBaseUrl: true },
    });
  }

  if (!found) {
    found = await prisma.catalogItem.findFirst({
      where: { game: row.game, name: { equals: row.itemLabel, mode: "insensitive" }, isActive: true },
      select: { imageLargeUrl: true, imageThumbUrl: true, imageBaseUrl: true },
    });
  }

  cache.set(key, found);
  return found;
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

function buildPrizeRows(data: {
  tiers?: Array<{
    name: string;
    percentage?: number;
    items: Array<{ label: string; estimatedValue: number; stock: number; imageUrl?: string }>;
  }>;
  prizes?: Array<{ label: string; imageUrl?: string; weight: number; stock: number; estimatedValue: number }>;
}) {
  let prizeRows: CreatePrizeRow[] = [];

  if (data.tiers && data.tiers.length > 0) {
    const tiers = data.tiers;

    const tiersWithPercent = tiers.filter((tier) => typeof tier.percentage === "number");
    const fixedPercentTotal = tiersWithPercent.reduce((sum, tier) => sum + (tier.percentage ?? 0), 0);
    if (fixedPercentTotal > 100) {
      throw new Error("Tier percentages exceed 100%");
    }

    const tiersWithoutPercent = tiers.filter((tier) => typeof tier.percentage !== "number");
    const remainingPercent = Math.max(0, 100 - fixedPercentTotal);
    const fallbackTierPercent = tiersWithoutPercent.length > 0 ? remainingPercent / tiersWithoutPercent.length : 0;

    for (const tier of tiers) {
      const tierPercent = tier.percentage ?? fallbackTierPercent;
      const perItemPercent = tier.items.length > 0 ? tierPercent / tier.items.length : 0;
      const itemWeight = Math.max(1, Math.round(perItemPercent * 100));

      for (const item of tier.items) {
        prizeRows.push({
          label: `${tier.name} - ${item.label}`,
          imageUrl: item.imageUrl ?? DEFAULT_POKEMON_CARD_IMAGE,
          weight: itemWeight,
          stock: item.stock,
          remainingStock: item.stock,
          estimatedValue: item.estimatedValue,
        });
      }
    }
  } else if (data.prizes && data.prizes.length > 0) {
    prizeRows = data.prizes.map((prize) => ({
      label: prize.label,
      imageUrl: prize.imageUrl ?? DEFAULT_POKEMON_CARD_IMAGE,
      weight: prize.weight,
      stock: prize.stock,
      remainingStock: prize.stock,
      estimatedValue: prize.estimatedValue,
    }));
  } else {
    prizeRows = [
      {
        label: "A Tier - Chase",
        imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
        weight: 10,
        stock: 1,
        remainingStock: 1,
        estimatedValue: 1000,
      },
      {
        label: "B Tier - Mid",
        imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
        weight: 50,
        stock: 10,
        remainingStock: 10,
        estimatedValue: 250,
      },
      {
        label: "C Tier - Base",
        imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
        weight: 200,
        stock: 100,
        remainingStock: 100,
        estimatedValue: 50,
      },
    ];
  }

  return prizeRows;
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

  const tierMap = new Map<string, { name: string; percentage?: number; items: Array<{ label: string; estimatedValue: number; stock: number; imageUrl: string }> }>();
  const unmatchedRows: Array<{ rowNumber: number; itemLabel: string; setId?: string; cardNumber?: string; reason: string }> = [];
  const cache = new Map<string, { imageLargeUrl: string | null; imageThumbUrl: string | null; imageBaseUrl: string | null } | null>();
  let matchedCount = 0;

  for (const row of rows) {
    const found = row.imageUrl ? null : await resolveCatalogItemForRow(row, cache);
    const imageUrl = row.imageUrl || found?.imageLargeUrl || found?.imageThumbUrl || found?.imageBaseUrl || DEFAULT_POKEMON_CARD_IMAGE;
    if (!row.imageUrl && !found) {
      unmatchedRows.push({
        rowNumber: row.rowNumber,
        itemLabel: row.itemLabel,
        setId: row.setId,
        cardNumber: row.cardNumber,
        reason: "No exact catalog match found. Using default image.",
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
    });
    tierMap.set(row.tierName, currentTier);
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
      optionalHeaders: ["tier_percentage", "set_id", "card_number", "catalog_item_id", "source_item_id", "image_url", "game"],
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

  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
  const maxPackItems = settings?.maxPackItems ?? 50;
  const maxPackTiers = settings?.maxPackTiers ?? 5;

  const tierCount = parsed.data.tiers?.length ?? 0;
  if (tierCount > maxPackTiers) {
    return res.status(400).json({ error: `plan limit exceeded: max ${maxPackTiers} tiers` });
  }

  const prizeRows = buildPrizeRows(parsed.data);

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
          data: prizeRows,
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

  const existing = await prisma.pack.findFirst({ where: { id: packId, vendorId: auth.vendorId, isActive: true } });
  if (!existing) return res.status(404).json({ error: "Pack not found" });

  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
  const maxPackItems = settings?.maxPackItems ?? 50;
  const maxPackTiers = settings?.maxPackTiers ?? 5;

  let replacementPrizeRows: CreatePrizeRow[] | null = null;

  if ((parsed.data.tiers && parsed.data.tiers.length > 0) || (parsed.data.prizes && parsed.data.prizes.length > 0)) {
    const tierCount = parsed.data.tiers?.length ?? 0;
    if (tierCount > maxPackTiers) {
      return res.status(400).json({ error: `plan limit exceeded: max ${maxPackTiers} tiers` });
    }
    replacementPrizeRows = buildPrizeRows(parsed.data);
    if (replacementPrizeRows.length > maxPackItems) {
      return res.status(400).json({ error: `vendor limit exceeded: max ${maxPackItems} items allowed in one draw pool` });
    }
  }

  const updatedPack = await prisma.$transaction(async (tx) => {
    if (replacementPrizeRows) {
      await tx.packPrize.deleteMany({ where: { packId: existing.id } });
      await tx.packPrize.createMany({
        data: replacementPrizeRows.map((row) => ({
          packId: existing.id,
          label: row.label,
          imageUrl: row.imageUrl,
          weight: row.weight,
          stock: row.stock,
          remainingStock: row.stock,
          estimatedValue: row.estimatedValue,
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

  return res.json({ pack: decoratePackWithRates(updatedPack) });
});

packRouter.patch("/v1/vendor/packs/:packId/archive", async (req: VendorRequest, res) => {
  const auth = await requirePackRole(req, res);
  if (!auth) return;
  const packId = String(req.params.packId || "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });

  const pack = await prisma.pack.findFirst({ where: { id: packId, vendorId: auth.vendorId, isActive: true } });
  if (!pack) return res.status(404).json({ error: "Pack not found" });

  const updated = await prisma.pack.update({
    where: { id: packId },
    data: { status: "ARCHIVED" },
    include: { prizes: true },
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
    const retired = await prisma.pack.update({
      where: { id: packId },
      data: { status: "ARCHIVED", isActive: false },
      include: { prizes: true },
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
      const retired = await prisma.pack.update({
        where: { id: packId },
        data: { status: "ARCHIVED", isActive: false },
        include: { prizes: true },
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
