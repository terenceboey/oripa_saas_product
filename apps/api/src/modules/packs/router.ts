import { Router } from "express";
import { createPackSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";

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

packRouter.get("/v1/packs", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const packRows = await prisma.pack.findMany({
    where: { vendorId: req.vendorId, isActive: true },
    include: { prizes: true },
    orderBy: { createdAt: "desc" },
  });

  const packs = packRows.map((pack) => decoratePackWithRates(pack));

  return res.json({ packs });
});

packRouter.get("/v1/packs/:packId", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const packId = String(req.params.packId || "").trim();
  if (!packId) return res.status(400).json({ error: "packId is required" });

  const pack = await prisma.pack.findFirst({
    where: { id: packId, vendorId: req.vendorId, isActive: true },
    include: { prizes: true },
  });

  if (!pack) return res.status(404).json({ error: "Pack not found" });
  return res.json({ pack: decoratePackWithRates(pack) });
});

packRouter.post("/v1/packs", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const parsed = createPackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: req.vendorId } });
  const maxPackItems = settings?.maxPackItems ?? 500;

  let prizeRows: CreatePrizeRow[] = [];

  if (parsed.data.tiers && parsed.data.tiers.length > 0) {
    const tiers = parsed.data.tiers;
    const itemCount = tiers.reduce((sum, tier) => sum + tier.items.length, 0);
    if (itemCount > maxPackItems) {
      return res.status(400).json({ error: `vendor limit exceeded: max ${maxPackItems} items allowed in one draw pool` });
    }

    const tiersWithPercent = tiers.filter((tier) => typeof tier.percentage === "number");
    const fixedPercentTotal = tiersWithPercent.reduce((sum, tier) => sum + (tier.percentage ?? 0), 0);
    if (fixedPercentTotal > 100) {
      return res.status(400).json({ error: "Tier percentages exceed 100%" });
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
  } else if (parsed.data.prizes && parsed.data.prizes.length > 0) {
    const prizeCount = parsed.data.prizes.length;
    if (prizeCount > maxPackItems) {
      return res.status(400).json({ error: `vendor limit exceeded: max ${maxPackItems} items allowed in one draw pool` });
    }
    prizeRows = parsed.data.prizes.map((prize) => ({
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
        estimatedValue: 1000
      },
      {
        label: "B Tier - Mid",
        imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
        weight: 50,
        stock: 10,
        remainingStock: 10,
        estimatedValue: 250
      },
      {
        label: "C Tier - Base",
        imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
        weight: 200,
        stock: 100,
        remainingStock: 100,
        estimatedValue: 50
      }
    ];
  }

  if (prizeRows.length > maxPackItems) {
    return res.status(400).json({ error: `vendor limit exceeded: max ${maxPackItems} items allowed in one draw pool` });
  }

  const pack = await prisma.pack.create({
    data: {
      vendorId: req.vendorId,
      title: parsed.data.title,
      pricePoints: parsed.data.pricePoints,
      totalStock: parsed.data.totalStock,
      remainingStock: parsed.data.totalStock,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      isNew: parsed.data.isNew,
      limitedLabel: parsed.data.limitedLabel,
      prizes: {
        createMany: {
          data: prizeRows
        }
      }
    },
    include: { prizes: true }
  });

  return res.status(201).json({ pack });
});






