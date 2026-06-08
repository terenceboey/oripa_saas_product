import type { PackTierSnapshot } from "@oripa/shared";

type TierInputItem = {
  label: string;
  estimatedValue: number;
  stock: number;
  imageUrl?: string | null;
  catalogItemId?: string | null;
  catalogSource?: string | null;
  catalogSourceItemId?: string | null;
  language?: string | null;
};

type TierInput = {
  name: string;
  percentage?: number;
  items: TierInputItem[];
};

function normalizeItem(item: TierInputItem) {
  return {
    label: item.label,
    estimatedValue: item.estimatedValue,
    stock: item.stock,
    imageUrl: item.imageUrl ?? null,
    catalogItemId: item.catalogItemId ?? null,
    catalogSource: item.catalogSource ?? null,
    catalogSourceItemId: item.catalogSourceItemId ?? null,
    language: item.language ?? null,
  };
}

function normalizePercentage(value?: number) {
  return typeof value === "number" ? value : null;
}

export function buildPackTierSnapshotFromTiers(tiers: TierInput[]): PackTierSnapshot {
  return {
    version: 1,
    tiers: tiers.map((tier) => ({
      name: tier.name,
      percentage: normalizePercentage(tier.percentage),
      items: tier.items.map(normalizeItem),
    })),
  };
}

export function buildPackTierSnapshotFromFlatItems(items: TierInputItem[], tierName = "A Tier"): PackTierSnapshot {
  return {
    version: 1,
    tiers: [
      {
        name: tierName,
        percentage: null,
        items: items.map(normalizeItem),
      },
    ],
  };
}
