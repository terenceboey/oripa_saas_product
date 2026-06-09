export type InventoryAllocationFailureReason =
  | "cross_vendor_inventory"
  | "insufficient_inventory"
  | "concurrent_inventory_conflict"
  | "partial_existing_allocation"
  | "missing_required_allocation";

export type PackInventoryMode = "PHYSICAL_REQUIRED" | "DIGITAL_NO_ALLOCATION" | "PILOT_NO_ALLOCATION";

export function normalizePackInventoryMode(mode: string | null | undefined): PackInventoryMode {
  if (mode === "DIGITAL_NO_ALLOCATION" || mode === "PILOT_NO_ALLOCATION") return mode;
  return "PHYSICAL_REQUIRED";
}

export function requiresPhysicalInventoryAllocation(mode: string | null | undefined): boolean {
  return normalizePackInventoryMode(mode) === "PHYSICAL_REQUIRED";
}

export class PackInventoryAllocationError extends Error {
  constructor(
    public readonly reason: InventoryAllocationFailureReason,
    message: string
  ) {
    super(message);
    this.name = "PackInventoryAllocationError";
  }
}

type PackPrizeInventoryInput = {
  id: string;
  packId?: string | null;
  catalogItemId?: string | null;
  label: string;
  stock: number;
};

type VendorInventoryItemInput = {
  id: string;
  vendorId: string;
  catalogItemId?: string | null;
  title: string;
  quantityTotal: number;
  quantityHeld: number;
  quantitySold: number;
  status: "ACTIVE" | "ARCHIVED" | "DAMAGED" | "SOLD_OUT";
};

export type PackPrizeInventoryAllocationPlanRow = {
  vendorId: string;
  packId: string;
  packPrizeId: string;
  vendorInventoryItemId: string;
  quantityAllocated: number;
  quantityCommitted: number;
  quantityReleased: number;
  status: "HELD";
  createdAt: Date;
  updatedAt: Date;
};

type AllocationPlanInput = {
  vendorId: string;
  packId: string;
  prizes: PackPrizeInventoryInput[];
  inventoryItems: VendorInventoryItemInput[];
  now: Date;
};

type ExistingAllocationRow = {
  id: string;
  vendorId?: string;
  packId?: string;
  packPrizeId: string;
  vendorInventoryItemId: string;
  quantityAllocated: number;
  quantityCommitted?: number;
  quantityReleased?: number;
  status: "HELD" | "COMMITTED" | "RELEASED";
};

