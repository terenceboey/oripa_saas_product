import { Prisma } from "@prisma/client";
import { Router } from "express";
import { walletTopupSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { getRequestUserId } from "../../lib/rbac";
import { VendorRequest } from "../../middleware/vendor";

export const walletRouter = Router();

const WALLET_HISTORY_TAKE = 20;
const FIXED_TOPUP_AMOUNTS = new Set([500, 1000, 5000, 10000]);

const walletSelect = {
  id: true,
  vendorId: true,
  userId: true,
  ownerLabel: true,
  balancePoints: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  entries: {
    orderBy: { createdAt: "desc" as const },
    take: WALLET_HISTORY_TAKE,
    select: {
      id: true,
      type: true,
      amountPoints: true,
      reason: true,
      balanceBefore: true,
      balanceAfter: true,
      actorUserId: true,
      requestId: true,
      idempotencyScopeKey: true,
      referenceType: true,
      referenceId: true,
      metadata: true,
      createdAt: true,
    },
  },
  topupOrders: {
    orderBy: { createdAt: "desc" as const },
    take: WALLET_HISTORY_TAKE,
    select: {
      id: true,
      pointsToCredit: true,
      expectedCurrencyAmount: true,
      currencyCode: true,
      status: true,
      provider: true,
      providerOrderRef: true,
      requestId: true,
      idempotencyScopeKey: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  drawOrders: {
    orderBy: { createdAt: "desc" as const },
    take: WALLET_HISTORY_TAKE,
    select: {
      id: true,
      packId: true,
      quantity: true,
      unitPricePoints: true,
      totalPoints: true,
      status: true,
      requestId: true,
      createdAt: true,
      pack: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  },
} as const;

async function resolveCustomerWalletContext(req: VendorRequest, res: any) {
  if (!req.vendorId) {
    res.status(400).json({ error: "Vendor not resolved" });
    return null;
  }

  const userId = await getRequestUserId(req, res);
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      fullName: true,
    },
  });

  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  return {
    vendorId: req.vendorId,
    userId: user.id,
    ownerLabel: user.displayName ?? user.fullName ?? user.email,
    email: user.email,
  };
}

function serializeWalletHistory(wallet: any) {
  if (!wallet) return null;

  return {
    ...wallet,
    topupOrders: (wallet.topupOrders ?? []).map((row: any) => ({
      ...row,
      expectedCurrencyAmount: row.expectedCurrencyAmount === null ? null : Number(row.expectedCurrencyAmount),
    })),
  };
}

walletRouter.get("/v1/wallet", async (req: VendorRequest, res) => {
  const auth = await resolveCustomerWalletContext(req, res);
  if (!auth) return;

  const wallet = await prisma.walletAccount.upsert({
    where: { vendorId_userId: { vendorId: auth.vendorId, userId: auth.userId } },
    update: { ownerLabel: auth.ownerLabel },
    create: {
      vendorId: auth.vendorId,
      userId: auth.userId,
      ownerLabel: auth.ownerLabel,
      balancePoints: 0,
    },
    select: walletSelect,
  });

  return res.json({ wallet: serializeWalletHistory(wallet) });
});

walletRouter.get("/v1/wallet/history", async (req: VendorRequest, res) => {
  const auth = await resolveCustomerWalletContext(req, res);
  if (!auth) return;

  const wallet = await prisma.walletAccount.upsert({
    where: { vendorId_userId: { vendorId: auth.vendorId, userId: auth.userId } },
    update: { ownerLabel: auth.ownerLabel },
    create: {
      vendorId: auth.vendorId,
      userId: auth.userId,
      ownerLabel: auth.ownerLabel,
      balancePoints: 0,
    },
    select: walletSelect,
  });

  return res.json({ wallet: serializeWalletHistory(wallet) });
});

walletRouter.post("/v1/wallet/topups", async (req: VendorRequest, res) => {
  const auth = await resolveCustomerWalletContext(req, res);
  if (!auth) return;

  const parsed = walletTopupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const amountPoints = parsed.data.amountPoints;
  if (!Number.isInteger(amountPoints) || amountPoints <= 0) {
    return res.status(400).json({ error: "amountPoints must be a positive integer" });
  }
  if (!FIXED_TOPUP_AMOUNTS.has(amountPoints) && amountPoints > 100000) {
    return res.status(400).json({ error: "custom top-up amount is too large" });
  }

  const rawIdempotencyKey = String(req.header("x-idempotency-key") ?? "").trim();
  if (!rawIdempotencyKey) {
    return res.status(400).json({ error: "x-idempotency-key header is required" });
  }

  const idempotencyScopeKey = `${auth.vendorId}:topup:${auth.userId}:${rawIdempotencyKey}`;
  const existingIdempotency = await prisma.idempotencyKey.findUnique({ where: { scopeKey: idempotencyScopeKey } });
  if (existingIdempotency?.responseJson) {
    return res.status(existingIdempotency.statusCode ?? 200).json(JSON.parse(existingIdempotency.responseJson));
  }
  if (existingIdempotency && !existingIdempotency.responseJson) {
    return res.status(409).json({ error: "Top-up is already in progress" });
  }

  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
  const pointsPerCurrencyUnit = settings?.pointsPerCurrencyUnit ?? 100;
  const currencyCode = settings?.currencyCode ?? "USD";
  const estimatedCurrencyAmount = new Prisma.Decimal((amountPoints / pointsPerCurrencyUnit).toFixed(2));
  const requestId = String(req.header("x-request-id") ?? "").trim() || null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.idempotencyKey.create({
        data: {
          key: rawIdempotencyKey,
          operation: "WALLET_TOPUP",
          scopeKey: idempotencyScopeKey,
          vendorId: auth.vendorId,
          userId: auth.userId,
          requestId,
          statusCode: 102,
          responseJson: "",
        },
      });

      const wallet = await tx.walletAccount.upsert({
        where: { vendorId_userId: { vendorId: auth.vendorId, userId: auth.userId } },
        update: { ownerLabel: auth.ownerLabel },
        create: {
          vendorId: auth.vendorId,
          userId: auth.userId,
          ownerLabel: auth.ownerLabel,
          balancePoints: 0,
        },
      });

      const balanceBefore = wallet.balancePoints;
      const balanceAfter = balanceBefore + amountPoints;

      const topupOrder = await tx.topupOrder.create({
        data: {
          vendorId: auth.vendorId,
          userId: auth.userId,
          walletAccountId: wallet.id,
          pointsToCredit: amountPoints,
          expectedCurrencyAmount: estimatedCurrencyAmount,
          currencyCode,
          status: "COMPLETED",
          provider: "manual_free_topup",
          providerOrderRef: `manual:${rawIdempotencyKey}`,
          requestId,
          idempotencyScopeKey,
          metadata: {
            simulated: true,
            fixedAmount: FIXED_TOPUP_AMOUNTS.has(amountPoints),
            pointsPerCurrencyUnit,
          },
        },
      });

      await tx.paymentTransaction.create({
        data: {
          vendorId: auth.vendorId,
          userId: auth.userId,
          topupOrderId: topupOrder.id,
          provider: "manual_free_topup",
          providerPaymentRef: `manual:${rawIdempotencyKey}`,
          status: "CAPTURED",
          amountCurrency: estimatedCurrencyAmount,
          currencyCode,
          rawPayload: {
            simulated: true,
            topupOrderId: topupOrder.id,
            amountPoints,
          },
          requestId,
        },
      });

      await tx.walletAccount.update({
        where: { id: wallet.id },
        data: {
          balancePoints: { increment: amountPoints },
          version: { increment: 1 },
        },
      });

      await tx.walletEntry.create({
        data: {
          vendorId: auth.vendorId,
          walletAccountId: wallet.id,
          type: "CREDIT",
          amountPoints,
          reason: "WALLET_TOPUP",
          balanceBefore,
          balanceAfter,
          actorUserId: auth.userId,
          requestId,
          idempotencyScopeKey,
          referenceType: "TOPUP_ORDER",
          referenceId: topupOrder.id,
          metadata: {
            simulated: true,
            amountPoints,
            currencyCode,
          },
        },
      });

      const walletSnapshot = await tx.walletAccount.findUnique({
        where: { id: wallet.id },
        select: walletSelect,
      });

      const responsePayload = {
        topupOrder: {
          ...topupOrder,
          expectedCurrencyAmount: Number(topupOrder.expectedCurrencyAmount ?? 0),
        },
        wallet: serializeWalletHistory(walletSnapshot),
        simulated: true,
      };

      await tx.idempotencyKey.update({
        where: { scopeKey: idempotencyScopeKey },
        data: {
          statusCode: 201,
          responseJson: JSON.stringify(responsePayload),
        },
      });

      await tx.auditLog.create({
        data: {
          vendorId: auth.vendorId,
          actorUserId: auth.userId,
          action: "WALLET_TOPUP_COMPLETED",
          entityType: "TopupOrder",
          entityId: topupOrder.id,
          requestId,
          afterState: responsePayload as unknown as Prisma.JsonObject,
          metadata: {
            simulated: true,
            amountPoints,
          },
        },
      });

      await tx.outboxEvent.create({
        data: {
          vendorId: auth.vendorId,
          aggregateType: "TopupOrder",
          aggregateId: topupOrder.id,
          eventType: "wallet.topup.completed",
          payload: responsePayload as unknown as Prisma.JsonObject,
          requestId,
        },
      });

      return responsePayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to top up points";
    return res.status(400).json({ error: message });
  }
});
