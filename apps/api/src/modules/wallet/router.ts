import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { requireVendorAccess } from "../../lib/rbac";

export const walletRouter = Router();

walletRouter.get("/v1/wallet", async (req: VendorRequest, res) => {
  const auth = await requireVendorAccess(req, res, ["OWNER", "MANAGER", "STAFF"]);
  if (!auth) return;

  const wallet = await prisma.walletAccount.findFirst({
    where: { vendorId: auth.vendorId },
    include: { entries: { orderBy: { createdAt: "desc" }, take: 20 } }
  });

  return res.json({ wallet });
});





