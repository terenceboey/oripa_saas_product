import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getRequestUserId } from "../../lib/rbac";
import { VendorRequest } from "../../middleware/vendor";

export const walletRouter = Router();

type WalletEntryLike = {
  id: string;
  type: string;
  amountPoints: number;
  reason: string;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: Date | string;
};

type WalletAccountLike = {
  id: string;
  balancePoints: number;
  entries?: WalletEntryLike[];
};

function humanizeReason(reason: string) {
  return reason
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function humanizeReferenceType(referenceType: string | null | undefined, reason: string) {
  if (!referenceType) return humanizeReason(reason);
  return referenceType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function buildReferenceLabel(entry: WalletEntryLike) {
  if (entry.referenceId) {
    const prefix = entry.reason === "BUYBACK_CREDIT" ? humanizeReason(entry.reason) : humanizeReferenceType(entry.referenceType, entry.reason);
    return `${prefix} ${entry.referenceId}`;
  }
  return `${humanizeReason(entry.reason)} ${entry.id}`;
}

function serializeWalletEntry(entry: WalletEntryLike) {
  return {
    id: entry.id,
    type: entry.type,
    amountPoints: entry.amountPoints,
    reason: entry.reason,
    balanceBefore: entry.balanceBefore,
    balanceAfter: entry.balanceAfter,
    createdAt: new Date(entry.createdAt).toISOString(),
    referenceLabel: buildReferenceLabel(entry),
  };
}

function serializeWallet(wallet: WalletAccountLike) {
  return {
    id: wallet.id,
    balancePoints: wallet.balancePoints,
    entries: (wallet.entries ?? []).map(serializeWalletEntry),
  };
}

walletRouter.get("/v1/wallet", async (req: VendorRequest, res) => {
  const vendorId = req.vendorId;
  if (!vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const userId = await getRequestUserId(req, res);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const wallet = await prisma.walletAccount.findUnique({
    where: { vendorId_userId: { vendorId, userId } },
    include: { entries: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!wallet) return res.status(404).json({ error: "Wallet not found" });

  return res.json({ wallet: serializeWallet(wallet) });
});
