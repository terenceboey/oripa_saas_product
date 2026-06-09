import { createHash, createHmac } from "node:crypto";
import { computePoolSnapshotHash, type PoolSnapshotPrizeRow } from "../packs/pool-snapshot";

export const ALGORITHM_VERSION = "hmac_sha256_v1";

export type DrawFairnessPrizeState = {
  id: string;
  label: string;
  weight: number;
  remainingStock: number;
};

export type DeterministicPrizeSelection = {
  selected: DrawFairnessPrizeState | null;
  lowerBound: number | null;
  upperBound: number | null;
  totalWeight: number;
  randomWeightValue: number;
  eligiblePrizeIds: string[];
};

export type DrawFairnessSelectionVector = {
  drawSequence: number;
  hmacHex: string;
  randomFloat: number;
  randomWeightValue: number;
  totalWeightAtDraw: number;
  tierLabel: string | null;
  tierLowerBound: number | null;
  tierUpperBound: number | null;
  rowSeedHex: string;
  chosenPackPrizeId: string | null;
  eligiblePrizeIds: string[];
};

export type DrawFairnessProofVector = {
  algorithmVersion: typeof ALGORITHM_VERSION;
  serverSeedHash: string;
  revealedServerSeed: string;
  clientSeed: string;
  nonceBase: string;
  quantity: number;
  poolSnapshotHash: string;
  selections: DrawFairnessSelectionVector[];
};

export type DrawFairnessVerificationError =
  | "algorithm_version_mismatch"
  | "server_seed_hash_mismatch"
  | "pool_hash_mismatch"
  | "quantity_mismatch"
  | `selection_${number}_mismatch`;

