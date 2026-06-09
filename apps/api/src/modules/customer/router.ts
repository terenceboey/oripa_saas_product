import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getRequestUserId } from "../../lib/rbac";
import { isCustomerProfileComplete } from "../../lib/customer-profile";
import {
  buildBuybackQuoteForCustodyItem,
  isBuybackQuoteExpired,
  isCustomerCustodyEnabled,
  nextCustodyItemStatusForRequest,
  normalizeCustomerRequestNote,
  normalizeIdempotencyKey,
  serializeCustodyItem,
  serializeCustodyRequest,
  serializeCustomerDraw,
} from "../../lib/customer-custody";
import { VendorRequest } from "../../middleware/vendor";

export const customerRouter = Router();

async function requireCustomerContext(req: VendorRequest, res: any) {
  const userId = await getRequestUserId(req, res);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (!req.vendorId) {
    res.status(400).json({ error: "Vendor not resolved" });
    return null;
  }
  return { userId, vendorId: req.vendorId };
}

function requireCustodyFeature(res: any) {
  if (isCustomerCustodyEnabled(process.env)) return true;
  res.status(404).json({ error: "Customer custody is not enabled for this deployment" });
  return false;
}

customerRouter.get("/v1/customer/summary", async (req: VendorRequest, res) => {
  const context = await requireCustomerContext(req, res);
  if (!context) return;

  const custodyEnabled = isCustomerCustodyEnabled(process.env);
  const [user, vendor, wallet, heldItems, pendingRequests, drawCount, livePacks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: context.userId },
      select: { id: true, email: true, displayName: true, age: true, country: true },
    }),
    prisma.vendor.findUnique({
      where: { id: context.vendorId },
      select: { id: true, name: true, slug: true, logoImageUrl: true, faviconImageUrl: true, vendorSettings: true },
    }),
    prisma.walletAccount.findUnique({
      where: { vendorId_userId: { vendorId: context.vendorId, userId: context.userId } },
      select: { balancePoints: true },
    }),
    custodyEnabled ? prisma.custodyItem.count({ where: { vendorId: context.vendorId, userId: context.userId, status: "HELD" } }) : Promise.resolve(0),
    custodyEnabled ? prisma.custodyRequest.count({ where: { vendorId: context.vendorId, userId: context.userId, status: { in: ["QUOTED", "PENDING", "OPS_REVIEW", "APPROVED", "PACKED"] } } }) : Promise.resolve(0),
    prisma.drawOrder.count({ where: { vendorId: context.vendorId, userId: context.userId } }),
    prisma.pack.findMany({
      where: { vendorId: context.vendorId, isActive: true, status: "LIVE" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        packBannerImageUrl: true,
        pricePoints: true,
        remainingStock: true,
        totalStock: true,
        limitedLabel: true,
      },
    }),
  ]);

  if (!user) return res.status(404).json({ error: "User not found" });
  if (!vendor) return res.status(404).json({ error: "Vendor not found" });

  return res.json({
    profile: {
      id: user.id,
      email: user.email,
      name: user.displayName,
      age: user.age,
      country: user.country,
      profileComplete: isCustomerProfileComplete(user),
    },
    vendor,
    wallet: { balancePoints: wallet?.balancePoints ?? 0 },
    custody: { enabled: custodyEnabled },
    counts: { heldItems, pendingRequests, drawCount },
    livePacks,
  });
});

customerRouter.get("/v1/customer/items", async (req: VendorRequest, res) => {
  if (!requireCustodyFeature(res)) return;
  const context = await requireCustomerContext(req, res);
  if (!context) return;

  const items = await prisma.custodyItem.findMany({
    where: { vendorId: context.vendorId, userId: context.userId },
    orderBy: { createdAt: "desc" },
    include: { requests: { orderBy: { requestedAt: "desc" }, take: 5 } },
  });

  return res.json({ items: items.map(serializeCustodyItem) });
});

customerRouter.get("/v1/customer/draws", async (req: VendorRequest, res) => {
  const context = await requireCustomerContext(req, res);
  if (!context) return;

  const draws = await prisma.drawOrder.findMany({
    where: { vendorId: context.vendorId, userId: context.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      pack: { select: { title: true, packBannerImageUrl: true } },
      fairnessProof: { select: { id: true, serverSeedHash: true } },
      results: {
        orderBy: { drawSequence: "asc" },
        include: {
          packPrize: { select: { label: true, imageUrl: true, estimatedValue: true } },
          custodyItem: { select: { id: true, status: true } },
        },
      },
    },
  });

  return res.json({ draws: draws.map(serializeCustomerDraw) });
});

async function createCustodyRequest(req: VendorRequest, res: any, type: "REDEMPTION" | "BUYBACK") {
  if (!requireCustodyFeature(res)) return;
  const context = await requireCustomerContext(req, res);
  if (!context) return;

  if (type === "BUYBACK") return res.status(400).json({ error: "Use buyback quote and accept endpoints" });

  const note = normalizeCustomerRequestNote(req.body?.note);
  if (req.body?.note != null && note == null) return res.status(400).json({ error: "Note must be 1-500 characters" });

  const item = await prisma.custodyItem.findFirst({
    where: { id: req.params.id, vendorId: context.vendorId, userId: context.userId },
    include: { requests: { where: { status: { in: ["QUOTED", "PENDING", "OPS_REVIEW", "APPROVED", "PACKED"] } }, take: 1 } },
  });
  if (!item) return res.status(404).json({ error: "Custody item not found" });
  if (item.status !== "HELD" || item.requests.length > 0) {
    return res.status(409).json({ error: "Custody item already has an active request" });
  }

  const nextStatus = nextCustodyItemStatusForRequest(type, "PENDING");
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.custodyRequest.create({
      data: {
        vendorId: context.vendorId,
        userId: context.userId,
        custodyItemId: item.id,
        type,
        customerNote: note,
      },
    });
    const updatedItem = await tx.custodyItem.update({
      where: { id: item.id },
      data: { status: nextStatus },
      include: { requests: { orderBy: { requestedAt: "desc" }, take: 5 } },
    });
    return { request, item: updatedItem };
  });

  return res.status(201).json({ request: result.request, item: serializeCustodyItem(result.item) });
}


