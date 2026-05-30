import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { CatalogSearchCandidate, CatalogSearchWhereInput } from "./search-query";
import type { CatalogItemClass } from "./source-priority";

export type NormalizedCatalogSearchClass = CatalogItemClass | "ALL";

export type CatalogSearchTypeAlias = "card" | "sealed" | "all";

export type CatalogSearchClassParams = {
  type?: CatalogSearchTypeAlias;
  itemClass?: NormalizedCatalogSearchClass;
};

export type CatalogSearchClient = Pick<PrismaClient, "catalogItem" | "catalogSealedProduct" | "catalogSet" | "$queryRaw">;

type AdapterInput = Omit<CatalogSearchWhereInput, "typeFilter"> & {
  itemClass: NormalizedCatalogSearchClass;
};

function typeAliasToItemClass(type?: CatalogSearchTypeAlias): NormalizedCatalogSearchClass | undefined {
  if (!type) return undefined;
  if (type === "card") return "CARD";
  if (type === "sealed") return "SEALED_PRODUCT";
  return "ALL";
}

export function normalizeCatalogSearchClass(params: CatalogSearchClassParams): NormalizedCatalogSearchClass {
  const fromType = typeAliasToItemClass(params.type);
  const fromItemClass = params.itemClass;

  if (fromType && fromItemClass && fromType !== fromItemClass) {
    throw new Error("type and itemClass conflict");
  }
  return fromItemClass ?? fromType ?? "CARD";
}

function containsInsensitive(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

function textMatches(q: string) {
  return [
    { name: { startsWith: q, mode: "insensitive" as const } },
    { name: { contains: q, mode: "insensitive" as const } },
    { searchText: { contains: q, mode: "insensitive" as const } },
  ];
}

function shouldApplyGameFilter(game?: string) {
  return Boolean(game && game !== "ALL");
}

async function findCardCandidates(client: CatalogSearchClient, input: AdapterInput, take: number): Promise<CatalogSearchCandidate[]> {
  return client.$queryRaw<CatalogSearchCandidate[]>(buildCardSql(input, take));
}

function buildCardSql(input: AdapterInput, take: number): Prisma.Sql {
  const needle = input.q.trim().toLocaleLowerCase();
  const containsNeedle = `%${needle}%`;
  const prefixNeedle = `${needle}%`;
  const clauses: Prisma.Sql[] = [
    Prisma.sql`"isActive" = true`,
    Prisma.sql`lower("name") LIKE ${containsNeedle}`,
    Prisma.sql`"itemType" = ${"CARD"}::"CatalogItemType"`,
  ];

  if (shouldApplyGameFilter(input.game)) clauses.push(Prisma.sql`game = ${input.game}`);
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
    WHERE ${Prisma.join(clauses, " AND ")}
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

async function findSealedCandidates(client: CatalogSearchClient, input: AdapterInput, take: number): Promise<CatalogSearchCandidate[]> {
  const rows = await client.catalogSealedProduct.findMany({
    where: {
      isActive: true,
      ...(shouldApplyGameFilter(input.game) ? { game: input.game } : {}),
      ...(input.language ? { language: input.language } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.setId ? { catalogSet: { sourceSetId: input.setId } } : {}),
      ...(input.setName ? { catalogSet: { name: containsInsensitive(input.setName) } } : {}),
      OR: textMatches(input.q),
    },
    include: { catalogSet: { select: { sourceSetId: true, name: true } } },
    orderBy: [{ name: "asc" }, { source: "asc" }, { sourceProductId: "asc" }],
    take,
  });

  return rows.map((row) => ({
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
    searchText: row.searchText,
  }));
}

async function findSetCandidates(client: CatalogSearchClient, input: AdapterInput, take: number): Promise<CatalogSearchCandidate[]> {
  const rows = await client.catalogSet.findMany({
    where: {
      isActive: true,
      ...(shouldApplyGameFilter(input.game) ? { game: input.game } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.setId ? { sourceSetId: input.setId } : {}),
      ...(input.setName ? { name: containsInsensitive(input.setName) } : {}),
      OR: textMatches(input.q),
    },
    orderBy: [{ name: "asc" }, { source: "asc" }, { sourceSetId: "asc" }],
    take,
  });

  return rows.map((row) => {
    const imageUrl = row.logoImageUrl ?? row.symbolImageUrl ?? row.bannerImageUrl;
    return {
      id: row.id,
      source: row.source,
      sourceItemId: row.sourceSetId,
      itemType: "SET",
      game: row.game,
      language: "en",
      name: row.name,
      setId: row.sourceSetId,
      setName: row.name,
      localId: row.setCode,
      cardNumber: null,
      rarity: null,
      imageThumbUrl: imageUrl,
      imageLargeUrl: imageUrl,
      imageBaseUrl: imageUrl,
      searchText: row.searchText,
    };
  });
}

export async function findCatalogSearchAdapterCandidates(
  client: CatalogSearchClient,
  input: AdapterInput,
  take: number,
): Promise<CatalogSearchCandidate[]> {
  if (input.itemClass === "CARD") return findCardCandidates(client, input, take);
  if (input.itemClass === "SEALED_PRODUCT") return findSealedCandidates(client, input, take);
  if (input.itemClass === "SET") return findSetCandidates(client, input, take);
  if (input.itemClass === "ALL") {
    const perClassTake = Math.max(take, 10);
    const [cards, sealed, sets] = await Promise.all([
      findCardCandidates(client, { ...input, itemClass: "CARD" }, perClassTake),
      findSealedCandidates(client, { ...input, itemClass: "SEALED_PRODUCT" }, perClassTake),
      findSetCandidates(client, { ...input, itemClass: "SET" }, perClassTake),
    ]);
    return [...cards, ...sealed, ...sets].slice(0, take);
  }
  return [];
}
