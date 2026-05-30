import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { VendorRequest } from "../../middleware/vendor";
import { getRequestUserId, getVendorMembershipRole } from "../../lib/rbac";
import { collapseCatalogSearchItems } from "./search-dedupe";
import {
  attachCatalogSearchPayloads,
  sortCatalogSearchCandidates,
  stripCatalogSearchPayload,
} from "./search-query";
import {
  findCatalogSearchAdapterCandidates,
  normalizeCatalogSearchClass,
  type CatalogSearchTypeAlias,
  type NormalizedCatalogSearchClass,
} from "./search-adapters";
import {
  buildCatalogFacetWhere,
  buildCatalogSuggestWhere,
  toCatalogSuggestionResponse,
} from "./facets";

export const catalogRouter = Router();

const itemClassSchema = z.enum(["CARD", "SEALED_PRODUCT", "SET", "SLAB", "CUSTOM_ITEM", "ACCESSORY", "BONUS", "ALL"]);
const typeSchema = z.enum(["card", "sealed", "all"]);

const catalogFilterSchema = z.object({
  type: typeSchema.optional(),
  itemClass: itemClassSchema.optional(),
  game: z.string().trim().max(40).optional().default("POKEMON"),
  language: z.string().trim().min(1).max(16).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  setId: z.string().trim().min(1).max(120).optional(),
  setName: z.string().trim().min(1).max(160).optional(),
  rarity: z.string().trim().min(1).max(120).optional(),
});

const searchQuerySchema = catalogFilterSchema.extend({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(30).optional().default(10),
  localId: z.string().trim().min(1).max(80).optional(),
  cardNumber: z.string().trim().min(1).max(80).optional(),
});

const facetQuerySchema = catalogFilterSchema.extend({
  limit: z.coerce.number().int().min(1).max(5000).optional().default(1000),
});

const suggestQuerySchema = catalogFilterSchema.extend({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(20).optional().default(8),
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

const catalogSearchSelect = {
  id: true,
  source: true,
  sourceItemId: true,
  itemType: true,
  game: true,
  language: true,
  name: true,
  setId: true,
  setName: true,
  localId: true,
  cardNumber: true,
  rarity: true,
  imageThumbUrl: true,
  imageLargeUrl: true,
  imageBaseUrl: true,
  searchText: true,
} as const;

function normalizeFacetValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function groupedFacetCount(row: { _count?: unknown }, field: string) {
  const counts = (row as any)?._count;
  if (!counts || typeof counts !== "object") return 0;
  const direct = (counts as Record<string, unknown>)[field];
  if (typeof direct === "number") return direct;
  const fallback = (counts as Record<string, unknown>)["_all"];
  return typeof fallback === "number" ? fallback : 0;
}

function normalizeOrSendInvalidQuery(
  params: { type?: CatalogSearchTypeAlias; itemClass?: NormalizedCatalogSearchClass },
  res: any,
): NormalizedCatalogSearchClass | null {
  try {
    return normalizeCatalogSearchClass(params);
  } catch (error) {
    res.status(400).json({ error: "invalid_query", message: (error as Error).message });
    return null;
  }
}

function rejectUnsupportedFacetSuggest(itemClass: NormalizedCatalogSearchClass, res: any) {
  if (itemClass === "CARD") return false;
  res.status(400).json({
    error: "unsupported_for_endpoint",
    message: "facets and suggest are card-only in P0",
    supportedItemClasses: ["CARD"],
  });
  return true;
}

catalogRouter.get("/v1/catalog/facets", async (req: VendorRequest, res) => {
  const auth = await requireVendorReadAccess(req, res);
  if (!auth) return;

  const parsed = facetQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
  }

  const { limit, type, itemClass, ...filters } = parsed.data;
  const normalizedClass = normalizeOrSendInvalidQuery({ type, itemClass }, res);
  if (!normalizedClass) return;
  if (rejectUnsupportedFacetSuggest(normalizedClass, res)) return;

  const where = buildCatalogFacetWhere({ ...filters, type: "card" });

  const [sourceRows, languageRows, setRows, rarityRows] = await prisma.$transaction([
    prisma.catalogItem.groupBy({
      by: ["source"],
      where,
      _count: { source: true },
      orderBy: { source: "asc" },
    }),
    prisma.catalogItem.groupBy({
      by: ["language"],
      where,
      _count: { language: true },
      orderBy: { language: "asc" },
    }),
    prisma.catalogItem.groupBy({
      by: ["setId", "setName"],
      where,
      _count: { setId: true },
      orderBy: [{ setId: "asc" }, { setName: "asc" }],
    }),
    prisma.catalogItem.groupBy({
      by: ["rarity"],
      where,
      _count: { rarity: true },
      orderBy: { rarity: "asc" },
    }),
  ]);

  const sources = sourceRows
    .map((row) => {
      const value = normalizeFacetValue(row.source);
      return value ? { value, count: groupedFacetCount(row, "source") } : null;
    })
    .filter((row): row is { value: string; count: number } => row !== null)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);

  const languages = languageRows
    .map((row) => {
      const value = normalizeFacetValue(row.language);
      return value ? { value, count: groupedFacetCount(row, "language") } : null;
    })
    .filter((row): row is { value: string; count: number } => row !== null)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);

  const sets = setRows
    .map((row) => {
      const id = normalizeFacetValue(row.setId);
      if (!id) return null;
      const name = normalizeFacetValue(row.setName);
      return { id, name, count: groupedFacetCount(row, "setId") };
    })
    .filter((row): row is { id: string; name: string | null; count: number } => row !== null)
    .sort((a, b) => b.count - a.count || (a.name ?? a.id).localeCompare(b.name ?? b.id))
    .slice(0, limit);

  const rarities = rarityRows
    .map((row) => {
      const value = normalizeFacetValue(row.rarity);
      return value ? { value, count: groupedFacetCount(row, "rarity") } : null;
    })
    .filter((row): row is { value: string; count: number } => row !== null)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);

  return res.json({ sources, languages, sets, rarities });
});

