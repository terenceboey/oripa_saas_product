import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { AddressInfo } from "node:net";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

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

async function getWallet(baseUrl: string, vendorHost: string, userId?: string) {
  const headers: Record<string, string> = { "x-vendor-host": vendorHost };
  if (userId) headers.authorization = `Bearer ${tokenFor(userId)}`;
  const response = await fetch(`${baseUrl}/v1/wallet`, { headers });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function main() {
  const restores: RestoreFn[] = [];
  const walletQueries: unknown[] = [];

  const vendorsByHost = new Map([
    ["alpha.localhost", { id: "vendor-alpha", host: "alpha.localhost", slug: "alpha", name: "Alpha Vendor" }],
    ["beta.localhost", { id: "vendor-beta", host: "beta.localhost", slug: "beta", name: "Beta Vendor" }],
  ]);

  const wallets = new Map([
    ["vendor-alpha:user-one", {
      id: "wallet-alpha-user-one",
      vendorId: "vendor-alpha",
      userId: "user-one",
      ownerLabel: "customer:user-one",
      balancePoints: 1000,
      version: 7,
      entries: [
        {
          id: "entry-buyback-credit",
          vendorId: "vendor-alpha",
          walletAccountId: "wallet-alpha-user-one",
          type: "CREDIT",
          amountPoints: 325,
          reason: "BUYBACK_CREDIT",
          balanceBefore: 675,
          balanceAfter: 1000,
          actorUserId: "ops-staff",
          requestId: "internal-request-id",
          idempotencyScopeKey: "buyback-credit:req_buyback",
          referenceType: "CustodyRequest",
          referenceId: "req_buyback",
          metadata: { custodyItemId: "item-secret", policyVersion: "policy-1" },
          createdAt: new Date("2026-06-09T09:30:00.000Z"),
        },
        {
          id: "entry-pack-draw",
          vendorId: "vendor-alpha",
          walletAccountId: "wallet-alpha-user-one",
          type: "DEBIT",
          amountPoints: 250,
          reason: "PACK_DRAW",
          balanceBefore: 925,
          balanceAfter: 675,
          actorUserId: "user-one",
          requestId: "draw-request-id",
          idempotencyScopeKey: "draw:vendor-alpha:user-one:key-1",
          referenceType: "DRAW_ORDER",
          referenceId: "pack-alpha",
          metadata: { drawOrderId: "draw-secret", quantity: 1 },
          createdAt: new Date("2026-06-09T09:00:00.000Z"),
        },
      ],
    }],
    ["vendor-alpha:user-two", { id: "wallet-alpha-user-two", vendorId: "vendor-alpha", userId: "user-two", balancePoints: 2000, entries: [] }],
    ["vendor-beta:user-one", { id: "wallet-beta-user-one", vendorId: "vendor-beta", userId: "user-one", balancePoints: 3000, entries: [] }],
  ]);

  restores.push(
    patchMethod((prisma as any).vendor, "findUnique", async ({ where }: any) => {
      if (where?.host) return vendorsByHost.get(where.host) ?? null;
      return null;
    }),
  );

  restores.push(
    patchMethod((prisma as any).walletAccount, "findUnique", async (query: any) => {
      walletQueries.push(query);
      const scoped = query?.where?.vendorId_userId;
      if (!scoped?.vendorId || !scoped?.userId) return null;
      return wallets.get(`${scoped.vendorId}:${scoped.userId}`) ?? null;
    }),
  );

  restores.push(
    patchMethod((prisma as any).walletAccount, "findFirst", async (query: any) => {
      walletQueries.push(query);
      throw new Error("wallet route must not use vendor-only findFirst");
    }),
  );

  const app = createApp();
  const server = app.listen(0);

  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const unauthenticated = await getWallet(baseUrl, "alpha.localhost");
    assert.equal(unauthenticated.response.status, 401, "GET /v1/wallet must reject unauthenticated requests");
    assert.equal(unauthenticated.payload.error, "unauthorized");

    const alphaUserOne = await getWallet(baseUrl, "alpha.localhost", "user-one");
    assert.equal(alphaUserOne.response.status, 200);
    assert.equal(alphaUserOne.payload.wallet.id, "wallet-alpha-user-one");
    assert.equal(alphaUserOne.payload.wallet.balancePoints, 1000);
    assert.deepEqual(alphaUserOne.payload.wallet.entries, [
      {
        id: "entry-buyback-credit",
        type: "CREDIT",
        amountPoints: 325,
        reason: "BUYBACK_CREDIT",
        balanceBefore: 675,
        balanceAfter: 1000,
        createdAt: "2026-06-09T09:30:00.000Z",
        referenceLabel: "Buyback credit req_buyback",
      },
      {
        id: "entry-pack-draw",
        type: "DEBIT",
        amountPoints: 250,
        reason: "PACK_DRAW",
        balanceBefore: 925,
        balanceAfter: 675,
        createdAt: "2026-06-09T09:00:00.000Z",
        referenceLabel: "Draw order pack-alpha",
      },
    ]);
    const serialized = JSON.stringify(alphaUserOne.payload.wallet);
    for (const forbidden of ["vendorId", "userId", "ownerLabel", "version", "walletAccountId", "actorUserId", "requestId", "idempotencyScopeKey", "metadata", "item-secret", "draw-secret"]) {
      assert.equal(serialized.includes(forbidden), false, `wallet payload must not expose ${forbidden}`);
    }

    const alphaUserTwo = await getWallet(baseUrl, "alpha.localhost", "user-two");
    assert.equal(alphaUserTwo.response.status, 200);
    assert.equal(alphaUserTwo.payload.wallet.id, "wallet-alpha-user-two", "same vendor must not leak another user's wallet");
    assert.equal(alphaUserTwo.payload.wallet.balancePoints, 2000);

    const betaUserOne = await getWallet(baseUrl, "beta.localhost", "user-one");
    assert.equal(betaUserOne.response.status, 200);
    assert.equal(betaUserOne.payload.wallet.id, "wallet-beta-user-one", "same user must not leak another vendor's wallet");
    assert.equal(betaUserOne.payload.wallet.balancePoints, 3000);

    const missingWallet = await getWallet(baseUrl, "beta.localhost", "user-two");
    assert.equal(missingWallet.response.status, 404, "missing scoped wallet must be deterministic");
    assert.deepEqual(missingWallet.payload, { error: "Wallet not found" });

    assert.equal(walletQueries.length, 4, "only authenticated wallet requests should query walletAccount");
    assert.deepEqual(walletQueries.map((query: any) => query.where.vendorId_userId), [
      { vendorId: "vendor-alpha", userId: "user-one" },
      { vendorId: "vendor-alpha", userId: "user-two" },
      { vendorId: "vendor-beta", userId: "user-one" },
      { vendorId: "vendor-beta", userId: "user-two" },
    ]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const restore of restores.reverse()) restore();
  }

  console.log("customer wallet scoping contract ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
