import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CUSTOMER_PHASE2_ENDPOINTS,
  CUSTOMER_CUSTODY_FEATURE_FLAG,
  OPS_CUSTODY_ENDPOINTS,
  canRequestCustodyAction,
  isCustomerCustodyEnabled,
  nextCustodyItemStatusForRequest,
  normalizeCustomerRequestNote,
  normalizeOpsRequestStatusUpdate,
  serializeCustodyItem,
  serializeCustomerDraw,
} from "../src/lib/customer-custody";

assert.deepEqual(CUSTOMER_PHASE2_ENDPOINTS, [
  "GET /v1/customer/summary",
  "GET /v1/customer/items",
  "GET /v1/customer/draws",
  "POST /v1/customer/items/:id/redemption-requests",
  "POST /v1/customer/items/:id/buyback-requests",
]);
assert.deepEqual(OPS_CUSTODY_ENDPOINTS, [
  "GET /v1/ops/custody-requests",
  "PATCH /v1/ops/custody-requests/:id",
]);
assert.equal(CUSTOMER_CUSTODY_FEATURE_FLAG, "CUSTOMER_CUSTODY_ENABLED");
assert.equal(isCustomerCustodyEnabled({}), false);
assert.equal(isCustomerCustodyEnabled({ CUSTOMER_CUSTODY_ENABLED: "false" }), false);
assert.equal(isCustomerCustodyEnabled({ CUSTOMER_CUSTODY_ENABLED: "true" }), true);

assert.equal(normalizeCustomerRequestNote("  Ship to my office.  "), "Ship to my office.");
assert.equal(normalizeCustomerRequestNote("x".repeat(501)), null);
assert.equal(normalizeCustomerRequestNote(42), null);

const item = serializeCustodyItem({
  id: "item_1",
  status: "HELD",
  provider: "ORIPA_INTERNAL",
  prizeLabel: "Moonbreon PSA 10",
  imageUrl: "https://example.test/card.png",
  imageLargeUrl: null,
  setName: "Evolving Skies",
  cardName: "Umbreon VMAX",
  rarity: "Secret Rare",
  estimatedValue: 1200,
  createdAt: new Date("2026-06-06T00:00:00.000Z"),
  requests: [],
});
assert.equal(item.id, "item_1");
assert.equal(item.prizeLabel, "Moonbreon PSA 10");
assert.equal(item.pendingRequest, null);
assert.equal(canRequestCustodyAction(item, "REDEMPTION"), true);
assert.equal(canRequestCustodyAction({ ...item, status: "REDEMPTION_REQUESTED" }, "BUYBACK"), false);
assert.equal(nextCustodyItemStatusForRequest("REDEMPTION", "PENDING"), "REDEMPTION_REQUESTED");
assert.equal(nextCustodyItemStatusForRequest("BUYBACK", "PENDING"), "BUYBACK_REQUESTED");
assert.equal(nextCustodyItemStatusForRequest("REDEMPTION", "COMPLETED"), "REDEEMED");
assert.equal(nextCustodyItemStatusForRequest("BUYBACK", "COMPLETED"), "BOUGHT_BACK");
assert.equal(nextCustodyItemStatusForRequest("BUYBACK", "REJECTED"), "HELD");
assert.equal(nextCustodyItemStatusForRequest("REDEMPTION", "CANCELLED"), "HELD");

assert.deepEqual(normalizeOpsRequestStatusUpdate({ status: "approved", opsNote: "  ok to redeem  " }), { status: "APPROVED", opsNote: "ok to redeem" });
assert.deepEqual(normalizeOpsRequestStatusUpdate({ status: "COMPLETED", opsNote: "x".repeat(1001) }), { error: "Ops note must be 1-1000 characters" });
assert.deepEqual(normalizeOpsRequestStatusUpdate({ status: "UNKNOWN" }), { error: "Unsupported custody request status" });

const requestedItem = serializeCustodyItem({
  id: "item_2",
  status: "BUYBACK_REQUESTED",
  provider: "ORIPA_INTERNAL",
  prizeLabel: "Charizard",
  imageUrl: null,
  imageLargeUrl: null,
  setName: null,
  cardName: null,
  rarity: null,
  estimatedValue: 900,
  createdAt: new Date("2026-06-06T00:00:00.000Z"),
  requests: [
    { id: "req_old", type: "REDEMPTION", status: "CANCELLED", customerNote: null, requestedAt: new Date("2026-06-05T00:00:00.000Z") },
    { id: "req_new", type: "BUYBACK", status: "PENDING", customerNote: "quote please", requestedAt: new Date("2026-06-06T00:00:00.000Z") },
  ],
});
assert.equal(requestedItem.pendingRequest?.id, "req_new");
assert.equal(requestedItem.pendingRequest?.type, "BUYBACK");

const draw = serializeCustomerDraw({
  id: "order_1",
  packId: "pack_1",
  quantity: 2,
  totalPoints: 500,
  createdAt: new Date("2026-06-06T00:00:00.000Z"),
  pack: { title: "Urania Alpha", packBannerImageUrl: "https://example.test/pack.png" },
  fairnessProof: { id: "proof_1", serverSeedHash: "hash_1" },
  results: [
    {
      id: "result_1",
      drawSequence: 1,
      pointsSpent: 250,
      packPrize: { label: "Pikachu", imageUrl: null, estimatedValue: 50 },
      custodyItem: { id: "custody_1", status: "HELD" },
    },
  ],
});
assert.equal(draw.results[0]?.custodyItemId, "custody_1");
assert.equal(draw.fairnessProofId, "proof_1");

const customerRouter = readFileSync(join(process.cwd(), "src/modules/customer/router.ts"), "utf8");
assert.match(customerRouter, /vendorId:\s*context\.vendorId,\s*userId:\s*context\.userId/s, "customer routes must scope custody records by vendorId and userId");
assert.match(customerRouter, /isCustomerCustodyEnabled\(process\.env\)/, "custody endpoints must be feature-flagged");

const opsRouter = readFileSync(join(process.cwd(), "src/modules/ops/router.ts"), "utf8");
assert.match(opsRouter, /hasRole\(role, \["OWNER", "MANAGER", "STAFF"\]\)/, "ops queue must require vendor staff role");
assert.match(opsRouter, /vendorId:\s*context\.vendorId/s, "ops queue must be vendor scoped");
assert.match(opsRouter, /nextCustodyItemStatusForRequest/, "ops status updates must keep item status consistent");

const appTs = readFileSync(join(process.cwd(), "src/app.ts"), "utf8");
assert.match(appTs, /app\.use\(customerRouter\)/, "app must mount customer router");
assert.match(appTs, /app\.use\(opsRouter\)/, "app must mount ops custody router");

console.log("customer custody backend contract ok");