export function computeServerSeedHash(serverSeed: string) {
  return sha256Hex(serverSeed);
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256Hex(key: string, message: string) {
  return createHmac("sha256", key).update(message).digest("hex");
}

export function hmacToUnitFloat(hmacHex: string) {
  const first13Hex = hmacHex.slice(0, 13);
  const intVal = Number.parseInt(first13Hex, 16);
  return intVal / Math.pow(2, 52);
}

export function tierFromLabel(label: string | null | undefined) {
  if (!label) return null;
  const idx = label.indexOf(" - ");
  return idx > 0 ? label.slice(0, idx).trim() : null;
}

export function selectDeterministicPrize(
  prizes: DrawFairnessPrizeState[],
  rand01: number
): DeterministicPrizeSelection {
  const available = prizes
    .filter((p) => p.remainingStock > 0 && p.weight > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);
  if (!available.length || totalWeight <= 0) {
    return {
      selected: null,
      lowerBound: null,
      upperBound: null,
      totalWeight,
      randomWeightValue: 0,
      eligiblePrizeIds: [],
    };
  }

  const randomWeightValue = Math.floor(rand01 * totalWeight) + 1;
  let cursor = 0;

  for (const prize of available) {
    const lower = cursor + 1;
    cursor += prize.weight;
    const upper = cursor;

    if (randomWeightValue >= lower && randomWeightValue <= upper) {
      return {
        selected: prize,
        lowerBound: lower,
        upperBound: upper,
        totalWeight,
        randomWeightValue,
        eligiblePrizeIds: available.map((row) => row.id),
      };
    }
  }

  const fallback = available[available.length - 1];
  return {
    selected: fallback,
    lowerBound: Math.max(1, totalWeight - fallback.weight + 1),
    upperBound: totalWeight,
    randomWeightValue,
    totalWeight,
    eligiblePrizeIds: available.map((row) => row.id),
  };
}

export function computeFairnessSelection(input: {
  serverSeed: string;
  clientSeed: string;
  nonceBase: string;
  drawSequence: number;
  prizes: DrawFairnessPrizeState[];
}): DrawFairnessSelectionVector {
  const hmacHex = hmacSha256Hex(input.serverSeed, `${input.clientSeed}:${input.nonceBase}:${input.drawSequence}`);
  const randomFloat = hmacToUnitFloat(hmacHex);
  const rowSeedHex = hmacSha256Hex(
    input.serverSeed,
    `${input.clientSeed}:row:${input.nonceBase}:${input.drawSequence}`
  );
  const selectedResult = selectDeterministicPrize(input.prizes, randomFloat);
  const selected = selectedResult.selected;

  return {
    drawSequence: input.drawSequence,
    hmacHex,
    randomFloat,
    randomWeightValue: selectedResult.randomWeightValue,
    totalWeightAtDraw: selectedResult.totalWeight,
    tierLabel: tierFromLabel(selected?.label),
    tierLowerBound: selectedResult.lowerBound,
    tierUpperBound: selectedResult.upperBound,
    rowSeedHex,
    chosenPackPrizeId: selected?.id ?? null,
    eligiblePrizeIds: selectedResult.eligiblePrizeIds,
  };
}

export function computeFairnessSelections(input: {
  serverSeed: string;
  clientSeed: string;
  nonceBase: string;
  quantity: number;
  prizes: DrawFairnessPrizeState[];
}): DrawFairnessSelectionVector[] {
  const prizeState = input.prizes.map((prize) => ({ ...prize }));
  const selections: DrawFairnessSelectionVector[] = [];

  for (let i = 0; i < input.quantity; i += 1) {
    const selection = computeFairnessSelection({
      serverSeed: input.serverSeed,
      clientSeed: input.clientSeed,
      nonceBase: input.nonceBase,
      drawSequence: i + 1,
      prizes: prizeState,
    });
    selections.push(selection);

    if (selection.chosenPackPrizeId) {
      const inMemoryRow = prizeState.find((row) => row.id === selection.chosenPackPrizeId);
      if (inMemoryRow) inMemoryRow.remainingStock -= 1;
    }
  }

  return selections;
}

export function computeFairnessProof(input: {
  serverSeed: string;
  clientSeed: string;
  nonceBase: string;
  quantity: number;
  poolSnapshotHash: string;
  prizes: DrawFairnessPrizeState[];
}): DrawFairnessProofVector {
  return {
    algorithmVersion: ALGORITHM_VERSION,
    serverSeedHash: computeServerSeedHash(input.serverSeed),
    revealedServerSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    nonceBase: input.nonceBase,
    quantity: input.quantity,
    poolSnapshotHash: input.poolSnapshotHash,
    selections: computeFairnessSelections(input),
  };
}

export function verifyFairnessProof(input: {
  proof: DrawFairnessProofVector;
  prizes: PoolSnapshotPrizeRow[];
}): { valid: boolean; errors: DrawFairnessVerificationError[] } {
  const errors: DrawFairnessVerificationError[] = [];
  const { proof, prizes } = input;

  if (proof.algorithmVersion !== ALGORITHM_VERSION) errors.push("algorithm_version_mismatch");
  if (computeServerSeedHash(proof.revealedServerSeed) !== proof.serverSeedHash) {
    errors.push("server_seed_hash_mismatch");
  }
  if (computePoolSnapshotHash(prizes) !== proof.poolSnapshotHash) {
    errors.push("pool_hash_mismatch");
  }
  if (proof.selections.length !== proof.quantity) errors.push("quantity_mismatch");

  if (errors.length === 0 || !errors.every((error) => error === "pool_hash_mismatch")) {
    const expected = computeFairnessSelections({
      serverSeed: proof.revealedServerSeed,
      clientSeed: proof.clientSeed,
      nonceBase: proof.nonceBase,
      quantity: proof.quantity,
      prizes,
    });

    for (let idx = 0; idx < Math.min(expected.length, proof.selections.length); idx += 1) {
      if (!fairnessSelectionEquals(proof.selections[idx], expected[idx])) {
        errors.push(`selection_${expected[idx].drawSequence}_mismatch`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function fairnessSelectionEquals(left: DrawFairnessSelectionVector, right: DrawFairnessSelectionVector) {
  return (
    left.drawSequence === right.drawSequence &&
    left.hmacHex === right.hmacHex &&
    left.randomFloat === right.randomFloat &&
    left.randomWeightValue === right.randomWeightValue &&
    left.totalWeightAtDraw === right.totalWeightAtDraw &&
    left.tierLabel === right.tierLabel &&
    left.tierLowerBound === right.tierLowerBound &&
    left.tierUpperBound === right.tierUpperBound &&
    left.rowSeedHex === right.rowSeedHex &&
    left.chosenPackPrizeId === right.chosenPackPrizeId &&
    left.eligiblePrizeIds.length === right.eligiblePrizeIds.length &&
    left.eligiblePrizeIds.every((id, idx) => id === right.eligiblePrizeIds[idx])
  );
}
