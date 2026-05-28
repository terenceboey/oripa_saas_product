import { Router } from "express";
import { createVendorSchema, updateVendorProfileSchema, updateVendorLimitsSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";

export const vendorRouter = Router();

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

vendorRouter.get("/v1/vendor/current", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const vendor = await prisma.vendor.findUnique({
    where: { id: req.vendorId },
    select: { id: true, name: true, slug: true, host: true, isActive: true },
  });

  if (!vendor) return res.status(404).json({ error: "Vendor not found" });
  return res.json({ vendor });
});

vendorRouter.patch("/v1/vendor/profile", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const parsed = updateVendorProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const vendor = await prisma.vendor.update({
    where: { id: req.vendorId },
    data: { name: parsed.data.name },
    select: { id: true, name: true, slug: true, host: true, isActive: true, updatedAt: true },
  });

  return res.json({ vendor });
});

vendorRouter.get("/v1/vendor/limits", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });
  const settings = await prisma.vendorSettings.findUnique({
    where: { vendorId: req.vendorId },
    select: { maxPackItems: true, maxDrawQuantity: true },
  });
  return res.json({
    limits: {
      maxPackItems: settings?.maxPackItems ?? 500,
      maxDrawQuantity: settings?.maxDrawQuantity ?? 100,
    },
  });
});

vendorRouter.patch("/v1/vendor/limits", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });
  const parsed = updateVendorLimitsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const updated = await prisma.vendorSettings.upsert({
    where: { vendorId: req.vendorId },
    update: {
      maxPackItems: parsed.data.maxPackItems,
      maxDrawQuantity: parsed.data.maxDrawQuantity,
    },
    create: {
      vendorId: req.vendorId,
      maxPackItems: parsed.data.maxPackItems ?? 500,
      maxDrawQuantity: parsed.data.maxDrawQuantity ?? 100,
    },
    select: { maxPackItems: true, maxDrawQuantity: true },
  });

  return res.json({ limits: updated });
});






