import { Prisma } from "@prisma/client";
import type { CatalogSearchMergeInput, CatalogSearchResponseItem } from "./search-dedupe";

const INSENSITIVE = "insensitive" as const;

export type CatalogSearchWhereInput = {
  q: string;
  game: string;
  typeFilter?: string;
  language?: string;
  source?: string;
  setId?: string;
  setName?: string;
  rarity?: string;
  localId?: string;
  cardNumber?: string;
};

export type CatalogSearchRankInput = {
  name: string;
  searchText?: string | null;
};

export type CatalogSearchCandidate = CatalogSearchMergeInput & {
  searchText?: string | null;
};

export type CatalogSearchPayloadRow = {
  id: string;
  sourcePayload?: unknown;
};

type CatalogSearchClient = {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
};

function containsInsensitive(value: string) {
  return { contains: value, mode: INSENSITIVE };
}

function andSql(clauses: Prisma.Sql[]) {
  return Prisma.join(clauses, " AND ");
}

export function buildCatalogIndexedSearchSql(input: CatalogSearchWhereInput, take: number): Prisma.Sql {
  const needle = input.q.trim().toLocaleLowerCase();
  const containsNeedle = `%${needle}%`;
  const prefixNeedle = `${needle}%`;
  const clauses: Prisma.Sql[] = [
    Prisma.sql`"isActive" = true`,
    Prisma.sql`lower("name") LIKE ${containsNeedle}`,
  ];
  if (input.game && input.game !== "ALL") clauses.push(Prisma.sql`game = ${input.game}`);

  if (input.typeFilter) clauses.push(Prisma.sql`"itemType" = ${input.typeFilter}::"CatalogItemType"`);
  if (input.language) clauses.push(Prisma.sql`language = ${input.language}`);
  if (input.source) clauses.push(Prisma.sql`source = ${input.source}`);
  if (input.setId) clauses.push(Prisma.sql`"setId" = ${input.setId}`);
  if (input.setName) clauses.push(Prisma.sql`lower("setName") LIKE ${`%${input.setName.toLocaleLowerCase()}%`}`);
  if (input.rarity) clauses.push(Prisma.sql`lower(rarity) LIKE ${`%${input.rarity.toLocaleLowerCase()}%`}`);
  if (input.localId) clauses.push(Prisma.sql`"localId" = ${input.localId}`);
  if (input.cardNumber) clauses.push(Prisma.sql`"cardNumber" = ${input.cardNumber}`);

  return Prisma.sql`
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
      "searchText"
    FROM "CatalogItem"
    WHERE ${andSql(clauses)}
    ORDER BY
      CASE
        WHEN lower("name") = ${needle} THEN 0
        WHEN lower("name") LIKE ${prefixNeedle} THEN 1
        ELSE 2
      END,
      name ASC,
      source ASC,
      "sourceItemId" ASC
    LIMIT ${take}
  `;
}

export async function findCatalogSearchCandidates(
  client: CatalogSearchClient,
  input: CatalogSearchWhereInput,
  take: number,
): Promise<CatalogSearchCandidate[]> {
  return client.$queryRaw<CatalogSearchCandidate[]>(buildCatalogIndexedSearchSql(input, take));
}

export function buildCatalogSearchWhere(input: CatalogSearchWhereInput): Prisma.CatalogItemWhereInput {
  return {
    isActive: true,
    ...(input.game && input.game !== "ALL" ? { game: input.game } : {}),
    ...(input.typeFilter ? { itemType: input.typeFilter as Prisma.EnumCatalogItemTypeFilter<"CatalogItem"> } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.setId ? { setId: input.setId } : {}),
    ...(input.setName ? { setName: containsInsensitive(input.setName) } : {}),
    ...(input.rarity ? { rarity: containsInsensitive(input.rarity) } : {}),
    ...(input.localId ? { localId: input.localId } : {}),
    ...(input.cardNumber ? { cardNumber: input.cardNumber } : {}),
    OR: [
      { name: { startsWith: input.q, mode: INSENSITIVE } },
      { name: { contains: input.q, mode: INSENSITIVE } },
      { searchText: { contains: input.q, mode: INSENSITIVE } },
    ],
  };
}

export function rankCatalogSearchItem(q: string, item: CatalogSearchRankInput): number {
  const needle = q.trim().toLocaleLowerCase();
  const name = item.name.toLocaleLowerCase();
  const searchText = item.searchText?.toLocaleLowerCase() ?? "";

  if (name.startsWith(needle)) return 0;
  if (name.includes(needle)) return 1;
  if (searchText.includes(needle)) return 2;
  return 3;
}

export function sortCatalogSearchCandidates<T extends CatalogSearchCandidate>(q: string, rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const rankDelta = rankCatalogSearchItem(q, left) - rankCatalogSearchItem(q, right);
    if (rankDelta !== 0) return rankDelta;
    const nameDelta = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (nameDelta !== 0) return nameDelta;
    const sourceDelta = left.source.localeCompare(right.source, undefined, { sensitivity: "base" });
    if (sourceDelta !== 0) return sourceDelta;
    return left.sourceItemId.localeCompare(right.sourceItemId, undefined, { sensitivity: "base" });
  });
}

export function attachCatalogSearchPayloads<T extends CatalogSearchCandidate>(
  rows: T[],
  payloadRows: CatalogSearchPayloadRow[],
): T[] {
  const payloadById = new Map(payloadRows.map((row) => [row.id, row.sourcePayload]));
  return rows.map((row) =>
    payloadById.has(row.id)
      ? {
          ...row,
          sourcePayload: payloadById.get(row.id),
        }
      : row,
  );
}

export function stripCatalogSearchPayload<T extends CatalogSearchResponseItem | CatalogSearchCandidate>(item: T) {
  const { sourcePayload: _sourcePayload, searchText: _searchText, ...response } = item as T & {
    sourcePayload?: unknown;
    searchText?: unknown;
  };
  return response;
}
