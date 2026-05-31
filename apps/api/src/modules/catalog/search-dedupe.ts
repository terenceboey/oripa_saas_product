type JsonRecord = Record<string, unknown>;

import { getSourceRank, type CatalogItemClass } from "./source-priority";

export type CatalogSearchMergeInput = {
  id: string;
  entityType?: string;
  catalogClass?: string;
  prizeableNow?: boolean;
  source: string;
  sourceItemId: string;
  itemType: string;
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
  sourcePayload?: unknown;
};

export type CatalogSearchResponseItem = Omit<CatalogSearchMergeInput, "sourcePayload"> & {
  mergedSourceItems: Array<{ id: string; source: string; sourceItemId: string }>;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function firstNonBlank(...values: unknown[]): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized.length > 0 && normalized.toLowerCase() !== "null") return normalized;
  }
  return null;
}

function asCatalogItemClass(value: string): CatalogItemClass {
  switch (value) {
    case "CARD":
    case "SEALED_PRODUCT":
    case "SET":
    case "SLAB":
    case "CUSTOM_ITEM":
    case "ACCESSORY":
    case "BONUS":
      return value;
    default:
      return "CARD";
  }
}

export function getCatalogSearchTcgplayerProductId(row: {
  source: string;
  sourceItemId?: string | null;
  sourcePayload?: unknown;
}): string | null {
  const payload = asRecord(row.sourcePayload);
  const raw = asRecord(payload?.raw);

  return firstNonBlank(
    raw?.tcgplayer_id,
    raw?.tcgplayer_product_id,
    row.source === "tcgtracking" ? raw?.id : null,
    row.source === "tcgtracking" ? row.sourceItemId : null,
  );
}

function preferredSourceRank(row: CatalogSearchMergeInput): number {
  return getSourceRank({
    game: row.game,
    itemClass: asCatalogItemClass(row.itemType),
    source: row.source,
    useCase: "SEARCH_DISPLAY",
  }).displayRank;
}

function dedupeKey(row: CatalogSearchMergeInput): string | null {
  const policy = getSourceRank({
    game: row.game,
    itemClass: asCatalogItemClass(row.itemType),
    source: row.source,
    useCase: "SEARCH_DISPLAY",
  });
  if (!policy.collapseEligible) return null;

  const tcgplayerProductId = getCatalogSearchTcgplayerProductId(row);
  if (!tcgplayerProductId) return null;
  return [row.game, row.itemType, tcgplayerProductId].join("::");
}

function toResponseItem(row: CatalogSearchMergeInput): CatalogSearchResponseItem {
  const { sourcePayload: _sourcePayload, ...response } = row;
  return {
    ...response,
    entityType: response.entityType ?? "catalog_item",
    catalogClass: response.catalogClass ?? response.itemType,
    prizeableNow: response.prizeableNow ?? response.itemType === "CARD",
    mergedSourceItems: [],
  };
}

export function collapseCatalogSearchItems(rows: CatalogSearchMergeInput[]): CatalogSearchResponseItem[] {
  const output: CatalogSearchResponseItem[] = [];
  const keyed = new Map<string, CatalogSearchResponseItem>();

  for (const row of rows) {
    const key = dedupeKey(row);
    if (!key) {
      output.push(toResponseItem(row));
      continue;
    }

    const existing = keyed.get(key);
    if (!existing) {
      const response = toResponseItem(row);
      keyed.set(key, response);
      output.push(response);
      continue;
    }

    if (preferredSourceRank(row) < preferredSourceRank(existing)) {
      const mergedSourceItems = [
        { id: existing.id, source: existing.source, sourceItemId: existing.sourceItemId },
        ...existing.mergedSourceItems,
      ].filter((item) => item.id !== row.id);
      Object.assign(existing, toResponseItem(row));
      existing.mergedSourceItems = mergedSourceItems;
    } else {
      existing.mergedSourceItems.push({ id: row.id, source: row.source, sourceItemId: row.sourceItemId });
    }
  }

  return output;
}
