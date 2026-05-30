import {
  buildCanonicalPoolSnapshot,
  computePoolSnapshotHash,
  PoolSnapshotPrizeRow,
} from "../packs/pool-snapshot";

export class DrawPoolIntegrityError extends Error {
  constructor(
    public readonly reason: "missing_frozen_hash" | "pool_hash_mismatch",
    message: string
  ) {
    super(message);
    this.name = "DrawPoolIntegrityError";
  }
}

type DrawPackPoolState = {
  id: string;
  poolSnapshotHash?: string | null;
};

export type DrawPoolSnapshotJson = {
  packId: string;
  frozenPoolSnapshotHash: string;
  computedPoolSnapshotHash: string;
  frozenPoolSnapshot: ReturnType<typeof buildCanonicalPoolSnapshot>;
  drawTimeRows: Array<{
    id: string;
    label: string;
    weight: number;
    remainingStock: number;
  }>;
};

export function resolveDrawPoolIntegrity(pack: DrawPackPoolState, rows: PoolSnapshotPrizeRow[]) {
  const frozenHash = pack.poolSnapshotHash ?? null;
  if (!frozenHash) {
    throw new DrawPoolIntegrityError("missing_frozen_hash", "Pack is live without a frozen pool hash");
  }

  const computedHash = computePoolSnapshotHash(rows);
  if (computedHash !== frozenHash) {
    throw new DrawPoolIntegrityError(
      "pool_hash_mismatch",
      "Current prize pool does not match frozen Pack.poolSnapshotHash"
    );
  }

  const sortedRows = [...rows].sort((left, right) => left.id.localeCompare(right.id));
  const poolSnapshotJson: DrawPoolSnapshotJson = {
    packId: pack.id,
    frozenPoolSnapshotHash: frozenHash,
    computedPoolSnapshotHash: computedHash,
    frozenPoolSnapshot: buildCanonicalPoolSnapshot(rows),
    drawTimeRows: sortedRows.map((row) => ({
      id: row.id,
      label: row.label,
      weight: row.weight,
      remainingStock: row.remainingStock,
    })),
  };

  return {
    poolSnapshotHash: frozenHash,
    computedPoolSnapshotHash: computedHash,
    poolSnapshotJson,
  };
}
