type CustodyRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
type CustodyRequestType = "REDEMPTION" | "BUYBACK";
type CustodyItemStatus = "HELD" | "REDEMPTION_REQUESTED" | "BUYBACK_REQUESTED" | "REDEEMED" | "BOUGHT_BACK" | "VOIDED";
type CustodyProvider = "ORIPA_INTERNAL" | "COLLECTOR_CRYPT" | "PHYGITALS";

const PENDING_REQUEST_STATUSES = new Set<CustodyRequestStatus>(["PENDING", "APPROVED"]);
const OPS_UPDATABLE_STATUSES = new Set<CustodyRequestStatus>(["APPROVED", "REJECTED", "CANCELLED", "COMPLETED"]);

export const CUSTOMER_CUSTODY_FEATURE_FLAG = "CUSTOMER_CUSTODY_ENABLED";

export const CUSTOMER_PHASE2_ENDPOINTS = [
  "GET /v1/customer/summary",
  "GET /v1/customer/items",
  "GET /v1/customer/draws",
  "POST /v1/customer/items/:id/redemption-requests",
  "POST /v1/customer/items/:id/buyback-requests",
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
  if (status === "COMPLETED") return type === "REDEMPTION" ? "REDEEMED" : "BOUGHT_BACK";
  if (status === "REJECTED" || status === "CANCELLED") return "HELD";
  return type === "REDEMPTION" ? "REDEMPTION_REQUESTED" : "BUYBACK_REQUESTED";
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
};

export function serializeCustodyRequest(input: CustodyRequestInput): SerializedCustodyRequest {
  return {
    id: input.id,
    type: input.type,
    status: input.status,
    customerNote: input.customerNote,
    requestedAt: toIso(input.requestedAt),
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
