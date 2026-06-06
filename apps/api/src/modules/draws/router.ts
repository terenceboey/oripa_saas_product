import { Prisma } from "@prisma/client";
import { Router } from "express";
import { drawSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { getRequestUserId } from "../../lib/rbac";
import { resolveDrawPoolIntegrity } from "./pool-integrity";
import { commitInventoryAllocationForPrizeDraw } from "../packs/inventory-allocation";

const ALGORITHM_VERSION = "hmac_sha256_v1";

type PrizeState = {
  id: string;
  label: string;
  weight: number;
  remainingStock: number;
};

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256Hex(key: string, message: string) {
  return createHmac("sha256", key).update(message).digest("hex");
}

function hmacToUnitFloat(hmacHex: string) {
  const first13Hex = hmacHex.slice(0, 13);
  const intVal = Number.parseInt(first13Hex, 16);
  return intVal / Math.pow(2, 52);
}

function tierFromLabel(label: string | null | undefined) {
  if (!label) return null;
  const idx = label.indexOf(" - ");
  return idx > 0 ? label.slice(0, idx).trim() : null;
}

function selectDeterministicPrize(prizes: PrizeState[], rand01: number) {
  const available = prizes
    .filter((p) => p.remainingStock > 0 && p.weight > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);
  if (!available.length || totalWeight <= 0) {
    return {
      selected: null,
      lowerBound: null,
      upperBound: null,
      totalWeight,
      randomWeightValue: 0,
      eligiblePrizeIds: [] as string[],
    };
  }

  const randomWeightValue = Math.floor(rand01 * totalWeight) + 1;
  let cursor = 0;

  for (const prize of available) {
    const lower = cursor + 1;
    cursor += prize.weight;
    const upper = cursor;

    if (randomWeightValue >= lower && randomWeightValue <= upper) {
      return {
        selected: prize,
        lowerBound: lower,
        upperBound: upper,
        totalWeight,
        randomWeightValue,
        eligiblePrizeIds: available.map((row) => row.id),
      };
    }
  }

  const fallback = available[available.length - 1];
  return {
    selected: fallback,
    lowerBound: Math.max(1, totalWeight - fallback.weight + 1),
    upperBound: totalWeight,
    totalWeight,
    randomWeightValue,
    eligiblePrizeIds: available.map((row) => row.id),
  };
}

export const drawRouter = Router();

drawRouter.post("/v1/draws", async (req: VendorRequest, res) => {
  const vendorId = req.vendorId;
  if (!vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const actorUserId = getRequestUserId(req);
  if (!actorUserId) return res.status(401).json({ error: "unauthorized" });
  const requestId = String(req.header("x-request-id") ?? "").trim() || randomUUID();
  const clientIp = String((req.headers["x-forwarded-for"] as string) ?? req.ip ?? "").split(",")[0].trim() || null;
  const userAgent = String(req.header("user-agent") ?? "").trim() || null;

  const rawIdemKey = String(req.header("x-idempotency-key") ?? "").trim();
  if (!rawIdemKey) {
    return res.status(400).json({ error: "x-idempotency-key header is required" });
  }
  const idempotencyScopeKey = `${vendorId}:draw:${actorUserId}:${rawIdemKey}`;

  const parsed = drawSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const { packId, quantity } = parsed.data;
  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId } });
  const maxDrawQuantity = settings?.maxDrawQuantity ?? 100;
  if (quantity > maxDrawQuantity) {
    return res.status(400).json({ error: `vendor limit exceeded: max ${maxDrawQuantity} draws per request` });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyKey.findUnique({ where: { scopeKey: idempotencyScopeKey } });
      if (existing?.responseJson) {
        return JSON.parse(existing.responseJson);
      }

      const now = new Date();
      const pack = await tx.pack.findFirst({
        where: {
          id: packId,
          vendorId,
          isActive: true,
          status: "LIVE",
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
        },
      });
      if (!pack) throw new Error("Pack not found or inactive");
      if (pack.remainingStock < quantity) throw new Error("Not enough stock remaining");

      const wallet = await tx.walletAccount.findUnique({
        where: { vendorId_userId: { vendorId, userId: actorUserId } },
      });
      if (!wallet) throw new Error("Wallet not found for user");

      const totalCost = pack.pricePoints * quantity;
      if (wallet.balancePoints < totalCost) throw new Error("Insufficient balance");
      const balanceBefore = wallet.balancePoints;
      const balanceAfter = wallet.balancePoints - totalCost;

      if (pack.drawLimitMode === "ONCE_PER_CUSTOMER") {
        const exists = await tx.drawOrder.findFirst({
          where: { vendorId, userId: actorUserId, packId: pack.id, status: "COMPLETED" },
          select: { id: true },
        });
        if (exists) throw new Error("You have reached the draw limit for this pack");
      }

      if (pack.drawLimitMode === "DAILY_RESET") {
        const tz = pack.drawLimitResetTimezone || "Asia/Singapore";
        const nowTz = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
        const start = new Date(nowTz);
        start.setHours(0, 0, 0, 0);
        const end = new Date(nowTz);
        end.setHours(23, 59, 59, 999);
        const used = await tx.drawOrder.aggregate({
          where: {
            vendorId,
            userId: actorUserId,
            packId: pack.id,
            status: "COMPLETED",
            createdAt: { gte: start, lte: end },
          },
          _sum: { quantity: true },
        });
        const usedQty = used._sum.quantity ?? 0;
        const dailyLimit = pack.drawLimitValue ?? 1;
        if (usedQty + quantity > dailyLimit) {
          throw new Error(`Daily draw limit exceeded for this pack (${dailyLimit})`);
        }
      }

      const packPrizes = await tx.packPrize.findMany({ where: { packId: pack.id } });
      const prizeLookup = new Map(packPrizes.map((prize) => [prize.id, prize]));
      const prizeState: PrizeState[] = packPrizes.map((prize) => ({
        id: prize.id,
        label: prize.label,
        weight: prize.weight,
        remainingStock: prize.remainingStock,
      }));

      const { poolSnapshotHash, poolSnapshotJson } = resolveDrawPoolIntegrity(pack, packPrizes);

      const serverSeed = randomBytes(32).toString("hex");
      const serverSeedHash = sha256Hex(serverSeed);
      const clientSeed = String(req.header("x-client-seed") ?? "").trim() || randomUUID();
      const nonceBase = randomUUID();

      const drawOrder = await tx.drawOrder.create({
        data: {
          vendorId,
          userId: actorUserId,
          walletAccountId: wallet.id,
          packId: pack.id,
          quantity,
          unitPricePoints: pack.pricePoints,
          totalPoints: totalCost,
          status: "COMPLETED",
          requestId,
          idempotencyScopeKey,
          clientIp,
          userAgent,
          metadata: {
            source: "provably-fair-draw-api",
            fairness: {
              version: ALGORITHM_VERSION,
              serverSeedHash,
              clientSeed,
              nonceBase,
              poolSnapshotHash,
            },
          },
        },
      });

      const fairnessProof = await tx.drawFairnessProof.create({
        data: {
          vendorId,
          drawOrderId: drawOrder.id,
          packId: pack.id,
          userId: actorUserId,
          algorithmVersion: ALGORITHM_VERSION,
          serverSeedHash,
          revealedServerSeed: serverSeed,
          clientSeed,
          nonceBase,
          quantity,
          poolSnapshotHash,
          poolSnapshotJson: poolSnapshotJson as Prisma.JsonObject,
        },
      });

      const draws: {
        drawId: string;
        prizeId: string | null;
        prizeLabel: string | null;
        prizeImageUrl: string | null;
        custodyItemId: string | null;
      }[] = [];

      const selectionRows: Prisma.DrawFairnessSelectionCreateManyInput[] = [];

      for (let i = 0; i < quantity; i += 1) {
        const drawSequence = i + 1;
        const hmacHex = hmacSha256Hex(serverSeed, `${clientSeed}:${nonceBase}:${drawSequence}`);
        const randomFloat = hmacToUnitFloat(hmacHex);
        const rowSeedHex = hmacSha256Hex(serverSeed, `${clientSeed}:row:${nonceBase}:${drawSequence}`);

        const selectedResult = selectDeterministicPrize(prizeState, randomFloat);
        const selected = selectedResult.selected;

        if (selected) {
          await tx.packPrize.update({
            where: { id: selected.id },
            data: { remainingStock: { decrement: 1 } },
          });
          await commitInventoryAllocationForPrizeDraw(tx, {
            vendorId,
            packId: pack.id,
            packPrizeId: selected.id,
          });

          const inMemoryRow = prizeState.find((row) => row.id === selected.id);
          if (inMemoryRow) inMemoryRow.remainingStock -= 1;
        }

        const legacyDraw = await tx.packDraw.create({
          data: {
            vendorId,
            packId: pack.id,
            prizeId: selected?.id ?? null,
            pointsSpent: pack.pricePoints,
          },
        });

        const drawResult = await tx.drawResult.create({
          data: {
            vendorId,
            drawOrderId: drawOrder.id,
            packId: pack.id,
            packPrizeId: selected?.id ?? null,
            drawSequence,
            pointsSpent: pack.pricePoints,
            rngVersion: ALGORITHM_VERSION,
            rngSeedHash: sha256Hex(`${serverSeedHash}:${clientSeed}:${nonceBase}:${drawSequence}:${selected?.id ?? "none"}`),
            requestId,
          },
        });

        const prize = selected?.id ? prizeLookup.get(selected.id) : null;
        const custodyItem = prize
          ? await tx.custodyItem.create({
              data: {
                vendorId,
                userId: actorUserId,
                packId: pack.id,
                packPrizeId: prize.id,
                drawOrderId: drawOrder.id,
                drawResultId: drawResult.id,
                prizeLabel: prize.label,
                imageUrl: prize.imageUrl,
                imageLargeUrl: prize.imageLargeUrl,
                setName: prize.setName,
                cardName: prize.label,
                rarity: prize.rarity,
                catalogSnapshot: prize.catalogSnapshot ?? Prisma.JsonNull,
                estimatedValue: prize.estimatedValue,
              },
            })
          : null;

        selectionRows.push({
          vendorId,
          drawOrderId: drawOrder.id,
          proofId: fairnessProof.id,
          drawSequence,
          hmacHex,
          randomFloat: new Prisma.Decimal(randomFloat.toFixed(18)),
          randomWeightValue: selectedResult.randomWeightValue,
          totalWeightAtDraw: selectedResult.totalWeight,
          tierLabel: tierFromLabel(selected?.label),
          tierLowerBound: selectedResult.lowerBound,
          tierUpperBound: selectedResult.upperBound,
          rowSeedHex,
          chosenPackPrizeId: selected?.id ?? null,
          eligiblePrizeIds: selectedResult.eligiblePrizeIds,
        });

        draws.push({
          drawId: legacyDraw.id,
          prizeId: selected?.id ?? null,
          prizeLabel: prize?.label ?? null,
          prizeImageUrl: prize?.imageUrl ?? null,
          custodyItemId: custodyItem?.id ?? null,
        });
      }

      if (selectionRows.length > 0) {
        await tx.drawFairnessSelection.createMany({ data: selectionRows });
      }

      await tx.pack.update({ where: { id: pack.id }, data: { remainingStock: { decrement: quantity } } });

      await tx.walletAccount.update({
        where: { id: wallet.id },
        data: {
          balancePoints: { decrement: totalCost },
          version: { increment: 1 },
        },
      });

      await tx.walletEntry.create({
        data: {
          vendorId,
          walletAccountId: wallet.id,
          type: "DEBIT",
          amountPoints: totalCost,
          reason: "PACK_DRAW",
          balanceBefore,
          balanceAfter,
          actorUserId,
          requestId,
          idempotencyScopeKey,
          referenceType: "DRAW_ORDER",
          metadata: {
            drawOrderId: drawOrder.id,
            packId: pack.id,
            quantity,
          },
          referenceId: pack.id,
        },
      });

      const vendorSettings = await tx.vendorSettings.findUnique({ where: { vendorId } });
      const pointsPerCurrencyUnit = vendorSettings?.pointsPerCurrencyUnit ?? 100;
      const currencyCode = vendorSettings?.currencyCode ?? "USD";
      const currencyAmount = Number((totalCost / pointsPerCurrencyUnit).toFixed(2));

      await tx.vendorRevenueLedger.createMany({
        data: [
          {
            vendorId,
            drawOrderId: drawOrder.id,
            type: "DRAW_GROSS",
            amountPoints: totalCost,
            conversionRate: new Prisma.Decimal(pointsPerCurrencyUnit),
            amountCurrency: new Prisma.Decimal(currencyAmount),
            currencyCode,
            requestId,
            metadata: { packId: pack.id },
          },
          {
            vendorId,
            drawOrderId: drawOrder.id,
            type: "TENANT_NET",
            amountPoints: totalCost,
            conversionRate: new Prisma.Decimal(pointsPerCurrencyUnit),
            amountCurrency: new Prisma.Decimal(currencyAmount),
            currencyCode,
            requestId,
            metadata: { packId: pack.id },
          },
        ],
      });

      const payload = {
        vendorId,
        packId: pack.id,
        drawOrderId: drawOrder.id,
        requestId,
        quantity,
        totalCost,
        draws,
        fairness: {
          version: ALGORITHM_VERSION,
          serverSeedHash,
          revealedServerSeed: serverSeed,
          clientSeed,
          nonceBase,
          poolSnapshotHash,
        },
      };

      await tx.idempotencyKey.upsert({
        where: { scopeKey: idempotencyScopeKey },
        update: {
          responseJson: JSON.stringify(payload),
          statusCode: 201,
          requestId,
        },
        create: {
          key: rawIdemKey,
          operation: "DRAW",
          scopeKey: idempotencyScopeKey,
          vendorId,
          userId: actorUserId,
          statusCode: 201,
          requestId,
          responseJson: JSON.stringify(payload),
        },
      });

      await tx.auditLog.create({
        data: {
          vendorId,
          actorUserId,
          action: "DRAW_EXECUTED",
          entityType: "DrawOrder",
          entityId: drawOrder.id,
          requestId,
          ipAddress: clientIp,
          userAgent,
          afterState: payload as Prisma.JsonObject,
          metadata: {
            idempotencyScopeKey,
          },
        },
      });

      await tx.outboxEvent.create({
        data: {
          vendorId,
          aggregateType: "DrawOrder",
          aggregateId: drawOrder.id,
          eventType: "draw.completed",
          payload: payload as Prisma.JsonObject,
          requestId,
        },
      });

      return payload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draw failed";
    return res.status(400).json({ error: message });
  }
});

