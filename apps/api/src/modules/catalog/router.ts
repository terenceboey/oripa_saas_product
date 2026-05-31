import { Router } from "express";
import { CatalogItemType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { getRequestUserId, getVendorMembershipRole } from "../../lib/rbac";
import { VendorRequest } from "../../middleware/vendor";
import { collapseCatalogSearchItems, type CatalogSearchMergeInput } from "./search-dedupe";
import {
  normalizeCatalogSearchClass,
  type CatalogSearchTypeAlias,
  type NormalizedCatalogSearchClass,
} from "./search-adapters";
import { stripCatalogSearchPayload } from "./search-query";

export const catalogRouter = Router();

const itemClassSchema = z.enum(["CARD", "SEALED_PRODUCT", "SET", "SLAB", "CUSTOM_ITEM", "ACCESSORY", "BONUS", "ALL"]);
const typeSchema = z.enum(["card", "sealed", "all"]);
const ENABLED_VENDOR_GAMES = ["POKEMON", "ONE_PIECE"] as const;
const enabledVendorGamesSet = new Set<string>(ENABLED_VENDOR_GAMES);

const catalogFilterSchema = z.object({
  type: typeSchema.optional(),
  itemClass: itemClassSchema.optional(),
  game: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase())
    .refine((value) => enabledVendorGamesSet.has(value), {
      message: `game must be one of: ${ENABLED_VENDOR_GAMES.join(", ")}`,
    }),
  language: z.string().trim().min(1).max(16).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  setId: z.string().trim().min(1).max(120).optional(),
  rarity: z.string().trim().min(1).max(120).optional(),
});

const searchQuerySchema = catalogFilterSchema.extend({
  q: z.string().trim().max(120).optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
  cursor: z.string().trim().min(1).max(1000).optional(),
});

