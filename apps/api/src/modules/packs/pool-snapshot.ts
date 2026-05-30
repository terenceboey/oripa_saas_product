import { createHash } from "node:crypto";

export type PackStatus = "DRAFT" | "LIVE" | "ARCHIVED";

export type PoolSnapshotPrizeRow = {
  id: string;
  label: string;
  imageUrl?: string | null;
  imageLargeUrl?: string | null;
  setId?: string | null;
  setName?: string | null;
  localId?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  catalogItemId?: string | null;
  catalogSource?: string | null;
  catalogSourceItemId?: string | null;
  catalogSnapshot?: unknown;
  estimatedValue: number;
  weight: number;
  stock: number;
  remainingStock: number;
};

export type CanonicalPoolSnapshot = {
  version: 1;
  rows: Array<{
    id: string;
    label: string;
    imageUrl: string | null;
    imageLargeUrl: string | null;
    setId: string | null;
    setName: string | null;
    localId: string | null;
    cardNumber: string | null;
    rarity: string | null;
    catalogItemId: string | null;
    catalogSource: string | null;
    catalogSourceItemId: string | null;
    catalogSnapshot: unknown;
    estimatedValue: number;
    weight: number;
    stock: number;
  }>;
};

type ExistingPublishState = {
  status: PackStatus;
  poolSnapshotHash?: string | null;
  publishedFromTemplateAt?: Date | string | null;
  publishedByUserId?: string | null;
  publishIdempotencyKey?: string | null;
};

type PublishContext = {
  actorUserId: string;
  now: Date;
  idempotencyKey?: string | null;
};

export class PackPublishFreezeError extends Error {
  constructor(
    public readonly reason: "archived" | "already_published" | "pool_hash_mismatch" | "empty_pool",
    message: string
  ) {
    super(message);
    this.name = "PackPublishFreezeError";
  }
}

function normalizeJson(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => normalizeJson(entry));

  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    normalized[key] = normalizeJson((value as Record<string, unknown>)[key]);
  }
  return normalized;
}

export function stableCanonicalJson(value: unknown) {
  return JSON.stringify(normalizeJson(value));
}

export function buildCanonicalPoolSnapshot(rows: PoolSnapshotPrizeRow[]): CanonicalPoolSnapshot {
  return {
    version: 1,
    rows: [...rows]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((row) => ({
        id: row.id,
        label: row.label,
        imageUrl: row.imageUrl ?? null,
        imageLargeUrl: row.imageLargeUrl ?? null,
        setId: row.setId ?? null,
        setName: row.setName ?? null,
        localId: row.localId ?? null,
        cardNumber: row.cardNumber ?? null,
        rarity: row.rarity ?? null,
        catalogItemId: row.catalogItemId ?? null,
        catalogSource: row.catalogSource ?? null,
        catalogSourceItemId: row.catalogSourceItemId ?? null,
        catalogSnapshot: normalizeJson(row.catalogSnapshot ?? null),
        estimatedValue: row.estimatedValue,
        weight: row.weight,
        stock: row.stock,
      })),
  };
}

export function computePoolSnapshotHash(rows: PoolSnapshotPrizeRow[]) {
  const canonicalJson = stableCanonicalJson(buildCanonicalPoolSnapshot(rows));
  return createHash("sha256").update(canonicalJson).digest("hex");
}

export function resolvePublishFreezeData(existing: ExistingPublishState, rows: PoolSnapshotPrizeRow[], context: PublishContext) {
  if (rows.length === 0) {
    throw new PackPublishFreezeError("empty_pool", "Packs cannot be published without prize rows");
  }
  if (existing.status === "ARCHIVED") {
    throw new PackPublishFreezeError("archived", "Archived packs cannot be published");
  }

  const nextHash = computePoolSnapshotHash(rows);
  const requestedKey = context.idempotencyKey ?? null;

  if (existing.status === "LIVE" && existing.poolSnapshotHash) {
    if (existing.poolSnapshotHash !== nextHash) {
      throw new PackPublishFreezeError("pool_hash_mismatch", "Current prize pool does not match frozen pool hash");
    }
    if (existing.publishIdempotencyKey && requestedKey && existing.publishIdempotencyKey !== requestedKey) {
      throw new PackPublishFreezeError("already_published", "Pack already published with a different idempotency key");
    }
    return null;
  }

  return {
    status: "LIVE" as const,
    poolSnapshotHash: nextHash,
    poolSnapshotVersion: 1,
    publishedFromTemplateAt: existing.publishedFromTemplateAt ?? context.now,
    publishedByUserId: existing.publishedByUserId ?? context.actorUserId,
    publishIdempotencyKey: existing.publishIdempotencyKey ?? requestedKey,
  };
}

export function publishFreezeErrorResponse(reason: PackPublishFreezeError["reason"] | "published") {
  if (reason === "archived") {
    return {
      error: "Pack cannot be published",
      message: "Archived packs cannot be published.",
    };
  }
  if (reason === "empty_pool") {
    return {
      error: "Pack cannot be published",
      message: "Packs cannot be published without prize rows.",
    };
  }
  if (reason === "pool_hash_mismatch") {
    return {
      error: "Frozen pack pool mismatch",
      message: "This pack's current prize rows no longer match its frozen pool hash.",
    };
  }
  return {
    error: "Pack already published",
    message: "This pack is already frozen with a different publish idempotency key.",
  };
}
