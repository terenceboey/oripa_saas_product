const DEFAULT_POKEMON_CARD_IMAGE = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";

export class CatalogPrizeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogPrizeResolutionError";
  }
}

export type CatalogItemSnapshotSource = {
  id: string;
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
  imageBaseUrl: string | null;
  imageThumbUrl: string | null;
  imageLargeUrl: string | null;
};

export type CatalogPrizeRef = {
  catalogItemId?: string;
  catalogSource?: string;
  catalogSourceItemId?: string;
  language?: string;
};

export type PackPrizeInput = CatalogPrizeRef & {
  label: string;
  imageUrl?: string;
  weight: number;
  stock: number;
  estimatedValue: number;
};

export type PackTierInput = {
  name: string;
  percentage?: number;
  items: Array<Omit<PackPrizeInput, "weight">>;
};

export type ResolvedPackPrizeRow = {
  label: string;
  imageUrl: string;
  imageLargeUrl?: string | null;
  setId?: string | null;
  setName?: string | null;
  localId?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  catalogItemId?: string | null;
  catalogSource?: string | null;
  catalogSourceItemId?: string | null;
  catalogSnapshot?: Record<string, unknown> | null;
  weight: number;
  stock: number;
  remainingStock: number;
  estimatedValue: number;
};

export type CatalogItemLookup = {
  findCatalogItemsByIds(ids: string[]): Promise<CatalogItemSnapshotSource[]>;
  findCatalogItemBySourceRef(ref: { source: string; sourceItemId: string; language?: string }): Promise<CatalogItemSnapshotSource | null>;
};

type PrizeCandidate = PackPrizeInput & { tierName?: string };

function hasCatalogRef(prize: CatalogPrizeRef) {
  return Boolean(prize.catalogItemId || (prize.catalogSource && prize.catalogSourceItemId));
}

function catalogSnapshotPayload(item: CatalogItemSnapshotSource) {
  return {
    id: item.id,
    source: item.source,
    sourceItemId: item.sourceItemId,
    itemType: item.itemType,
    game: item.game,
    language: item.language,
    name: item.name,
    setId: item.setId,
    setName: item.setName,
    localId: item.localId,
    cardNumber: item.cardNumber,
    rarity: item.rarity,
    imageBaseUrl: item.imageBaseUrl,
    imageThumbUrl: item.imageThumbUrl,
    imageLargeUrl: item.imageLargeUrl,
  };
}

export function buildCatalogPrizeSnapshot(item: CatalogItemSnapshotSource, tierName?: string) {
  const label = tierName ? `${tierName} - ${item.name}` : item.name;
  return {
    catalogItemId: item.id,
    catalogSource: item.source,
    catalogSourceItemId: item.sourceItemId,
    catalogSnapshot: catalogSnapshotPayload(item),
    label,
    imageUrl: item.imageThumbUrl ?? item.imageBaseUrl ?? item.imageLargeUrl ?? DEFAULT_POKEMON_CARD_IMAGE,
    imageLargeUrl: item.imageLargeUrl,
    setId: item.setId,
    setName: item.setName,
    localId: item.localId,
    cardNumber: item.cardNumber,
    rarity: item.rarity,
  };
}

async function loadCatalogItems(candidates: PrizeCandidate[], catalogLookup: CatalogItemLookup) {
  const catalogIds = [...new Set(candidates.map((prize) => prize.catalogItemId).filter((id): id is string => Boolean(id)))];
  const catalogItems = await catalogLookup.findCatalogItemsByIds(catalogIds);
  const byId = new Map(catalogItems.map((item) => [item.id, item]));

  for (const prize of candidates) {
    if (!prize.catalogItemId || byId.has(prize.catalogItemId)) continue;
    throw new CatalogPrizeResolutionError(`Catalog item not found: ${prize.catalogItemId}`);
  }

  const sourceRefCache = new Map<string, CatalogItemSnapshotSource>();
  for (const prize of candidates) {
    if (prize.catalogItemId || !prize.catalogSource || !prize.catalogSourceItemId) continue;
    const language = prize.language ?? "en";
    const cacheKey = `${prize.catalogSource}\u0000${prize.catalogSourceItemId}\u0000${language}`;
    if (sourceRefCache.has(cacheKey)) continue;
    const item = await catalogLookup.findCatalogItemBySourceRef({
      source: prize.catalogSource,
      sourceItemId: prize.catalogSourceItemId,
      language,
    });
    if (!item) {
      throw new CatalogPrizeResolutionError(`Catalog item not found: ${prize.catalogSource}/${prize.catalogSourceItemId}/${language}`);
    }
    sourceRefCache.set(cacheKey, item);
  }

  return { byId, sourceRefCache };
}

