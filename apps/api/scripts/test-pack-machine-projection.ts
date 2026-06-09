import assert from "node:assert/strict";
import { DEFAULT_BUYBACK_PERCENT } from "../src/lib/customer-custody";
import { buildPackMachineProjection } from "../src/modules/packs/machine-projection";

const now = new Date("2026-06-09T00:00:00.000Z");

const liveBasePack = {
  id: "pack-mach-001",
  title: "June Ladder Pack",
  sourceTemplateType: "VENDOR_TEMPLATE",
  isActive: true,
  status: "LIVE" as const,
  pricePoints: 250,
  totalStock: 5,
  remainingStock: 4,
  startsAt: null,
  endsAt: null,
  poolSnapshotHash: "pool-hash",
  inventoryMode: "DIGITAL_NO_ALLOCATION" as const,
  updatedAt: new Date("2026-06-08T12:00:00.000Z"),
};

const projection = buildPackMachineProjection({
  ...liveBasePack,
  tierSnapshotJson: {
    version: 1,
    tiers: [
      {
        name: "S Tier",
        percentage: 25,
        items: [
          { label: "Chase", estimatedValue: 400, stock: 1 },
        ],
      },
      {
        name: "A Tier",
        percentage: 75,
        items: [
          { label: "Base Hit", estimatedValue: 100, stock: 4 },
        ],
      },
    ],
  },
  prizes: [
    {
      id: "prize-a",
      label: "Base Hit",
      estimatedValue: 100,
      weight: 1,
      stock: 4,
      remainingStock: 4,
      updatedAt: new Date("2026-06-08T10:00:00.000Z"),
    },
    {
      id: "prize-b",
      label: "Chase",
      estimatedValue: 400,
      weight: 3,
      stock: 1,
      remainingStock: 1,
      updatedAt: new Date("2026-06-08T11:00:00.000Z"),
    },
    {
      id: "prize-c",
      label: "Display Only",
      estimatedValue: 999,
      weight: 0,
      stock: 1,
      remainingStock: 1,
      updatedAt: new Date("2026-06-08T09:00:00.000Z"),
    },
  ],
}, { now });

assert.deepEqual(Object.keys(projection), [
  "code",
  "family",
  "pricePoints",
  "estimatedEv",
  "minValue",
  "maxValue",
  "buybackPercent",
  "stock",
  "odds",
  "tierRanges",
  "valueAsOf",
  "valueFresh",
  "availability",
]);

assert.equal(projection.code, "pack-mach-001");
assert.equal(projection.family, "VENDOR_TEMPLATE");
assert.equal(projection.pricePoints, 250);
assert.equal(projection.estimatedEv, 325, "EV must use only positive prize weights");
assert.equal(projection.minValue, 100);
assert.equal(projection.maxValue, 999);
assert.equal(projection.buybackPercent, DEFAULT_BUYBACK_PERCENT);
assert.deepEqual(projection.stock, { total: 5, remaining: 4 });
assert.equal(projection.valueFresh, true);
assert.equal(projection.valueAsOf, "2026-06-08T12:00:00.000Z");
assert.equal(projection.availability.status, "open");
assert.equal(projection.availability.reasonCode, "available");
assert.deepEqual(projection.tierRanges, [
  { name: "S Tier", percentage: 25, minValue: 400, maxValue: 400, itemCount: 1 },
  { name: "A Tier", percentage: 75, minValue: 100, maxValue: 100, itemCount: 1 },
]);
assert.deepEqual(projection.odds, {
  totalWeight: 4,
  prizes: [
    { prizeId: "prize-a", label: "Base Hit", weight: 1, probability: 0.25, dropRatePercent: 25 },
    { prizeId: "prize-b", label: "Chase", weight: 3, probability: 0.75, dropRatePercent: 75 },
    { prizeId: "prize-c", label: "Display Only", weight: 0, probability: 0, dropRatePercent: 0 },
  ],
});

const staleValueProjection = buildPackMachineProjection({
  ...liveBasePack,
  id: "pack-mach-002",
  tierSnapshotJson: null,
  prizes: [
    {
      id: "prize-stale",
      label: "Unknown Value Prize",
      estimatedValue: Number.NaN,
      weight: 1,
      stock: 1,
      remainingStock: 1,
      updatedAt: new Date("2026-06-08T11:00:00.000Z"),
    },
  ],
}, { now });

assert.equal(staleValueProjection.estimatedEv, null);
assert.equal(staleValueProjection.minValue, null);
assert.equal(staleValueProjection.maxValue, null);
assert.equal(staleValueProjection.valueFresh, false);
assert.equal(staleValueProjection.availability.status, "policy_blocked");
assert.equal(staleValueProjection.availability.reasonCode, "value_stale");

const physicalProjection = buildPackMachineProjection({
  ...liveBasePack,
  id: "pack-mach-003",
  inventoryMode: "PHYSICAL_REQUIRED" as const,
  prizes: [
    {
      id: "prize-physical",
      label: "Physical Chase",
      estimatedValue: 500,
      weight: 1,
      stock: null,
      remainingStock: 1,
      updatedAt: new Date("2026-06-08T11:00:00.000Z"),
    },
  ],
}, { now });

assert.equal(physicalProjection.valueFresh, true, "inventory failures should not imply stale values");
assert.equal(physicalProjection.availability.openable, false);
assert.equal(physicalProjection.availability.status, "policy_blocked");
assert.equal(physicalProjection.availability.reasonCode, "physical_inventory_missing");

console.log("pack machine projection tests passed");
