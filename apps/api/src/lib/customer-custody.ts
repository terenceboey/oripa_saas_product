type CustodyRequestStatus =
  | "QUOTED"
  | "PENDING"
  | "OPS_REVIEW"
  | "APPROVED"
  | "PACKED"
  | "FULFILLED_MANUAL"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "CREDITED"
  | "EXPIRED";
type CustodyRequestType = "REDEMPTION" | "BUYBACK";
type CustodyItemStatus = "HELD" | "REDEMPTION_REQUESTED" | "BUYBACK_REQUESTED" | "REDEEMED" | "BOUGHT_BACK" | "VOIDED";
type CustodyProvider = "ORIPA_INTERNAL" | "COLLECTOR_CRYPT" | "PHYGITALS";

const PENDING_REQUEST_STATUSES = new Set<CustodyRequestStatus>(["QUOTED", "PENDING", "OPS_REVIEW", "APPROVED", "PACKED"]);
const OPS_UPDATABLE_STATUSES = new Set<CustodyRequestStatus>(["OPS_REVIEW", "APPROVED", "PACKED", "FULFILLED_MANUAL", "REJECTED", "CANCELLED", "COMPLETED"]);

export const BUYBACK_POLICY_VERSION = "oripa-buyback-v1";
export const BUYBACK_VALUE_SOURCE = "ORIPA_INTERNAL_ESTIMATE";
export const BUYBACK_QUOTE_CURRENCY = "POINTS";
export const DEFAULT_BUYBACK_PERCENT = 70;
export const BUYBACK_QUOTE_TTL_MS = 15 * 60 * 1000;
export const BUYBACK_VALUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const CUSTOMER_CUSTODY_FEATURE_FLAG = "CUSTOMER_CUSTODY_ENABLED";

export const CUSTOMER_PHASE2_ENDPOINTS = [
  "GET /v1/customer/summary",
  "GET /v1/customer/items",
  "GET /v1/customer/draws",
  "POST /v1/customer/items/:id/redemption-requests",
  "POST /v1/customer/items/:id/buyback-quotes",
  "POST /v1/customer/buyback-quotes/:id/accept",
] as const;

export const OPS_CUSTODY_ENDPOINTS = [
  "GET /v1/ops/custody-requests",
  "PATCH /v1/ops/custody-requests/:id",
] as const;

export type SerializedCustodyRequest = {
  id: string;
  type: CustodyRequestType;
  status: CustodyRequestStatus;
  customerNote: string | null;
  requestedAt: string;
  quoteAmount: number | null;
  quoteCurrency: string | null;
  buybackPercent: number | null;
  policyVersion: string | null;
  valueSource: string | null;
  valueAsOf: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  creditedAt: string | null;
};

export type SerializedCustodyItem = {
  id: string;
  status: CustodyItemStatus;
  provider: CustodyProvider;
  prizeLabel: string;
  imageUrl: string | null;
  imageLargeUrl: string | null;
  setName: string | null;
  cardName: string | null;
  rarity: string | null;
  estimatedValue: number | null;
  createdAt: string;
  pendingRequest: SerializedCustodyRequest | null;
  requests: SerializedCustodyRequest[];
};

type CustodyItemInput = {
  id: string;
  status: CustodyItemStatus;
  provider: CustodyProvider;
  prizeLabel: string;
  imageUrl: string | null;
  imageLargeUrl: string | null;
  setName: string | null;
  cardName: string | null;
  rarity: string | null;
  estimatedValue: number | { toString(): string } | null;
  createdAt: Date | string;
  requests?: Array<{
    id: string;
    type: CustodyRequestType;
    status: CustodyRequestStatus;
    customerNote: string | null;
    requestedAt: Date | string;
    quoteAmount?: number | { toString(): string } | null;
    quoteCurrency?: string | null;
    buybackPercent?: number | null;
    policyVersion?: string | null;
    valueSource?: string | null;
    valueAsOf?: Date | string | null;
    expiresAt?: Date | string | null;
    acceptedAt?: Date | string | null;
    creditedAt?: Date | string | null;
  }>;
};

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumberOrNull(value: number | { toString(): string } | null | undefined) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export function normalizeCustomerRequestNote(input: unknown) {
  if (input == null) return null;
  if (typeof input !== "string") return null;
  const note = input.trim();
  if (!note) return null;
  if (note.length > 500) return null;
  return note;
}

export function isCustomerCustodyEnabled(env: Record<string, string | undefined>) {
  return String(env[CUSTOMER_CUSTODY_FEATURE_FLAG] ?? "").trim().toLowerCase() === "true";
}

