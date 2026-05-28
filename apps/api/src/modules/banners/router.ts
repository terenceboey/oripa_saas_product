import { Router } from "express";
import { createBannerSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";

export const bannerRouter = Router();

bannerRouter.get("/v1/banners", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const banners = await prisma.vendorBanner.findMany({
    where: { vendorId: req.vendorId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return res.json({ banners });
});

bannerRouter.get("/v1/vendor/banners", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const banners = await prisma.vendorBanner.findMany({
    where: { vendorId: req.vendorId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return res.json({ banners });
});

bannerRouter.post("/v1/vendor/banners", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const parsed = createBannerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const banner = await prisma.vendorBanner.create({
    data: {
      vendorId: req.vendorId,
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
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "banner id is required" });

  const parsed = createBannerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const existing = await prisma.vendorBanner.findFirst({ where: { id, vendorId: req.vendorId } });
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
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "banner id is required" });

  const existing = await prisma.vendorBanner.findFirst({ where: { id, vendorId: req.vendorId } });
  if (!existing) return res.status(404).json({ error: "Banner not found" });

  await prisma.vendorBanner.delete({ where: { id } });
  return res.status(204).send();
});






