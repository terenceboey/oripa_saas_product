import { DEFAULT_BUYBACK_PERCENT } from "../../lib/customer-custody";
import { evaluatePackAvailability, type PackAvailability } from "./availability";
import { requiresPhysicalInventoryAllocation } from "./inventory-allocation";

type ProjectionPrizeInput = {
  id: string;
  label: string;
  estimatedValue: number | null;
  weight: number;
  stock?: number | null;
  remainingStock?: number | null;
  updatedAt?: Date | string | null;
};

type ProjectionTierSnapshotItem = {
  estimatedValue: number;
};

type ProjectionTierSnapshotTier = {
  name: string;
  percentage?: number | null;
  items: ProjectionTierSnapshotItem[];
};

type ProjectionPackInput = {
  id: string;
  title?: string | null;
  sourceTemplateType?: string | null;
  isActive: boolean;
  status: "DRAFT" | "LIVE" | "ARCHIVED";
  pricePoints: number;
  totalStock?: number | null;
  remainingStock: number;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  poolSnapshotHash?: string | null;
  inventoryMode?: string | null;
  tierSnapshotJson?: unknown;
  updatedAt?: Date | string | null;
  prizes: ProjectionPrizeInput[];
};

type ProjectionOddsEntry = {
  prizeId: string;
  label: string;
  weight: number;
  probability: number;
  dropRatePercent: number;
};

type ProjectionTierRange = {
  name: string;
  percentage: number | null;
  minValue: number | null;
  maxValue: number | null;
  itemCount: number;
};

