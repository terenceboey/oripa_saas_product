import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getRequestUserId } from "../../lib/rbac";
import { isCustomerProfileComplete } from "../../lib/customer-profile";
import {
  isCustomerCustodyEnabled,
  nextCustodyItemStatusForRequest,
  normalizeCustomerRequestNote,
  serializeCustodyItem,
  serializeCustomerDraw,
} from "../../lib/customer-custody";
import { VendorRequest } from "../../middleware/vendor";

export const customerRouter = Router();

function requireCustomerContext(req: VendorRequest, res: any) {
  const userId = getRequestUserId(req);
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
  const context = requireCustomerContext(req, res);
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
    custodyEnabled ? prisma.custodyRequest.count({ where: { vendorId: context.vendorId, userId: context.userId, status: "PENDING" } }) : Promise.resolve(0),
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
  const context = requireCustomerContext(req, res);
  if (!context) return;

  const items = await prisma.custodyItem.findMany({
    where: { vendorId: context.vendorId, userId: context.userId },
    orderBy: { createdAt: "desc" },
    include: { requests: { orderBy: { requestedAt: "desc" }, take: 5 } },
  });

  return res.json({ items: items.map(serializeCustodyItem) });
});

customerRouter.get("/v1/customer/draws", async (req: VendorRequest, res) => {
  const context = requireCustomerContext(req, res);
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
  const context = requireCustomerContext(req, res);
  if (!context) return;

  const note = normalizeCustomerRequestNote(req.body?.note);
  if (req.body?.note != null && note == null) return res.status(400).json({ error: "Note must be 1-500 characters" });

  const item = await prisma.custodyItem.findFirst({
    where: { id: req.params.id, vendorId: context.vendorId, userId: context.userId },
    include: { requests: { where: { status: { in: ["PENDING", "APPROVED"] } }, take: 1 } },
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

customerRouter.post("/v1/customer/items/:id/redemption-requests", async (req: VendorRequest, res) => {
  return createCustodyRequest(req, res, "REDEMPTION");
});

customerRouter.post("/v1/customer/items/:id/buyback-requests", async (req: VendorRequest, res) => {
  return createCustodyRequest(req, res, "BUYBACK");
});