export function nextCustodyItemStatusForRequest(type: CustodyRequestType, status: CustodyRequestStatus): CustodyItemStatus {
  if (status === "COMPLETED" || status === "FULFILLED_MANUAL") return type === "REDEMPTION" ? "REDEEMED" : "BOUGHT_BACK";
  if (status === "REJECTED" || status === "CANCELLED") return "HELD";
  if (status === "EXPIRED") return "HELD";
  if (status === "CREDITED") return "BOUGHT_BACK";
  return type === "REDEMPTION" ? "REDEMPTION_REQUESTED" : "BUYBACK_REQUESTED";
}

const VALID_CUSTODY_REQUEST_TRANSITIONS: Record<CustodyRequestType, Partial<Record<CustodyRequestStatus, CustodyRequestStatus[]>>> = {
  REDEMPTION: {
    PENDING: ["OPS_REVIEW", "REJECTED", "CANCELLED"],
    OPS_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["PACKED", "CANCELLED"],
    PACKED: ["FULFILLED_MANUAL"],
  },
  BUYBACK: {
    QUOTED: ["PENDING", "EXPIRED", "CANCELLED"],
    PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["CREDITED"],
  },
};

export function isValidCustodyRequestTransition(type: CustodyRequestType, fromStatus: CustodyRequestStatus, toStatus: CustodyRequestStatus) {
  if (fromStatus === toStatus) return true;
  return VALID_CUSTODY_REQUEST_TRANSITIONS[type]?.[fromStatus]?.includes(toStatus) ?? false;
}

export function terminalCustodyRequestStatuses() {
  return new Set<CustodyRequestStatus>(["REJECTED", "CANCELLED", "COMPLETED", "FULFILLED_MANUAL", "CREDITED", "EXPIRED"]);
}

export function normalizeIdempotencyKey(input: unknown) {
  if (typeof input !== "string") return null;
  const key = input.trim();
  if (!key || key.length > 128) return null;
  return key;
}

type BuybackQuoteItemInput = {
  id: string;
  status: CustodyItemStatus;
  estimatedValue: number | { toString(): string } | null;
  estimatedValueSource?: string | null;
  estimatedValueAsOf?: Date | string | null;
  requests?: Array<{ status: CustodyRequestStatus }>;
};

export function buildBuybackQuoteForCustodyItem(
  item: BuybackQuoteItemInput,
  options: { now?: Date; buybackPercent?: number; policyVersion?: string } = {},
):
  | { ok: true; quoteAmount: number; quoteCurrency: string; buybackPercent: number; policyVersion: string; valueSource: string; valueAsOf: Date; expiresAt: Date }
  | { ok: false; error: string; reasonCode: "ineligible" | "active_request" | "missing_value" | "stale_value" } {
  if (item.status !== "HELD") return { ok: false, error: "Custody item is not eligible for buyback", reasonCode: "ineligible" };
  if ((item.requests ?? []).some((request) => PENDING_REQUEST_STATUSES.has(request.status))) {
    return { ok: false, error: "Custody item already has an active request", reasonCode: "active_request" };
  }

  const estimatedValue = toNumberOrNull(item.estimatedValue);
  if (estimatedValue == null || estimatedValue <= 0) return { ok: false, error: "Custody item has no quoteable value", reasonCode: "missing_value" };
  if (!item.estimatedValueAsOf) return { ok: false, error: "Custody item value is stale", reasonCode: "stale_value" };

  const now = options.now ?? new Date();
  const valueAsOf = item.estimatedValueAsOf instanceof Date ? item.estimatedValueAsOf : new Date(item.estimatedValueAsOf);
  if (!Number.isFinite(valueAsOf.getTime()) || now.getTime() - valueAsOf.getTime() > BUYBACK_VALUE_MAX_AGE_MS || valueAsOf.getTime() > now.getTime() + 60_000) {
    return { ok: false, error: "Custody item value is stale", reasonCode: "stale_value" };
  }

  const buybackPercent = options.buybackPercent ?? DEFAULT_BUYBACK_PERCENT;
  const quoteAmount = Math.floor((estimatedValue * buybackPercent) / 100);
  if (quoteAmount <= 0) return { ok: false, error: "Custody item has no quoteable value", reasonCode: "missing_value" };

  return {
    ok: true,
    quoteAmount,
    quoteCurrency: BUYBACK_QUOTE_CURRENCY,
    buybackPercent,
    policyVersion: options.policyVersion ?? BUYBACK_POLICY_VERSION,
    valueSource: item.estimatedValueSource ?? BUYBACK_VALUE_SOURCE,
    valueAsOf,
    expiresAt: new Date(now.getTime() + BUYBACK_QUOTE_TTL_MS),
  };
}

export function isBuybackQuoteExpired(input: { expiresAt?: Date | string | null }, now = new Date()) {
  if (!input.expiresAt) return true;
  const expiresAt = input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
  return !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime();
}

