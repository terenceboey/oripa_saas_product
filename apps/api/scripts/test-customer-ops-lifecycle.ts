import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { AddressInfo } from "node:net";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  isValidCustodyRequestTransition,
  nextCustodyItemStatusForRequest,
  normalizeOpsRequestStatusUpdate,
} from "../src/lib/customer-custody";

assert.equal(isValidCustodyRequestTransition("REDEMPTION", "PENDING", "OPS_REVIEW"), true);
assert.equal(isValidCustodyRequestTransition("REDEMPTION", "PENDING", "PACKED"), false);
assert.equal(isValidCustodyRequestTransition("REDEMPTION", "APPROVED", "PACKED"), true);
assert.equal(isValidCustodyRequestTransition("REDEMPTION", "PACKED", "FULFILLED_MANUAL"), true);
assert.equal(isValidCustodyRequestTransition("BUYBACK", "PENDING", "PACKED"), false);
assert.equal(nextCustodyItemStatusForRequest("REDEMPTION", "OPS_REVIEW"), "REDEMPTION_REQUESTED");
assert.equal(nextCustodyItemStatusForRequest("REDEMPTION", "PACKED"), "REDEMPTION_REQUESTED");
assert.equal(nextCustodyItemStatusForRequest("REDEMPTION", "FULFILLED_MANUAL"), "REDEEMED");
assert.deepEqual(normalizeOpsRequestStatusUpdate({ status: "packed", opsNote: "  packed in safe  " }), { status: "PACKED", opsNote: "packed in safe" });
assert.deepEqual(normalizeOpsRequestStatusUpdate({ status: "fulfilled_manual" }), { status: "FULFILLED_MANUAL", opsNote: null });

type RestoreFn = () => void;

function patchMethod<T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]): RestoreFn {
  const original = target[key];
  target[key] = replacement;
  return () => {
    target[key] = original;
  };
}

function tokenFor(userId: string) {
  return jwt.sign({ sub: userId, email: `${userId}@example.test` }, process.env.JWT_SECRET ?? "change-me");
}

