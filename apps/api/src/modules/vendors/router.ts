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

function toNullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
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
          storefrontThemePreset: true,
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
      registeredBusinessAddressLine1: true,
      registeredBusinessAddressLine2: true,
      registeredBusinessAddressCity: true,
      registeredBusinessAddressStateProvince: true,
      registeredBusinessAddressPostalCode: true,
      registeredBusinessAddressCountry: true,
      contactPhoneNumber: true,
      businessEmail: true,
      businessWebsiteUrl: true,
      facebookUrl: true,
      instagramUrl: true,
      tiktokUrl: true,
      xUrl: true,
      linkedinUrl: true,
      youtubeUrl: true,
      payoutBankAccountHolderName: true,
      payoutBankName: true,
      payoutBankCountry: true,
      payoutBankAccountNumber: true,
      payoutBankIban: true,
      payoutBankSwiftBic: true,
      payoutBankBranchCode: true,
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
      registeredBusinessAddressLine1: toNullableText(parsed.data.registeredBusinessAddressLine1),
      registeredBusinessAddressLine2: toNullableText(parsed.data.registeredBusinessAddressLine2),
      registeredBusinessAddressCity: toNullableText(parsed.data.registeredBusinessAddressCity),
      registeredBusinessAddressStateProvince: toNullableText(parsed.data.registeredBusinessAddressStateProvince),
      registeredBusinessAddressPostalCode: toNullableText(parsed.data.registeredBusinessAddressPostalCode),
      registeredBusinessAddressCountry: toNullableText(parsed.data.registeredBusinessAddressCountry),
      contactPhoneNumber: String(parsed.data.contactPhoneNumber ?? "").trim() || null,
      businessEmail: String(parsed.data.businessEmail ?? "").trim() || null,
      businessWebsiteUrl: toNullableText(parsed.data.businessWebsiteUrl),
      facebookUrl: toNullableText(parsed.data.facebookUrl),
      instagramUrl: toNullableText(parsed.data.instagramUrl),
      tiktokUrl: toNullableText(parsed.data.tiktokUrl),
      xUrl: toNullableText(parsed.data.xUrl),
      linkedinUrl: toNullableText(parsed.data.linkedinUrl),
      youtubeUrl: toNullableText(parsed.data.youtubeUrl),
      payoutBankAccountHolderName: toNullableText(parsed.data.payoutBankAccountHolderName),
      payoutBankName: toNullableText(parsed.data.payoutBankName),
      payoutBankCountry: toNullableText(parsed.data.payoutBankCountry),
      payoutBankAccountNumber: toNullableText(parsed.data.payoutBankAccountNumber),
      payoutBankIban: toNullableText(parsed.data.payoutBankIban),
      payoutBankSwiftBic: toNullableText(parsed.data.payoutBankSwiftBic),
      payoutBankBranchCode: toNullableText(parsed.data.payoutBankBranchCode),
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
      registeredBusinessAddressLine1: true,
      registeredBusinessAddressLine2: true,
      registeredBusinessAddressCity: true,
      registeredBusinessAddressStateProvince: true,
      registeredBusinessAddressPostalCode: true,
      registeredBusinessAddressCountry: true,
      contactPhoneNumber: true,
      businessEmail: true,
      businessWebsiteUrl: true,
      facebookUrl: true,
      instagramUrl: true,
      tiktokUrl: true,
      xUrl: true,
      linkedinUrl: true,
      youtubeUrl: true,
      payoutBankAccountHolderName: true,
      payoutBankName: true,
      payoutBankCountry: true,
      payoutBankAccountNumber: true,
      payoutBankIban: true,
      payoutBankSwiftBic: true,
      payoutBankBranchCode: true,
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

  const { storefrontThemePreset, ...themeFields } = parsed.data;
  const themeData = {
    ...themeFields,
    ...(storefrontThemePreset != null ? { storefrontThemePreset } : {}),
  };

  const theme = await prisma.vendorSettings.upsert({
    where: { vendorId: auth.vendorId },
    update: themeData,
    create: {
      vendorId: auth.vendorId,
      ...themeData,
    },
    select: {
      storefrontPrimary: true,
      storefrontSecondary: true,
      storefrontAccent: true,
      storefrontSurface: true,
      storefrontText: true,
      storefrontMuted: true,
      storefrontRadius: true,
      storefrontThemePreset: true,
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

  const [entries, walletAgg, topupAgg, vendorWallet] = await Promise.all([
    prisma.vendorRevenueLedger.findMany({
      where: { vendorId: auth.vendorId, type: { in: ["DRAW_GROSS", "PLATFORM_FEE", "TENANT_NET"] } },
      select: { type: true, amountPoints: true, amountCurrency: true, currencyCode: true },
    }),
    prisma.walletEntry.aggregate({
      where: { vendorId: auth.vendorId, type: "DEBIT", reason: "PACK_DRAW" },
      _sum: { amountPoints: true },
    }),
    prisma.walletEntry.aggregate({
      where: { vendorId: auth.vendorId, type: "CREDIT", reason: "WALLET_TOPUP" },
      _sum: { amountPoints: true },
      _count: { _all: true },
    }),
    prisma.walletAccount.findFirst({
      where: { vendorId: auth.vendorId, userId: null },
      select: { balancePoints: true },
    }),
  ]);

  const totalRevenuePoints = entries.filter((row) => row.type === "DRAW_GROSS").reduce((sum, row) => sum + row.amountPoints, 0);
  const platformFeePoints = entries.filter((row) => row.type === "PLATFORM_FEE").reduce((sum, row) => sum + row.amountPoints, 0);
  const tenantNetPoints = entries.filter((row) => row.type === "TENANT_NET").reduce((sum, row) => sum + row.amountPoints, 0);
  const totalRevenueCurrency = entries.filter((row) => row.type === "DRAW_GROSS").reduce((sum, row) => sum + Number(row.amountCurrency ?? 0), 0);
  const vendorSpentPoints = walletAgg._sum.amountPoints ?? 0;
  const topupPoints = topupAgg._sum.amountPoints ?? 0;
  const topupCount = topupAgg._count._all ?? 0;
  const vendorWalletBalance = vendorWallet?.balancePoints ?? 0;

  return res.json({
    summary: {
      totalRevenuePoints,
      totalRevenueCurrency: Number(totalRevenueCurrency.toFixed(2)),
      platformFeePoints,
      tenantNetPoints,
      vendorSpentPoints,
      vendorWalletBalance,
      topupPoints,
      topupCount,
      netPoints: vendorWalletBalance,
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

vendorRouter.get("/v1/vendor/earnings/topups", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;

  const [topups, aggregate] = await Promise.all([
    prisma.walletEntry.findMany({
      where: { vendorId: auth.vendorId, type: "CREDIT", reason: "WALLET_TOPUP" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        amountPoints: true,
        metadata: true,
        createdAt: true,
        walletAccount: {
          select: {
            user: {
              select: {
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
    }),
    prisma.walletEntry.aggregate({
      where: { vendorId: auth.vendorId, type: "CREDIT", reason: "WALLET_TOPUP" },
      _sum: { amountPoints: true },
      _count: { _all: true },
    }),
  ]);

  return res.json({
    topups: topups.map((row) => {
      const metadata = (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) ? row.metadata as Record<string, unknown> : {};
      return {
        id: row.id,
        pointsToCredit: row.amountPoints,
        amountCurrency: typeof metadata.amountCurrency === "number" ? metadata.amountCurrency : Number(metadata.amountCurrency ?? 0),
        currencyCode: typeof metadata.currencyCode === "string" ? metadata.currencyCode : null,
        createdAt: row.createdAt,
        user: row.walletAccount?.user ?? null,
      };
    }),
    summary: {
      topupPoints: aggregate._sum.amountPoints ?? 0,
      topupCount: aggregate._count._all ?? 0,
    },
  });
});

vendorRouter.get("/v1/vendor/wins", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;

  const packId = String(req.query.packId ?? "").trim();
  const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

  const wins = await prisma.drawResult.findMany({
    where: {
      vendorId: auth.vendorId,
      ...(packId ? { packId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      drawSequence: true,
      pointsSpent: true,
      createdAt: true,
      pack: {
        select: {
          id: true,
          title: true,
        },
      },
      packPrize: {
        select: {
          id: true,
          label: true,
          imageUrl: true,
          imageLargeUrl: true,
          estimatedValue: true,
          rarity: true,
        },
      },
      drawOrder: {
        select: {
          id: true,
          quantity: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              fullName: true,
              phoneNumber: true,
              shippingAddressLine1: true,
              shippingAddressLine2: true,
              shippingAddressCity: true,
              shippingAddressState: true,
              shippingAddressPostalCode: true,
              shippingAddressCountry: true,
            },
          },
        },
      },
      custodyItem: {
        select: {
          prizeLabel: true,
          imageUrl: true,
          imageLargeUrl: true,
          estimatedValue: true,
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              fullName: true,
              phoneNumber: true,
              shippingAddressLine1: true,
              shippingAddressLine2: true,
              shippingAddressCity: true,
              shippingAddressState: true,
              shippingAddressPostalCode: true,
              shippingAddressCountry: true,
            },
          },
        },
      },
    },
  });

  return res.json({
    wins: wins.map((row) => {
      const prizeLabel = row.packPrize?.label ?? row.custodyItem?.prizeLabel ?? "No prize";
      const prizeImageUrl = row.packPrize?.imageLargeUrl ?? row.packPrize?.imageUrl ?? row.custodyItem?.imageLargeUrl ?? row.custodyItem?.imageUrl ?? null;
      const prizeEstimatedValue = row.packPrize?.estimatedValue ?? row.custodyItem?.estimatedValue ?? null;
      const customer = row.drawOrder.user ?? row.custodyItem?.user ?? null;
      return {
        id: row.id,
        packId: row.pack.id,
        packTitle: row.pack.title,
        drawSequence: row.drawSequence,
        pointsSpent: row.pointsSpent,
        createdAt: row.createdAt,
        drawOrderId: row.drawOrder.id,
        drawOrderQuantity: row.drawOrder.quantity,
        customer,
        prize: {
          id: row.packPrize?.id ?? null,
          label: prizeLabel,
          imageUrl: prizeImageUrl,
          estimatedValue: prizeEstimatedValue,
          rarity: row.packPrize?.rarity ?? null,
        },
      };
    }),
  });
});

vendorRouter.get("/v1/vendor/fulfilment", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;

  const packId = String(req.query.packId ?? "").trim();
  const statusRaw = String(req.query.status ?? "").trim().toUpperCase();
  const search = String(req.query.q ?? "").trim();
  const limitRaw = Number.parseInt(String(req.query.limit ?? "100"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

  const validStatuses = new Set(["HELD", "REDEMPTION_REQUESTED", "BUYBACK_REQUESTED", "REDEEMED", "BOUGHT_BACK", "VOIDED"]);
  if (statusRaw && !validStatuses.has(statusRaw)) {
    return res.status(400).json({ error: "invalid status filter" });
  }

  const where: any = {
    vendorId: auth.vendorId,
    ...(packId ? { packId } : {}),
    ...(statusRaw ? { status: statusRaw as any } : {}),
    ...(search
      ? {
          OR: [
            { prizeLabel: { contains: search, mode: "insensitive" as const } },
            { cardName: { contains: search, mode: "insensitive" as const } },
            { setName: { contains: search, mode: "insensitive" as const } },
            { rarity: { contains: search, mode: "insensitive" as const } },
            { providerMemo: { contains: search, mode: "insensitive" as const } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
            { user: { displayName: { contains: search, mode: "insensitive" as const } } },
            { user: { fullName: { contains: search, mode: "insensitive" as const } } },
            { pack: { title: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const items = (await prisma.custodyItem.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      status: true,
      provider: true,
      providerMemo: true,
      providerTxSig: true,
      prizeLabel: true,
      imageUrl: true,
      imageLargeUrl: true,
      setName: true,
      cardName: true,
      rarity: true,
      estimatedValue: true,
      createdAt: true,
      updatedAt: true,
      drawOrderId: true,
      pack: {
        select: {
          id: true,
          title: true,
        },
      },
      packPrize: {
        select: {
          id: true,
          label: true,
          imageUrl: true,
          imageLargeUrl: true,
          estimatedValue: true,
          rarity: true,
        },
      },
      drawOrder: {
        select: {
          id: true,
          quantity: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              fullName: true,
              phoneNumber: true,
              shippingAddressLine1: true,
              shippingAddressLine2: true,
              shippingAddressCity: true,
              shippingAddressState: true,
              shippingAddressPostalCode: true,
              shippingAddressCountry: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          fullName: true,
          phoneNumber: true,
          shippingAddressLine1: true,
          shippingAddressLine2: true,
          shippingAddressCity: true,
          shippingAddressState: true,
          shippingAddressPostalCode: true,
          shippingAddressCountry: true,
        },
      },
    },
  })) as any[];

  const summary = items.reduce(
    (acc, row) => {
      const customer = row.user ?? row.drawOrder.user ?? null;
      const shippingComplete = Boolean(
        customer?.phoneNumber?.trim() &&
          customer?.shippingAddressLine1?.trim() &&
          customer?.shippingAddressCity?.trim() &&
          customer?.shippingAddressPostalCode?.trim() &&
          customer?.shippingAddressCountry?.trim()
      );
      acc.total += 1;
      acc.byStatus[row.status] = (acc.byStatus[row.status] ?? 0) + 1;
      if (shippingComplete) acc.shippingComplete += 1;
      else acc.shippingMissing += 1;
      return acc;
    },
    {
      total: 0,
      shippingComplete: 0,
      shippingMissing: 0,
      byStatus: {} as Record<string, number>,
    }
  );

  return res.json({
    items: items.map((row) => {
      const customer = row.user ?? row.drawOrder.user ?? null;
      const shippingComplete = Boolean(
        customer?.phoneNumber?.trim() &&
          customer?.shippingAddressLine1?.trim() &&
          customer?.shippingAddressCity?.trim() &&
          customer?.shippingAddressPostalCode?.trim() &&
          customer?.shippingAddressCountry?.trim()
      );
      return {
        id: row.id,
        status: row.status,
        provider: row.provider,
        providerMemo: row.providerMemo,
        providerTxSig: row.providerTxSig,
        prizeLabel: row.packPrize?.label ?? row.prizeLabel,
        prizeImageUrl: row.packPrize?.imageLargeUrl ?? row.packPrize?.imageUrl ?? row.imageLargeUrl ?? row.imageUrl ?? null,
        prizeEstimatedValue: row.packPrize?.estimatedValue ?? row.estimatedValue ?? null,
        prizeRarity: row.packPrize?.rarity ?? row.rarity ?? null,
        setName: row.setName ?? null,
        cardName: row.cardName ?? null,
        drawOrderId: row.drawOrderId,
        drawOrderQuantity: row.drawOrder.quantity,
        pack: row.pack,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        shippingComplete,
        customer,
      };
    }),
    summary,
  });
});

vendorRouter.patch("/v1/vendor/fulfilment/:custodyItemId", async (req: VendorRequest, res) => {
  const auth = await requireVendorRole(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;

  const custodyItemId = String(req.params.custodyItemId ?? "").trim();
  if (!custodyItemId) {
    return res.status(400).json({ error: "custodyItemId is required" });
  }

  const statusInput = String(req.body?.status ?? "").trim().toUpperCase();
  const providerMemo = String(req.body?.providerMemo ?? "").trim();
  const providerTxSig = String(req.body?.providerTxSig ?? "").trim();
  const provider = String(req.body?.provider ?? "").trim().toUpperCase();
  const validStatuses = new Set(["HELD", "REDEMPTION_REQUESTED", "BUYBACK_REQUESTED", "REDEEMED", "BOUGHT_BACK", "VOIDED"]);
  const validProviders = new Set(["ORIPA_INTERNAL", "AIRWALLEX", "MANUAL"]);

  if (!statusInput && !providerMemo && !providerTxSig && !provider) {
    return res.status(400).json({ error: "no update fields provided" });
  }
  if (statusInput && !validStatuses.has(statusInput)) {
    return res.status(400).json({ error: "invalid status" });
  }
  if (provider && !validProviders.has(provider)) {
    return res.status(400).json({ error: "invalid provider" });
  }

  const existing = await prisma.custodyItem.findFirst({
    where: { id: custodyItemId, vendorId: auth.vendorId },
    select: { id: true },
  });
  if (!existing) {
    return res.status(404).json({ error: "custody item not found" });
  }

  const updated = await prisma.custodyItem.update({
    where: { id: custodyItemId },
    data: {
      ...(statusInput ? { status: statusInput as any } : {}),
      ...(providerMemo ? { providerMemo } : {}),
      ...(providerTxSig ? { providerTxSig } : {}),
      ...(provider ? { provider: provider as any } : {}),
    },
    select: {
      id: true,
      status: true,
      provider: true,
      providerMemo: true,
      providerTxSig: true,
      updatedAt: true,
    },
  });

  return res.json({ item: updated });
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

      const vendorWallet =
        (await tx.walletAccount.findFirst({
          where: { vendorId, userId: null },
        })) ??
        (await tx.walletAccount.create({
          data: {
            vendorId,
            userId: null,
            ownerLabel: "Vendor Revenue",
            balancePoints: 0,
          },
        }));
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
