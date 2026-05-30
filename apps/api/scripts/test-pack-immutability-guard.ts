import assert from "node:assert/strict";
import {
  packPrizeMutationErrorResponse,
  shouldRejectPackPrizeMutation,
} from "../src/modules/packs/immutability";

const replacementPrizes = [
  {
    label: "Replacement prize",
    estimatedValue: 1000,
    weight: 10,
    stock: 1,
  },
];

assert.equal(
  shouldRejectPackPrizeMutation("LIVE", { prizes: replacementPrizes }),
  true,
  "LIVE packs must reject prize replacement payloads"
);

assert.equal(
  shouldRejectPackPrizeMutation("ARCHIVED", { prizes: replacementPrizes }),
  true,
  "ARCHIVED packs must reject prize replacement payloads"
);

assert.equal(
  shouldRejectPackPrizeMutation("LIVE", {
    tiers: [{ name: "A", percentage: 100, items: [{ label: "Tier prize", estimatedValue: 1000, stock: 1 }] }],
  }),
  true,
  "LIVE packs must reject tier/pool replacement payloads"
);

assert.equal(
  shouldRejectPackPrizeMutation("DRAFT", { prizes: replacementPrizes }),
  false,
  "DRAFT packs must preserve existing prize edit behavior"
);

assert.equal(
  shouldRejectPackPrizeMutation("LIVE", { title: "Retitle only" }),
  false,
  "LIVE packs can still receive non-prize metadata edits through this guard"
);

assert.deepEqual(packPrizeMutationErrorResponse("LIVE"), {
  error: "Pack prize pool is immutable after publish",
  message: "This pack is LIVE, so its prize pool can no longer be edited. Archive it and create a new draft pack to change prizes.",
});

assert.deepEqual(packPrizeMutationErrorResponse("ARCHIVED"), {
  error: "Pack prize pool is immutable after publish",
  message: "This pack is ARCHIVED, so its prize pool can no longer be edited. Archive it and create a new draft pack to change prizes.",
});

console.log("pack immutability guard tests passed");