export type PackMachineProjection = {
  code: string;
  family: string;
  pricePoints: number;
  estimatedEv: number | null;
  minValue: number | null;
  maxValue: number | null;
  buybackPercent: number;
  stock: { total: number | null; remaining: number };
  odds: { totalWeight: number; prizes: ProjectionOddsEntry[] };
  tierRanges: ProjectionTierRange[];
  valueAsOf: string | null;
  valueFresh: boolean;
  availability: PackAvailability;
};

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function roundTo(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function pickValueAsOf(pack: ProjectionPackInput, prizes: ProjectionPrizeInput[]) {
  const timestamps = [toDate(pack.updatedAt), ...prizes.map((prize) => toDate(prize.updatedAt))]
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function parseTierSnapshot(input: unknown): ProjectionTierSnapshotTier[] {
  if (!input || typeof input !== "object") return [];
  const tiers = (input as { tiers?: unknown }).tiers;
  if (!Array.isArray(tiers)) return [];

  return tiers.flatMap((tier) => {
    if (!tier || typeof tier !== "object") return [];
    const items = Array.isArray((tier as { items?: unknown }).items) ? (tier as { items: unknown[] }).items : [];
    return [{
      name: typeof (tier as { name?: unknown }).name === "string" && (tier as { name: string }).name.trim()
        ? (tier as { name: string }).name
        : "Tier",
      percentage: toFiniteNumber((tier as { percentage?: unknown }).percentage),
      items: items.flatMap((item) => {
        const estimatedValue = item && typeof item === "object"
          ? toFiniteNumber((item as { estimatedValue?: unknown }).estimatedValue)
          : null;
        return estimatedValue == null ? [] : [{ estimatedValue }];
      }),
    }];
  });
}

function buildTierRanges(pack: ProjectionPackInput, prizes: ProjectionPrizeInput[]): ProjectionTierRange[] {
  const snapshotTiers = parseTierSnapshot(pack.tierSnapshotJson);
  if (snapshotTiers.length > 0) {
    return snapshotTiers.map((tier) => {
      const values = tier.items.map((item) => item.estimatedValue).filter((value) => Number.isFinite(value));
      return {
        name: tier.name,
        percentage: tier.percentage ?? null,
        minValue: values.length > 0 ? Math.min(...values) : null,
        maxValue: values.length > 0 ? Math.max(...values) : null,
        itemCount: tier.items.length,
      };
    });
  }

  const values = prizes
    .map((prize) => toFiniteNumber(prize.estimatedValue))
    .filter((value): value is number => value != null);
  if (values.length === 0) return [];

  return [{
    name: "All prizes",
    percentage: null,
    minValue: Math.min(...values),
    maxValue: Math.max(...values),
    itemCount: values.length,
  }];
}

function buildOdds(prizes: ProjectionPrizeInput[]) {
  const totalWeight = prizes.reduce((sum, prize) => sum + Math.max(0, toFiniteNumber(prize.weight) ?? 0), 0);
  return {
    totalWeight,
    prizes: prizes.map((prize) => {
      const weight = Math.max(0, toFiniteNumber(prize.weight) ?? 0);
      const probability = totalWeight > 0 ? roundTo(weight / totalWeight, 6) : 0;
      return {
        prizeId: prize.id,
        label: prize.label,
        weight,
        probability,
        dropRatePercent: roundTo(probability * 100, 4),
      };
    }),
  };
}

function computePhysicalInventoryMissing(pack: ProjectionPackInput) {
  if (!requiresPhysicalInventoryAllocation(pack.inventoryMode)) return false;
  if (pack.remainingStock <= 0) return false;

  const weightedPrizes = pack.prizes.filter((prize) => (toFiniteNumber(prize.weight) ?? 0) > 0);
  if (weightedPrizes.length === 0) return true;

  let remainingSignalTotal = 0;
  for (const prize of weightedPrizes) {
    const stock = toFiniteNumber(prize.stock);
    const remainingStock = toFiniteNumber(prize.remainingStock);
    if (stock == null || remainingStock == null) return true;
    if (stock < 0 || remainingStock < 0 || remainingStock > stock) return true;
    remainingSignalTotal += remainingStock;
  }

  return remainingSignalTotal < pack.remainingStock;
}

export function buildPackMachineProjection(
  pack: ProjectionPackInput,
  options: { now?: Date; buybackPercent?: number } = {},
): PackMachineProjection {
  const valuedPrizes = pack.prizes
    .map((prize) => ({ prize, estimatedValue: toFiniteNumber(prize.estimatedValue) }))
    .filter((entry): entry is { prize: ProjectionPrizeInput; estimatedValue: number } => entry.estimatedValue != null);
  const positiveWeightValuedPrizes = valuedPrizes.filter((entry) => (toFiniteNumber(entry.prize.weight) ?? 0) > 0);
  const totalPositiveWeight = positiveWeightValuedPrizes.reduce((sum, entry) => sum + (toFiniteNumber(entry.prize.weight) ?? 0), 0);

  const estimatedEv = totalPositiveWeight > 0
    ? roundTo(
        positiveWeightValuedPrizes.reduce(
          (sum, entry) => sum + entry.estimatedValue * (toFiniteNumber(entry.prize.weight) ?? 0),
          0,
        ) / totalPositiveWeight,
        2,
      )
    : null;
  const valuedNumbers = valuedPrizes.map((entry) => entry.estimatedValue);
  const minValue = valuedNumbers.length > 0 ? Math.min(...valuedNumbers) : null;
  const maxValue = valuedNumbers.length > 0 ? Math.max(...valuedNumbers) : null;
  const valueFresh = pack.prizes.length > 0
    && pack.prizes.every((prize) => toFiniteNumber(prize.estimatedValue) != null)
    && valuedNumbers.length > 0;

  const physicalInventoryMissing = computePhysicalInventoryMissing(pack);
  const availability = evaluatePackAvailability({
    pack: {
      id: pack.id,
      isActive: pack.isActive,
      status: pack.status,
      pricePoints: pack.pricePoints,
      remainingStock: pack.remainingStock,
      startsAt: pack.startsAt,
      endsAt: pack.endsAt,
      poolSnapshotHash: pack.poolSnapshotHash ?? null,
    },
    now: options.now,
    physicalInventoryMissing,
    valueStale: !valueFresh,
  });

  return {
    code: pack.id,
    family: pack.sourceTemplateType ?? (pack.title?.trim() || pack.id),
    pricePoints: pack.pricePoints,
    estimatedEv,
    minValue,
    maxValue,
    buybackPercent: options.buybackPercent ?? DEFAULT_BUYBACK_PERCENT,
    stock: {
      total: toFiniteNumber(pack.totalStock),
      remaining: pack.remainingStock,
    },
    odds: buildOdds(pack.prizes),
    tierRanges: buildTierRanges(pack, pack.prizes),
    valueAsOf: valueFresh ? pickValueAsOf(pack, pack.prizes) : null,
    valueFresh,
    availability,
  };
}
