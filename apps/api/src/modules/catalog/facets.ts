import { CatalogItemType, Prisma } from "@prisma/client";
import { sortCatalogSearchCandidates, stripCatalogSearchPayload } from "./search-query";

export type CatalogBrowseType = "card" | "sealed" | "all";

export type CatalogFacetQuery = {
  game?: string;
  type?: CatalogBrowseType;
  language?: string;
  source?: string;
  setId?: string;
  setName?: string;
  rarity?: string;
};

export type CatalogSuggestQuery = CatalogFacetQuery & {
  q: string;
};

export type CatalogFacetRow = {
  source: string | null;
  language: string | null;
  setId: string | null;
  setName: string | null;
  rarity: string | null;
};

export type CatalogSuggestionRow = {
  id: string;
  source: string;
  sourceItemId: string;
  itemType: CatalogItemType | string;
  game: string;
  language: string;
  name: string;
  setId: string | null;
  setName: string | null;
  localId: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageThumbUrl: string | null;
  imageLargeUrl: string | null;
  imageBaseUrl: string | null;
  searchText?: string;
  sourcePayload?: unknown;
};

function typeToCatalogItemType(type: CatalogBrowseType | undefined) {
  if (type === "sealed") return CatalogItemType.SEALED_PRODUCT;
  if (type === "all") return undefined;
  return CatalogItemType.CARD;
}

export function buildCatalogFacetWhere(query: CatalogFacetQuery): Prisma.CatalogItemWhereInput {
  const where: Prisma.CatalogItemWhereInput = {
    isActive: true,
    game: query.game ?? "POKEMON",
  };
  const itemType = typeToCatalogItemType(query.type);
  if (itemType) where.itemType = itemType;
  if (query.language) where.language = query.language;
  if (query.source) where.source = query.source;
  if (query.setId) where.setId = query.setId;
  if (query.setName) where.setName = { contains: query.setName, mode: "insensitive" };
  if (query.rarity) where.rarity = { contains: query.rarity, mode: "insensitive" };
  return where;
}

export function buildCatalogSuggestWhere(query: CatalogSuggestQuery): Prisma.CatalogItemWhereInput {
  return {
    ...buildCatalogFacetWhere(query),
    OR: [
      { name: { startsWith: query.q, mode: "insensitive" } },
      { name: { contains: query.q, mode: "insensitive" } },
      { searchText: { contains: query.q, mode: "insensitive" } },
    ],
  };
}

function countedOptions(values: Array<string | null>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function toCatalogFacetResponse(rows: CatalogFacetRow[]) {
  const setCounts = new Map<string, { id: string; name: string | null; count: number }>();
  for (const row of rows) {
    const id = row.setId?.trim();
    if (!id) continue;
    const current = setCounts.get(id);
    if (current) {
      current.count += 1;
      if (!current.name && row.setName) current.name = row.setName;
    } else {
      setCounts.set(id, { id, name: row.setName?.trim() || null, count: 1 });
    }
  }

  return {
    sources: countedOptions(rows.map((row) => row.source)),
    languages: countedOptions(rows.map((row) => row.language)),
    sets: [...setCounts.values()].sort((a, b) => b.count - a.count || (a.name ?? a.id).localeCompare(b.name ?? b.id)),
    rarities: countedOptions(rows.map((row) => row.rarity)),
  };
}

export function toCatalogSuggestionResponse(rows: CatalogSuggestionRow[], q = "") {
  const sortedRows = q ? sortCatalogSearchCandidates(q, rows) : rows;
  return {
    items: sortedRows.map((row) => stripCatalogSearchPayload(row)),
  };
}
