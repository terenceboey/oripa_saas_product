import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { TenantRequest } from "../../middleware/tenant";

export const walletRouter = Router();

walletRouter.get("/v1/wallet", async (req: TenantRequest, res) => {
  if (!req.tenantId) return res.status(400).json({ error: "Tenant not resolved" });

  const wallet = await prisma.walletAccount.findFirst({
    where: { tenantId: req.tenantId },
    include: { entries: { orderBy: { createdAt: "desc" }, take: 20 } }
  });

  return res.json({ wallet });
});
