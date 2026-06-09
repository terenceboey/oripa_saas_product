import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import jwt from "jsonwebtoken";
import { AddressInfo } from "node:net";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  BUYBACK_POLICY_VERSION,
  BUYBACK_QUOTE_CURRENCY,
  buildBuybackQuoteForCustodyItem,
  isBuybackQuoteExpired,
  nextCustodyItemStatusForRequest,
  normalizeIdempotencyKey,
  serializeCustodyRequest,
} from "../src/lib/customer-custody";

const now = new Date("2026-06-08T12:00:00.000Z");
const freshValueAsOf = new Date("2026-06-08T11:00:00.000Z");
const staleValueAsOf = new Date("2026-05-01T00:00:00.000Z");

assert.equal(normalizeIdempotencyKey("  quote-key-1  "), "quote-key-1");
assert.equal(normalizeIdempotencyKey(""), null);
assert.equal(normalizeIdempotencyKey("x".repeat(129)), null);

const quote = buildBuybackQuoteForCustodyItem({
  id: "item_1",
  status: "HELD",
  estimatedValue: 1000,
  estimatedValueSource: "vendor_comp",
  estimatedValueAsOf: freshValueAsOf,
  requests: [],
}, { now, buybackPercent: 65 });
assert.equal(quote.ok, true);
if (quote.ok) {
  assert.equal(quote.quoteAmount, 650);
  assert.equal(quote.quoteCurrency, BUYBACK_QUOTE_CURRENCY);
  assert.equal(quote.buybackPercent, 65);
  assert.equal(quote.policyVersion, BUYBACK_POLICY_VERSION);
  assert.equal(quote.valueSource, "vendor_comp");
  assert.equal(quote.valueAsOf.toISOString(), freshValueAsOf.toISOString());
  assert.equal(quote.expiresAt.toISOString(), "2026-06-08T12:15:00.000Z");
}

assert.deepEqual(buildBuybackQuoteForCustodyItem({
  id: "item_stale",
  status: "HELD",
  estimatedValue: 1000,
  estimatedValueAsOf: staleValueAsOf,
  requests: [],
}, { now }), { ok: false, error: "Custody item value is stale", reasonCode: "stale_value" });

assert.deepEqual(buildBuybackQuoteForCustodyItem({
  id: "item_cross",
  status: "BUYBACK_REQUESTED",
  estimatedValue: 1000,
  estimatedValueAsOf: freshValueAsOf,
  requests: [],
}, { now }), { ok: false, error: "Custody item is not eligible for buyback", reasonCode: "ineligible" });

assert.equal(isBuybackQuoteExpired({ expiresAt: "2026-06-08T12:14:59.000Z" }, now), false);
assert.equal(isBuybackQuoteExpired({ expiresAt: "2026-06-08T12:00:00.000Z" }, now), true);
assert.equal(nextCustodyItemStatusForRequest("BUYBACK", "QUOTED"), "BUYBACK_REQUESTED");
assert.equal(nextCustodyItemStatusForRequest("BUYBACK", "CREDITED"), "BOUGHT_BACK");
assert.equal(nextCustodyItemStatusForRequest("BUYBACK", "EXPIRED"), "HELD");

const serialized = serializeCustodyRequest({
  id: "quote_1",
  type: "BUYBACK",
  status: "QUOTED",
  customerNote: null,
  requestedAt: now,
  quoteAmount: 650,
  quoteCurrency: "POINTS",
  buybackPercent: 65,
  policyVersion: "policy-1",
  valueSource: "vendor_comp",
  valueAsOf: freshValueAsOf,
  expiresAt: new Date("2026-06-08T12:15:00.000Z"),
});
assert.equal(serialized.quoteAmount, 650);
assert.equal(serialized.policyVersion, "policy-1");
assert.equal(serialized.valueAsOf, freshValueAsOf.toISOString());

const customerRouter = readFileSync(join(process.cwd(), "src/modules/customer/router.ts"), "utf8");
assert.match(customerRouter, /buyback-quotes/, "customer router must expose buyback quote endpoint");
assert.match(customerRouter, /vendorId:\s*context\.vendorId,\s*userId:\s*context\.userId/s, "quote lookup must be scoped by vendor and user");
assert.match(customerRouter, /idempotencyScopeKey/, "quote creation must persist idempotency scope");
assert.match(customerRouter, /isBuybackQuoteExpired/, "quote accept must reject expired quotes");

const opsRouter = readFileSync(join(process.cwd(), "src/modules/ops/router.ts"), "utf8");
assert.match(opsRouter, /BUYBACK_CREDIT/, "ops buyback approval must create a wallet credit ledger entry");
assert.match(opsRouter, /buyback-credit:\$\{existing\.id\}/, "wallet credit must use a request-scoped idempotency key");
assert.match(opsRouter, /creditsBuyback \? "CREDITED" : parsed\.status/, "successful buyback approval must transition to credited");


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

