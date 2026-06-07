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
  let capturedSql = "";

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
    patchMethod(prisma as any, "$queryRaw", async (sql: any) => {
      capturedSql = Array.isArray(sql?.strings) ? sql.strings.join("?") : "";
      return [
        {
          id: "card-1",
          source: "tcgtracking",
          sourceItemId: "src-1",
          itemType: "CARD",
          game: "POKEMON",
          language: "en",
          name: "Charizard ex",
          setId: "85:23599",
          setName: "151",
          localId: "006",
          cardNumber: "006/165",
          rarity: "Double Rare",
          imageThumbUrl: "thumb.jpg",
          imageLargeUrl: "large.jpg",
          imageBaseUrl: "base.jpg",
          searchText: "charizard ex",
          sourcePayload: { raw: { id: "src-1" } },
          rarityOrder: 2,
          nameSort: "charizard ex",
        },
      ];
    }),
  );

  const app = createApp();
  const server = app.listen(0);

  try {
    const port = (server.address() as AddressInfo).port;
    const token = jwt.sign({ sub: "user-1", email: "owner@example.com" }, process.env.JWT_SECRET ?? "change-me");

    const response = await fetch(
      `http://127.0.0.1:${port}/v1/catalog/search?game=POKEMON&itemClass=CARD&setId=85%3A23599&limit=50`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "x-vendor-host": "demo.localhost",
        },
      },
    );

    const payload = await response.json().catch(() => ({}));
    assert.equal(response.status, 200);
    assert.equal(Array.isArray(payload.items), true);
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].name, "Charizard ex");
    assert.equal(payload.nextCursor, null);
    assert.equal(capturedSql.includes("JOIN \"CatalogSet\" cs"), true);
    assert.equal(capturedSql.includes("cs.\"sourceSetId\" ="), true);
    assert.equal(capturedSql.includes("lower(ci.name) LIKE"), false);

    const idleResponse = await fetch(
      `http://127.0.0.1:${port}/v1/catalog/search?game=POKEMON&itemClass=CARD&limit=50`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "x-vendor-host": "demo.localhost",
        },
      },
    );
    const idlePayload = await idleResponse.json().catch(() => ({}));
    assert.equal(idleResponse.status, 200);
    assert.deepEqual(idlePayload.items, []);

    const invalidGameResponse = await fetch(
      `http://127.0.0.1:${port}/v1/catalog/search?game=YUGIOH&itemClass=CARD&setId=sv3pt5&limit=50`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "x-vendor-host": "demo.localhost",
        },
      },
    );
    assert.equal(invalidGameResponse.status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const restore of restores.reverse()) restore();
  }

  console.log("catalog search route hierarchy test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
