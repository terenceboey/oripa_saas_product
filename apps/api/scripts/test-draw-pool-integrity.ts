import assert from "node:assert/strict";
import { computePoolSnapshotHash } from "../src/modules/packs/pool-snapshot";
import { DrawPoolIntegrityError, resolveDrawPoolIntegrity } from "../src/modules/draws/pool-integrity";

const prizeRows = [
  {
    id: "prize-b",
    label: "Base Set Pikachu",
    imageUrl: "https://images.example/pika-thumb.png",
    imageLargeUrl: "https://images.example/pika-large.png",
    setId: "base1",
    setName: "Base Set",
    localId: "058",
    cardNumber: "58/102",
    rarity: "Common",
    catalogItemId: "catalog-pika",
    catalogSource: "tcgdex",
    catalogSourceItemId: "base1-058",
    catalogSnapshot: {
      sourceItemId: "base1-058",
      source: "tcgdex",
      name: "Pikachu",
    },
    estimatedValue: 300,
    weight: 25,
    stock: 3,
    remainingStock: 2,
  },
  {
    id: "prize-a",
    label: "Charizard ex",
    imageUrl: "https://images.example/zard-thumb.png",
    imageLargeUrl: "https://images.example/zard-large.png",
    setId: "sv3pt5",
    setName: "Scarlet & Violet 151",
    localId: "006",
    cardNumber: "006/165",
    rarity: "Double Rare",
    catalogItemId: "catalog-zard",
    catalogSource: "pokemoncard.io",
    catalogSourceItemId: "sv3pt5-006",
    catalogSnapshot: {
      sourceItemId: "sv3pt5-006",
      source: "pokemoncard.io",
      name: "Charizard ex",
    },
    estimatedValue: 2500,
    weight: 10,
    stock: 1,
    remainingStock: 1,
  },
];

const frozenHash = computePoolSnapshotHash(prizeRows);

const verified = resolveDrawPoolIntegrity({ id: "pack-live", poolSnapshotHash: frozenHash }, prizeRows);
assert.equal(verified.poolSnapshotHash, frozenHash, "draw fairness proof must store the frozen Pack.poolSnapshotHash");
assert.equal(verified.computedPoolSnapshotHash, frozenHash, "computed draw-time pool hash must match frozen hash");
assert.equal(verified.poolSnapshotJson.frozenPoolSnapshotHash, frozenHash);
assert.equal(verified.poolSnapshotJson.computedPoolSnapshotHash, frozenHash);
assert.deepEqual(
  verified.poolSnapshotJson.drawTimeRows.map((row) => ({ id: row.id, remainingStock: row.remainingStock })),
  [
    { id: "prize-a", remainingStock: 1 },
    { id: "prize-b", remainingStock: 2 },
  ],
  "draw proof snapshot should preserve deterministic draw-time stock rows for HMAC verification"
);

const tamperedRows = prizeRows.map((row) => (row.id === "prize-a" ? { ...row, stock: row.stock + 1 } : row));
assert.throws(
  () => resolveDrawPoolIntegrity({ id: "pack-live", poolSnapshotHash: frozenHash }, tamperedRows),
  (error) =>
    error instanceof DrawPoolIntegrityError &&
    error.reason === "pool_hash_mismatch" &&
    /Current prize pool does not match frozen Pack.poolSnapshotHash/.test(error.message),
  "draw must reject if immutable prize pool economics were tampered after publish/freeze"
);

const catalogTamperedRows = prizeRows.map((row) =>
  row.id === "prize-b" ? { ...row, catalogSnapshot: { ...(row.catalogSnapshot as object), name: "Raichu" } } : row
);
assert.throws(
  () => resolveDrawPoolIntegrity({ id: "pack-live", poolSnapshotHash: frozenHash }, catalogTamperedRows),
  (error) => error instanceof DrawPoolIntegrityError && error.reason === "pool_hash_mismatch",
  "draw must reject if immutable catalog snapshot identity was tampered after publish/freeze"
);

const depletedRows = prizeRows.map((row) => (row.id === "prize-a" ? { ...row, remainingStock: 0 } : row));
assert.equal(
  resolveDrawPoolIntegrity({ id: "pack-live", poolSnapshotHash: frozenHash }, depletedRows).poolSnapshotHash,
  frozenHash,
  "normal draw-time remainingStock depletion must not trip frozen pool verification"
);

assert.throws(
  () => resolveDrawPoolIntegrity({ id: "pack-live", poolSnapshotHash: null }, prizeRows),
  (error) =>
    error instanceof DrawPoolIntegrityError &&
    error.reason === "missing_frozen_hash" &&
    /Pack is live without a frozen pool hash/.test(error.message),
  "draw must fail closed if a live pack has no frozen pool hash"
);

console.log("draw pool integrity tests passed");
