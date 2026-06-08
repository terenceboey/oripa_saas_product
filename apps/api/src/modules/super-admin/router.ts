import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireSuperAdmin } from "../../lib/rbac";

export const superAdminRouter = Router();

const pendingStatuses = ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] as const;

function normalizeAdminNotes(input: unknown) {
  const value = String(input ?? "").trim();
  return value.length > 0 ? value.slice(0, 2000) : null;
}

superAdminRouter.get("/v1/super-admin/me", async (req, res) => {
  const auth = await requireSuperAdmin(req, res);
  if (!auth) return;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      fullName: true,
      status: true,
      emailVerificationStatus: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return res.status(404).json({ error: "Super admin not found" });
  return res.json({ user });
});

superAdminRouter.get("/v1/super-admin/dashboard", async (req, res) => {
  const auth = await requireSuperAdmin(req, res);
  if (!auth) return;

  const [vendorCounts, pendingVendors] = await Promise.all([
    prisma.vendor.groupBy({
      by: ["applicationStatus"],
      _count: { _all: true },
    }),
    prisma.vendor.findMany({
      where: { applicationStatus: { in: [...pendingStatuses] } },
      select: {
        id: true,
        name: true,
        slug: true,
        host: true,
        isActive: true,
        riskLevel: true,
        applicationStatus: true,
        entityName: true,
        yearsOfOperations: true,
        personInCharge: true,
        personInChargeCountry: true,
        businessRegistrationNumber: true,
        registeredBusinessAddress: true,
        contactPhoneNumber: true,
        businessEmail: true,
        websiteOrSocialLinks: true,
        identificationDocumentType: true,
        identificationDocumentUrl: true,
        applicationSubmittedAt: true,
        applicationReviewedAt: true,
        applicationReviewNotes: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  const counts = vendorCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.applicationStatus] = row._count._all;
    return acc;
  }, {});

  return res.json({
    summary: {
      totalPending: pendingVendors.length,
      draft: counts.DRAFT ?? 0,
      submitted: counts.SUBMITTED ?? 0,
      underReview: counts.UNDER_REVIEW ?? 0,
      approved: counts.APPROVED ?? 0,
      rejected: counts.REJECTED ?? 0,
    },
    pendingVendors,
  });
});

superAdminRouter.get("/v1/super-admin/vendors", async (req, res) => {
  const auth = await requireSuperAdmin(req, res);
  if (!auth) return;

  const status = String(req.query.status ?? "").trim().toUpperCase();
  const whereStatus = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"].includes(status) ? status : undefined;

  const vendors = await prisma.vendor.findMany({
    where: whereStatus ? { applicationStatus: whereStatus as any } : undefined,
    select: {
      id: true,
      name: true,
      slug: true,
      host: true,
      isActive: true,
      riskLevel: true,
      applicationStatus: true,
      entityName: true,
      yearsOfOperations: true,
      personInCharge: true,
      personInChargeCountry: true,
      businessRegistrationNumber: true,
      registeredBusinessAddress: true,
      contactPhoneNumber: true,
      businessEmail: true,
      websiteOrSocialLinks: true,
      identificationDocumentType: true,
      identificationDocumentUrl: true,
      applicationSubmittedAt: true,
      applicationReviewedAt: true,
      applicationReviewNotes: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return res.json({ vendors });
});

superAdminRouter.get("/v1/super-admin/vendors/:vendorId", async (req, res) => {
  const auth = await requireSuperAdmin(req, res);
  if (!auth) return;

  const vendorId = String(req.params.vendorId ?? "").trim();
  if (!vendorId) return res.status(400).json({ error: "vendorId is required" });

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      slug: true,
      host: true,
      logoImageUrl: true,
      faviconImageUrl: true,
      referralCode: true,
      businessLocation: true,
      businessContact: true,
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
      isActive: true,
      riskLevel: true,
      complianceFlags: true,
      createdAt: true,
      updatedAt: true,
      members: {
        select: {
          id: true,
          userId: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              status: true,
              lastLoginAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!vendor) return res.status(404).json({ error: "Vendor not found" });
  return res.json({ vendor });
});

async function reviewVendorApplication(req: Parameters<typeof requireSuperAdmin>[0], res: Parameters<typeof requireSuperAdmin>[1], nextStatus: "APPROVED" | "REJECTED") {
  const auth = await requireSuperAdmin(req, res);
  if (!auth) return null;

  const vendorId = String(req.params.vendorId ?? "").trim();
  if (!vendorId) {
    res.status(400).json({ error: "vendorId is required" });
    return null;
  }

  const notes = normalizeAdminNotes((req.body ?? {}).notes);
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextVendor = await tx.vendor.update({
      where: { id: vendorId },
      data: {
        applicationStatus: nextStatus,
        applicationReviewedAt: new Date(),
        applicationReviewNotes: notes,
        isActive: nextStatus === "APPROVED",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        host: true,
        isActive: true,
        applicationStatus: true,
        applicationReviewedAt: true,
        applicationReviewNotes: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: auth.userId,
        action: nextStatus === "APPROVED" ? "SUPER_ADMIN_VENDOR_APPROVED" : "SUPER_ADMIN_VENDOR_REJECTED",
        entityType: "Vendor",
        entityId: vendorId,
        beforeState: {
          applicationStatus: vendor.applicationStatus,
          isActive: vendor.isActive,
          applicationReviewNotes: vendor.applicationReviewNotes,
        },
        afterState: {
          applicationStatus: nextVendor.applicationStatus,
          isActive: nextVendor.isActive,
          applicationReviewNotes: nextVendor.applicationReviewNotes,
        },
        metadata: {
          approvedBy: auth.email,
          notes,
        },
      },
    });

    return nextVendor;
  });

  return res.json({ vendor: updated });
}

superAdminRouter.patch("/v1/super-admin/vendors/:vendorId/approve", async (req, res) => {
  return reviewVendorApplication(req, res, "APPROVED");
});

superAdminRouter.patch("/v1/super-admin/vendors/:vendorId/reject", async (req, res) => {
  return reviewVendorApplication(req, res, "REJECTED");
});
