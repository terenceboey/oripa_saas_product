import { Router } from "express";
import { CatalogItemType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { VendorRequest } from "../../middleware/vendor";
import { getRequestUserId, getVendorMembershipRole } from "../../lib/rbac";

export const catalogRouter = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().min(3).max(120),
  limit: z.coerce.number().int().min(1).max(10).optional().default(8),
  type: z.enum(["card", "sealed", "all"]).optional().default("card"),
  game: z.string().trim().max(40).optional(),
});
const SEARCH_CACHE_TTL_SECONDS = 60;
const CACHE_IO_TIMEOUT_MS = 80;
const SEARCH_CACHE_VERSION = "v2";

type CatalogSearchRow = {
  id: string;
  game: string;
  name: string;
  setId: string | null;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageThumbUrl: string | null;
  imageLargeUrl: string | null;
  imageBaseUrl: string | null;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function normalizeSearchQuery(input: string) {
  return input
    .toLowerCase()
    .replace(/[#/\\._-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const requestStartedAt = Date.now();
  const auth = await requireVendorReadAccess(req, res);
  if (!auth) return;

  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
  }

  const { q, limit, type, game } = parsed.data;
  const normalizedQ = normalizeSearchQuery(q);
  const normalizedRawQ = q.toLowerCase().trim();
  if (!normalizedQ || normalizedQ.length < 3) {
    return res.status(400).json({ error: "Search query too short after normalization" });
  }
  const normalizedGame = String(game ?? "").trim().toUpperCase();
  const gameFilter = normalizedGame && normalizedGame !== "ALL" ? normalizedGame : undefined;
  const typeFilter =
    type === "card"
      ? CatalogItemType.CARD
      : type === "sealed"
        ? CatalogItemType.SEALED_PRODUCT
        : undefined;

  const cacheKey = `catalog:search:${SEARCH_CACHE_VERSION}:${auth.vendorId}:${normalizedQ}:${limit}:${type}:${gameFilter ?? "ALL"}`;
  let cacheHit = false;
  let dbQueryMs = 0;
  try {
    const cached = await withTimeout(redis.get(cacheKey), CACHE_IO_TIMEOUT_MS);
    if (cached) {
      cacheHit = true;
      const items = JSON.parse(cached);
      const totalMs = Date.now() - requestStartedAt;
      console.info(
        `[catalog.search] vendor=${auth.vendorId} qlen=${normalizedQ.length} limit=${limit} type=${type} game=${gameFilter ?? "ALL"} cache=hit count=${items.length} dbMs=0 totalMs=${totalMs}`
      );
      return res.json({ items, cached: true });
    }
  } catch {
    // Cache is optional; continue with DB query path.
  }

  const dbStartedAt = Date.now();
  const rows = await prisma.$queryRaw<CatalogSearchRow[]>`
    SELECT
      c."id",
      c."game",
      c."name",
      c."setId",
      c."setName",
      c."cardNumber",
      c."rarity",
      c."imageThumbUrl",
      c."imageLargeUrl",
      c."imageBaseUrl"
    FROM "CatalogItem" c
    WHERE c."isActive" = true
      AND (${gameFilter ?? null}::text IS NULL OR c."game" = ${gameFilter ?? null})
      AND (${typeFilter ?? null}::"CatalogItemType" IS NULL OR c."itemType" = ${typeFilter ?? null})
      AND (
        lower(c."searchText") % ${normalizedQ}
        OR lower(c."name") LIKE ${`%${normalizedQ}%`}
        OR lower(c."name") LIKE ${`%${normalizedRawQ}%`}
      )
    ORDER BY
      similarity(lower(c."searchText"), ${normalizedQ}) DESC,
      CASE WHEN lower(c."name") LIKE ${`${normalizedQ}%`} THEN 0 ELSE 1 END ASC,
      length(c."name") ASC
    LIMIT ${limit}
  `;
  dbQueryMs = Date.now() - dbStartedAt;

  const items = rows.map((row) => ({
    id: row.id,
    game: row.game,
    name: row.name,
    setId: row.setId,
    setName: row.setName,
    cardNumber: row.cardNumber,
    rarity: row.rarity,
    imageThumbUrl: row.imageThumbUrl,
    imageLargeUrl: row.imageLargeUrl,
    imageBaseUrl: row.imageBaseUrl,
  }));

  try {
    await withTimeout(redis.set(cacheKey, JSON.stringify(items), "EX", SEARCH_CACHE_TTL_SECONDS), CACHE_IO_TIMEOUT_MS);
  } catch {
    // Cache is optional; ignore errors.
  }

  const totalMs = Date.now() - requestStartedAt;
  console.info(
    `[catalog.search] vendor=${auth.vendorId} qlen=${normalizedQ.length} limit=${limit} type=${type} game=${gameFilter ?? "ALL"} cache=${cacheHit ? "hit" : "miss"} count=${items.length} dbMs=${dbQueryMs} totalMs=${totalMs}`
  );

  return res.json({ items, cached: false });
});
