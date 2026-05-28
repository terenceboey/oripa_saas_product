import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";

export const walletRouter = Router();

walletRouter.get("/v1/wallet", async (req: VendorRequest, res) => {
  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const wallet = await prisma.walletAccount.findFirst({
    where: { vendorId: req.vendorId },
    include: { entries: { orderBy: { createdAt: "desc" }, take: 20 } }
  });

  return res.json({ wallet });
});





