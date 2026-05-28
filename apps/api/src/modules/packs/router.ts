import { Router } from "express";
import { createPackSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";
import { TenantRequest } from "../../middleware/tenant";

export const packRouter = Router();

packRouter.get("/v1/packs", async (req: TenantRequest, res) => {
  if (!req.tenantId) return res.status(400).json({ error: "Tenant not resolved" });

  const packs = await prisma.pack.findMany({
    where: { tenantId: req.tenantId, isActive: true },
    include: { prizes: true },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ packs });
});

packRouter.post("/v1/packs", async (req: TenantRequest, res) => {
  if (!req.tenantId) return res.status(400).json({ error: "Tenant not resolved" });

  const parsed = createPackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const pack = await prisma.pack.create({
    data: {
      tenantId: req.tenantId,
      title: parsed.data.title,
      pricePoints: parsed.data.pricePoints,
      totalStock: parsed.data.totalStock,
      remainingStock: parsed.data.totalStock,
      prizes: {
        createMany: {
          data: [
            { label: "A Tier", weight: 1, stock: 1, remainingStock: 1, estimatedValue: 1000 },
            { label: "B Tier", weight: 5, stock: 10, remainingStock: 10, estimatedValue: 250 },
            { label: "C Tier", weight: 20, stock: 100, remainingStock: 100, estimatedValue: 50 }
          ]
        }
      }
    },
    include: { prizes: true }
  });

  return res.status(201).json({ pack });
});