async function postJson(baseUrl: string, path: string, userId: string, body: unknown, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-vendor-host": "alpha.localhost",
    authorization: `Bearer ${tokenFor(userId)}`,
  };
  if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function main() {
  const restores: RestoreFn[] = [];
  const oldFlag = process.env.CUSTOMER_CUSTODY_ENABLED;
  process.env.CUSTOMER_CUSTODY_ENABLED = "true";
  const current = new Date();
  const fresh = new Date(current.getTime() - 60 * 60 * 1000);
  const stale = new Date(current.getTime() - 30 * 24 * 60 * 60 * 1000);
  const items = new Map([
    ["item_fresh", {
      id: "item_fresh",
      vendorId: "vendor-alpha",
      userId: "user-one",
      status: "HELD",
      provider: "ORIPA_INTERNAL",
      prizeLabel: "Moonbreon",
      imageUrl: null,
      imageLargeUrl: null,
      setName: null,
      cardName: null,
      rarity: null,
      estimatedValue: 1000,
      estimatedValueSource: "vendor_comp",
      estimatedValueAsOf: fresh,
      createdAt: current,
      requests: [],
    }],
    ["item_stale", {
      id: "item_stale",
      vendorId: "vendor-alpha",
      userId: "user-one",
      status: "HELD",
      provider: "ORIPA_INTERNAL",
      prizeLabel: "Old comp",
      imageUrl: null,
      imageLargeUrl: null,
      setName: null,
      cardName: null,
      rarity: null,
      estimatedValue: 1000,
      estimatedValueSource: "vendor_comp",
      estimatedValueAsOf: stale,
      createdAt: current,
      requests: [],
    }],
  ]);
  const requests: any[] = [];

  restores.push(patchMethod((prisma as any).vendor, "findUnique", async ({ where }: any) => {
    if (where?.host === "alpha.localhost") return { id: "vendor-alpha", host: "alpha.localhost", slug: "alpha", name: "Alpha" };
    return null;
  }));
  restores.push(patchMethod((prisma as any).custodyItem, "findFirst", async ({ where }: any) => {
    const item = items.get(where?.id);
    if (!item || item.vendorId !== where?.vendorId || item.userId !== where?.userId) return null;
    return { ...item, requests: requests.filter((request) => request.custodyItemId === item.id && ["QUOTED", "PENDING", "APPROVED"].includes(request.status)) };
  }));
  restores.push(patchMethod((prisma as any).custodyRequest, "findFirst", async ({ where }: any) => {
    const request = requests.find((entry) => {
      if (where?.id && entry.id !== where.id) return false;
      if (where?.vendorId && entry.vendorId !== where.vendorId) return false;
      if (where?.userId && entry.userId !== where.userId) return false;
      if (where?.custodyItemId && entry.custodyItemId !== where.custodyItemId) return false;
      if (where?.type && entry.type !== where.type) return false;
      if (where?.idempotencyScopeKey && entry.idempotencyScopeKey !== where.idempotencyScopeKey) return false;
      return true;
    });
    if (!request) return null;
    return { ...request, custodyItem: items.get(request.custodyItemId) };
  }));
  restores.push(patchMethod((prisma as any).custodyRequest, "create", async ({ data }: any) => {
    const request = { id: `quote_${requests.length + 1}`, requestedAt: current, reviewedAt: null, completedAt: null, creditedAt: null, opsNote: null, customerNote: null, ...data };
    requests.push(request);
    return request;
  }));
  restores.push(patchMethod((prisma as any).custodyRequest, "update", async ({ where, data }: any) => {
    const request = requests.find((entry) => entry.id === where.id);
    if (!request) throw new Error("request not found");
    Object.assign(request, data);
    return request;
  }));
  restores.push(patchMethod((prisma as any).custodyItem, "update", async ({ where, data }: any) => {
    const item = items.get(where.id);
    if (!item) throw new Error("item not found");
    Object.assign(item, data);
    return { ...item, requests: requests.filter((request) => request.custodyItemId === item.id) };
  }));
  restores.push(patchMethod((prisma as any), "$transaction", async (callback: any) => callback(prisma)));

  const app = createApp();
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const staleQuote = await postJson(baseUrl, "/v1/customer/items/item_stale/buyback-quotes", "user-one", {}, "stale-key");
    assert.equal(staleQuote.response.status, 400, "stale value must block quote");
    assert.equal(staleQuote.payload.reasonCode, "stale_value");

    const crossUser = await postJson(baseUrl, "/v1/customer/items/item_fresh/buyback-quotes", "user-two", {}, "cross-key");
    assert.equal(crossUser.response.status, 404, "cross-user quote access must be denied as not found");

    const firstQuote = await postJson(baseUrl, "/v1/customer/items/item_fresh/buyback-quotes", "user-one", {}, "quote-key");
    assert.equal(firstQuote.response.status, 201);
    assert.equal(firstQuote.payload.quote.quoteAmount, 700);
    assert.equal(firstQuote.payload.quote.policyVersion, BUYBACK_POLICY_VERSION);

    const secondQuote = await postJson(baseUrl, "/v1/customer/items/item_fresh/buyback-quotes", "user-one", {}, "quote-key");
    assert.equal(secondQuote.response.status, 200, "quote creation must be idempotent by scoped key");
    assert.equal(secondQuote.payload.quote.id, firstQuote.payload.quote.id);

    const firstAccept = await postJson(baseUrl, `/v1/customer/buyback-quotes/${firstQuote.payload.quote.id}/accept`, "user-one", { note: "credit wallet" });
    assert.equal(firstAccept.response.status, 200);
    assert.equal(firstAccept.payload.request.status, "PENDING");
    assert.equal(firstAccept.payload.item.status, "BUYBACK_REQUESTED");

    const secondAccept = await postJson(baseUrl, `/v1/customer/buyback-quotes/${firstQuote.payload.quote.id}/accept`, "user-one", { note: "credit wallet" });
    assert.equal(secondAccept.response.status, 200, "accept quote must be idempotent");
    assert.equal(secondAccept.payload.request.id, firstAccept.payload.request.id);
    assert.equal(requests.length, 1, "idempotent quote/accept must not duplicate requests");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const restore of restores.reverse()) restore();
    if (oldFlag == null) delete process.env.CUSTOMER_CUSTODY_ENABLED;
    else process.env.CUSTOMER_CUSTODY_ENABLED = oldFlag;
  }

  console.log("customer buyback policy backend contract ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
