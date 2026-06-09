import assert from "node:assert/strict";
import { computePoolSnapshotHash, type PoolSnapshotPrizeRow } from "../src/modules/packs/pool-snapshot";
import {
  ALGORITHM_VERSION,
  computeFairnessProof,
  computeServerSeedHash,
  verifyFairnessProof,
} from "../src/modules/draws/fairness";

const prizeRows: PoolSnapshotPrizeRow[] = [
  {
    id: "prize-b",
    label: "Silver Eevee",
    estimatedValue: 500,
    weight: 25,
    stock: 2,
    remainingStock: 2,
  },
  {
    id: "prize-a",
    label: "Gold Charizard",
    estimatedValue: 2500,
    weight: 10,
    stock: 1,
    remainingStock: 1,
  },
  {
    id: "prize-c",
    label: "Bronze Pikachu",
    estimatedValue: 100,
    weight: 65,
    stock: 5,
    remainingStock: 5,
  },
];

const serverSeed = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const clientSeed = "customer-seed-001";
const nonceBase = "nonce-base-001";
const poolSnapshotHash = computePoolSnapshotHash(prizeRows);

assert.equal(ALGORITHM_VERSION, "hmac_sha256_v1");
assert.equal(poolSnapshotHash, "74b89c26274bd60f21aef9e98c17fe0a850f0420f91e96a853da2022d54c357b");
assert.equal(computeServerSeedHash(serverSeed), "a8ae6e6ee929abea3afcfc5258c8ccd6f85273e0d4626d26c7279f3250f77c8e");

const proof = computeFairnessProof({
  serverSeed,
  clientSeed,
  nonceBase,
  quantity: 2,
  poolSnapshotHash,
  prizes: prizeRows,
});

assert.deepEqual(
  proof,
  {
    algorithmVersion: "hmac_sha256_v1",
    serverSeedHash: "a8ae6e6ee929abea3afcfc5258c8ccd6f85273e0d4626d26c7279f3250f77c8e",
    revealedServerSeed: serverSeed,
    clientSeed,
    nonceBase,
    quantity: 2,
    poolSnapshotHash,
    selections: [
      {
        drawSequence: 1,
        hmacHex: "ec7a7c2813eda0abac59ddc3988eb3129c7e9e1c5da720e715b81cfa162299a4",
        randomFloat: 0.9237439725729275,
        randomWeightValue: 93,
        totalWeightAtDraw: 100,
        tierLabel: null,
        tierLowerBound: 36,
        tierUpperBound: 100,
        rowSeedHex: "8d3c7448e51a33c9e55d230d36ff5b82d7b4351aa5287a3594bc51afb49279c0",
        chosenPackPrizeId: "prize-c",
        eligiblePrizeIds: ["prize-a", "prize-b", "prize-c"],
      },
      {
        drawSequence: 2,
        hmacHex: "9809220334e22a78812bd91225f7a88e5d631724d46d0f448c532effd05230a5",
        randomFloat: 0.5938893564060739,
        randomWeightValue: 60,
        totalWeightAtDraw: 100,
        tierLabel: null,
        tierLowerBound: 36,
        tierUpperBound: 100,
        rowSeedHex: "ef5a5805188c815685c91b56af91b10b65b60d7eb0c702839072213356d5a8bf",
        chosenPackPrizeId: "prize-c",
        eligiblePrizeIds: ["prize-a", "prize-b", "prize-c"],
      },
    ],
  },
  "fixed seed/client/nonce/pool must produce golden roll and selection vectors"
);

const replayedProof = computeFairnessProof({
  serverSeed,
  clientSeed,
  nonceBase,
  quantity: 2,
  poolSnapshotHash,
  prizes: prizeRows,
});
assert.deepEqual(replayedProof, proof, "idempotent replay must produce the same proof and selections");

assert.deepEqual(verifyFairnessProof({ proof, prizes: prizeRows }), { valid: true, errors: [] });

const tamperedPoolRows = prizeRows.map((row) => (row.id === "prize-a" ? { ...row, weight: row.weight + 1 } : row));
assert.deepEqual(
  verifyFairnessProof({ proof, prizes: tamperedPoolRows }),
  { valid: false, errors: ["pool_hash_mismatch"] },
  "tampered pool economics must fail proof verification"
);

const tamperedSelection = {
  ...proof,
  selections: proof.selections.map((row) =>
    row.drawSequence === 1 ? { ...row, chosenPackPrizeId: "prize-a" } : row
  ),
};
assert.deepEqual(
  verifyFairnessProof({ proof: tamperedSelection, prizes: prizeRows }),
  { valid: false, errors: ["selection_1_mismatch"] },
  "tampered chosen prize must fail proof verification"
);

console.log("draw fairness golden vector tests passed");
