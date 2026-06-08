import { Router } from "express";
import {
  createVendorSchema,
  updateVendorBusinessSchema,
  updateVendorLimitsSchema,
  updateVendorLogoSchema,
  updateVendorPlanSchema,
  updateVendorPrefixSchema,
  updateVendorProfileSchema,
  updateVendorReferralSchema,
  updateVendorThemeSchema,
  vendorApplicationSchema,
} from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { VendorMembershipRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { requireVendorAccess } from "../../lib/rbac";

export const vendorRouter = Router();

async function requireVendorRole(req: VendorRequest, res: any, allowedRoles: VendorMembershipRole[]) {
  return requireVendorAccess(req, res, allowedRoles);
}

function planLimits(planCode: "BASIC" | "ELITE") {
  if (planCode === "ELITE") {
    return {
      maxPackItems: 150,
      maxPackTiers: 10,
      maxDrawQuantity: 100,
    };
  }
  return {
    maxPackItems: 50,
    maxPackTiers: 5,
    maxDrawQuantity: 100,
  };
}

function parseVendorDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

vendorRouter.post("/v1/vendors", async (req, res) => {
  const parsed = createVendorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const vendor = await prisma.vendor.create({ data: parsed.data });
  return res.status(201).json({ vendor });
});

vendorRouter.get("/v1/vendors/by-host", async (req, res) => {
  const host = String(req.query.host ?? "").trim().toLowerCase();
  if (!host) return res.status(400).json({ error: "host is required" });

  const vendor = await prisma.vendor.findUnique({ where: { host } });
  if (!vendor) return res.status(404).json({ error: "Vendor not found" });

  return res.json({ vendor });
});

vendorRouter.post("/v1/vendor/bootstrap-owner", async (_req: VendorRequest, res) => {
  return res.status(403).json({ error: "Vendor owner bootstrap is disabled. Vendor access requires super admin approval." });
});

vendorRouter.get("/v1/vendor/me", async (req: VendorRequest, res) => {
  const auth = await requireVendorAccess(req, res);
  if (!auth) return;
  return res.json({ userId: auth.actorUserId, role: auth.role, isVendorMember: Boolean(auth.role) });
});

vendorRouter.get("/v1/vendor/current", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const vendor = await prisma.vendor.findUnique({
    where: { id: req.vendorId },
    select: {
      id: true,
      name: true,
      slug: true,
      host: true,
      logoImageUrl: true,
      faviconImageUrl: true,
      isActive: true,
      referralCode: true,
      businessLocation: true,
      businessContact: true,
      vendorSettings: {
        select: {
          storefrontPrimary: true,
          storefrontSecondary: true,
          storefrontAccent: true,
          storefrontSurface: true,
          storefrontText: true,
          storefrontMuted: true,
          storefrontRadius: true,
        },
      },
    },
  });

  if (!vendor) return res.status(404).json({ error: "Vendor not found" });
  return res.json({ vendor });
});

vendorRouter.get("/v1/vendor/application", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;

  const vendor = await prisma.vendor.findUnique({
    where: { id: auth.vendorId },
    select: {
      id: true,
      name: true,
      applicationStatus: true,
      entityName: true,
      yearsOfOperations: true,
      personInCharge: true,
      personInChargeDateOfBirth: true,
      personInChargeCountry: true,
      identificationDocumentType: true,
      identificationDocumentUrl: true,
      businessRegistrationNumber: true,
      registeredBusinessAddress: true,
      contactPhoneNumber: true,
      businessEmail: true,
      websiteOrSocialLinks: true,
      payoutBankDetails: true,
      applicationSubmittedAt: true,
      applicationReviewedAt: true,
      applicationReviewNotes: true,
      updatedAt: true,
    },
  });
  if (!vendor) return res.status(404).json({ error: "Vendor not found" });
  return res.json({ application: vendor });
});

