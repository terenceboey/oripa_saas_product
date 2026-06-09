import { Router } from "express";
import type { CustodyRequestStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getRequestUserId, getVendorMembershipRole, hasRole } from "../../lib/rbac";
import { isValidCustodyRequestTransition, nextCustodyItemStatusForRequest, normalizeOpsRequestStatusUpdate, serializeCustodyItem, terminalCustodyRequestStatuses } from "../../lib/customer-custody";
import { VendorRequest } from "../../middleware/vendor";

export const opsRouter = Router();

async function requireOpsContext(req: VendorRequest, res: any) {
  if (!req.vendorId) {
    res.status(400).json({ error: "Vendor not resolved" });
    return null;
  }
  const actorUserId = await getRequestUserId(req, res);
  if (!actorUserId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const role = await getVendorMembershipRole({ vendorId: req.vendorId, userId: actorUserId });
  if (!role || !hasRole(role, ["OWNER", "MANAGER", "STAFF"])) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }
  return { vendorId: req.vendorId, actorUserId, role };
}

function parseStatusFilter(input: unknown) {
  const raw = String(input ?? "PENDING").trim().toUpperCase();
  if (raw === "ALL") return undefined;
  const allowed = new Set<CustodyRequestStatus>(["QUOTED", "PENDING", "OPS_REVIEW", "APPROVED", "PACKED", "FULFILLED_MANUAL", "REJECTED", "CANCELLED", "COMPLETED", "CREDITED", "EXPIRED"]);
  return allowed.has(raw as CustodyRequestStatus) ? raw as CustodyRequestStatus : "PENDING";
}

function serializeOpsCustodyRequest(request: any) {
  return {
    id: request.id,
    type: request.type,
    status: request.status,
    customerNote: request.customerNote,
    opsNote: request.opsNote,
    requestedAt: request.requestedAt.toISOString(),
    reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
    completedAt: request.completedAt ? request.completedAt.toISOString() : null,
    customer: {
      id: request.user.id,
      email: request.user.email,
      name: request.user.displayName,
    },
    quote: request.type === "BUYBACK" ? {
      amount: request.quoteAmount,
      currency: request.quoteCurrency,
      buybackPercent: request.buybackPercent,
      policyVersion: request.policyVersion,
      valueSource: request.valueSource,
      valueAsOf: request.valueAsOf ? request.valueAsOf.toISOString() : null,
      expiresAt: request.expiresAt ? request.expiresAt.toISOString() : null,
      creditedAt: request.creditedAt ? request.creditedAt.toISOString() : null,
      walletEntryId: request.walletEntryId,
    } : null,
    item: serializeCustodyItem({ ...request.custodyItem, requests: [request] }),
  };
}

opsRouter.get("/v1/ops/custody-requests", async (req: VendorRequest, res) => {
  const context = await requireOpsContext(req, res);
  if (!context) return;
  const status = parseStatusFilter(req.query.status);
  const requests = await prisma.custodyRequest.findMany({
    where: { vendorId: context.vendorId, ...(status ? { status } : {}) },
    orderBy: { requestedAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      custodyItem: true,
    },
  });
  return res.json({ requests: requests.map(serializeOpsCustodyRequest) });
});

