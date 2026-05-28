import { Prisma } from "@prisma/client";
import { Router } from "express";
import { drawSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { drawQueue } from "../../queue";
import { TenantRequest } from "../../middleware/tenant";

function pickWeightedPrize(prizes: { id: string; weight: number; remainingStock: number }[]) {
  const available = prizes.filter((p) => p.remainingStock > 0 && p.weight > 0);
  const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);
  if (!available.length || totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  for (const prize of available) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return available[available.length - 1];
}

export const drawRouter = Router();

drawRouter.post("/v1/draws", async (req: TenantRequest, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) return res.status(400).json({ error: "Tenant not resolved" });

  const idemKey = String(req.header("x-idempotency-key") ?? "").trim();
  if (!idemKey) {
    return res.status(400).json({ error: "x-idempotency-key header is required" });
  }

  const parsed = drawSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const { packId, quantity } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyKey.findUnique({ where: { key: idemKey } });
      if (existing?.responseJson) {
        return JSON.parse(existing.responseJson);
      }

      const pack = await tx.pack.findFirst({
        where: { id: packId, tenantId, isActive: true },
      });
      if (!pack) throw new Error("Pack not found or inactive");
      if (pack.remainingStock < quantity) throw new Error("Not enough stock remaining");

      const wallet = await tx.walletAccount.findFirst({ where: { tenantId } });
      if (!wallet) throw new Error("Wallet not found for tenant");

      const totalCost = pack.pricePoints * quantity;
      if (wallet.balancePoints < totalCost) throw new Error("Insufficient balance");

      const prizes = await tx.packPrize.findMany({ where: { packId: pack.id } });
      const draws: { drawId: string; prizeId: string | null }[] = [];

      for (let i = 0; i < quantity; i += 1) {
        const selected = pickWeightedPrize(prizes);

        if (selected) {
          await tx.packPrize.update({
            where: { id: selected.id },
            data: { remainingStock: { decrement: 1 } },
          });
          const idx = prizes.findIndex((p) => p.id === selected.id);
          if (idx >= 0) prizes[idx].remainingStock -= 1;
        }

        const draw = await tx.packDraw.create({
          data: {
            tenantId,
            packId: pack.id,
            prizeId: selected?.id ?? null,
            pointsSpent: pack.pricePoints,
          },
        });

        draws.push({ drawId: draw.id, prizeId: selected?.id ?? null });
      }

      await tx.pack.update({ where: { id: pack.id }, data: { remainingStock: { decrement: quantity } } });

      await tx.walletAccount.update({
        where: { id: wallet.id },
        data: { balancePoints: { decrement: totalCost } },
      });

      await tx.walletEntry.create({
        data: {
          tenantId,
          walletAccountId: wallet.id,
          type: "DEBIT",
          amountPoints: totalCost,
          reason: "PACK_DRAW",
          referenceId: pack.id,
        },
      });

      const payload = {
        tenantId,
        packId: pack.id,
        quantity,
        totalCost,
        draws,
      };

      await tx.idempotencyKey.upsert({
        where: { key: idemKey },
        update: { responseJson: JSON.stringify(payload) },
        create: {
          key: idemKey,
          tenantId,
          responseJson: JSON.stringify(payload),
        },
      });

      return payload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await drawQueue.add("post-draw", { drawResult: result }, {
      removeOnComplete: true,
      removeOnFail: 100,
    });

    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draw failed";
    return res.status(400).json({ error: message });
  }
});