vendorRouter.patch("/v1/vendor/application", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER"]);
  if (!auth) return;

  const parsed = vendorApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const personInChargeDateOfBirth = parseVendorDate(parsed.data.personInChargeDateOfBirth);
  if (!personInChargeDateOfBirth) {
    return res.status(400).json({ error: "personInChargeDateOfBirth must be a valid YYYY-MM-DD date" });
  }
  const identificationDocumentUrl = String(parsed.data.identificationDocumentUrl ?? "").trim();
  if (!identificationDocumentUrl) {
    return res.status(400).json({ error: "identificationDocumentUrl is required" });
  }

  const vendor = await prisma.vendor.update({
    where: { id: auth.vendorId },
    data: {
      entityName: parsed.data.entityName.trim(),
      yearsOfOperations: parsed.data.yearsOfOperations,
      personInCharge: parsed.data.personInCharge.trim(),
      personInChargeDateOfBirth,
      personInChargeCountry: parsed.data.personInChargeCountry.trim().toUpperCase(),
      identificationDocumentType: parsed.data.identificationDocumentType,
      identificationDocumentUrl,
      businessRegistrationNumber: String(parsed.data.businessRegistrationNumber ?? "").trim() || null,
      registeredBusinessAddress: String(parsed.data.registeredBusinessAddress ?? "").trim() || null,
      contactPhoneNumber: String(parsed.data.contactPhoneNumber ?? "").trim() || null,
      businessEmail: String(parsed.data.businessEmail ?? "").trim() || null,
      websiteOrSocialLinks: String(parsed.data.websiteOrSocialLinks ?? "").trim() || null,
      payoutBankDetails: String(parsed.data.payoutBankDetails ?? "").trim() || null,
      applicationStatus: parsed.data.applicationStatus ?? "SUBMITTED",
      applicationSubmittedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      applicationStatus: true,
      entityName: true,
      yearsOfOperations: true,
      personInCharge: true,
      personInChargeDateOfBirth: true,
      personInChargeCountry: true,
      identificationDocumentType: true,
      identificationDocumentUrl: true,
      businessRegistrationNumber: true,
      registeredBusinessAddress: true,
      contactPhoneNumber: true,
      businessEmail: true,
      websiteOrSocialLinks: true,
      payoutBankDetails: true,
      applicationSubmittedAt: true,
      applicationReviewedAt: true,
      applicationReviewNotes: true,
      updatedAt: true,
    },
  });

  return res.json({ application: vendor });
});

vendorRouter.patch("/v1/vendor/theme", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER"]);
  if (!auth) return;

  const parsed = updateVendorThemeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const theme = await prisma.vendorSettings.upsert({
    where: { vendorId: auth.vendorId },
    update: parsed.data,
    create: {
      vendorId: auth.vendorId,
      ...parsed.data,
    },
    select: {
      storefrontPrimary: true,
      storefrontSecondary: true,
      storefrontAccent: true,
      storefrontSurface: true,
      storefrontText: true,
      storefrontMuted: true,
      storefrontRadius: true,
    },
  });

  return res.json({ theme });
});

vendorRouter.patch("/v1/vendor/profile", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER"]);
  if (!auth) return;

  const parsed = updateVendorProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const vendor = await prisma.vendor.update({
    where: { id: auth.vendorId },
    data: { name: parsed.data.name },
    select: {
      id: true,
      name: true,
      slug: true,
      host: true,
      logoImageUrl: true,
      faviconImageUrl: true,
      isActive: true,
      referralCode: true,
      businessLocation: true,
      businessContact: true,
      updatedAt: true,
    },
  });

  return res.json({ vendor });
});

vendorRouter.patch("/v1/vendor/logo", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER"]);
  if (!auth) return;

  const parsed = updateVendorLogoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const vendor = await prisma.vendor.update({
    where: { id: auth.vendorId },
    data: {
      logoImageUrl: parsed.data.logoImageUrl,
      faviconImageUrl: parsed.data.faviconImageUrl ?? parsed.data.logoImageUrl,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      host: true,
      logoImageUrl: true,
      faviconImageUrl: true,
      updatedAt: true,
    },
  });

  return res.json({ vendor });
});

