import assert from "node:assert/strict";
import {
  PackInventoryAllocationError,
  buildPackPrizeInventoryAllocationPlan,
  commitInventoryAllocationForPrizeDraw,
  normalizePackInventoryMode,
  releaseHeldInventoryForPack,
  requiresPhysicalInventoryAllocation,
  reserveInventoryForPackPublish,
} from "../src/modules/packs/inventory-allocation";

const now = new Date("2026-05-30T12:00:00.000Z");

assert.equal(normalizePackInventoryMode(undefined), "PHYSICAL_REQUIRED");
assert.equal(normalizePackInventoryMode(""), "PHYSICAL_REQUIRED");
assert.equal(normalizePackInventoryMode("DIGITAL_NO_ALLOCATION"), "DIGITAL_NO_ALLOCATION");
assert.equal(normalizePackInventoryMode("PILOT_NO_ALLOCATION"), "PILOT_NO_ALLOCATION");
assert.equal(requiresPhysicalInventoryAllocation(undefined), true, "missing mode must fail closed as physical");
assert.equal(requiresPhysicalInventoryAllocation("DIGITAL_NO_ALLOCATION"), false, "digital bypass must be explicit");
assert.equal(requiresPhysicalInventoryAllocation("PILOT_NO_ALLOCATION"), false, "pilot bypass must be explicit");

const prizeRows = [
  {
    id: "prize-zard",
    packId: "pack-1",
    catalogItemId: "catalog-zard",
    label: "Charizard ex",
    stock: 2,
  },
  {
    id: "prize-pika",
    packId: "pack-1",
    catalogItemId: "catalog-pika",
    label: "Pikachu",
    stock: 1,
  },
];

const inventoryRows = [
  {
    id: "inv-zard",
    vendorId: "vendor-a",
    catalogItemId: "catalog-zard",
    title: "Charizard ex",
    quantityTotal: 3,
    quantityHeld: 0,
    quantitySold: 0,
    status: "ACTIVE" as const,
  },
  {
    id: "inv-pika",
    vendorId: "vendor-a",
    catalogItemId: "catalog-pika",
    title: "Pikachu",
    quantityTotal: 1,
    quantityHeld: 0,
    quantitySold: 0,
    status: "ACTIVE" as const,
  },
];

const allocationPlan = buildPackPrizeInventoryAllocationPlan({
  vendorId: "vendor-a",
  packId: "pack-1",
  prizes: prizeRows,
  inventoryItems: inventoryRows,
  now,
});

assert.deepEqual(
  allocationPlan.map((row) => ({
    packPrizeId: row.packPrizeId,
    vendorInventoryItemId: row.vendorInventoryItemId,
    quantityAllocated: row.quantityAllocated,
    status: row.status,
  })),
  [
    {
      packPrizeId: "prize-zard",
      vendorInventoryItemId: "inv-zard",
      quantityAllocated: 2,
      status: "HELD",
    },
    {
      packPrizeId: "prize-pika",
      vendorInventoryItemId: "inv-pika",
      quantityAllocated: 1,
      status: "HELD",
    },
  ],
  "publish allocation plan must reserve exact prize stock from matching vendor inventory"
);

assert.throws(
  () =>
    buildPackPrizeInventoryAllocationPlan({
      vendorId: "vendor-a",
      packId: "pack-1",
      prizes: [prizeRows[0]],
      inventoryItems: [{ ...inventoryRows[0], vendorId: "vendor-b" }],
      now,
    }),
  (error) => error instanceof PackInventoryAllocationError && error.reason === "cross_vendor_inventory",
  "inventory owned by another vendor must be rejected, not silently allocated"
);

assert.throws(
  () =>
    buildPackPrizeInventoryAllocationPlan({
      vendorId: "vendor-a",
      packId: "pack-1",
      prizes: [prizeRows[0]],
      inventoryItems: [{ ...inventoryRows[0], quantityTotal: 1 }],
      now,
    }),
  (error) => error instanceof PackInventoryAllocationError && error.reason === "insufficient_inventory",
  "publish must block overselling when allocatable inventory is below prize stock"
);