catalogRouter.get("/v1/catalog/suggest", async (req: VendorRequest, res) => {
  const auth = await requireVendorReadAccess(req, res);
  if (!auth) return;

  const parsed = suggestQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
  }

  const { q, limit, type, itemClass, ...filters } = parsed.data;
  const normalizedClass = normalizeOrSendInvalidQuery({ type, itemClass }, res);
  if (!normalizedClass) return;
  if (rejectUnsupportedFacetSuggest(normalizedClass, res)) return;

  const rows = await prisma.catalogItem.findMany({
    where: buildCatalogSuggestWhere({ ...filters, type: "card", q }),
    orderBy: [{ name: "asc" }, { source: "asc" }, { sourceItemId: "asc" }],
    select: catalogSearchSelect,
    take: Math.min(limit * 4, 80),
  });

  const responseItems = toCatalogSuggestionResponse(rows, q).items.slice(0, limit);
  return res.json({ items: responseItems });
});

catalogRouter.get("/v1/catalog/search", async (req: VendorRequest, res) => {
  const auth = await requireVendorReadAccess(req, res);
  if (!auth) return;

  if ("offset" in req.query) {
    return res.status(400).json({ error: "invalid_query", message: "offset pagination is not supported for catalog search" });
  }

  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
  }

  const { q, limit, type, itemClass, game, language, source, setId, setName, rarity, localId, cardNumber } = parsed.data;
  const normalizedClass = normalizeOrSendInvalidQuery({ type, itemClass }, res);
  if (!normalizedClass) return;

  const candidateLimit = Math.min(limit * 4, 120);

  const candidates = await findCatalogSearchAdapterCandidates(
    prisma,
    {
      q,
      game,
      itemClass: normalizedClass,
      language,
      source,
      setId,
      setName,
      rarity,
      localId,
      cardNumber,
    },
    candidateLimit,
  );

  const cardCandidates = candidates.filter((candidate) => candidate.itemType === "CARD");
  const payloadRows = cardCandidates.length
    ? await prisma.catalogItem.findMany({
        where: { id: { in: cardCandidates.map((candidate) => candidate.id) } },
        select: { id: true, sourcePayload: true },
      })
    : [];

  const responseItems = collapseCatalogSearchItems(sortCatalogSearchCandidates(q, attachCatalogSearchPayloads(candidates, payloadRows)))
    .slice(0, limit)
    .map(stripCatalogSearchPayload);

  return res.json({ items: responseItems });
});