vendorRouter.patch("/v1/vendor/prefix", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER"]);
  if (!auth) return;

  const parsed = updateVendorPrefixSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const nextSlug = parsed.data.slug.trim().toLowerCase();
  const baseDomain = String(process.env.VENDOR_BASE_DOMAIN ?? "").trim().toLowerCase();
  if (!baseDomain) {
    return res.status(400).json({ error: "VENDOR_BASE_DOMAIN is not configured" });
  }

  const nextHost = `${nextSlug}.${baseDomain}`;
  const existing = await prisma.vendor.findFirst({
    where: {
      OR: [{ slug: nextSlug }, { host: nextHost }],
      NOT: { id: auth.vendorId },
    },
    select: { id: true },
  });
  if (existing) {
    return res.status(409).json({ error: "Vendor prefix is already in use" });
  }

  const vendor = await prisma.vendor.update({
    where: { id: auth.vendorId },
    data: { slug: nextSlug, host: nextHost },
    select: {
      id: true,
      name: true,
      slug: true,
      host: true,
      isActive: true,
      referralCode: true,
      businessLocation: true,
      businessContact: true,
      updatedAt: true,
    },
  });

  return res.json({
    vendor,
    message: `Vendor prefix updated. New host: ${nextHost}`,
  });
});

vendorRouter.patch("/v1/vendor/business", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER"]);
  if (!auth) return;

  const parsed = updateVendorBusinessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const vendor = await prisma.vendor.update({
    where: { id: auth.vendorId },
    data: {
      businessLocation: parsed.data.businessLocation,
      businessContact: parsed.data.businessContact,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      host: true,
      referralCode: true,
      businessLocation: true,
      businessContact: true,
      updatedAt: true,
    },
  });

  return res.json({ vendor });
});

vendorRouter.patch("/v1/vendor/referral", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER"]);
  if (!auth) return;

  const parsed = updateVendorReferralSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  try {
    const vendor = await prisma.vendor.update({
      where: { id: auth.vendorId },
      data: { referralCode: parsed.data.referralCode },
      select: { id: true, referralCode: true, updatedAt: true },
    });
    return res.json({ vendor });
  } catch {
    return res.status(409).json({ error: "Referral code already in use" });
  }
});

vendorRouter.get("/v1/vendor/plan", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;
  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
  const planCode = settings?.planCode ?? "BASIC";
  return res.json({
    plan: {
      planCode,
      ...planLimits(planCode),
    },
  });
});

vendorRouter.patch("/v1/vendor/plan", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER"]);
  if (!auth) return;
  const parsed = updateVendorPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const planCode = parsed.data.planCode;
  const limits = planLimits(planCode);

  const updated = await prisma.vendorSettings.upsert({
    where: { vendorId: auth.vendorId },
    update: {
      planCode,
      maxPackItems: limits.maxPackItems,
      maxPackTiers: limits.maxPackTiers,
      maxDrawQuantity: limits.maxDrawQuantity,
    },
    create: {
      vendorId: auth.vendorId,
      planCode,
      maxPackItems: limits.maxPackItems,
      maxPackTiers: limits.maxPackTiers,
      maxDrawQuantity: limits.maxDrawQuantity,
    },
    select: { planCode: true, maxPackItems: true, maxPackTiers: true, maxDrawQuantity: true },
  });

  return res.json({ plan: updated });
});

vendorRouter.get("/v1/vendor/limits", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;
  const settings = await prisma.vendorSettings.findUnique({
    where: { vendorId: auth.vendorId },
    select: { planCode: true, maxPackItems: true, maxPackTiers: true, maxDrawQuantity: true },
  });

  const planCode = settings?.planCode ?? "BASIC";
  const computed = planLimits(planCode);

  return res.json({
    limits: {
      planCode,
      maxPackItems: settings?.maxPackItems ?? computed.maxPackItems,
      maxPackTiers: settings?.maxPackTiers ?? computed.maxPackTiers,
      maxDrawQuantity: settings?.maxDrawQuantity ?? computed.maxDrawQuantity,
    },
  });
});

