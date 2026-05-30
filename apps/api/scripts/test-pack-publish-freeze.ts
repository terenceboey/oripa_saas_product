import assert from "node:assert/strict";
import {
  buildCanonicalPoolSnapshot,
  computePoolSnapshotHash,
  publishFreezeErrorResponse,
  resolvePublishFreezeData,
} from "../src/modules/packs/pool-snapshot";

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
      name: "Pikachu",
      sourceItemId: "base1-058",
      source: "tcgdex",
    },
    estimatedValue: 300,
    weight: 25,
    stock: 3,
    remainingStock: 3,
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

const reorderedAndKeyShuffledRows = [
  {
    remainingStock: 1,
    stock: 1,
    weight: 10,
    estimatedValue: 2500,
    catalogSnapshot: {
      name: "Charizard ex",
      source: "pokemoncard.io",
      sourceItemId: "sv3pt5-006",
    },
    catalogSourceItemId: "sv3pt5-006",
    catalogSource: "pokemoncard.io",
    catalogItemId: "catalog-zard",
    rarity: "Double Rare",
    cardNumber: "006/165",
    localId: "006",
    setName: "Scarlet & Violet 151",
    setId: "sv3pt5",
    imageLargeUrl: "https://images.example/zard-large.png",
    imageUrl: "https://images.example/zard-thumb.png",
    label: "Charizard ex",
    id: "prize-a",
  },
  {
    remainingStock: 3,
    stock: 3,
    weight: 25,
    estimatedValue: 300,
    catalogSnapshot: {
      source: "tcgdex",
      sourceItemId: "base1-058",
      name: "Pikachu",
    },
    catalogSourceItemId: "base1-058",
    catalogSource: "tcgdex",
    catalogItemId: "catalog-pika",
    rarity: "Common",
    cardNumber: "58/102",
    localId: "058",
    setName: "Base Set",
    setId: "base1",
    imageLargeUrl: "https://images.example/pika-large.png",
    imageUrl: "https://images.example/pika-thumb.png",
    label: "Base Set Pikachu",
    id: "prize-b",
  },
];

const firstSnapshot = buildCanonicalPoolSnapshot(prizeRows);
const secondSnapshot = buildCanonicalPoolSnapshot(reorderedAndKeyShuffledRows);
assert.deepEqual(firstSnapshot, secondSnapshot, "canonical pool snapshot must be stable across row/key order");
assert.deepEqual(
  firstSnapshot.rows.map((row) => row.id),
  ["prize-a", "prize-b"],
  "canonical pool rows must be sorted by prize id"
);
assert.equal(firstSnapshot.version, 1, "canonical pool snapshot must carry version 1");

const firstHash = computePoolSnapshotHash(prizeRows);
const secondHash = computePoolSnapshotHash(reorderedAndKeyShuffledRows);
assert.match(firstHash, /^[a-f0-9]{64}$/);
assert.equal(firstHash, secondHash, "pool hash must be deterministic for equivalent pool rows");

const now = new Date("2026-05-30T09:00:00.000Z");
const publishData = resolvePublishFreezeData(
  {
    status: "DRAFT",
    poolSnapshotHash: null,
    publishedFromTemplateAt: null,
    publishedByUserId: null,
    publishIdempotencyKey: null,
  },
  prizeRows,
  { actorUserId: "user-owner", now, idempotencyKey: "idem-123" }
);
assert.deepEqual(publishData, {
  status: "LIVE",
  poolSnapshotHash: firstHash,
  poolSnapshotVersion: 1,
  publishedFromTemplateAt: now,
  publishedByUserId: "user-owner",
  publishIdempotencyKey: "idem-123",
});

const alreadyPublished = resolvePublishFreezeData(
  {
    status: "LIVE",
    poolSnapshotHash: firstHash,
    publishedFromTemplateAt: now,
    publishedByUserId: "user-owner",
    publishIdempotencyKey: "idem-123",
  },
  reorderedAndKeyShuffledRows,
  { actorUserId: "different-user", now: new Date("2026-05-30T10:00:00.000Z"), idempotencyKey: "idem-123" }
);
assert.equal(alreadyPublished, null, "republishing an already frozen pack with the same key/hash is idempotent no-op");

assert.throws(
  () =>
    resolvePublishFreezeData(
      {
        status: "LIVE",
        poolSnapshotHash: firstHash,
        publishedFromTemplateAt: now,
        publishedByUserId: "user-owner",
        publishIdempotencyKey: "idem-123",
      },
      prizeRows,
      { actorUserId: "user-owner", now, idempotencyKey: "different-key" }
    ),
  /already published with a different idempotency key/,
  "publishing a frozen pack with a different idempotency key must be rejected"
);

const depletedFrozenPool = prizeRows.map((row) => (row.id === "prize-a" ? { ...row, remainingStock: 0 } : row));
assert.equal(
  computePoolSnapshotHash(depletedFrozenPool),
  firstHash,
  "normal draw-time remainingStock depletion must not change the frozen pool identity hash"
);

const mutatedFrozenPool = prizeRows.map((row) => (row.id === "prize-a" ? { ...row, stock: 2 } : row));
assert.throws(
  () =>
    resolvePublishFreezeData(
      {
        status: "LIVE",
        poolSnapshotHash: firstHash,
        publishedFromTemplateAt: now,
        publishedByUserId: "user-owner",
        publishIdempotencyKey: "idem-123",
      },
      mutatedFrozenPool,
      { actorUserId: "user-owner", now, idempotencyKey: "idem-123" }
    ),
  /Current prize pool does not match frozen pool hash/,
  "republishing a frozen pack after pool mutation must be rejected by hash mismatch"
);

assert.throws(
  () =>
    resolvePublishFreezeData(
      {
        status: "ARCHIVED",
        poolSnapshotHash: firstHash,
        publishedFromTemplateAt: now,
        publishedByUserId: "user-owner",
        publishIdempotencyKey: "idem-123",
      },
      prizeRows,
      { actorUserId: "user-owner", now, idempotencyKey: "idem-123" }
    ),
  /Archived packs cannot be published/,
  "archived packs must not be publishable"
);

assert.deepEqual(publishFreezeErrorResponse("published"), {
  error: "Pack already published",
  message: "This pack is already frozen with a different publish idempotency key.",
});

console.log("pack publish/freeze tests passed");