function buybackIdempotencyScope(vendorId: string, userId: string, custodyItemId: string, key: string) {
  return `buyback-quote:${vendorId}:${userId}:${custodyItemId}:${key}`;
}

customerRouter.post("/v1/customer/items/:id/buyback-quotes", async (req: VendorRequest, res) => {
  if (!requireCustodyFeature(res)) return;
  const context = await requireCustomerContext(req, res);
  if (!context) return;

  const idempotencyKey = normalizeIdempotencyKey(req.header("x-idempotency-key") ?? req.body?.idempotencyKey);
  if (!idempotencyKey) return res.status(400).json({ error: "Idempotency key required" });
  const idempotencyScopeKey = buybackIdempotencyScope(context.vendorId, context.userId, req.params.id, idempotencyKey);

  const existingQuote = await prisma.custodyRequest.findFirst({
    where: { vendorId: context.vendorId, userId: context.userId, custodyItemId: req.params.id, type: "BUYBACK", idempotencyScopeKey },
  });
  if (existingQuote) return res.status(200).json({ quote: serializeCustodyRequest(existingQuote) });

  const item = await prisma.custodyItem.findFirst({
    where: { id: req.params.id, vendorId: context.vendorId, userId: context.userId },
    include: { requests: { where: { status: { in: ["QUOTED", "PENDING", "OPS_REVIEW", "APPROVED", "PACKED"] } }, take: 1 } },
  });
  if (!item) return res.status(404).json({ error: "Custody item not found" });

  const quote = buildBuybackQuoteForCustodyItem(item);
  if (!quote.ok) {
    const status = quote.reasonCode === "active_request" ? 409 : 400;
    return res.status(status).json({ error: quote.error, reasonCode: quote.reasonCode });
  }

  const created = await prisma.custodyRequest.create({
    data: {
      vendorId: context.vendorId,
      userId: context.userId,
      custodyItemId: item.id,
      type: "BUYBACK",
      status: "QUOTED",
      quoteAmount: quote.quoteAmount,
      quoteCurrency: quote.quoteCurrency,
      buybackPercent: quote.buybackPercent,
      policyVersion: quote.policyVersion,
      valueSource: quote.valueSource,
      valueAsOf: quote.valueAsOf,
      expiresAt: quote.expiresAt,
      idempotencyKey,
      idempotencyScopeKey,
    },
  });

  return res.status(201).json({ quote: serializeCustodyRequest(created) });
});

customerRouter.post("/v1/customer/buyback-quotes/:id/accept", async (req: VendorRequest, res) => {
  if (!requireCustodyFeature(res)) return;
  const context = await requireCustomerContext(req, res);
  if (!context) return;

  const note = normalizeCustomerRequestNote(req.body?.note);
  if (req.body?.note != null && note == null) return res.status(400).json({ error: "Note must be 1-500 characters" });

  const existing = await prisma.custodyRequest.findFirst({
    where: { id: req.params.id, vendorId: context.vendorId, userId: context.userId, type: "BUYBACK" },
    include: { custodyItem: true },
  });
  if (!existing) return res.status(404).json({ error: "Buyback quote not found" });
  if (existing.status === "PENDING" || existing.status === "APPROVED" || existing.status === "CREDITED") {
    return res.status(200).json({ request: serializeCustodyRequest(existing), item: serializeCustodyItem({ ...existing.custodyItem, requests: [existing] }) });
  }
  if (existing.status !== "QUOTED") return res.status(409).json({ error: "Buyback quote is not acceptable" });
  if (isBuybackQuoteExpired(existing)) {
    const expired = await prisma.custodyRequest.update({ where: { id: existing.id }, data: { status: "EXPIRED" } });
    return res.status(409).json({ error: "Buyback quote expired", quote: serializeCustodyRequest(expired) });
  }

  const acceptedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.custodyRequest.update({
      where: { id: existing.id },
      data: { status: "PENDING", customerNote: note, acceptedAt },
    });
    const item = await tx.custodyItem.update({
      where: { id: existing.custodyItemId },
      data: { status: nextCustodyItemStatusForRequest("BUYBACK", "PENDING") },
      include: { requests: { orderBy: { requestedAt: "desc" }, take: 5 } },
    });
    return { request, item };
  });

  return res.status(200).json({ request: serializeCustodyRequest(result.request), item: serializeCustodyItem(result.item) });
});

customerRouter.post("/v1/customer/items/:id/redemption-requests", async (req: VendorRequest, res) => {
  return createCustodyRequest(req, res, "REDEMPTION");
});

customerRouter.post("/v1/customer/items/:id/buyback-requests", async (req: VendorRequest, res) => {
  return createCustodyRequest(req, res, "BUYBACK");
});
