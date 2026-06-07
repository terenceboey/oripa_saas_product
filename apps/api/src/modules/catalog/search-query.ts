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
    Prisma.sql`ci."isActive" = true`,
    Prisma.sql`lower(ci.name) LIKE ${containsNeedle}`,
  ];
  if (input.game && input.game !== "ALL") clauses.push(Prisma.sql`ci.game = ${input.game}`);

  if (input.typeFilter) clauses.push(Prisma.sql`ci."itemType" = ${input.typeFilter}::"CatalogItemType"`);
  if (input.language) clauses.push(Prisma.sql`ci.language = ${input.language}`);
  if (input.source) clauses.push(Prisma.sql`ci.source = ${input.source}`);
  if (input.setId) clauses.push(Prisma.sql`cs."sourceSetId" = ${input.setId}`);
  if (input.setName) clauses.push(Prisma.sql`lower(cs.name) LIKE ${`%${input.setName.toLocaleLowerCase()}%`}`);
  if (input.rarity) clauses.push(Prisma.sql`lower(ci.rarity) LIKE ${`%${input.rarity.toLocaleLowerCase()}%`}`);
  if (input.localId) clauses.push(Prisma.sql`ci."localId" = ${input.localId}`);
  if (input.cardNumber) clauses.push(Prisma.sql`ci."cardNumber" = ${input.cardNumber}`);

  return Prisma.sql`
    SELECT
      ci.id,
      ci.source,
      ci."sourceItemId",
      ci."itemType",
      ci.game,
      ci.language,
      ci.name,
      cs."sourceSetId" AS "setId",
      cs.name AS "setName",
      ci."localId",
      ci."cardNumber",
      ci.rarity,
      ci."imageThumbUrl",
      ci."imageLargeUrl",
      ci."imageBaseUrl",
      ci."searchText"
    FROM "CatalogItem" ci
    JOIN "CatalogSet" cs ON cs.id = ci."catalogSetId"
    WHERE ${andSql(clauses)}
    ORDER BY
      CASE
        WHEN lower(ci.name) = ${needle} THEN 0
        WHEN lower(ci.name) LIKE ${prefixNeedle} THEN 1
        ELSE 2
      END,
      ci.name ASC,
      ci.source ASC,
      ci."sourceItemId" ASC
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
  const catalogSetWhere: Prisma.CatalogSetWhereInput = {
    ...(input.setId ? { sourceSetId: input.setId } : {}),
    ...(input.setName ? { name: containsInsensitive(input.setName) } : {}),
  };

  return {
    isActive: true,
    ...(input.game && input.game !== "ALL" ? { game: input.game } : {}),
    ...(input.typeFilter ? { itemType: input.typeFilter as Prisma.EnumCatalogItemTypeFilter<"CatalogItem"> } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(Object.keys(catalogSetWhere).length > 0 ? { catalogSet: catalogSetWhere } : {}),
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
