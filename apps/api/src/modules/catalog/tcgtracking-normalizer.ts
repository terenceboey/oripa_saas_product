import { CatalogItemType, Prisma } from "@prisma/client";

export const TCGTRACKING_SOURCE = "tcgtracking";
export const POKEMON_GAME = "POKEMON";

export type TcgTrackingSetContext = {
  id?: unknown;
  set_id?: unknown;
  name?: unknown;
  set_name?: unknown;
  abbreviation?: unknown;
  set_abbr?: unknown;
};

export type TcgTrackingProduct = {
  id?: unknown;
  product_id?: unknown;
  name?: unknown;
  clean_name?: unknown;
  number?: unknown;
  ext_number?: unknown;
  rarity?: unknown;
  ext_rarity?: unknown;
  image_url?: unknown;
  category_id?: unknown;
  group_id?: unknown;
  cardtrader?: Array<{ product_type?: unknown; collector_number?: unknown }>;
  [key: string]: unknown;
};

export type CatalogItemProjection = {
  source: string;
  sourceItemId: string;
  localId: string | null;
  itemType: CatalogItemType;
  game: string;
  language: string;
  name: string;
  setId: string | null;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageBaseUrl: string | null;
  imageThumbUrl: string | null;
  imageLargeUrl: string | null;
  searchText: string;
  isActive: true;
  sourcePayload: Prisma.InputJsonValue;
};

export type NormalizerSkipReason = "missing_id" | "missing_name" | "non_card_product";

export type NormalizeStats = {
  missing_id: number;
  missing_name: number;
  missing_image: number;
  missing_set_metadata: number;
  non_card_product: number;
  rows_written: number;
  rows_skipped: number;
};

export type NormalizeResult = {
  row: CatalogItemProjection | null;
  stats: NormalizeStats;
  skippedReason?: NormalizerSkipReason;
};

export function asNonEmptyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function hasCardShape(product: TcgTrackingProduct): boolean {
  const productType = asNonEmptyString(product.cardtrader?.[0]?.product_type)?.toLowerCase();
  if (productType === "single") return true;

  const number = asNonEmptyString(product.number) ?? asNonEmptyString(product.ext_number);
  const rarity = asNonEmptyString(product.rarity) ?? asNonEmptyString(product.ext_rarity);
  return Boolean(number || rarity);
}

export function buildTcgtrackingSearchText(input: {
  name: string;
  setName?: string | null;
  setId?: string | null;
  setAbbr?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  game?: string | null;
}): string {
  return [
    input.name,
    input.setName,
    input.setId,
    input.setAbbr,
    input.cardNumber,
    input.rarity,
    input.game ?? POKEMON_GAME,
    "card",
    TCGTRACKING_SOURCE,
  ]
    .map((part) => asNonEmptyString(part))
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function normalizeTcgtrackingProductForCatalog(
  product: TcgTrackingProduct,
  options: {
    language: string;
    game?: string;
    categoryId?: string | null;
    set?: TcgTrackingSetContext | null;
    pricing?: unknown;
    skus?: unknown;
    sourceContext?: Record<string, unknown>;
  } = { language: "en" },
): NormalizeResult {
  const stats: NormalizeStats = {
    missing_id: 0,
    missing_name: 0,
    missing_image: 0,
    missing_set_metadata: 0,
    non_card_product: 0,
    rows_written: 0,
    rows_skipped: 0,
  };

  const rawSourceItemId = asNonEmptyString(product.id) ?? asNonEmptyString(product.product_id);
  if (!rawSourceItemId) {
    stats.missing_id += 1;
    stats.rows_skipped += 1;
    return { row: null, stats, skippedReason: "missing_id" };
  }

  const name = asNonEmptyString(product.name) ?? asNonEmptyString(product.clean_name);
  if (!name) {
    stats.missing_name += 1;
    stats.rows_skipped += 1;
    return { row: null, stats, skippedReason: "missing_name" };
  }

  if (!hasCardShape(product)) {
    stats.non_card_product += 1;
    stats.rows_skipped += 1;
    return { row: null, stats, skippedReason: "non_card_product" };
  }

  const setId =
    asNonEmptyString(options.set?.id) ??
    asNonEmptyString(options.set?.set_id) ??
    asNonEmptyString(product.group_id);
  const categoryId = asNonEmptyString(options.categoryId);
  const sourceItemId = categoryId && categoryId !== "3" ? `${categoryId}:${rawSourceItemId}` : rawSourceItemId;

  const setName = asNonEmptyString(options.set?.name) ?? asNonEmptyString(options.set?.set_name);
  const setAbbr = asNonEmptyString(options.set?.abbreviation) ?? asNonEmptyString(options.set?.set_abbr);
  if (!setName || !setAbbr) {
    stats.missing_set_metadata += 1;
  }

  const cardNumber = asNonEmptyString(product.number) ?? asNonEmptyString(product.ext_number);
  const rarity = asNonEmptyString(product.rarity) ?? asNonEmptyString(product.ext_rarity);
  const image = asNonEmptyString(product.image_url);
  if (!image) stats.missing_image += 1;

  const row: CatalogItemProjection = {
    source: TCGTRACKING_SOURCE,
    sourceItemId,
    localId: cardNumber,
    itemType: CatalogItemType.CARD,
    game: options.game ?? POKEMON_GAME,
    language: options.language,
    name,
    setId,
    setName,
    cardNumber,
    rarity,
    imageBaseUrl: image,
    imageThumbUrl: image,
    imageLargeUrl: image,
    searchText: buildTcgtrackingSearchText({ name, setName, setId, setAbbr, cardNumber, rarity, game: options.game ?? POKEMON_GAME }),
    isActive: true,
    sourcePayload: {
      source: TCGTRACKING_SOURCE,
      sourceItemId,
      rawSourceItemId,
      categoryId: options.categoryId ?? null,
      raw: product,
      set: options.set ?? null,
      pricing: options.pricing ?? null,
      skus: options.skus ?? null,
      context: options.sourceContext ?? null,
    } as Prisma.InputJsonValue,
  };

  stats.rows_written += 1;
  return { row, stats };
}

export function mergeNormalizeStats(items: NormalizeStats[]): NormalizeStats {
  return items.reduce<NormalizeStats>(
    (acc, item) => ({
      missing_id: acc.missing_id + item.missing_id,
      missing_name: acc.missing_name + item.missing_name,
      missing_image: acc.missing_image + item.missing_image,
      missing_set_metadata: acc.missing_set_metadata + item.missing_set_metadata,
      non_card_product: acc.non_card_product + item.non_card_product,
      rows_written: acc.rows_written + item.rows_written,
      rows_skipped: acc.rows_skipped + item.rows_skipped,
    }),
    {
      missing_id: 0,
      missing_name: 0,
      missing_image: 0,
      missing_set_metadata: 0,
      non_card_product: 0,
      rows_written: 0,
      rows_skipped: 0,
    },
  );
}