vendorRouter.patch("/v1/vendor/limits", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER"]);
  if (!auth) return;
  const parsed = updateVendorLimitsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const existing = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
  const planCode = existing?.planCode ?? "BASIC";
  const bounds = planLimits(planCode);

  const nextItems = parsed.data.maxPackItems ?? existing?.maxPackItems ?? bounds.maxPackItems;
  const nextQty = parsed.data.maxDrawQuantity ?? existing?.maxDrawQuantity ?? bounds.maxDrawQuantity;
  const nextTiers = existing?.maxPackTiers ?? bounds.maxPackTiers;

  if (nextItems > bounds.maxPackItems) {
    return res.status(400).json({ error: `plan limit exceeded: maxPackItems <= ${bounds.maxPackItems}` });
  }

  const updated = await prisma.vendorSettings.upsert({
    where: { vendorId: auth.vendorId },
    update: {
      maxPackItems: nextItems,
      maxPackTiers: nextTiers,
      maxDrawQuantity: nextQty,
    },
    create: {
      vendorId: auth.vendorId,
      planCode,
      maxPackItems: nextItems,
      maxPackTiers: nextTiers,
      maxDrawQuantity: nextQty,
    },
    select: { planCode: true, maxPackItems: true, maxPackTiers: true, maxDrawQuantity: true },
  });

  return res.json({ limits: updated });
});

vendorRouter.get("/v1/vendor/earnings/summary", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;

  const [entries, walletAgg] = await Promise.all([
    prisma.vendorRevenueLedger.findMany({
      where: { vendorId: auth.vendorId, type: "DRAW_GROSS" },
      select: { amountPoints: true, amountCurrency: true, currencyCode: true },
    }),
    prisma.walletEntry.aggregate({
      where: { vendorId: auth.vendorId, type: "DEBIT", reason: "PACK_DRAW" },
      _sum: { amountPoints: true },
    }),
  ]);

  const totalRevenuePoints = entries.reduce((sum, row) => sum + row.amountPoints, 0);
  const totalRevenueCurrency = entries.reduce((sum, row) => sum + Number(row.amountCurrency ?? 0), 0);
  const vendorSpentPoints = walletAgg._sum.amountPoints ?? 0;

  return res.json({
    summary: {
      totalRevenuePoints,
      totalRevenueCurrency: Number(totalRevenueCurrency.toFixed(2)),
      vendorSpentPoints,
      netPoints: totalRevenuePoints - vendorSpentPoints,
      currencyCode: entries[0]?.currencyCode ?? "USD",
    },
  });
});

vendorRouter.get("/v1/vendor/earnings/packs", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;

  const packs = await prisma.pack.findMany({
    where: { vendorId: auth.vendorId },
    select: { id: true, title: true },
  });

  const rows = await prisma.drawOrder.groupBy({
    by: ["packId"],
    where: { vendorId: auth.vendorId, status: "COMPLETED" },
    _sum: { totalPoints: true, quantity: true },
    _count: { _all: true },
  });

  const packMap = new Map(packs.map((pack) => [pack.id, pack.title]));
  const items = rows.map((row) => ({
    packId: row.packId,
    packTitle: packMap.get(row.packId) ?? "Unknown Pack",
    drawOrders: row._count._all,
    totalDrawQuantity: row._sum.quantity ?? 0,
    totalPoints: row._sum.totalPoints ?? 0,
  }));

  return res.json({ items });
});

