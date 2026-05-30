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

async function main() {
  const restores: RestoreFn[] = [];
  let sourceGroupByCalled = false;

  restores.push(
    patchMethod((prisma as any).vendor, "findUnique", async ({ where }: any) => {
      if (where?.host === "demo.localhost") {
        return { id: "vendor-1", host: "demo.localhost", slug: "demo", name: "Demo Vendor" };
      }
      return null;
    }),
  );

  restores.push(
    patchMethod((prisma as any).vendorMembership, "findFirst", async () => {
      return { role: "OWNER" };
    }),
  );

  restores.push(
    patchMethod(prisma as any, "$transaction", async (queries: Array<Promise<unknown>>) => {
      return Promise.all(queries);
    }),
  );

  restores.push(
    patchMethod((prisma as any).catalogItem, "groupBy", async (args: any) => {
      const by = Array.isArray(args?.by) ? args.by.join(",") : "";
      if (by === "source") {
        sourceGroupByCalled = true;
        return [
          { source: "pokemoncard.io", _count: { source: 22000 } },
          { source: "tcgtracking", _count: { source: 58000 } },
        ];
      }
      if (by === "language") {
        return [
          { language: "en", _count: { language: 79000 } },
          { language: "ja", _count: { language: 1000 } },
        ];
      }
      if (by === "setId,setName") {
        return [
          { setId: "sv3pt5", setName: "Scarlet & Violet 151", _count: { setId: 900 } },
          { setId: "sv2a", setName: "Pokemon Card 151", _count: { setId: 800 } },
        ];
      }
      if (by === "rarity") {
        return [
          { rarity: "Rare", _count: { rarity: 1200 } },
          { rarity: "Double Rare", _count: { rarity: 500 } },
        ];
      }
      return [];
    }),
  );

  const app = createApp();
  const server = app.listen(0);

  try {
    const port = (server.address() as AddressInfo).port;
    const token = jwt.sign({ sub: "user-1", email: "owner@example.com" }, process.env.JWT_SECRET ?? "change-me");
    const response = await fetch(
      `http://127.0.0.1:${port}/v1/catalog/facets?type=card&game=POKEMON&limit=30`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "x-vendor-host": "demo.localhost",
        },
      },
    );

    const payload = await response.json().catch(() => ({}));
    assert.equal(response.status, 200);
    assert.equal(sourceGroupByCalled, true);
    assert.deepEqual(payload.sources, [
      { value: "tcgtracking", count: 58000 },
      { value: "pokemoncard.io", count: 22000 },
    ]);
    assert.equal(payload.languages[0].value, "en");
    assert.equal(payload.sets[0].id, "sv3pt5");
    assert.equal(payload.rarities[0].value, "Rare");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const restore of restores.reverse()) restore();
  }

  console.log("catalog facets route source options test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
