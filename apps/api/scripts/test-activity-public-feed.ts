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

async function getPublicActivity(baseUrl: string, vendorHost: string, limit?: number) {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  const response = await fetch(`${baseUrl}/v1/activity/public${query}`, {
    headers: {
      "x-vendor-host": vendorHost,
      authorization: `Bearer ${tokenFor("viewer-user")}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function main() {
  const restores: RestoreFn[] = [];
  const drawResultQueries: any[] = [];

  const vendorsByHost = new Map([
    ["alpha.localhost", { id: "vendor-alpha", host: "alpha.localhost", slug: "alpha", name: "Alpha Vendor" }],
    ["beta.localhost", { id: "vendor-beta", host: "beta.localhost", slug: "beta", name: "Beta Vendor" }],
  ]);

  restores.push(
    patchMethod((prisma as any).vendor, "findUnique", async ({ where }: any) => {
      if (where?.host) return vendorsByHost.get(where.host) ?? null;
      return null;
    }),
  );

  restores.push(
    patchMethod((prisma as any).drawResult, "findMany", async (query: any) => {
      drawResultQueries.push(query);
      return [
        {
          id: "draw-result-public-1",
          vendorId: "vendor-alpha",
          drawOrderId: "draw-order-public-1",
          packId: "pack-visible-1",
          packPrizeId: "prize-visible-1",
          drawSequence: 1,
          requestId: "internal-request-1",
          createdAt: new Date("2026-06-09T01:02:03.000Z"),
          drawOrder: {
            id: "draw-order-public-1",
            vendorId: "vendor-alpha",
            userId: "user-secret-one",
            requestId: "order-request-secret",
            idempotencyScopeKey: "idem-secret",
            clientIp: "203.0.113.1",
            userAgent: "private-agent",
            status: "COMPLETED",
            createdAt: new Date("2026-06-09T01:02:00.000Z"),
            user: {
              id: "user-secret-one",
              email: "alice@example.test",
              fullName: "Alice Collector",
              displayName: "Alice",
            },
          },
          pack: {
            id: "pack-visible-1",
            vendorId: "vendor-alpha",
            title: "Visible Pack",
            isActive: true,
            status: "LIVE",
            startsAt: null,
            endsAt: null,
            remainingStock: 3,
            poolSnapshotHash: "pool-1",
            tierSnapshotJson: {
              version: 1,
              tiers: [{ name: "A Tier", percentage: null, items: [{ label: "Chase", estimatedValue: 1200, stock: 1 }] }],
            },
          },
          packPrize: {
            id: "prize-visible-1",
            label: "A Tier - Moonbreon",
            estimatedValue: 1200,
          },
          custodyItem: {
            id: "custody-secret-1",
            estimatedValue: 1300,
          },
        },
      ];
    }),
  );

  const app = createApp();
  const server = app.listen(0);

  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const alpha = await getPublicActivity(baseUrl, "alpha.localhost", 999);
    assert.equal(alpha.response.status, 200, "GET /v1/activity/public should succeed");
    assert.equal(Array.isArray(alpha.payload.activities), true, "payload must contain activities array");
    assert.equal(alpha.payload.activities.length, 1);

    assert.deepEqual(alpha.payload.activities[0], {
      packTitle: "Visible Pack",
      prizeLabel: "A Tier - Moonbreon",
      valueBand: "1000+",
      timestamp: "2026-06-09T01:02:03.000Z",
      customerLabel: alpha.payload.activities[0].customerLabel,
    });
    assert.match(alpha.payload.activities[0].customerLabel, /^Collector #[0-9]{4}$/);

    const serialized = JSON.stringify(alpha.payload);
    for (const forbidden of [
      "alice@example.test",
      "Alice Collector",
      "user-secret-one",
      "draw-order-public-1",
      "draw-result-public-1",
      "custody-secret-1",
      "idem-secret",
      "203.0.113.1",
      "private-agent",
      "internal-request-1",
      "order-request-secret",
      "pack-visible-1",
      "prize-visible-1",
    ]) {
      assert.equal(serialized.includes(forbidden), false, `response must not leak ${forbidden}`);
    }

    assert.equal(drawResultQueries.length, 1, "route must fetch activity from drawResult");
    assert.equal(drawResultQueries[0].take, 50, "limit must clamp to 50");
    assert.equal(drawResultQueries[0].where.vendorId, "vendor-alpha", "query must be vendor scoped");
    assert.equal(drawResultQueries[0].where.drawOrder.status, "COMPLETED", "only completed orders belong in the feed");
    assert.equal(drawResultQueries[0].where.pack.vendorId, "vendor-alpha", "pack relation must be vendor scoped");
    assert.equal(drawResultQueries[0].where.pack.isActive, true, "inactive packs must be excluded");
    assert.deepEqual(drawResultQueries[0].where.pack.status, { not: "ARCHIVED" }, "archived packs must be excluded");
    assert.deepEqual(
      drawResultQueries[0].select.drawOrder.select,
      { status: true, createdAt: true },
      "public feed query must not select customer/user/order identifiers",
    );

    const beta = await getPublicActivity(baseUrl, "beta.localhost", 0);
    assert.equal(beta.response.status, 200);
    assert.equal(drawResultQueries[1].take, 1, "limit must clamp to minimum 1");
    assert.equal(drawResultQueries[1].where.vendorId, "vendor-beta", "vendor scope must follow req.vendorId");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const restore of restores.reverse()) restore();
  }

  console.log("activity public feed tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
