import { Prisma } from "@prisma/client";
import { Router } from "express";
import { walletTopupSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { getRequestUserId } from "../../lib/rbac";
import { VendorRequest } from "../../middleware/vendor";
import {
  convertCurrencyMajorToMinor,
  convertPointsToCurrencyMajor,
  createAirwallexPaymentIntent,
  formatCurrencyAmount,
  getCurrencyMinorUnitDigits,
  resolveCurrencyCodeForCountry,
} from "../../lib/airwallex";

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
      country: true,
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
    countryCode: user.country,
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
  const currencyCode = resolveCurrencyCodeForCountry(auth.countryCode, settings?.currencyCode ?? undefined);
  const estimatedCurrencyAmountMajor = convertPointsToCurrencyMajor(amountPoints, pointsPerCurrencyUnit);
  const estimatedCurrencyAmount = new Prisma.Decimal(estimatedCurrencyAmountMajor.toFixed(2));
  const amountMinor = convertCurrencyMajorToMinor(estimatedCurrencyAmountMajor, currencyCode);
  if (amountMinor <= 0) {
    return res.status(400).json({ error: "top-up amount is too small for the selected currency" });
  }
  if (getCurrencyMinorUnitDigits(currencyCode) === 0 && amountPoints % 100 !== 0) {
    return res.status(400).json({ error: "top-up amount must be a multiple of 100 points for this currency" });
  }
  const requestId = String(req.header("x-request-id") ?? "").trim() || null;
  const origin = String(req.header("origin") ?? "").trim();
  const host = String(req.header("host") ?? "").trim().toLowerCase();
  const baseUrl = origin || (host ? `https://${host}` : process.env.WEB_URL ?? "http://localhost:3000");
  const returnUrl = new URL("/profile", baseUrl).toString();
  let bootstrapTopupOrderId: string | null = null;
  let bootstrapWalletSnapshot: unknown = null;
  let checkoutIntent: Awaited<ReturnType<typeof createAirwallexPaymentIntent>> | null = null;

  try {
    const bootstrap = await prisma.$transaction(async (tx) => {
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

      const topupOrder = await tx.topupOrder.create({
        data: {
          vendorId: auth.vendorId,
          userId: auth.userId,
          walletAccountId: wallet.id,
          pointsToCredit: amountPoints,
          expectedCurrencyAmount: estimatedCurrencyAmount,
          currencyCode,
          status: "PENDING",
          provider: "airwallex",
          providerOrderRef: null,
          requestId,
          idempotencyScopeKey,
          metadata: {
            fixedAmount: FIXED_TOPUP_AMOUNTS.has(amountPoints),
            pointsPerCurrencyUnit,
            amountMinor,
            returnUrl,
            provider: "airwallex",
          },
        },
      });

      const walletSnapshot = await tx.walletAccount.findUnique({
        where: { id: wallet.id },
        select: walletSelect,
      });

      return {
        walletSnapshot,
        topupOrder: {
          id: topupOrder.id,
          expectedCurrencyAmount: topupOrder.expectedCurrencyAmount,
        },
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    bootstrapTopupOrderId = bootstrap.topupOrder.id;
    bootstrapWalletSnapshot = bootstrap.walletSnapshot;

    checkoutIntent = await createAirwallexPaymentIntent({
      amountMinor,
      currencyCode,
      merchantOrderId: bootstrap.topupOrder.id,
      requestId,
      returnUrl,
      metadata: {
        vendorId: auth.vendorId,
        userId: auth.userId,
        topupOrderId: bootstrap.topupOrder.id,
        amountPoints,
        amountCurrency: estimatedCurrencyAmountMajor,
        currencyCode,
      },
    });

    const intent = checkoutIntent;
    if (!intent) {
      throw new Error("Airwallex checkout intent was not created");
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentTopupOrder = await tx.topupOrder.findUnique({
        where: { id: bootstrap.topupOrder.id },
        select: {
          id: true,
          status: true,
          pointsToCredit: true,
          expectedCurrencyAmount: true,
          currencyCode: true,
          providerOrderRef: true,
          metadata: true,
        },
      });
      if (!currentTopupOrder) {
        throw new Error(`Top-up order ${bootstrap.topupOrder.id} disappeared before checkout finalization`);
      }

      await tx.topupOrder.update({
        where: { id: bootstrap.topupOrder.id },
        data: {
          provider: "airwallex",
          providerOrderRef: intent.id,
          metadata: {
            fixedAmount: FIXED_TOPUP_AMOUNTS.has(amountPoints),
            pointsPerCurrencyUnit,
            amountMinor,
            returnUrl,
            provider: "airwallex",
            paymentIntentId: intent.id,
          },
        },
      });

      const existingPaymentTransaction = await tx.paymentTransaction.findFirst({
        where: {
          topupOrderId: bootstrap.topupOrder.id,
          provider: "airwallex",
        },
      });
      const paymentTransactionStatus = currentTopupOrder.status === "COMPLETED"
        ? "CAPTURED"
        : currentTopupOrder.status === "CANCELLED" || currentTopupOrder.status === "FAILED"
          ? "FAILED"
          : "AUTHORIZED";
      if (existingPaymentTransaction) {
        await tx.paymentTransaction.update({
          where: { id: existingPaymentTransaction.id },
          data: {
            providerPaymentRef: intent.id,
            status: paymentTransactionStatus,
            amountCurrency: estimatedCurrencyAmount,
            currencyCode,
            rawPayload: intent.raw as Prisma.InputJsonValue,
            requestId,
          },
        });
      } else {
        await tx.paymentTransaction.create({
          data: {
            vendorId: auth.vendorId,
            userId: auth.userId,
            topupOrderId: bootstrap.topupOrder.id,
            provider: "airwallex",
            providerPaymentRef: intent.id,
            status: paymentTransactionStatus,
            amountCurrency: estimatedCurrencyAmount,
            currencyCode,
            rawPayload: intent.raw as Prisma.InputJsonValue,
            requestId,
          },
        });
      }

      const responsePayload = {
        topupOrder: {
          id: bootstrap.topupOrder.id,
          status: currentTopupOrder.status,
          provider: "airwallex",
          providerOrderRef: intent.id,
          expectedCurrencyAmount: Number(currentTopupOrder.expectedCurrencyAmount ?? 0),
          currencyCode: currentTopupOrder.currencyCode ?? currencyCode,
          pointsToCredit: amountPoints,
        },
        wallet: serializeWalletHistory(bootstrapWalletSnapshot),
        checkout: {
          provider: "airwallex",
          intentId: intent.id,
          clientSecret: intent.clientSecret,
          currencyCode: intent.currencyCode,
          countryCode: auth.countryCode ?? null,
          amountMinor,
          amountCurrency: estimatedCurrencyAmountMajor,
          returnUrl,
          successUrl: returnUrl,
          cancelUrl: returnUrl,
        },
        pricing: {
          pointsPerCurrencyUnit,
          currencyCode,
          amountCurrencyLabel: formatCurrencyAmount(estimatedCurrencyAmountMajor, currencyCode),
          amountCurrencyMajor: estimatedCurrencyAmountMajor,
        },
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
          action: "WALLET_TOPUP_STARTED",
          entityType: "TopupOrder",
          entityId: bootstrap.topupOrder.id,
          requestId,
          afterState: responsePayload as unknown as Prisma.JsonObject,
          metadata: {
            amountPoints,
            currencyCode,
            amountMinor,
          },
        },
      });

      await tx.outboxEvent.create({
        data: {
          vendorId: auth.vendorId,
          aggregateType: "TopupOrder",
          aggregateId: bootstrap.topupOrder.id,
          eventType: "wallet.topup.started",
          payload: responsePayload as unknown as Prisma.JsonObject,
          requestId,
        },
      });

      return responsePayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return res.status(201).json(result);
  } catch (error) {
    if (bootstrapTopupOrderId) {
      await prisma.$transaction(async (tx) => {
        const topupOrderId = bootstrapTopupOrderId;
        if (!topupOrderId) return;
        await tx.topupOrder.update({
          where: { id: topupOrderId },
          data: {
            status: "FAILED",
            metadata: {
              fixedAmount: FIXED_TOPUP_AMOUNTS.has(amountPoints),
              pointsPerCurrencyUnit,
              amountMinor,
              returnUrl,
              provider: "airwallex",
              paymentIntentId: checkoutIntent?.id ?? null,
              failureReason: error instanceof Error ? error.message : "Airwallex top-up creation failed",
            },
          },
        });

        if (checkoutIntent) {
          await tx.paymentTransaction.create({
            data: {
              vendorId: auth.vendorId,
              userId: auth.userId,
              topupOrderId,
              provider: "airwallex",
              providerPaymentRef: checkoutIntent.id,
              status: "FAILED",
              amountCurrency: estimatedCurrencyAmount,
              currencyCode,
              rawPayload: {
                error: error instanceof Error ? error.message : "Airwallex top-up creation failed",
                checkoutIntent: checkoutIntent.raw,
              } as unknown as Prisma.InputJsonValue,
              requestId,
            },
          });
        }

        await tx.idempotencyKey.update({
          where: { scopeKey: idempotencyScopeKey },
          data: {
            statusCode: 502,
            responseJson: JSON.stringify({
              error: "Top-up checkout could not be created",
              message: error instanceof Error ? error.message : "Failed to create Airwallex checkout",
            }),
          },
        }).catch(() => null);
      }).catch(() => null);
    }
    const message = error instanceof Error ? error.message : "Failed to top up points";
    return res.status(400).json({ error: message });
  }
});
