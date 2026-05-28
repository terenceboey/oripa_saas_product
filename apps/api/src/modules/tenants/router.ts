import { Router } from "express";
import { createTenantSchema } from "@oripa/shared";
import { prisma } from "../../lib/prisma";

export const tenantRouter = Router();

tenantRouter.post("/v1/tenants", async (req, res) => {
  const parsed = createTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const tenant = await prisma.tenant.create({ data: parsed.data });
  return res.status(201).json({ tenant });
});

tenantRouter.get("/v1/tenants/by-host", async (req, res) => {
  const host = String(req.query.host ?? "").trim().toLowerCase();
  if (!host) return res.status(400).json({ error: "host is required" });

  const tenant = await prisma.tenant.findUnique({ where: { host } });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  return res.json({ tenant });
});
