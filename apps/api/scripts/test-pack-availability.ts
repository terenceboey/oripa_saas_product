import assert from "node:assert/strict";
import {
  evaluatePackAvailability,
  packAvailabilityErrorResponse,
  type PackAvailabilityInput,
} from "../src/modules/packs/availability";

const basePack: PackAvailabilityInput["pack"] = {
  id: "pack-live",
  isActive: true,
  status: "LIVE",
  pricePoints: 100,
  remainingStock: 5,
  startsAt: null,
  endsAt: null,
  poolSnapshotHash: "pool-hash",
};

const now = new Date("2026-06-08T12:00:00.000Z");

function availabilityFor(overrides: Partial<PackAvailabilityInput["pack"]> = {}, input: Partial<PackAvailabilityInput> = {}) {
  return evaluatePackAvailability({
    pack: { ...basePack, ...overrides },
    now,
    quantity: 1,
    isAuthenticated: true,
    walletBalancePoints: 1_000,
    ...input,
  });
}

const open = availabilityFor();
assert.equal(open.status, "open");
assert.equal(open.reasonCode, "available");
assert.equal(open.openable, true);
assert.equal(open.visible, true);

const disabledCases: Array<[string, Partial<PackAvailabilityInput["pack"]>, ReturnType<typeof evaluatePackAvailability>["status"], ReturnType<typeof evaluatePackAvailability>["reasonCode"]]> = [
  ["inactive", { isActive: false }, "disabled", "paused"],
  ["draft", { status: "DRAFT" }, "disabled", "paused"],
  ["archived", { status: "ARCHIVED" }, "disabled", "paused"],
];
for (const [label, overrides, status, reasonCode] of disabledCases) {
  const result = availabilityFor(overrides);
  assert.equal(result.status, status, `${label} status`);
  assert.equal(result.reasonCode, reasonCode, `${label} reason`);
  assert.equal(result.openable, false, `${label} openable`);
}

assert.deepEqual(
  availabilityFor({ remainingStock: 0 }, { quantity: 1 }),
  {
    visible: true,
    openable: false,
    status: "sold_out",
    reasonCode: "out_of_stock",
    errorMessage: "Pack is sold out",
  },
  "sold-out list/detail/draw reason must be stable"
);

assert.equal(availabilityFor({ startsAt: new Date("2026-06-09T00:00:00.000Z") }).reasonCode, "not_started");
assert.equal(availabilityFor({ endsAt: new Date("2026-06-08T00:00:00.000Z") }).reasonCode, "ended");
assert.equal(availabilityFor({ poolSnapshotHash: null }).reasonCode, "policy_missing");
assert.equal(availabilityFor({}, { walletBalancePoints: 50, quantity: 1 }).reasonCode, "insufficient_balance");
assert.equal(availabilityFor({}, { isAuthenticated: false }).reasonCode, "not_authenticated");

const drawResponse = packAvailabilityErrorResponse(availabilityFor({ remainingStock: 0 }, { quantity: 2 }));
assert.equal(drawResponse.error, "Pack is sold out");
assert.equal(drawResponse.availability.reasonCode, "out_of_stock");
assert.equal(drawResponse.availability.openable, false);

console.log("pack availability tests passed");
