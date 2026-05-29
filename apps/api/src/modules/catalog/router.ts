import { Router } from "express";
import { CatalogItemType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { getRequestUserId, getVendorMembershipRole } from "../../lib/rbac";

export const catalogRouter = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(30).optional().default(10),
  type: z.enum(["card", "sealed", "all"]).optional().default("card"),
  game: z.string().trim().max(40).optional(),
});

async function requireVendorReadAccess(req: VendorRequest, res: any) {
  if (!req.vendorId) {
    res.status(400).json({ error: "Vendor not resolved" });
    return null;
  }
  const actorUserId = getRequestUserId(req);
  if (!actorUserId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const role = await getVendorMembershipRole({ vendorId: req.vendorId, userId: actorUserId });
  if (!role) {
    res.status(403).json({ error: "forbidden: insufficient vendor role" });
    return null;
  }
  return { vendorId: req.vendorId, actorUserId, role };
}

catalogRouter.get("/v1/catalog/search", async (req: VendorRequest, res) => {
  const auth = await requireVendorReadAccess(req, res);
  if (!auth) return;

  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
  }

  const { q, limit, type, game } = parsed.data;
  const normalizedGame = String(game ?? "").trim().toUpperCase();
  const gameFilter = normalizedGame && normalizedGame !== "ALL" ? normalizedGame : undefined;
  const typeFilter =
    type === "card"
      ? CatalogItemType.CARD
      : type === "sealed"
        ? CatalogItemType.SEALED_PRODUCT
        : undefined;

  const byNameStarts = await prisma.catalogItem.findMany({
    where: {
      isActive: true,
      ...(gameFilter ? { game: gameFilter } : {}),
      ...(typeFilter ? { itemType: typeFilter } : {}),
      name: { startsWith: q, mode: "insensitive" },
    },
    orderBy: [{ name: "asc" }],
    take: limit,
  });

  const remaining = Math.max(0, limit - byNameStarts.length);
  let byContains: typeof byNameStarts = [];

  if (remaining > 0) {
    byContains = await prisma.catalogItem.findMany({
      where: {
        isActive: true,
        ...(gameFilter ? { game: gameFilter } : {}),
        ...(typeFilter ? { itemType: typeFilter } : {}),
        name: { contains: q, mode: "insensitive" },
        id: { notIn: byNameStarts.map((row) => row.id) },
      },
      orderBy: [{ name: "asc" }],
      take: remaining,
    });
  }

  const items = [...byNameStarts, ...byContains].map((row) => ({
    id: row.id,
    source: row.source,
    sourceItemId: row.sourceItemId,
    itemType: row.itemType,
    game: row.game,
    language: row.language,
    name: row.name,
    setId: row.setId,
    setName: row.setName,
    cardNumber: row.cardNumber,
    rarity: row.rarity,
    imageThumbUrl: row.imageThumbUrl,
    imageLargeUrl: row.imageLargeUrl,
    imageBaseUrl: row.imageBaseUrl,
  }));

  return res.json({ items });
});
