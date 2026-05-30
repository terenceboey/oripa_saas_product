type PackStatus = "DRAFT" | "LIVE" | "ARCHIVED";

type PackPrizeMutationPayload = Record<string, unknown> & {
  prizes?: unknown[];
  tiers?: unknown[];
};

export function hasPackPrizeMutation(payload: PackPrizeMutationPayload) {
  return Boolean((payload.prizes && payload.prizes.length > 0) || (payload.tiers && payload.tiers.length > 0));
}

export function shouldRejectPackPrizeMutation(status: PackStatus, payload: PackPrizeMutationPayload) {
  return status !== "DRAFT" && hasPackPrizeMutation(payload);
}

export function packPrizeMutationErrorResponse(status: Exclude<PackStatus, "DRAFT"> | PackStatus) {
  return {
    error: "Pack prize pool is immutable after publish",
    message: `This pack is ${status}, so its prize pool can no longer be edited. Archive it and create a new draft pack to change prizes.`,
  };
}
