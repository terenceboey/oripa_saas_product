import { createHash } from "node:crypto";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { evaluatePackAvailability, type PackAvailabilityPack } from "../packs/availability";

export const activityRouter = Router();

type PublicActivityRow = {
  vendorId: string;
  createdAt: Date;
  drawSequence: number;
  drawOrder: {
    status: string;
    createdAt: Date;
  };
  pack: {
    vendorId: string;
    title: string;
    isActive: boolean;
    status: "DRAFT" | "LIVE" | "ARCHIVED";
    pricePoints: number;
    remainingStock: number;
    startsAt: Date | null;
    endsAt: Date | null;
    poolSnapshotHash: string | null;
    tierSnapshotJson: unknown;
  };
  packPrize: {
    label: string;
    estimatedValue: number;
  } | null;
  custodyItem: {
    estimatedValue: number | null;
  } | null;
};

function clampLimit(raw: unknown) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(50, Math.max(1, parsed));
}

function toPackAvailabilityPack(pack: PublicActivityRow["pack"]): PackAvailabilityPack {
  return {
    id: "activity-pack",
    isActive: pack.isActive,
    status: pack.status,
    pricePoints: pack.pricePoints,
    remainingStock: pack.remainingStock,
    startsAt: pack.startsAt,
    endsAt: pack.endsAt,
    poolSnapshotHash: pack.poolSnapshotHash,
  };
}

function extractTierLabel(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const tiers = (snapshot as { tiers?: unknown }).tiers;
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const firstTier = tiers[0];
  if (!firstTier || typeof firstTier !== "object") return null;
  const name = (firstTier as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function toValueBand(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "unknown";
  if ((value as number) >= 1000) return "1000+";
  if ((value as number) >= 500) return "500-999";
  if ((value as number) >= 250) return "250-499";
  if ((value as number) >= 100) return "100-249";
  if ((value as number) >= 50) return "50-99";
  return "0-49";
}

function anonymizedCustomerLabel(vendorId: string, timestamp: Date, drawSequence: number): string {
  const stableInput = `${vendorId}:${timestamp.toISOString()}:${drawSequence}`;
  const digest = createHash("sha256").update(stableInput).digest("hex");
  const labelNumber = (Number.parseInt(digest.slice(0, 8), 16) % 10_000).toString().padStart(4, "0");
  return `Collector #${labelNumber}`;
}

function isPubliclyVisible(pack: PublicActivityRow["pack"]): boolean {
  return evaluatePackAvailability({
    pack: toPackAvailabilityPack(pack),
    quantity: 1,
    isAuthenticated: true,
  }).visible;
}

activityRouter.get("/v1/activity/public", async (req: VendorRequest, res) => {
  const vendorId = req.vendorId;
  if (!vendorId) return res.status(400).json({ error: "Vendor not resolved" });

  const limit = clampLimit(req.query.limit);
  const rows = await prisma.drawResult.findMany({
    where: {
      vendorId,
      drawOrder: { status: "COMPLETED" },
      pack: {
        vendorId,
        isActive: true,
        status: { not: "ARCHIVED" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      vendorId: true,
      createdAt: true,
      drawSequence: true,
      drawOrder: {
        select: {
          status: true,
          createdAt: true,
        },
      },
      pack: {
        select: {
          vendorId: true,
          title: true,
          isActive: true,
          status: true,
          pricePoints: true,
          remainingStock: true,
          startsAt: true,
          endsAt: true,
          poolSnapshotHash: true,
          tierSnapshotJson: true,
        },
      },
      packPrize: {
        select: {
          label: true,
          estimatedValue: true,
        },
      },
      custodyItem: {
        select: {
          estimatedValue: true,
        },
      },
    },
  });

  const activities = (rows as PublicActivityRow[])
    .filter((row) => row.vendorId === vendorId && row.pack.vendorId === vendorId)
    .filter((row) => row.drawOrder.status === "COMPLETED")
    .filter((row) => isPubliclyVisible(row.pack))
    .map((row) => ({
      packTitle: row.pack.title,
      prizeLabel: row.packPrize?.label ?? extractTierLabel(row.pack.tierSnapshotJson) ?? "Unknown prize",
      valueBand: toValueBand(row.custodyItem?.estimatedValue ?? row.packPrize?.estimatedValue ?? null),
      timestamp: row.createdAt.toISOString(),
      customerLabel: anonymizedCustomerLabel(vendorId, row.drawOrder.createdAt, row.drawSequence),
    }));

  return res.json({ activities });
});