drawRouter.get("/v1/draws/:drawOrderId/proof", async (req: VendorRequest, res) => {
  const vendorId = req.vendorId;
  if (!vendorId) return res.status(400).json({ error: "Vendor not resolved" });
  const actorUserId = getRequestUserId(req);
  if (!actorUserId) return res.status(401).json({ error: "unauthorized" });

  const drawOrderId = String(req.params.drawOrderId ?? "").trim();
  if (!drawOrderId) return res.status(400).json({ error: "drawOrderId is required" });

  const proof = await prisma.drawFairnessProof.findFirst({
    where: { drawOrderId, vendorId, userId: actorUserId },
    include: {
      selections: {
        orderBy: { drawSequence: "asc" },
      },
    },
  });

  if (!proof) return res.status(404).json({ error: "Fairness proof not found" });

  return res.json({
    proof: {
      drawOrderId: proof.drawOrderId,
      algorithmVersion: proof.algorithmVersion,
      serverSeedHash: proof.serverSeedHash,
      revealedServerSeed: proof.revealedServerSeed,
      clientSeed: proof.clientSeed,
      nonceBase: proof.nonceBase,
      quantity: proof.quantity,
      poolSnapshotHash: proof.poolSnapshotHash,
      createdAt: proof.createdAt,
      selections: proof.selections.map((row) => ({
        drawSequence: row.drawSequence,
        hmacHex: row.hmacHex,
        randomFloat: row.randomFloat.toString(),
        randomWeightValue: row.randomWeightValue,
        totalWeightAtDraw: row.totalWeightAtDraw,
        tierLabel: row.tierLabel,
        tierLowerBound: row.tierLowerBound,
        tierUpperBound: row.tierUpperBound,
        rowSeedHex: row.rowSeedHex,
        chosenPackPrizeId: row.chosenPackPrizeId,
      })),
    },
    howToVerify: [
      "1. Verify commitment: SHA256(revealedServerSeed) must equal serverSeedHash.",
      "2. For each sequence i, compute HMAC_SHA256(revealedServerSeed, clientSeed:nonceBase:i).",
      "3. Convert first 13 hex chars to integer and divide by 2^52 for randomFloat.",
      "4. Rebuild eligible rows from pool snapshot and remaining stock progression, then walk cumulative weights.",
      "5. Confirm chosenPackPrizeId and range bounds match stored selections.",
    ],
  });
});

drawRouter.get("/v1/fairness-proofs", async (req: VendorRequest, res) => {
  const vendorId = req.vendorId;
  if (!vendorId) return res.status(400).json({ error: "Vendor not resolved" });
  const actorUserId = getRequestUserId(req);
  if (!actorUserId) return res.status(401).json({ error: "unauthorized" });

  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 100;

  const proofs = await prisma.drawFairnessProof.findMany({
    where: { vendorId, userId: actorUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      drawOrderId: true,
      algorithmVersion: true,
      serverSeedHash: true,
      revealedServerSeed: true,
      clientSeed: true,
      nonceBase: true,
      quantity: true,
      poolSnapshotHash: true,
      createdAt: true,
    },
  });

  return res.json({ proofs });
});
