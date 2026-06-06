import { Router } from "express";
import { CustodyRequestStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getRequestUserId, getVendorMembershipRole, hasRole } from "../../lib/rbac";
import { nextCustodyItemStatusForRequest, normalizeOpsRequestStatusUpdate, serializeCustodyItem } from "../../lib/customer-custody";
import { VendorRequest } from "../../middleware/vendor";

export const opsRouter = Router();

async function requireOpsContext(req: VendorRequest, res: any) {
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
  if (!role || !hasRole(role, ["OWNER", "MANAGER", "STAFF"])) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }
  return { vendorId: req.vendorId, actorUserId, role };
}

function parseStatusFilter(input: unknown) {
  const raw = String(input ?? "PENDING").trim().toUpperCase();
  if (raw === "ALL") return undefined;
  const allowed = new Set<CustodyRequestStatus>(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"]);
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
    include: { custodyItem: true },
  });
  if (!existing) return res.status(404).json({ error: "Custody request not found" });
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    return res.status(409).json({ error: "Custody request is already terminal" });
  }

  const now = new Date();
  const itemStatus = nextCustodyItemStatusForRequest(existing.type, parsed.status);
  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.custodyRequest.update({
      where: { id: existing.id },
      data: {
        status: parsed.status,
        opsNote: parsed.opsNote,
        reviewedAt: parsed.status === "APPROVED" || parsed.status === "REJECTED" ? now : existing.reviewedAt,
        completedAt: parsed.status === "COMPLETED" ? now : null,
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
    return request;
  });

  return res.json({ request: serializeOpsCustodyRequest({ ...updated, custodyItem: { ...updated.custodyItem, status: itemStatus } }) });
});
