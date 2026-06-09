import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { AddressInfo } from "node:net";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { computePoolSnapshotHash } from "../src/modules/packs/pool-snapshot";

// This route-level probe keeps the draw transaction fail-closed for physical packs:
// no held allocation proof => 400, and wallet/custody/revenue side-effect writers are not reached.

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

const physicalPackId = "cmphysical0000000000000001";
const digitalPackId = "cmdigital00000000000000001";

async function postDraw(baseUrl: string, inventoryMode: string) {
  const packId = inventoryMode === "DIGITAL_NO_ALLOCATION" ? digitalPackId : physicalPackId;
  const response = await fetch(`${baseUrl}/v1/draws`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vendor-host": "physical.localhost",
      "x-idempotency-key": `idem-${inventoryMode}`,
      "x-client-seed": "client-seed",
      authorization: `Bearer ${tokenFor("user-physical")}`,
    },
    body: JSON.stringify({ packId, quantity: 1 }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function main() {
  const restores: RestoreFn[] = [];
  const prizeRow = {
    id: "prize-physical",
    packId: "pack-physical",
    catalogItemId: "catalog-physical",
    catalogSource: null,
    catalogSourceItemId: null,
    catalogSnapshot: null,
    label: "Physical Charizard",
    imageUrl: null,
    imageLargeUrl: null,
    setId: null,
    setName: null,
    localId: null,
    cardNumber: null,
    rarity: "rare",
    estimatedValue: 500,
    weight: 1,
    stock: 1,
    remainingStock: 1,
  };
  const poolSnapshotHash = computePoolSnapshotHash([prizeRow]);
  const sideEffectCalls: string[] = [];

  const vendorsByHost = new Map([
    ["physical.localhost", { id: "vendor-physical", host: "physical.localhost", slug: "physical", name: "Physical Vendor" }],
  ]);

  restores.push(
    patchMethod((prisma as any).vendor, "findUnique", async ({ where }: any) => {
      if (where?.host) return vendorsByHost.get(where.host) ?? null;
      return null;
    }),
  );

  const tx = {
    idempotencyKey: {
      findUnique: async () => null,
      upsert: async () => {
        sideEffectCalls.push("idempotencyKey.upsert");
        return {};
      },
    },
    pack: {
      findFirst: async ({ where }: any) => ({
        id: where.id,
        vendorId: "vendor-physical",
        title: "Physical Pack",
        pricePoints: 100,
        totalStock: 1,
        remainingStock: 1,
        isNew: true,
        limitedLabel: null,
        importantNotes: null,
        status: "LIVE",
        isActive: true,
        startsAt: null,
        endsAt: null,
        poolSnapshotHash,
        drawLimitMode: "NONE",
        drawLimitValue: null,
        drawLimitResetTimezone: "Asia/Singapore",
        inventoryMode: where.id === digitalPackId ? "DIGITAL_NO_ALLOCATION" : "PHYSICAL_REQUIRED",
      }),
      update: async () => {
        sideEffectCalls.push("pack.update");
        return {};
      },
    },
    walletAccount: {
      findUnique: async () => ({ id: "wallet-physical", vendorId: "vendor-physical", userId: "user-physical", balancePoints: 1000 }),
      update: async () => {
        sideEffectCalls.push("walletAccount.update");
        return {};
      },
    },
    drawOrder: {
      create: async () => ({ id: "draw-order-physical" }),
      aggregate: async () => ({ _sum: { quantity: 0 } }),
    },
    drawFairnessProof: {
      create: async () => ({ id: "proof-physical" }),
    },
    packPrize: {
      findMany: async () => [prizeRow],
      update: async () => ({ id: prizeRow.id }),
    },
    packPrizeInventoryAllocation: {
      findMany: async () => [],
      updateMany: async () => {
        sideEffectCalls.push("packPrizeInventoryAllocation.updateMany");
        return { count: 0 };
      },
    },
    vendorInventoryItem: {
      updateMany: async () => {
        sideEffectCalls.push("vendorInventoryItem.updateMany");
        return { count: 0 };
      },
    },
    packDraw: {
      create: async () => {
        sideEffectCalls.push("packDraw.create");
        return { id: "legacy-draw" };
      },
    },
    drawResult: {
      create: async () => {
        sideEffectCalls.push("drawResult.create");
        return { id: "draw-result-physical" };
      },
    },
    custodyItem: {
      create: async () => {
        sideEffectCalls.push("custodyItem.create");
        return { id: "custody-physical" };
      },
    },
    drawFairnessSelection: {
      createMany: async () => {
        sideEffectCalls.push("drawFairnessSelection.createMany");
        return { count: 1 };
      },
    },
    walletEntry: {
      create: async () => {
        sideEffectCalls.push("walletEntry.create");
        return {};
      },
    },
    vendorSettings: {
      findUnique: async () => ({ pointsPerCurrencyUnit: 100, currencyCode: "USD" }),
    },
    vendorRevenueLedger: {
      createMany: async () => {
        sideEffectCalls.push("vendorRevenueLedger.createMany");
        return { count: 2 };
      },
    },
    auditLog: {
      create: async () => {
        sideEffectCalls.push("auditLog.create");
        return {};
      },
    },
    outboxEvent: {
      create: async () => {
        sideEffectCalls.push("outboxEvent.create");
        return {};
      },
    },
  };

  restores.push(patchMethod((prisma as any).vendorSettings, "findUnique", async () => ({ maxDrawQuantity: 100 })));
  restores.push(
    patchMethod(prisma as any, "$transaction", async (callback: (transactionClient: typeof tx) => Promise<unknown>) => {
      const stagedSideEffectsStart = sideEffectCalls.length;
      try {
        return await callback(tx);
      } catch (error) {
        sideEffectCalls.splice(stagedSideEffectsStart);
        throw error;
      }
    }),
  );

  const app = createApp();
  const server = app.listen(0);

  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const failedPhysical = await postDraw(baseUrl, "PHYSICAL_REQUIRED");
    assert.equal(failedPhysical.response.status, 400, "physical pack draw must fail without held allocation proof");
    assert.match(String(failedPhysical.payload.error ?? ""), /inventory allocation/i);
    assert.deepEqual(sideEffectCalls, [], "failed physical allocation must not leave wallet/custody/revenue/outbox side effects");

    sideEffectCalls.length = 0;
    const bypassDigital = await postDraw(baseUrl, "DIGITAL_NO_ALLOCATION");
    assert.equal(bypassDigital.response.status, 201, "digital backend mode may explicitly bypass physical allocation proof");
    assert.equal(bypassDigital.payload.draws?.[0]?.custodyItemId, "custody-physical");
    assert.ok(sideEffectCalls.includes("walletEntry.create"), "successful explicit bypass still records normal wallet side effects");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const restore of restores.reverse()) restore();
  }

  console.log("draw physical inventory fail-closed tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