const facetQuerySchema = catalogFilterSchema.extend({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

type CatalogFacetOption = { value: string; count: number };
type CatalogSetFacetOption = { id: string; name: string | null; count: number };
type CatalogFacetsResponse = {
  sources: CatalogFacetOption[];
  languages: CatalogFacetOption[];
  sets: CatalogSetFacetOption[];
  rarities: CatalogFacetOption[];
};

type CardCursor = {
  kind: "CARD";
  rarityOrder: number;
  nameSort: string;
  source: string;
  sourceItemId: string;
  id: string;
};

type SealedCursor = {
  kind: "SEALED_PRODUCT";
  nameSort: string;
  source: string;
  sourceItemId: string;
  id: string;
};

type PickerSearchItem = CatalogSearchMergeInput;

type PickerSearchPage = {
  items: PickerSearchItem[];
  nextCursor: string | null;
};

type CardSearchRow = PickerSearchItem & {
  rarityOrder: number;
  nameSort: string;
};

const CARD_RARITY_ORDER_SQL = Prisma.sql`
  CASE
    WHEN rarity IS NULL OR btrim(rarity) = '' THEN 999
    WHEN lower(rarity) LIKE '%black label%' THEN 0
    WHEN lower(rarity) LIKE '%serial%' THEN 0
    WHEN lower(rarity) LIKE '%secret%' THEN 0
    WHEN lower(rarity) LIKE '%starlight%' THEN 0
    WHEN lower(rarity) LIKE '%ghost rare%' THEN 0
    WHEN lower(rarity) LIKE '%ultimate rare%' THEN 0
    WHEN lower(rarity) LIKE '%illustration rare%' THEN 0
    WHEN lower(rarity) LIKE '%special illustration rare%' THEN 0
    WHEN lower(rarity) LIKE '%hyper rare%' THEN 1
    WHEN lower(rarity) LIKE '%rainbow rare%' THEN 1
    WHEN lower(rarity) LIKE '%gold%' THEN 1
    WHEN lower(rarity) LIKE '%alternate art%' THEN 1
    WHEN lower(rarity) LIKE '%alt art%' THEN 1
    WHEN lower(rarity) LIKE '%ultra rare%' THEN 2
    WHEN lower(rarity) LIKE '%double rare%' THEN 2
    WHEN lower(rarity) LIKE '%triple rare%' THEN 2
    WHEN lower(rarity) LIKE '%rare holo%' THEN 2
    WHEN lower(rarity) LIKE '%holo rare%' THEN 2
    WHEN lower(rarity) LIKE '%super rare%' THEN 2
    WHEN lower(rarity) LIKE '%rare%' THEN 3
    WHEN lower(rarity) LIKE '%uncommon%' THEN 4
    WHEN lower(rarity) LIKE '%common%' THEN 5
    ELSE 6
  END
`;

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

function encodeCursor(value: CardCursor | SealedCursor) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCursor<T>(value: string): T | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
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

function sortFacetOptions(options: CatalogFacetOption[]) {
  return options.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function sortSetFacetOptions(options: CatalogSetFacetOption[]) {
  return options.sort((a, b) => b.count - a.count || (a.name ?? a.id).localeCompare(b.name ?? b.id));
}

function asItemClassForPicker(normalizedClass: NormalizedCatalogSearchClass) {
  if (normalizedClass === "ALL") return "ALL";
  if (normalizedClass === "CARD") return "CARD";
  if (normalizedClass === "SEALED_PRODUCT") return "SEALED_PRODUCT";
  if (normalizedClass === "SET") return "SET";
  return normalizedClass;
}

function buildCardFacetWhere(input: {
  game: string;
  source?: string;
  language?: string;
  setId?: string;
  rarity?: string;
}): Prisma.CatalogItemWhereInput {
  return {
    isActive: true,
    itemType: CatalogItemType.CARD,
    game: input.game,
    ...(input.source ? { source: input.source } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.setId ? { setId: input.setId } : {}),
    ...(input.rarity
      ? {
          rarity: {
            equals: input.rarity,
            mode: "insensitive",
          },
        }
      : {}),
  };
}

async function getCardFacets(input: {
  game: string;
  source?: string;
  language?: string;
  setId?: string;
  rarity?: string;
  limit: number;
}): Promise<CatalogFacetsResponse> {
  const sourceWhere = buildCardFacetWhere({
    game: input.game,
    language: input.language,
    setId: input.setId,
    rarity: input.rarity,
  });
  const languageWhere = buildCardFacetWhere({
    game: input.game,
    source: input.source,
    setId: input.setId,
    rarity: input.rarity,
  });
  const setWhere = buildCardFacetWhere({
    game: input.game,
    source: input.source,
    language: input.language,
  });

  const rarityWhere = input.setId
    ? buildCardFacetWhere({
        game: input.game,
        source: input.source,
        language: input.language,
        setId: input.setId,
      })
    : null;

  const [sourceRows, languageRows, setRows] = await Promise.all([
    prisma.catalogItem.groupBy({
      by: ["source"],
      where: sourceWhere,
      _count: { source: true },
      orderBy: { source: "asc" },
    }),
    prisma.catalogItem.groupBy({
      by: ["language"],
      where: languageWhere,
      _count: { language: true },
      orderBy: { language: "asc" },
    }),
    prisma.catalogItem.groupBy({
      by: ["setId", "setName"],
      where: setWhere,
      _count: { setId: true },
      orderBy: [{ setId: "asc" }, { setName: "asc" }],
    }),
  ]);

  const rarityRows = rarityWhere
    ? await prisma.catalogItem.groupBy({
        by: ["rarity"],
        where: rarityWhere,
        _count: { rarity: true },
        orderBy: { rarity: "asc" },
      })
    : [];

  const sources = sortFacetOptions(
    sourceRows
      .map((row: (typeof sourceRows)[number]) => {
        const value = normalizeFacetValue(row.source);
        return value ? { value, count: groupedFacetCount(row, "source") } : null;
      })
      .filter((row: CatalogFacetOption | null): row is CatalogFacetOption => row !== null),
  ).slice(0, input.limit);

  const languages = sortFacetOptions(
    languageRows
      .map((row: (typeof languageRows)[number]) => {
        const value = normalizeFacetValue(row.language);
        return value ? { value, count: groupedFacetCount(row, "language") } : null;
      })
      .filter((row: CatalogFacetOption | null): row is CatalogFacetOption => row !== null),
  ).slice(0, input.limit);

  const sets = sortSetFacetOptions(
    setRows
      .map((row: (typeof setRows)[number]) => {
        const id = normalizeFacetValue(row.setId);
        if (!id) return null;
        const name = normalizeFacetValue(row.setName);
        return { id, name, count: groupedFacetCount(row, "setId") };
      })
      .filter((row: CatalogSetFacetOption | null): row is CatalogSetFacetOption => row !== null),
  ).slice(0, input.limit);

  const rarities = sortFacetOptions(
    rarityRows
      .map((row: (typeof rarityRows)[number]) => {
        const value = normalizeFacetValue(row.rarity);
        return value ? { value, count: groupedFacetCount(row, "rarity") } : null;
      })
      .filter((row: CatalogFacetOption | null): row is CatalogFacetOption => row !== null),
  ).slice(0, input.limit);

  return { sources, languages, sets, rarities };
}

async function getSealedFacets(input: {
  game: string;
  source?: string;
  language?: string;
  setId?: string;
  limit: number;
}): Promise<CatalogFacetsResponse> {
  const baseWhere: Prisma.CatalogSealedProductWhereInput = {
    isActive: true,
    game: input.game,
    ...(input.source ? { source: input.source } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.setId ? { catalogSet: { sourceSetId: input.setId } } : {}),
  };

  const [sourceRows, languageRows, setRows] = await prisma.$transaction([
    prisma.catalogSealedProduct.groupBy({
      by: ["source"],
      where: {
        isActive: true,
        game: input.game,
        ...(input.language ? { language: input.language } : {}),
        ...(input.setId ? { catalogSet: { sourceSetId: input.setId } } : {}),
      },
      _count: { source: true },
      orderBy: { source: "asc" },
    }),
    prisma.catalogSealedProduct.groupBy({
      by: ["language"],
      where: {
        isActive: true,
        game: input.game,
        ...(input.source ? { source: input.source } : {}),
        ...(input.setId ? { catalogSet: { sourceSetId: input.setId } } : {}),
      },
      _count: { language: true },
      orderBy: { language: "asc" },
    }),
    prisma.catalogSealedProduct.findMany({
      where: {
        ...baseWhere,
      },
      select: {
        catalogSet: {
          select: {
            sourceSetId: true,
            name: true,
          },
        },
      },
      take: 5000,
    }),
  ]);

  const sources = sortFacetOptions(
    sourceRows
      .map((row) => {
        const value = normalizeFacetValue(row.source);
        return value ? { value, count: groupedFacetCount(row, "source") } : null;
      })
      .filter((row): row is CatalogFacetOption => row !== null),
  ).slice(0, input.limit);

  const languages = sortFacetOptions(
    languageRows
      .map((row) => {
        const value = normalizeFacetValue(row.language);
        return value ? { value, count: groupedFacetCount(row, "language") } : null;
      })
      .filter((row): row is CatalogFacetOption => row !== null),
  ).slice(0, input.limit);

  const setCounts = new Map<string, CatalogSetFacetOption>();
  for (const row of setRows) {
    const setId = normalizeFacetValue(row.catalogSet?.sourceSetId);
    if (!setId) continue;
    const setName = normalizeFacetValue(row.catalogSet?.name);
    const current = setCounts.get(setId);
    if (current) current.count += 1;
    else setCounts.set(setId, { id: setId, name: setName, count: 1 });
  }
  const sets = sortSetFacetOptions([...setCounts.values()]).slice(0, input.limit);

  return {
    sources,
    languages,
    sets,
    rarities: [],
  };
}

async function searchCardItems(input: {
  game: string;
  q: string;
  limit: number;
  cursor?: string;
  source?: string;
  language?: string;
  setId?: string;
  rarity?: string;
}): Promise<PickerSearchPage> {
  const query = input.q.trim().toLowerCase();
  if (!input.setId && query.length === 0) {
    return { items: [], nextCursor: null };
  }

  const clauses: Prisma.Sql[] = [
    Prisma.sql`"isActive" = true`,
    Prisma.sql`"itemType" = ${CatalogItemType.CARD}::"CatalogItemType"`,
    Prisma.sql`game = ${input.game}`,
  ];

  if (input.source) clauses.push(Prisma.sql`source = ${input.source}`);
  if (input.language) clauses.push(Prisma.sql`language = ${input.language}`);
  if (input.setId) clauses.push(Prisma.sql`"setId" = ${input.setId}`);
  if (input.rarity) clauses.push(Prisma.sql`lower(coalesce(rarity, '')) = ${input.rarity.toLowerCase()}`);
  if (query.length > 0) {
    const likeNeedle = `%${query}%`;
    clauses.push(Prisma.sql`(
      lower(name) LIKE ${likeNeedle}
      OR lower(coalesce("searchText", '')) LIKE ${likeNeedle}
    )`);
  }

  if (input.cursor) {
    const decoded = decodeCursor<CardCursor>(input.cursor);
    if (!decoded || decoded.kind !== "CARD") {
      throw new Error("invalid_cursor");
    }
    clauses.push(
      Prisma.sql`(
        (${CARD_RARITY_ORDER_SQL}, lower(name), source, "sourceItemId", id)
        > (${decoded.rarityOrder}, ${decoded.nameSort}, ${decoded.source}, ${decoded.sourceItemId}, ${decoded.id})
      )`,
    );
  }

  const rows = await prisma.$queryRaw<CardSearchRow[]>(Prisma.sql`
    SELECT
      id,
      source,
      "sourceItemId",
      "itemType",
      game,
      language,
      name,
      "setId",
      "setName",
      "localId",
      "cardNumber",
      rarity,
      "imageThumbUrl",
      "imageLargeUrl",
      "imageBaseUrl",
      "searchText",
      "sourcePayload",
      ${CARD_RARITY_ORDER_SQL} AS "rarityOrder",
      lower(name) AS "nameSort"
    FROM "CatalogItem"
    WHERE ${Prisma.join(clauses, " AND ")}
    ORDER BY "rarityOrder" ASC, "nameSort" ASC, source ASC, "sourceItemId" ASC, id ASC
    LIMIT ${input.limit + 1}
  `);

  const hasMore = rows.length > input.limit;
  const pageRows = hasMore ? rows.slice(0, input.limit) : rows;
  const collapsedRows = collapseCatalogSearchItems(pageRows).map(stripCatalogSearchPayload) as PickerSearchItem[];
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && lastRow
    ? encodeCursor({
        kind: "CARD",
        rarityOrder: lastRow.rarityOrder,
        nameSort: lastRow.nameSort,
        source: lastRow.source,
        sourceItemId: lastRow.sourceItemId,
        id: lastRow.id,
      })
    : null;

  return {
    items: collapsedRows,
    nextCursor,
  };
}

async function searchSealedItems(input: {
  game: string;
  q: string;
  limit: number;
  cursor?: string;
  source?: string;
  language?: string;
  setId?: string;
}): Promise<PickerSearchPage> {
  const query = input.q.trim();
  if (!input.setId && query.length === 0) {
    return { items: [], nextCursor: null };
  }

  const cursor = input.cursor ? decodeCursor<SealedCursor>(input.cursor) : null;
  if (input.cursor && (!cursor || cursor.kind !== "SEALED_PRODUCT")) {
    throw new Error("invalid_cursor");
  }

  const rows = await prisma.catalogSealedProduct.findMany({
    where: {
      isActive: true,
      game: input.game,
      ...(input.source ? { source: input.source } : {}),
      ...(input.language ? { language: input.language } : {}),
      ...(input.setId ? { catalogSet: { sourceSetId: input.setId } } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { searchText: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      catalogSet: {
        select: {
          sourceSetId: true,
          name: true,
        },
      },
    },
    orderBy: [{ name: "asc" }, { source: "asc" }, { sourceProductId: "asc" }, { id: "asc" }],
    ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    take: input.limit + 1,
  });

  const hasMore = rows.length > input.limit;
  const pageRows = hasMore ? rows.slice(0, input.limit) : rows;
  const mappedRows: PickerSearchItem[] = pageRows.map((row) => ({
    id: row.id,
    source: row.source,
    sourceItemId: row.sourceProductId,
    itemType: "SEALED_PRODUCT",
    game: row.game,
    language: row.language,
    name: row.name,
    setId: row.catalogSet?.sourceSetId ?? row.catalogSetId,
    setName: row.catalogSet?.name ?? null,
    localId: null,
    cardNumber: null,
    rarity: null,
    imageThumbUrl: row.imageUrl,
    imageLargeUrl: row.imageUrl,
    imageBaseUrl: row.imageUrl,
  }));

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && lastRow
    ? encodeCursor({
        kind: "SEALED_PRODUCT",
        nameSort: lastRow.name.toLowerCase(),
        source: lastRow.source,
        sourceItemId: lastRow.sourceProductId,
        id: lastRow.id,
      })
    : null;

  return {
    items: mappedRows,
    nextCursor,
  };
}

catalogRouter.get("/v1/catalog/facets", async (req: VendorRequest, res) => {
  const auth = await requireVendorReadAccess(req, res);
  if (!auth) return;

  const parsed = facetQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
  }

  const { type, itemClass, game, source, language, setId, rarity, limit } = parsed.data;
  const normalizedClass = normalizeOrSendInvalidQuery({ type, itemClass }, res);
  if (!normalizedClass) return;

  const pickerClass = asItemClassForPicker(normalizedClass);
  if (pickerClass === "SEALED_PRODUCT") {
    const facets = await getSealedFacets({ game, source, language, setId, limit });
    return res.json(facets);
  }

  const facets = await getCardFacets({
    game,
    source,
    language,
    setId,
    rarity,
    limit,
  });
  return res.json(facets);
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

  const { q, limit, cursor, type, itemClass, game, language, source, setId, rarity } = parsed.data;
  const normalizedClass = normalizeOrSendInvalidQuery({ type, itemClass }, res);
  if (!normalizedClass) return;

  const pickerClass = asItemClassForPicker(normalizedClass);

  try {
    if (pickerClass === "CARD") {
      const page = await searchCardItems({
        game,
        q,
        limit,
        cursor,
        language,
        source,
        setId,
        rarity,
      });
      return res.json(page);
    }

    if (pickerClass === "SEALED_PRODUCT") {
      const page = await searchSealedItems({
        game,
        q,
        limit,
        cursor,
        language,
        source,
        setId,
      });
      return res.json(page);
    }

    if (pickerClass === "ALL") {
      const [cardPage, sealedPage] = await Promise.all([
        searchCardItems({
          game,
          q,
          limit,
          language,
          source,
          setId,
          rarity,
        }),
        searchSealedItems({
          game,
          q,
          limit,
          language,
          source,
          setId,
        }),
      ]);

      const merged = [...cardPage.items, ...sealedPage.items].slice(0, limit);
      return res.json({
        items: merged,
        nextCursor: null,
      });
    }

    return res.json({ items: [], nextCursor: null });
  } catch (error) {
    if ((error as Error).message === "invalid_cursor") {
      return res.status(400).json({ error: "invalid_cursor", message: "Cursor is invalid for this query." });
    }
    throw error;
  }
});
