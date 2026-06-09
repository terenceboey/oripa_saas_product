import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getRequestUserId } from "../../lib/rbac";
import { VendorRequest } from "../../middleware/vendor";

export const walletRouter = Router();

walletRouter.get("/v1/wallet", async (req: VendorRequest, res) => {
  const vendorId = req.vendorId;
  if (!vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const userId = await getRequestUserId(req, res);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const wallet = await prisma.walletAccount.findUnique({
    where: { vendorId_userId: { vendorId, userId } },
    include: { entries: { orderBy: { createdAt: "desc" }, take: 20 } }
  });

  if (!wallet) return res.status(404).json({ error: "Wallet not found" });

  return res.json({ wallet });
});





