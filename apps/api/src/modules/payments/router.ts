import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  extractAirwallexWebhookDetails,
  verifyAirwallexWebhookSignature,
} from "../../lib/airwallex";

export const paymentsRouter = Router();

type RawBodyRequest = {
  rawBody?: string;
};

function isTruthyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function asJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Prisma.JsonObject;
}

async function loadTopupOrder(tx: Prisma.TransactionClient, merchantOrderId: string, paymentIntentId: string) {
  const whereClauses: Array<{ id: string } | { providerOrderRef: string }> = [];
  if (isTruthyString(merchantOrderId)) whereClauses.push({ id: merchantOrderId });
  if (isTruthyString(paymentIntentId)) whereClauses.push({ providerOrderRef: paymentIntentId });
  if (whereClauses.length === 0) return null;

  return tx.topupOrder.findFirst({
    where: {
      OR: whereClauses,
    },
    include: {
      walletAccount: true,
      user: true,
    },
  });
}

const terminalAirwallexPaymentIntentEvents = new Set([
  "payment_intent.succeeded",
  "payment_intent.failed",
  "payment_intent.cancelled",
]);

paymentsRouter.post("/v1/webhooks/airwallex", async (req, res) => {
  const rawBody = String((req as RawBodyRequest).rawBody ?? "");
  if (!rawBody) return res.status(400).json({ error: "Missing raw webhook body" });

  const timestamp = String(req.header("x-timestamp") ?? "").trim();
  const signature = String(req.header("x-signature") ?? "").trim();
  if (!verifyAirwallexWebhookSignature(rawBody, timestamp, signature)) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  const details = extractAirwallexWebhookDetails(payload);
  if (!details.eventType || !details.eventId) {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }
  if (!terminalAirwallexPaymentIntentEvents.has(details.eventType)) {
    return res.status(200).json({
      acknowledged: true,
      ignored: true,
      reason: "non-terminal event",
      eventType: details.eventType,
      eventId: details.eventId,
    });
  }

  const dedupeScopeKey = `airwallex:webhook:${details.eventId}`;
  const requestId = details.eventId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingIdempotency = await tx.idempotencyKey.findUnique({
        where: { scopeKey: dedupeScopeKey },
      });
      if (existingIdempotency?.responseJson) {
        return JSON.parse(existingIdempotency.responseJson);
      }

      const topupOrder = await loadTopupOrder(tx, details.merchantOrderId, details.paymentIntentId);
      if (!topupOrder) {
        const ignoredPayload = {
          acknowledged: true,
          ignored: true,
          reason: "topup order not found",
          eventType: details.eventType,
          eventId: details.eventId,
        };
        await tx.idempotencyKey.update({
          where: { scopeKey: dedupeScopeKey },
          data: {
            statusCode: 200,
            responseJson: JSON.stringify(ignoredPayload),
          },
        });
        return ignoredPayload;
      }

      if (!existingIdempotency) {
        await tx.idempotencyKey.create({
          data: {
            key: details.eventId,
            operation: "AIRWALLEX_WEBHOOK",
            scopeKey: dedupeScopeKey,
            vendorId: topupOrder.vendorId,
            userId: topupOrder.userId,
            requestId,
            statusCode: 200,
            responseJson: "",
          },
        });
      }

      if (topupOrder.status === "COMPLETED") {
        const alreadyCompleted = {
          acknowledged: true,
          idempotent: true,
          eventType: details.eventType,
          eventId: details.eventId,
          topupOrderId: topupOrder.id,
        };
        await tx.idempotencyKey.update({
          where: { scopeKey: dedupeScopeKey },
          data: {
            statusCode: 200,
            responseJson: JSON.stringify(alreadyCompleted),
          },
        });
        return alreadyCompleted;
      }

      const currentWallet = await tx.walletAccount.findUnique({
        where: { id: topupOrder.walletAccountId },
        select: { id: true, balancePoints: true, version: true },
      });
      if (!currentWallet) {
        throw new Error(`Wallet not found for top-up order ${topupOrder.id}`);
      }

      const paymentStatus = details.eventType === "payment_intent.succeeded"
        ? "COMPLETED"
        : String(details.eventType).toLowerCase().includes("cancel")
          ? "CANCELLED"
          : "FAILED";
      let responsePayload: Record<string, unknown>;

      if (details.eventType === "payment_intent.succeeded") {
        const balanceBefore = currentWallet.balancePoints;
        const balanceAfter = balanceBefore + topupOrder.pointsToCredit;

        await tx.walletAccount.update({
          where: { id: currentWallet.id },
          data: {
            balancePoints: { increment: topupOrder.pointsToCredit },
            version: { increment: 1 },
          },
        });

        await tx.walletEntry.create({
          data: {
            vendorId: topupOrder.vendorId,
            walletAccountId: currentWallet.id,
            type: "CREDIT",
            amountPoints: topupOrder.pointsToCredit,
            reason: "WALLET_TOPUP",
            balanceBefore,
            balanceAfter,
            actorUserId: topupOrder.userId,
            requestId,
            idempotencyScopeKey: dedupeScopeKey,
            referenceType: "TOPUP_ORDER",
            referenceId: topupOrder.id,
            metadata: {
              provider: "airwallex",
              paymentIntentId: details.paymentIntentId || null,
              merchantOrderId: details.merchantOrderId || null,
              currencyCode: topupOrder.currencyCode,
              amountCurrency: Number(topupOrder.expectedCurrencyAmount ?? 0),
            },
          },
        });
      }

        await tx.topupOrder.update({
          where: { id: topupOrder.id },
          data: {
            status: paymentStatus,
            provider: "airwallex",
            providerOrderRef: details.paymentIntentId || topupOrder.providerOrderRef,
            metadata: {
            ...asJsonObject(topupOrder.metadata),
            provider: "airwallex",
            paymentIntentId: details.paymentIntentId || null,
            merchantOrderId: details.merchantOrderId || null,
            lastWebhookEventId: details.eventId,
            lastWebhookEventType: details.eventType,
            lastWebhookStatus: details.status || null,
          },
        },
      });

      if (paymentStatus === "COMPLETED") {
        const existingPaymentTransaction = await tx.paymentTransaction.findFirst({
          where: {
            topupOrderId: topupOrder.id,
            provider: "airwallex",
          },
        });
        if (existingPaymentTransaction) {
          await tx.paymentTransaction.update({
            where: { id: existingPaymentTransaction.id },
            data: {
              status: "CAPTURED",
              providerPaymentRef: details.paymentIntentId || topupOrder.providerOrderRef || null,
              amountCurrency: topupOrder.expectedCurrencyAmount,
              currencyCode: topupOrder.currencyCode,
              rawPayload: payload as Prisma.InputJsonValue,
              requestId,
            },
          });
        } else {
          await tx.paymentTransaction.create({
            data: {
              vendorId: topupOrder.vendorId,
              userId: topupOrder.userId,
              topupOrderId: topupOrder.id,
              provider: "airwallex",
              providerPaymentRef: details.paymentIntentId || topupOrder.providerOrderRef || null,
              status: "CAPTURED",
              amountCurrency: topupOrder.expectedCurrencyAmount,
              currencyCode: topupOrder.currencyCode,
              rawPayload: payload as Prisma.InputJsonValue,
              requestId,
            },
          });
        }
      }

      responsePayload = {
        acknowledged: true,
        eventType: details.eventType,
        eventId: details.eventId,
        topupOrderId: topupOrder.id,
        status: paymentStatus,
      };

      await tx.idempotencyKey.update({
        where: { scopeKey: dedupeScopeKey },
        data: {
          statusCode: 200,
          responseJson: JSON.stringify(responsePayload),
        },
      });

      if (paymentStatus === "COMPLETED") {
        await tx.auditLog.create({
          data: {
            vendorId: topupOrder.vendorId,
            actorUserId: topupOrder.userId,
            action: "WALLET_TOPUP_COMPLETED",
            entityType: "TopupOrder",
            entityId: topupOrder.id,
            requestId,
            afterState: responsePayload as unknown as Prisma.JsonObject,
            metadata: {
              provider: "airwallex",
              paymentIntentId: details.paymentIntentId || null,
              merchantOrderId: details.merchantOrderId || null,
            },
          },
        });

        await tx.outboxEvent.create({
          data: {
            vendorId: topupOrder.vendorId,
            aggregateType: "TopupOrder",
            aggregateId: topupOrder.id,
            eventType: "wallet.topup.completed",
            payload: responsePayload as unknown as Prisma.JsonObject,
            requestId,
          },
        });
      }

      await tx.topupOrder.delete({ where: { id: topupOrder.id } }).catch(() => null);

      return responsePayload;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return res.status(500).json({ error: message });
  }
});