async function main() {
  const operations: string[] = [];
  const heldByInventoryId = new Map<string, number>();
  const tx = {
    packPrizeInventoryAllocation: {
      findMany: async () => [],
      createMany: async ({ data }: { data: Array<{ vendorInventoryItemId: string; quantityAllocated: number }> }) => {
        operations.push(`createMany:${data.length}`);
        return { count: data.length };
      },
      update: async () => ({}),
    },
    vendorInventoryItem: {
      findMany: async () => inventoryRows,
      updateMany: async ({ where, data }: { where: { id: string; vendorId: string; quantityHeld: number; quantitySold: number; quantityTotal: { gte: number } }; data: { quantityHeld: { increment: number } } }) => {
        assert.equal(where.quantityHeld, 0, "conditional hold must guard against stale quantityHeld");
        assert.equal(where.quantitySold, 0, "conditional hold must guard against stale quantitySold");
        operations.push(`hold:${where.id}:${data.quantityHeld.increment}`);
        heldByInventoryId.set(where.id, (heldByInventoryId.get(where.id) ?? 0) + data.quantityHeld.increment);
        return { count: 1 };
      },
    },
  };

  const created = await reserveInventoryForPackPublish(tx, {
    vendorId: "vendor-a",
    packId: "pack-1",
    prizes: prizeRows,
    now,
  });

  assert.equal(created.length, 2);
  assert.deepEqual(operations, ["hold:inv-zard:2", "hold:inv-pika:1", "createMany:2"]);
  assert.deepEqual([...heldByInventoryId.entries()], [
    ["inv-zard", 2],
    ["inv-pika", 1],
  ]);

  const titleLookupTx = {
    packPrizeInventoryAllocation: {
      findMany: async () => [],
      createMany: async () => ({ count: 1 }),
      update: async () => ({}),
    },
    vendorInventoryItem: {
      findMany: async (args: { where?: { vendorId?: string; OR?: Array<{ title?: { equals: string; mode: string } }> } }) => {
        assert.equal(args.where?.vendorId, "vendor-a", "inventory lookup must be vendor-scoped at the DB query level");
        const titleClause = args.where?.OR?.find((clause) => clause.title)?.title;
        assert.deepEqual(titleClause, { equals: "Dark Magician", mode: "insensitive" });
        return [{ ...inventoryRows[0], id: "inv-dark", catalogItemId: null, title: "dark magician", quantityTotal: 1 }];
      },
      updateMany: async () => ({ count: 1 }),
    },
  };
  await reserveInventoryForPackPublish(titleLookupTx, {
    vendorId: "vendor-a",
    packId: "pack-title",
    prizes: [{ id: "prize-title", packId: "pack-title", catalogItemId: null, label: "Dark Magician", stock: 1 }],
    now,
  });

  const failingTx = {
    ...tx,
    vendorInventoryItem: {
      findMany: async () => inventoryRows,
      updateMany: async ({ where, data }: { where: { id: string }; data: { quantityHeld: { increment: number } } }) => {
        operations.push(`attempt:${where.id}:${data.quantityHeld.increment}`);
        return { count: where.id === "inv-pika" ? 0 : 1 };
      },
    },
    packPrizeInventoryAllocation: {
      findMany: async () => [],
      createMany: async () => {
        operations.push("createMany-after-failed-hold");
        return { count: 1 };
      },
      update: async () => ({}),
    },
  };

  await assert.rejects(
    () =>
      reserveInventoryForPackPublish(failingTx, {
        vendorId: "vendor-a",
        packId: "pack-1",
        prizes: prizeRows,
        now,
      }),
    (error) => error instanceof PackInventoryAllocationError && error.reason === "concurrent_inventory_conflict",
    "transactional reserve must abort before creating allocation rows if any conditional hold fails"
  );
  assert.equal(
    operations.includes("createMany-after-failed-hold"),
    false,
    "allocation rows must not be created after a failed inventory hold inside the publish transaction"
  );

  const partialExistingAllocationTx = {
    packPrizeInventoryAllocation: {
      findMany: async () => [
        {
          id: "alloc-underheld-zard",
          packPrizeId: "prize-zard",
          vendorInventoryItemId: "inv-zard",
          quantityAllocated: 1,
          status: "HELD" as const,
        },
      ],
      createMany: async () => {
        operations.push("createMany-after-partial-existing-allocation");
        return { count: 1 };
      },
      update: async () => ({}),
    },
    vendorInventoryItem: {
      findMany: async () => {
        operations.push("inventory-lookup-after-partial-existing-allocation");
        return inventoryRows;
      },
      updateMany: async () => {
        operations.push("hold-after-partial-existing-allocation");
        return { count: 1 };
      },
    },
  };

  await assert.rejects(
    () =>
      reserveInventoryForPackPublish(partialExistingAllocationTx, {
        vendorId: "vendor-a",
        packId: "pack-1",
        prizes: prizeRows,
        now,
      }),
    (error) => error instanceof PackInventoryAllocationError && error.reason === "partial_existing_allocation",
    "existing allocation rows must cover full prize stock before publish can treat allocation as idempotent"
  );
  assert.equal(
    operations.includes("inventory-lookup-after-partial-existing-allocation"),
    false,
    "partial existing allocation must fail before trying to add more holds outside the original transaction"
  );

  const lifecycleOperations: string[] = [];
  const lifecycleTx = {
    packPrizeInventoryAllocation: {
      findMany: async ({ where }: { where: { packId: string; status?: string } }) => {
        lifecycleOperations.push(`allocations:${where.packId}:${where.status ?? "any"}`);
        return [
          {
            id: "alloc-zard",
            vendorId: "vendor-a",
            packId: "pack-1",
            packPrizeId: "prize-zard",
            vendorInventoryItemId: "inv-zard",
            quantityAllocated: 2,
            quantityCommitted: 0,
            quantityReleased: 0,
            status: "HELD" as const,
          },
        ];
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: { quantityCommitted?: { increment: number }; quantityReleased?: { increment: number }; status?: string } }) => {
        lifecycleOperations.push(
          `allocation-update:${where.id}:commit=${data.quantityCommitted?.increment ?? 0}:release=${data.quantityReleased?.increment ?? 0}:status=${data.status ?? "unchanged"}`
        );
        return { count: 1 };
      },
    },
    vendorInventoryItem: {
      updateMany: async ({ where, data }: { where: { id: string; vendorId: string; quantityHeld?: { gte: number } }; data: { quantityHeld: { decrement: number }; quantitySold?: { increment: number } } }) => {
        lifecycleOperations.push(
          `inventory-update:${where.id}:held-${data.quantityHeld.decrement}:sold+${data.quantitySold?.increment ?? 0}`
        );
        return { count: 1 };
      },
    },
  };

  await commitInventoryAllocationForPrizeDraw(lifecycleTx, {
    vendorId: "vendor-a",
    packId: "pack-1",
    packPrizeId: "prize-zard",
  });
  assert.deepEqual(lifecycleOperations.slice(-2), [
    "inventory-update:inv-zard:held-1:sold+1",
    "allocation-update:alloc-zard:commit=1:release=0:status=unchanged",
  ]);

  const guardedCommitOperations: string[] = [];
  const guardedCommitTx = {
    packPrizeInventoryAllocation: {
      findMany: async () => [
        {
          id: "alloc-guarded",
          vendorId: "vendor-a",
          packId: "pack-1",
          packPrizeId: "prize-zard",
          vendorInventoryItemId: "inv-zard",
          quantityAllocated: 2,
          quantityCommitted: 1,
          quantityReleased: 0,
          status: "HELD" as const,
        },
      ],
      updateMany: async ({ where, data }: { where: { id: string; status: string; quantityCommitted: number; quantityReleased: number }; data: { quantityCommitted?: { increment: number }; status?: string } }) => {
        guardedCommitOperations.push(
          `allocation-guard:${where.id}:committed=${where.quantityCommitted}:released=${where.quantityReleased}:status=${where.status}:increment=${data.quantityCommitted?.increment ?? 0}:next=${data.status ?? "unchanged"}`
        );
        return { count: 1 };
      },
      createMany: async () => ({ count: 0 }),
      update: async () => {
        throw new Error("commit must use guarded updateMany, not unguarded update");
      },
    },
    vendorInventoryItem: {
      findMany: async () => [],
      updateMany: async () => {
        guardedCommitOperations.push("inventory-commit");
        return { count: 1 };
      },
    },
  };

  await commitInventoryAllocationForPrizeDraw(guardedCommitTx, {
    vendorId: "vendor-a",
    packId: "pack-1",
    packPrizeId: "prize-zard",
  });
  assert.deepEqual(guardedCommitOperations, [
    "inventory-commit",
    "allocation-guard:alloc-guarded:committed=1:released=0:status=HELD:increment=1:next=COMMITTED",
  ]);

  lifecycleOperations.length = 0;
  await releaseHeldInventoryForPack(lifecycleTx, { vendorId: "vendor-a", packId: "pack-1" });
  assert.deepEqual(lifecycleOperations.slice(-2), [
    "inventory-update:inv-zard:held-2:sold+0",
    "allocation-update:alloc-zard:commit=0:release=2:status=RELEASED",
  ]);

  console.log("pack inventory allocation tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