vendorRouter.get("/v1/vendor/referrals", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;

  const vendor = await prisma.vendor.findUnique({ where: { id: auth.vendorId }, select: { referralCode: true } });
  if (!vendor?.referralCode) {
    return res.json({ referralCode: null, customers: [] });
  }

  const signups = await prisma.vendorReferralSignup.findMany({
    where: {
      vendorId: auth.vendorId,
    },
    include: { customerUser: { select: { id: true, email: true, displayName: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const customers = signups.map((row) => ({
    id: row.customerUser.id,
    email: row.customerUser.email,
    displayName: row.customerUser.displayName,
    createdAt: row.customerUser.createdAt,
    referredAt: row.createdAt,
    referralCode: row.referralCode,
  }));

  return res.json({ referralCode: vendor.referralCode, customers });
});

vendorRouter.post("/v1/vendor/points/qr", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER"]);
  if (!auth) return;
  const vendorId = auth.vendorId;
  const actorUserId = auth.actorUserId;

  const points = Number(req.body?.points ?? 0);
  const expiresInMinutes = Number(req.body?.expiresInMinutes ?? 15);

  if (!Number.isInteger(points) || points <= 0) return res.status(400).json({ error: "points must be a positive integer" });
  if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 1 || expiresInMinutes > 1440) {
    return res.status(400).json({ error: "expiresInMinutes must be between 1 and 1440" });
  }

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const token = randomUUID();
  const qr = await prisma.vendorPointGrantQr.create({
    data: {
      vendorId,
      token,
      points,
      expiresAt,
      createdByUserId: actorUserId,
    },
  });

  return res.status(201).json({ qr });
});

vendorRouter.get("/v1/vendor/points/qr", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;
  const vendorId = auth.vendorId;

  const qrs = await prisma.vendorPointGrantQr.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({ qrs });
});

vendorRouter.post("/v1/points/qr/redeem", async (req: VendorRequest, res) => {
  const auth = await requireVendorAccess(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;
  const vendorId = auth.vendorId;
  const actorUserId = auth.actorUserId;

  const token = String(req.body?.token ?? "").trim();
  if (!token) return res.status(400).json({ error: "token is required" });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const qr = await tx.vendorPointGrantQr.findFirst({
        where: { vendorId, token },
      });
      if (!qr) throw new Error("QR not found");
      if (qr.status !== "ACTIVE") throw new Error("QR is no longer active");
      if (qr.expiresAt <= new Date()) throw new Error("QR expired");

      const vendorWallet = await tx.walletAccount.findFirst({
        where: { vendorId, userId: null },
      });
      if (!vendorWallet) throw new Error("Vendor source wallet not found");
      if (vendorWallet.balancePoints < qr.points) throw new Error("Vendor balance insufficient");

      const customerWallet = await tx.walletAccount.upsert({
        where: { vendorId_userId: { vendorId, userId: actorUserId } },
        update: {},
        create: {
          vendorId,
          userId: actorUserId,
          ownerLabel: "Customer",
          balancePoints: 0,
        },
      });

      const vendorBefore = vendorWallet.balancePoints;
      const vendorAfter = vendorBefore - qr.points;
      const customerBefore = customerWallet.balancePoints;
      const customerAfter = customerBefore + qr.points;

      await tx.walletAccount.update({
        where: { id: vendorWallet.id },
        data: { balancePoints: { decrement: qr.points }, version: { increment: 1 } },
      });
      await tx.walletAccount.update({
        where: { id: customerWallet.id },
        data: { balancePoints: { increment: qr.points }, version: { increment: 1 } },
      });

      await tx.walletEntry.createMany({
        data: [
          {
            vendorId,
            walletAccountId: vendorWallet.id,
            type: "DEBIT",
            amountPoints: qr.points,
            reason: "VENDOR_QR_GRANT",
            balanceBefore: vendorBefore,
            balanceAfter: vendorAfter,
            actorUserId,
            referenceType: "VENDOR_QR",
            referenceId: qr.id,
            metadata: { token: qr.token },
          },
          {
            vendorId,
            walletAccountId: customerWallet.id,
            type: "CREDIT",
            amountPoints: qr.points,
            reason: "VENDOR_QR_GRANT",
            balanceBefore: customerBefore,
            balanceAfter: customerAfter,
            actorUserId,
            referenceType: "VENDOR_QR",
            referenceId: qr.id,
            metadata: { token: qr.token },
          },
        ],
      });

      const redeemed = await tx.vendorPointGrantQr.update({
        where: { id: qr.id },
        data: {
          status: "REDEEMED",
          redeemedByUserId: actorUserId,
          redeemedAt: new Date(),
        },
      });

      return { qr: redeemed, pointsCredited: qr.points };
    });

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to redeem QR";
    return res.status(400).json({ error: message });
  }
});