opsRouter.patch("/v1/ops/custody-requests/:id", async (req: VendorRequest, res) => {
  const context = await requireOpsContext(req, res);
  if (!context) return;
  const parsed = normalizeOpsRequestStatusUpdate(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  const existing = await prisma.custodyRequest.findFirst({
    where: { id: req.params.id, vendorId: context.vendorId },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      custodyItem: true,
    },
  });
  if (!existing) return res.status(404).json({ error: "Custody request not found" });
  if (existing.type === "BUYBACK" && existing.status === "CREDITED" && parsed.status === "APPROVED") {
    return res.json({ request: serializeOpsCustodyRequest(existing) });
  }
  if (terminalCustodyRequestStatuses().has(existing.status)) {
    return res.status(409).json({ error: "Custody request is already terminal" });
  }
  if (!isValidCustodyRequestTransition(existing.type, existing.status, parsed.status)) {
    return res.status(409).json({ error: "Invalid custody request transition", fromStatus: existing.status, toStatus: parsed.status });
  }
  if (existing.type === "BUYBACK" && parsed.status === "APPROVED" && (!existing.quoteAmount || existing.quoteAmount <= 0)) {
    return res.status(409).json({ error: "Buyback request has no creditable quote" });
  }

  const now = new Date();
  const creditsBuyback = existing.type === "BUYBACK" && parsed.status === "APPROVED";
  const finalRequestStatus = creditsBuyback ? "CREDITED" : parsed.status;
  const itemStatus = nextCustodyItemStatusForRequest(existing.type, finalRequestStatus);
  const updated = await prisma.$transaction(async (tx) => {
    let walletEntryId = existing.walletEntryId;
    let creditedAt = existing.creditedAt;

    if (creditsBuyback) {
      const idempotencyScopeKey = `buyback-credit:${existing.id}`;
      const existingCredit = await tx.walletEntry.findUnique({ where: { idempotencyScopeKey } });
      if (existingCredit) {
        walletEntryId = existingCredit.id;
        creditedAt = existing.creditedAt ?? existingCredit.createdAt;
      } else {
        const wallet = await tx.walletAccount.upsert({
          where: { vendorId_userId: { vendorId: existing.vendorId, userId: existing.userId } },
          create: {
            vendorId: existing.vendorId,
            userId: existing.userId,
            ownerLabel: `customer:${existing.userId}`,
            balancePoints: 0,
          },
          update: {},
        });
        const balanceBefore = wallet.balancePoints;
        const balanceAfter = balanceBefore + (existing.quoteAmount ?? 0);
        const updatedWallet = await tx.walletAccount.update({
          where: { id: wallet.id },
          data: { balancePoints: balanceAfter, version: { increment: 1 } },
        });
        const entry = await tx.walletEntry.create({
          data: {
            vendorId: existing.vendorId,
            walletAccountId: updatedWallet.id,
            type: "CREDIT",
            amountPoints: existing.quoteAmount ?? 0,
            reason: "BUYBACK_CREDIT",
            balanceBefore,
            balanceAfter,
            actorUserId: context.actorUserId,
            requestId: existing.id,
            idempotencyScopeKey,
            referenceType: "CustodyRequest",
            referenceId: existing.id,
            metadata: {
              custodyItemId: existing.custodyItemId,
              policyVersion: existing.policyVersion,
              valueSource: existing.valueSource,
              valueAsOf: existing.valueAsOf ? existing.valueAsOf.toISOString() : null,
              quoteCurrency: existing.quoteCurrency,
              buybackPercent: existing.buybackPercent,
            },
          },
        });
        walletEntryId = entry.id;
        creditedAt = now;
      }
    }

    const request = await tx.custodyRequest.update({
      where: { id: existing.id },
      data: {
        status: finalRequestStatus,
        opsNote: parsed.opsNote,
        reviewedAt: parsed.status === "OPS_REVIEW" || parsed.status === "APPROVED" || parsed.status === "REJECTED" ? now : existing.reviewedAt,
        completedAt: parsed.status === "COMPLETED" || parsed.status === "FULFILLED_MANUAL" ? now : null,
        creditedAt,
        walletEntryId,
      },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        custodyItem: true,
      },
    });
    await tx.custodyItem.update({
      where: { id: existing.custodyItemId },
      data: { status: itemStatus },
    });
    if (existing.custodyItem.packPrizeInventoryAllocationId && finalRequestStatus === "CREDITED") {
      await tx.packPrizeInventoryAllocation.update({
        where: { id: existing.custodyItem.packPrizeInventoryAllocationId },
        data: {
          status: "RELEASED",
          quantityCommitted: { decrement: 1 },
          quantityReleased: { increment: 1 },
        },
      });
    }
    await tx.auditLog.create({
      data: {
        vendorId: context.vendorId,
        actorUserId: context.actorUserId,
        action: "CUSTODY_REQUEST_TRANSITION",
        entityType: "CustodyRequest",
        entityId: existing.id,
        requestId: String(req.header("x-request-id") ?? "").trim() || undefined,
        ipAddress: req.ip,
        userAgent: req.header("user-agent") ?? undefined,
        beforeState: {
          status: existing.status,
          custodyItemStatus: existing.custodyItem.status,
          walletEntryId: existing.walletEntryId,
        },
        afterState: {
          status: finalRequestStatus,
          custodyItemStatus: itemStatus,
          walletEntryId,
        },
        metadata: {
          requestedStatus: parsed.status,
          requestType: existing.type,
          opsNotePresent: parsed.opsNote != null,
          inventoryAllocationId: existing.custodyItem.packPrizeInventoryAllocationId ?? null,
          automaticShippingProvider: false,
        },
      },
    });
    return request;
  });

  return res.json({ request: serializeOpsCustodyRequest({ ...updated, custodyItem: { ...updated.custodyItem, status: itemStatus } }) });
});