function resolveCatalogItem(
  prize: PrizeCandidate,
  catalogItems: { byId: Map<string, CatalogItemSnapshotSource>; sourceRefCache: Map<string, CatalogItemSnapshotSource> }
) {
  if (prize.catalogItemId) return catalogItems.byId.get(prize.catalogItemId) ?? null;
  if (prize.catalogSource && prize.catalogSourceItemId) {
    return catalogItems.sourceRefCache.get(`${prize.catalogSource}\u0000${prize.catalogSourceItemId}\u0000${prize.language ?? "en"}`) ?? null;
  }
  return null;
}

function manualPrizeRow(prize: PrizeCandidate): ResolvedPackPrizeRow {
  return {
    label: prize.tierName ? `${prize.tierName} - ${prize.label}` : prize.label,
    imageUrl: prize.imageUrl ?? DEFAULT_POKEMON_CARD_IMAGE,
    weight: prize.weight,
    stock: prize.stock,
    remainingStock: prize.stock,
    estimatedValue: prize.estimatedValue,
  };
}

export async function resolvePackPrizeRows(
  data: { tiers?: PackTierInput[]; prizes?: PackPrizeInput[] },
  catalogLookup: CatalogItemLookup
): Promise<ResolvedPackPrizeRow[]> {
  const candidates: PrizeCandidate[] = [];

  if (data.tiers && data.tiers.length > 0) {
    const tiersWithPercent = data.tiers.filter((tier) => typeof tier.percentage === "number");
    const fixedPercentTotal = tiersWithPercent.reduce((sum, tier) => sum + (tier.percentage ?? 0), 0);
    if (fixedPercentTotal > 100) {
      throw new Error("Tier percentages exceed 100%");
    }

    const tiersWithoutPercent = data.tiers.filter((tier) => typeof tier.percentage !== "number");
    const remainingPercent = Math.max(0, 100 - fixedPercentTotal);
    const fallbackTierPercent = tiersWithoutPercent.length > 0 ? remainingPercent / tiersWithoutPercent.length : 0;

    for (const tier of data.tiers) {
      const tierPercent = tier.percentage ?? fallbackTierPercent;
      const perItemPercent = tier.items.length > 0 ? tierPercent / tier.items.length : 0;
      const itemWeight = Math.max(1, Math.round(perItemPercent * 100));

      for (const item of tier.items) {
        candidates.push({ ...item, tierName: tier.name, weight: itemWeight });
      }
    }
  } else if (data.prizes && data.prizes.length > 0) {
    candidates.push(...data.prizes);
  } else {
    candidates.push(
      { label: "A Tier - Chase", imageUrl: DEFAULT_POKEMON_CARD_IMAGE, weight: 10, stock: 1, estimatedValue: 1000 },
      { label: "B Tier - Mid", imageUrl: DEFAULT_POKEMON_CARD_IMAGE, weight: 50, stock: 10, estimatedValue: 250 },
      { label: "C Tier - Base", imageUrl: DEFAULT_POKEMON_CARD_IMAGE, weight: 200, stock: 100, estimatedValue: 50 }
    );
  }

  const catalogItems = candidates.some(hasCatalogRef)
    ? await loadCatalogItems(candidates, catalogLookup)
    : { byId: new Map<string, CatalogItemSnapshotSource>(), sourceRefCache: new Map<string, CatalogItemSnapshotSource>() };

  return candidates.map((candidate) => {
    const catalogItem = resolveCatalogItem(candidate, catalogItems);
    if (!catalogItem) return manualPrizeRow(candidate);
    return {
      ...buildCatalogPrizeSnapshot(catalogItem, candidate.tierName),
      weight: candidate.weight,
      stock: candidate.stock,
      remainingStock: candidate.stock,
      estimatedValue: candidate.estimatedValue,
    };
  });
}