export function normalizeOpsRequestStatusUpdate(input: unknown):
  | { status: CustodyRequestStatus; opsNote: string | null }
  | { error: string } {
  const body = input && typeof input === "object" ? input as { status?: unknown; opsNote?: unknown } : {};
  const status = typeof body.status === "string" ? body.status.trim().toUpperCase() as CustodyRequestStatus : "" as CustodyRequestStatus;
  if (!OPS_UPDATABLE_STATUSES.has(status)) return { error: "Unsupported custody request status" };
  if (body.opsNote == null) return { status, opsNote: null };
  if (typeof body.opsNote !== "string") return { error: "Ops note must be 1-1000 characters" };
  const opsNote = body.opsNote.trim();
  if (!opsNote || opsNote.length > 1000) return { error: "Ops note must be 1-1000 characters" };
  return { status, opsNote };
}

type CustodyRequestInput = {
  id: string;
  type: CustodyRequestType;
  status: CustodyRequestStatus;
  customerNote: string | null;
  requestedAt: Date | string;
  quoteAmount?: number | { toString(): string } | null;
  quoteCurrency?: string | null;
  buybackPercent?: number | null;
  policyVersion?: string | null;
  valueSource?: string | null;
  valueAsOf?: Date | string | null;
  expiresAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  creditedAt?: Date | string | null;
};

export function serializeCustodyRequest(input: CustodyRequestInput): SerializedCustodyRequest {
  return {
    id: input.id,
    type: input.type,
    status: input.status,
    customerNote: input.customerNote,
    requestedAt: toIso(input.requestedAt),
    quoteAmount: toNumberOrNull(input.quoteAmount),
    quoteCurrency: input.quoteCurrency ?? null,
    buybackPercent: input.buybackPercent ?? null,
    policyVersion: input.policyVersion ?? null,
    valueSource: input.valueSource ?? null,
    valueAsOf: input.valueAsOf ? toIso(input.valueAsOf) : null,
    expiresAt: input.expiresAt ? toIso(input.expiresAt) : null,
    acceptedAt: input.acceptedAt ? toIso(input.acceptedAt) : null,
    creditedAt: input.creditedAt ? toIso(input.creditedAt) : null,
  };
}

export function serializeCustodyItem(input: CustodyItemInput): SerializedCustodyItem {
  const requests = [...(input.requests ?? [])]
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    .map(serializeCustodyRequest);
  const pendingRequest = requests.find((request) => PENDING_REQUEST_STATUSES.has(request.status)) ?? null;
  return {
    id: input.id,
    status: input.status,
    provider: input.provider,
    prizeLabel: input.prizeLabel,
    imageUrl: input.imageUrl,
    imageLargeUrl: input.imageLargeUrl,
    setName: input.setName,
    cardName: input.cardName,
    rarity: input.rarity,
    estimatedValue: toNumberOrNull(input.estimatedValue),
    createdAt: toIso(input.createdAt),
    pendingRequest,
    requests,
  };
}

export function canRequestCustodyAction(item: Pick<SerializedCustodyItem, "status" | "pendingRequest">, _type: CustodyRequestType) {
  return item.status === "HELD" && item.pendingRequest == null;
}

type CustomerDrawInput = {
  id: string;
  packId: string;
  quantity: number;
  totalPoints: number;
  createdAt: Date | string;
  pack: { title: string; packBannerImageUrl: string | null };
  fairnessProof: { id: string; serverSeedHash: string } | null;
  results: Array<{
    id: string;
    drawSequence: number;
    pointsSpent: number;
    packPrize: { label: string; imageUrl: string | null; estimatedValue: number } | null;
    custodyItem: { id: string; status: CustodyItemStatus } | null;
  }>;
};

export function serializeCustomerDraw(input: CustomerDrawInput) {
  return {
    id: input.id,
    packId: input.packId,
    packTitle: input.pack.title,
    packImageUrl: input.pack.packBannerImageUrl,
    quantity: input.quantity,
    totalPoints: input.totalPoints,
    createdAt: toIso(input.createdAt),
    fairnessProofId: input.fairnessProof?.id ?? null,
    serverSeedHash: input.fairnessProof?.serverSeedHash ?? null,
    results: input.results.map((result) => ({
      id: result.id,
      drawSequence: result.drawSequence,
      pointsSpent: result.pointsSpent,
      prizeLabel: result.packPrize?.label ?? "Mystery prize",
      prizeImageUrl: result.packPrize?.imageUrl ?? null,
      estimatedValue: result.packPrize?.estimatedValue ?? null,
      custodyItemId: result.custodyItem?.id ?? null,
      custodyStatus: result.custodyItem?.status ?? null,
    })),
  };
}
