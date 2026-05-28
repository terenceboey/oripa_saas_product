import { Router } from "express";
import { createPackSchema, updatePackSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { getBearerUserId, getVendorMembershipRole, hasRole } from "../../lib/rbac";

export const packRouter = Router();
const DEFAULT_POKEMON_CARD_IMAGE = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";

type CreatePrizeRow = {
  label: string;
  imageUrl: string;
  weight: number;
  stock: number;
  remainingStock: number;
  estimatedValue: number;
};

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
  const actorUserId = getBearerUserId(req.header("authorization") ?? undefined);
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

packRouter.post("/v1/packs", async (req: VendorRequest, res) => {
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
});

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

  await prisma.pack.delete({ where: { id: packId } });
  return res.status(204).send();
});
