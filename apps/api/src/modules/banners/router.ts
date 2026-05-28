import { Router } from "express";
import { createBannerSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { getRequestUserId, getVendorMembershipRole, hasRole } from "../../lib/rbac";

export const bannerRouter = Router();

async function requireBannerRole(req: VendorRequest, res: any, allowStaffReadOnly = false) {
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
  if (!role) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }
  if (!allowStaffReadOnly && !hasRole(role, ["OWNER", "MANAGER"])) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }
  return { vendorId: req.vendorId, actorUserId, role };
}

bannerRouter.get("/v1/banners", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const banners = await prisma.vendorBanner.findMany({
    where: { vendorId: req.vendorId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return res.json({ banners });
});

bannerRouter.get("/v1/vendor/banners", async (req: VendorRequest, res) => {
  const auth = await requireBannerRole(req, res, true);
  if (!auth) return;

  const banners = await prisma.vendorBanner.findMany({
    where: { vendorId: auth.vendorId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return res.json({ banners });
});

bannerRouter.post("/v1/vendor/banners", async (req: VendorRequest, res) => {
  const auth = await requireBannerRole(req, res);
  if (!auth) return;

  const parsed = createBannerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const banner = await prisma.vendorBanner.create({
    data: {
      vendorId: auth.vendorId,
      title: parsed.data.title,
      imageUrl: parsed.data.imageUrl,
      targetUrl: parsed.data.targetUrl ?? null,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    },
  });

  return res.status(201).json({ banner });
});

bannerRouter.patch("/v1/vendor/banners/:id", async (req: VendorRequest, res) => {
  const auth = await requireBannerRole(req, res);
  if (!auth) return;

  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "banner id is required" });

  const parsed = createBannerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const existing = await prisma.vendorBanner.findFirst({ where: { id, vendorId: auth.vendorId } });
  if (!existing) return res.status(404).json({ error: "Banner not found" });

  const banner = await prisma.vendorBanner.update({
    where: { id },
    data: {
      title: parsed.data.title,
      imageUrl: parsed.data.imageUrl,
      targetUrl: parsed.data.targetUrl,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    },
  });

  return res.json({ banner });
});

bannerRouter.delete("/v1/vendor/banners/:id", async (req: VendorRequest, res) => {
  const auth = await requireBannerRole(req, res);
  if (!auth) return;

  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "banner id is required" });

  const existing = await prisma.vendorBanner.findFirst({ where: { id, vendorId: auth.vendorId } });
  if (!existing) return res.status(404).json({ error: "Banner not found" });

  await prisma.vendorBanner.delete({ where: { id } });
  return res.status(204).send();
});