async function patchRequest(baseUrl: string, path: string, userId: string, status: string, host = "alpha.localhost") {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-vendor-host": host,
      authorization: `Bearer ${tokenFor(userId)}`,
    },
    body: JSON.stringify({ status, opsNote: `move to ${status}` }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function main() {
  const restores: RestoreFn[] = [];
  const now = new Date("2026-06-08T12:00:00.000Z");
  const allocations = new Map([
    ["alloc_redemption", { id: "alloc_redemption", status: "COMMITTED", quantityAllocated: 1, quantityCommitted: 1, quantityReleased: 0 }],
    ["alloc_buyback", { id: "alloc_buyback", status: "COMMITTED", quantityAllocated: 1, quantityCommitted: 1, quantityReleased: 0 }],
  ]);
  const items = new Map<string, any>([
    ["item_redemption", {
      id: "item_redemption",
      vendorId: "vendor-alpha",
      userId: "customer-one",
      status: "REDEMPTION_REQUESTED",
      provider: "ORIPA_INTERNAL",
      prizeLabel: "Moonbreon",
      imageUrl: null,
      imageLargeUrl: null,
      setName: null,
      cardName: null,
      rarity: null,
      estimatedValue: 1000,
      createdAt: now,
      packPrizeInventoryAllocationId: "alloc_redemption",
    }],
    ["item_buyback", {
      id: "item_buyback",
      vendorId: "vendor-alpha",
      userId: "customer-one",
      status: "BUYBACK_REQUESTED",
      provider: "ORIPA_INTERNAL",
      prizeLabel: "Charizard",
      imageUrl: null,
      imageLargeUrl: null,
      setName: null,
      cardName: null,
      rarity: null,
      estimatedValue: 800,
      createdAt: now,
      packPrizeInventoryAllocationId: "alloc_buyback",
    }],
  ]);
  const requests = new Map<string, any>([
    ["req_redemption", {
      id: "req_redemption",
      vendorId: "vendor-alpha",
      userId: "customer-one",
      custodyItemId: "item_redemption",
      type: "REDEMPTION",
      status: "PENDING",
      customerNote: "ship it",
      opsNote: null,
      requestedAt: now,
      reviewedAt: null,
      completedAt: null,
      creditedAt: null,
      quoteAmount: null,
      quoteCurrency: null,
      buybackPercent: null,
      policyVersion: null,
      valueSource: null,
      valueAsOf: null,
      expiresAt: null,
      walletEntryId: null,
      user: { id: "customer-one", email: "customer-one@example.test", displayName: "Customer One" },
    }],
    ["req_buyback", {
      id: "req_buyback",
      vendorId: "vendor-alpha",
      userId: "customer-one",
      custodyItemId: "item_buyback",
      type: "BUYBACK",
      status: "PENDING",
      customerNote: "buy it",
      opsNote: null,
      requestedAt: now,
      reviewedAt: null,
      completedAt: null,
      creditedAt: null,
      quoteAmount: 560,
      quoteCurrency: "POINTS",
      buybackPercent: 70,
      policyVersion: "policy-1",
      valueSource: "vendor_comp",
      valueAsOf: now,
      expiresAt: new Date(now.getTime() + 900_000),
      walletEntryId: null,
      user: { id: "customer-one", email: "customer-one@example.test", displayName: "Customer One" },
    }],
  ]);
  const audits: any[] = [];
  const walletEntries: any[] = [];

  function requestWithIncludes(request: any) {
    return { ...request, user: request.user, custodyItem: items.get(request.custodyItemId) };
  }

  restores.push(patchMethod((prisma as any).vendor, "findUnique", async ({ where }: any) => {
    if (where?.host === "alpha.localhost") return { id: "vendor-alpha", host: "alpha.localhost", slug: "alpha", name: "Alpha" };
    if (where?.host === "beta.localhost") return { id: "vendor-beta", host: "beta.localhost", slug: "beta", name: "Beta" };
    return null;
  }));
  restores.push(patchMethod((prisma as any).vendorMembership, "findFirst", async ({ where }: any) => {
    if (where?.vendorId === "vendor-alpha" && where?.userId === "ops-staff") return { role: "STAFF" };
    if (where?.vendorId === "vendor-alpha" && where?.userId === "ops-viewer") return { role: "CUSTOMER" };
    return null;
  }));
  restores.push(patchMethod((prisma as any).custodyRequest, "findFirst", async ({ where }: any) => {
    const request = requests.get(where?.id);
    if (!request || request.vendorId !== where?.vendorId) return null;
    return requestWithIncludes(request);
  }));
  restores.push(patchMethod((prisma as any).custodyRequest, "update", async ({ where, data }: any) => {
    const request = requests.get(where.id);
    if (!request) throw new Error("request not found");
    Object.assign(request, data);
    return requestWithIncludes(request);
  }));
  restores.push(patchMethod((prisma as any).custodyItem, "update", async ({ where, data }: any) => {
    const item = items.get(where.id);
    if (!item) throw new Error("item not found");
    Object.assign(item, data);
    return item;
  }));
  restores.push(patchMethod((prisma as any).packPrizeInventoryAllocation, "update", async ({ where, data }: any) => {
    const allocation = allocations.get(where.id);
    if (!allocation) throw new Error("allocation not found");
    if (data.status) allocation.status = data.status;
    if (data.quantityCommitted?.decrement) allocation.quantityCommitted -= data.quantityCommitted.decrement;
    if (data.quantityReleased?.increment) allocation.quantityReleased += data.quantityReleased.increment;
    return allocation;
  }));
  restores.push(patchMethod((prisma as any).auditLog, "create", async ({ data }: any) => {
    audits.push({ id: `audit_${audits.length + 1}`, ...data });
    return audits[audits.length - 1];
  }));
  restores.push(patchMethod((prisma as any).walletEntry, "findUnique", async () => null));
  restores.push(patchMethod((prisma as any).walletEntry, "create", async ({ data }: any) => {
    const entry = { id: `wallet_entry_${walletEntries.length + 1}`, createdAt: now, ...data };
    walletEntries.push(entry);
    return entry;
  }));
  restores.push(patchMethod((prisma as any).walletAccount, "upsert", async () => ({ id: "wallet_1", balancePoints: 100 })));
  restores.push(patchMethod((prisma as any).walletAccount, "update", async ({ data }: any) => ({ id: "wallet_1", balancePoints: data.balancePoints, version: 1 })));
  restores.push(patchMethod((prisma as any), "$transaction", async (callback: any) => callback(prisma)));

  const app = createApp();
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const noRole = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-viewer", "OPS_REVIEW");
    assert.equal(noRole.response.status, 403, "non-staff vendor member cannot change custody ops lifecycle");

    const crossVendor = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "OPS_REVIEW", "beta.localhost");
    assert.equal(crossVendor.response.status, 403, "cross-vendor ops actor must be denied before request lookup");

    const invalid = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "PACKED");
    assert.equal(invalid.response.status, 409, "invalid transition PENDING -> PACKED must be rejected");
    assert.equal(requests.get("req_redemption")?.status, "PENDING");
    assert.equal(audits.length, 0, "invalid transition must not write audit log");

    const review = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "OPS_REVIEW");
    assert.equal(review.response.status, 200);
    assert.equal(review.payload.request.status, "OPS_REVIEW");
    assert.equal(items.get("item_redemption")?.status, "REDEMPTION_REQUESTED");
    assert.equal(allocations.get("alloc_redemption")?.status, "COMMITTED", "redemption review must keep physical inventory locked");
    assert.equal(audits.at(-1)?.action, "CUSTODY_REQUEST_TRANSITION");

    const approved = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "APPROVED");
    assert.equal(approved.response.status, 200);
    const packed = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "PACKED");
    assert.equal(packed.response.status, 200);
    const fulfilled = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_redemption", "ops-staff", "FULFILLED_MANUAL");
    assert.equal(fulfilled.response.status, 200);
    assert.equal(fulfilled.payload.request.status, "FULFILLED_MANUAL");
    assert.equal(items.get("item_redemption")?.status, "REDEEMED");
    assert.equal(allocations.get("alloc_redemption")?.status, "COMMITTED", "manual fulfillment must preserve committed allocation proof, not release or label-ship automatically");

    const credited = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_buyback", "ops-staff", "APPROVED");
    assert.equal(credited.response.status, 200);
    assert.equal(credited.payload.request.status, "CREDITED");
    assert.equal(items.get("item_buyback")?.status, "BOUGHT_BACK");
    assert.equal(allocations.get("alloc_buyback")?.status, "RELEASED", "credited buyback returns custody item to vendor inventory pool");
    assert.equal(allocations.get("alloc_buyback")?.quantityReleased, 1);
    assert.equal(walletEntries.length, 1, "buyback approval credits wallet once");
    assert.ok(audits.some((entry) => entry.entityId === "req_buyback" && entry.afterState?.status === "CREDITED"), "credited buyback transition must be audited");

    const duplicateCredit = await patchRequest(baseUrl, "/v1/ops/custody-requests/req_buyback", "ops-staff", "APPROVED");
    assert.equal(duplicateCredit.response.status, 200, "duplicate buyback approval should be idempotent");
    assert.equal(duplicateCredit.payload.request.status, "CREDITED");
    assert.equal(walletEntries.length, 1, "duplicate buyback approval must not create another wallet credit");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const restore of restores.reverse()) restore();
  }

  console.log("customer ops lifecycle backend contract ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