type InventoryTransactionClient = {
  vendorInventoryItem: {
    findMany(args: unknown): Promise<VendorInventoryItemInput[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  packPrizeInventoryAllocation: {
    findMany(args: unknown): Promise<ExistingAllocationRow[]>;
    createMany(args: { data: PackPrizeInventoryAllocationPlanRow[] }): Promise<{ count: number }>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
};

function matchesPrize(item: VendorInventoryItemInput, prize: PackPrizeInventoryInput) {
  if (prize.catalogItemId) return item.catalogItemId === prize.catalogItemId;
  return item.title.trim().toLowerCase() === prize.label.trim().toLowerCase();
}

function allocatableQuantity(item: VendorInventoryItemInput, plannedByInventoryId: Map<string, number>) {
  return Math.max(0, item.quantityTotal - item.quantityHeld - item.quantitySold - (plannedByInventoryId.get(item.id) ?? 0));
}

export function buildPackPrizeInventoryAllocationPlan({
  vendorId,
  packId,
  prizes,
  inventoryItems,
  now,
}: AllocationPlanInput): PackPrizeInventoryAllocationPlanRow[] {
  const plannedByInventoryId = new Map<string, number>();
  const rows: PackPrizeInventoryAllocationPlanRow[] = [];

  for (const prize of prizes.filter((row) => row.stock > 0)) {
    const matchingItems = inventoryItems.filter((item) => matchesPrize(item, prize));
    const sameVendorItems = matchingItems.filter((item) => item.vendorId === vendorId);
    if (sameVendorItems.length === 0 && matchingItems.some((item) => item.vendorId !== vendorId)) {
      throw new PackInventoryAllocationError(
        "cross_vendor_inventory",
        `Inventory for prize ${prize.id} belongs to a different vendor`
      );
    }

    const candidates = sameVendorItems
      .filter((item) => item.status === "ACTIVE")
      .sort((left, right) => left.id.localeCompare(right.id));

    let remainingToAllocate = prize.stock;
    for (const item of candidates) {
      const quantityAllocated = Math.min(remainingToAllocate, allocatableQuantity(item, plannedByInventoryId));
      if (quantityAllocated <= 0) continue;

      rows.push({
        vendorId,
        packId,
        packPrizeId: prize.id,
        vendorInventoryItemId: item.id,
        quantityAllocated,
        quantityCommitted: 0,
        quantityReleased: 0,
        status: "HELD",
        createdAt: now,
        updatedAt: now,
      });
      plannedByInventoryId.set(item.id, (plannedByInventoryId.get(item.id) ?? 0) + quantityAllocated);
      remainingToAllocate -= quantityAllocated;
      if (remainingToAllocate === 0) break;
    }

    if (remainingToAllocate > 0) {
      throw new PackInventoryAllocationError(
        "insufficient_inventory",
        `Prize ${prize.id} needs ${prize.stock} physical units but only ${prize.stock - remainingToAllocate} are allocatable`
      );
    }
  }

  return rows;
}

function remainingHeldQuantity(allocation: ExistingAllocationRow) {
  return Math.max(
    0,
    allocation.quantityAllocated - (allocation.quantityCommitted ?? 0) - (allocation.quantityReleased ?? 0)
  );
}

export async function commitInventoryAllocationForPrizeDraw(
  tx: InventoryTransactionClient,
  input: { vendorId: string; packId: string; packPrizeId: string; inventoryMode?: string | null }
) {
  const allocations = await tx.packPrizeInventoryAllocation.findMany({
    where: {
      vendorId: input.vendorId,
      packId: input.packId,
      packPrizeId: input.packPrizeId,
      status: "HELD",
    },
    orderBy: { createdAt: "asc" },
  });
  const allocation = allocations.find((row) => remainingHeldQuantity(row) > 0);
  if (!allocation) {
    if (requiresPhysicalInventoryAllocation(input.inventoryMode)) {
      throw new PackInventoryAllocationError(
        "missing_required_allocation",
        `Physical pack ${input.packId} cannot draw prize ${input.packPrizeId} without held inventory allocation proof`
      );
    }
    return null;
  }

  const inventoryResult = await tx.vendorInventoryItem.updateMany({
    where: {
      id: allocation.vendorInventoryItemId,
      vendorId: input.vendorId,
      quantityHeld: { gte: 1 },
    },
    data: {
      quantityHeld: { decrement: 1 },
      quantitySold: { increment: 1 },
    },
  });
  if (inventoryResult.count !== 1) {
    throw new PackInventoryAllocationError(
      "concurrent_inventory_conflict",
      `Inventory item ${allocation.vendorInventoryItemId} no longer has held quantity to commit`
    );
  }

  const nextCommitted = (allocation.quantityCommitted ?? 0) + 1;
  const nextReleased = allocation.quantityReleased ?? 0;
  const fullyConsumed = nextCommitted + nextReleased >= allocation.quantityAllocated;
  const allocationResult = await tx.packPrizeInventoryAllocation.updateMany({
    where: {
      id: allocation.id,
      status: "HELD",
      quantityCommitted: allocation.quantityCommitted ?? 0,
      quantityReleased: allocation.quantityReleased ?? 0,
    },
    data: {
      quantityCommitted: { increment: 1 },
      ...(fullyConsumed ? { status: "COMMITTED" } : {}),
    },
  });
  if (allocationResult.count !== 1) {
    throw new PackInventoryAllocationError(
      "concurrent_inventory_conflict",
      `Allocation ${allocation.id} changed while committing inventory`
    );
  }

  return allocation;
}

export async function releaseHeldInventoryForPack(
  tx: InventoryTransactionClient,
  input: { vendorId: string; packId: string }
) {
  const allocations = await tx.packPrizeInventoryAllocation.findMany({
    where: { vendorId: input.vendorId, packId: input.packId, status: "HELD" },
    orderBy: { createdAt: "asc" },
  });

  for (const allocation of allocations) {
    const quantityToRelease = remainingHeldQuantity(allocation);
    if (quantityToRelease <= 0) continue;

    const inventoryResult = await tx.vendorInventoryItem.updateMany({
      where: {
        id: allocation.vendorInventoryItemId,
        vendorId: input.vendorId,
        quantityHeld: { gte: quantityToRelease },
      },
      data: { quantityHeld: { decrement: quantityToRelease } },
    });
    if (inventoryResult.count !== 1) {
      throw new PackInventoryAllocationError(
        "concurrent_inventory_conflict",
        `Inventory item ${allocation.vendorInventoryItemId} no longer has held quantity to release`
      );
    }

    const allocationResult = await tx.packPrizeInventoryAllocation.updateMany({
      where: {
        id: allocation.id,
        status: "HELD",
        quantityCommitted: allocation.quantityCommitted ?? 0,
        quantityReleased: allocation.quantityReleased ?? 0,
      },
      data: {
        quantityReleased: { increment: quantityToRelease },
        status: "RELEASED",
      },
    });
    if (allocationResult.count !== 1) {
      throw new PackInventoryAllocationError(
        "concurrent_inventory_conflict",
        `Allocation ${allocation.id} changed while releasing inventory`
      );
    }
  }

  return allocations;
}

export function packInventoryAllocationErrorResponse(reason: InventoryAllocationFailureReason) {
  if (reason === "cross_vendor_inventory") {
    return {
      error: "Pack inventory allocation rejected",
      message: "Pack prizes cannot reserve inventory owned by another vendor.",
    };
  }
  if (reason === "insufficient_inventory") {
    return {
      error: "Pack inventory allocation rejected",
      message: "Physical paid packs cannot be published without enough allocatable vendor inventory.",
    };
  }
  if (reason === "missing_required_allocation") {
    return {
      error: "Pack inventory allocation rejected",
      message: "Physical pack draw cannot complete without held inventory allocation proof.",
    };
  }
  return {
    error: "Pack inventory allocation rejected",
    message: "Inventory changed during publish. Retry after refreshing the pack inventory allocation.",
  };
}

export async function reserveInventoryForPackPublish(
  tx: InventoryTransactionClient,
  input: {
    vendorId: string;
    packId: string;
    prizes: PackPrizeInventoryInput[];
    now: Date;
  }
) {
  const existingAllocations = await tx.packPrizeInventoryAllocation.findMany({
    where: { packId: input.packId, status: { in: ["HELD", "COMMITTED"] } },
  });
  if (existingAllocations.length > 0) {
    const allocatedByPrizeId = existingAllocations.reduce((acc, row) => {
      acc.set(row.packPrizeId, (acc.get(row.packPrizeId) ?? 0) + row.quantityAllocated);
      return acc;
    }, new Map<string, number>());
    const alreadyCoversPool = input.prizes
      .filter((row) => row.stock > 0)
      .every((prize) => (allocatedByPrizeId.get(prize.id) ?? 0) >= prize.stock);
    if (alreadyCoversPool) return [];
    throw new PackInventoryAllocationError(
      "partial_existing_allocation",
      `Pack ${input.packId} has partial existing inventory allocation rows`
    );
  }

  const catalogItemIds = input.prizes.map((row) => row.catalogItemId).filter((id): id is string => Boolean(id));
  const labelsWithoutCatalogRef = input.prizes
    .filter((row) => !row.catalogItemId)
    .map((row) => row.label)
    .filter((label) => label.trim().length > 0);
  const inventoryItems = await tx.vendorInventoryItem.findMany({
    where: {
      vendorId: input.vendorId,
      OR: [
        ...(catalogItemIds.length > 0 ? [{ catalogItemId: { in: catalogItemIds } }] : []),
        ...labelsWithoutCatalogRef.map((label) => ({ title: { equals: label, mode: "insensitive" as const } })),
      ],
    },
  });

  const plan = buildPackPrizeInventoryAllocationPlan({ ...input, inventoryItems });

  for (const allocation of plan) {
    const inventoryItem = inventoryItems.find((item) => item.id === allocation.vendorInventoryItemId);
    if (!inventoryItem) {
      throw new PackInventoryAllocationError(
        "concurrent_inventory_conflict",
        `Inventory item ${allocation.vendorInventoryItemId} disappeared during publish`
      );
    }
    const minTotalAfterHold = inventoryItem.quantityHeld + inventoryItem.quantitySold + allocation.quantityAllocated;
    const result = await tx.vendorInventoryItem.updateMany({
      where: {
        id: allocation.vendorInventoryItemId,
        vendorId: input.vendorId,
        status: "ACTIVE",
        quantityHeld: inventoryItem.quantityHeld,
        quantitySold: inventoryItem.quantitySold,
        quantityTotal: { gte: minTotalAfterHold },
      },
      data: { quantityHeld: { increment: allocation.quantityAllocated } },
    });
    if (result.count !== 1) {
      throw new PackInventoryAllocationError(
        "concurrent_inventory_conflict",
        `Inventory item ${allocation.vendorInventoryItemId} no longer has enough allocatable quantity`
      );
    }
  }

  if (plan.length > 0) {
    await tx.packPrizeInventoryAllocation.createMany({ data: plan });
  }

  return plan;
}
