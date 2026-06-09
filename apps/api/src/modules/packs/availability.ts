import type { PackStatus } from "@prisma/client";

export type PackAvailabilityStatus =
  | "open"
  | "closed"
  | "sold_out"
  | "disabled"
  | "not_started"
  | "ended"
  | "policy_blocked";

export type PackAvailabilityReasonCode =
  | "available"
  | "not_authenticated"
  | "profile_incomplete"
  | "insufficient_balance"
  | "paused"
  | "out_of_stock"
  | "not_started"
  | "ended"
  | "policy_missing"
  | "value_stale"
  | "physical_inventory_missing"
  | "emergency_stop";

export type PackAvailabilityPack = {
  id: string;
  isActive: boolean;
  status: PackStatus | "DRAFT" | "LIVE" | "ARCHIVED";
  pricePoints: number;
  remainingStock: number;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  poolSnapshotHash?: string | null;
};

export type PackAvailabilityInput = {
  pack: PackAvailabilityPack;
  now?: Date;
  quantity?: number;
  isAuthenticated?: boolean;
  walletBalancePoints?: number | null;
  profileComplete?: boolean;
  requireFrozenPoolHash?: boolean;
  physicalInventoryMissing?: boolean;
  valueStale?: boolean;
  emergencyStopped?: boolean;
};

export type PackAvailability = {
  visible: boolean;
  openable: boolean;
  status: PackAvailabilityStatus;
  reasonCode: PackAvailabilityReasonCode;
  errorMessage: string | null;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function closed(
  status: PackAvailabilityStatus,
  reasonCode: PackAvailabilityReasonCode,
  errorMessage: string,
  visible = true
): PackAvailability {
  return { visible, openable: false, status, reasonCode, errorMessage };
}

export function evaluatePackAvailability(input: PackAvailabilityInput): PackAvailability {
  const now = input.now ?? new Date();
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const { pack } = input;

  if (!pack.isActive || pack.status === "DRAFT" || pack.status === "ARCHIVED") {
    return closed("disabled", "paused", "Pack is not open", false);
  }

  if (input.emergencyStopped) {
    return closed("policy_blocked", "emergency_stop", "Pack opening is temporarily paused");
  }

  if (pack.status !== "LIVE") {
    return closed("disabled", "paused", "Pack is not open", false);
  }

  const startsAt = asDate(pack.startsAt);
  if (startsAt && startsAt > now) {
    return closed("not_started", "not_started", "Pack is not open yet");
  }

  const endsAt = asDate(pack.endsAt);
  if (endsAt && endsAt <= now) {
    return closed("ended", "ended", "Pack has ended");
  }

  if (pack.remainingStock < quantity) {
    return closed("sold_out", "out_of_stock", "Pack is sold out");
  }

  if (input.requireFrozenPoolHash !== false && !pack.poolSnapshotHash) {
    return closed("policy_blocked", "policy_missing", "Pack policy is incomplete");
  }

  if (input.physicalInventoryMissing) {
    return closed("policy_blocked", "physical_inventory_missing", "Physical inventory proof is missing");
  }

  if (input.valueStale) {
    return closed("policy_blocked", "value_stale", "Pack value policy is stale");
  }

  if (input.isAuthenticated === false) {
    return closed("closed", "not_authenticated", "Authentication is required to open this pack");
  }

  if (input.profileComplete === false) {
    return closed("closed", "profile_incomplete", "Profile is incomplete");
  }

  if (typeof input.walletBalancePoints === "number" && input.walletBalancePoints < pack.pricePoints * quantity) {
    return closed("closed", "insufficient_balance", "Insufficient balance");
  }

  return { visible: true, openable: true, status: "open", reasonCode: "available", errorMessage: null };
}

export function packAvailabilityErrorResponse(availability: PackAvailability) {
  return {
    error: availability.errorMessage ?? "Pack is not available",
    availability,
  };
}
