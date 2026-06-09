"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { apiBaseUrl, apiFetch, ensureCsrfCookie } from "../../../lib/api";

type CustodyRequestStatus =
  | "PENDING"
  | "OPS_REVIEW"
  | "APPROVED"
  | "PACKED"
  | "FULFILLED_MANUAL"
  | "CREDITED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "EXPIRED";

type FilterStatus = "ALL" | CustodyRequestStatus;
type CustodyRequestType = "REDEMPTION" | "BUYBACK";
type ActionStatus =
  | "OPS_REVIEW"
  | "APPROVED"
  | "PACKED"
  | "FULFILLED_MANUAL"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

type OpsCustomer = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
};

type OpsQuote = {
  amount?: number | null;
  currency?: string | null;
  buybackPercent?: number | null;
  policyVersion?: string | null;
  valueSource?: string | null;
  valueAsOf?: string | null;
  expiresAt?: string | null;
  creditedAt?: string | null;
  walletEntryId?: string | null;
};

type OpsItem = {
  id?: string | null;
  status?: string | null;
  provider?: string | null;
  prizeLabel?: string | null;
  setName?: string | null;
  cardName?: string | null;
  rarity?: string | null;
  estimatedValue?: number | null;
  imageUrl?: string | null;
  imageLargeUrl?: string | null;
  createdAt?: string | null;
};

type OpsCustodyRequest = {
  id: string;
  type: CustodyRequestType;
  status: CustodyRequestStatus;
  customerNote?: string | null;
  opsNote?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  completedAt?: string | null;
  customer?: OpsCustomer | null;
  quote?: OpsQuote | null;
  item?: OpsItem | null;
};

type Feedback = {
  kind: "success" | "error";
  message: string;
};

const clientPageHeader = { "x-client-page": "/ops/custody" };
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const filterOptions: FilterStatus[] = [
  "ALL",
  "PENDING",
  "OPS_REVIEW",
  "APPROVED",
  "PACKED",
  "FULFILLED_MANUAL",
  "CREDITED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
  "EXPIRED",
];
const actionOptions: ActionStatus[] = ["OPS_REVIEW", "APPROVED", "PACKED", "FULFILLED_MANUAL", "REJECTED", "CANCELLED", "COMPLETED"];
const terminalStatuses = new Set<CustodyRequestStatus>(["REJECTED", "CANCELLED", "COMPLETED", "FULFILLED_MANUAL", "CREDITED", "EXPIRED"]);

function isLocalhostLike(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "demo.localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.startsWith("127.0.0.1") ||
    normalized.startsWith("0.0.0.0")
  );
}

function currentVendorHost() {
  if (typeof window !== "undefined" && window.location.host) {
    const host = window.location.host.toLowerCase();
    return isLocalhostLike(host) ? configuredVendorHost || "demo.localhost" : host;
  }
  return configuredVendorHost || "demo.localhost";
}

function statusLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value.replaceAll("_", " ").toLowerCase();
}

function formatTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not recorded";
}

function formatAmount(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null) return "Pending";
  return `${amount.toLocaleString()} ${currency?.trim() || "POINTS"}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "Not set";
  return `${value}%`;
}

function displayValue(value: string | number | null | undefined) {
  if (value == null || value === "") return "Not provided";
  return String(value);
}

function defaultActionStatus(request: OpsCustodyRequest): ActionStatus {
  switch (request.status) {
    case "PENDING":
      return request.type === "BUYBACK" ? "APPROVED" : "OPS_REVIEW";
    case "OPS_REVIEW":
      return "APPROVED";
    case "APPROVED":
      return "PACKED";
    case "PACKED":
      return "FULFILLED_MANUAL";
    default:
      return "OPS_REVIEW";
  }
}

function allowedActionStatuses(request: OpsCustodyRequest) {
  if (terminalStatuses.has(request.status)) return [];
  if (request.type === "BUYBACK") {
    if (request.status === "PENDING") return ["APPROVED", "REJECTED", "CANCELLED"] satisfies ActionStatus[];
    return [];
  }
  if (request.status === "PENDING") return ["OPS_REVIEW", "REJECTED", "CANCELLED"] satisfies ActionStatus[];
  if (request.status === "OPS_REVIEW") return ["APPROVED", "REJECTED", "CANCELLED"] satisfies ActionStatus[];
  if (request.status === "APPROVED") return ["PACKED", "CANCELLED"] satisfies ActionStatus[];
  if (request.status === "PACKED") return ["FULFILLED_MANUAL"] satisfies ActionStatus[];
  return [];
}

export default function OpsCustodyPage() {
  const vendorHost = useMemo(() => currentVendorHost(), []);
  const headers = useMemo(() => ({ ...clientPageHeader, "x-vendor-host": vendorHost }), [vendorHost]);

  const [filter, setFilter] = useState<FilterStatus>("PENDING");
  const [requests, setRequests] = useState<OpsCustodyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackById, setFeedbackById] = useState<Record<string, Feedback>>({});
  const [actionStatusById, setActionStatusById] = useState<Record<string, ActionStatus>>({});
  const [opsNoteById, setOpsNoteById] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadRequests = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError(null);

    try {
      const url = new URL("/v1/ops/custody-requests", apiBaseUrl);
      url.searchParams.set("status", filter);
      const response = await apiFetch(url, {
        credentials: "include",
        cache: "no-store",
        headers,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error("Sign in with an authorized vendor account to view the custody queue.");
      if (response.status === 403) throw new Error("Your account does not have permission to manage custody requests for this vendor.");
      if (!response.ok) throw new Error(payload.error ?? "Failed to load custody requests");

      const nextRequests = Array.isArray(payload.requests) ? (payload.requests as OpsCustodyRequest[]) : [];
      setRequests(nextRequests);
      setActionStatusById((current) => {
        const next = { ...current };
        for (const request of nextRequests) {
          next[request.id] = current[request.id] ?? defaultActionStatus(request);
        }
        return next;
      });
      setOpsNoteById((current) => {
        const next = { ...current };
        for (const request of nextRequests) {
          if (next[request.id] == null) next[request.id] = request.opsNote ?? "";
        }
        return next;
      });
    } catch (err) {
      setRequests([]);
      setError(err instanceof Error ? err.message : "Failed to load custody requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, headers]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function submitTransition(request: OpsCustodyRequest) {
    const nextStatus = actionStatusById[request.id] ?? defaultActionStatus(request);
    const opsNote = (opsNoteById[request.id] ?? "").trim();

    setSubmittingId(request.id);
    setFeedbackById((current) => {
      const next = { ...current };
      delete next[request.id];
      return next;
    });

    try {
      await ensureCsrfCookie();
      const response = await apiFetch(`${apiBaseUrl}/v1/ops/custody-requests/${request.id}`, {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
          opsNote: opsNote || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error("Sign in with an authorized vendor account to update custody requests.");
      if (response.status === 403) throw new Error("Your account does not have permission to update custody requests for this vendor.");
      if (!response.ok) throw new Error(payload.error ?? "Failed to update custody request");

      const updated = payload.request as OpsCustodyRequest | undefined;
      setRequests((current) => current.map((entry) => (entry.id === request.id ? updated ?? entry : entry)));
      if (updated) {
        setActionStatusById((current) => ({ ...current, [request.id]: defaultActionStatus(updated) }));
        setOpsNoteById((current) => ({ ...current, [request.id]: updated.opsNote ?? opsNote }));
      }
      const finalStatus = updated?.status ?? nextStatus;
      const buybackCredited = request.type === "BUYBACK" && nextStatus === "APPROVED" && finalStatus === "CREDITED";
      setFeedbackById((current) => ({
        ...current,
        [request.id]: {
          kind: "success",
          message: buybackCredited
            ? "Buyback approved and credited. Backend returned CREDITED, which is expected for approved buybacks."
            : `Request updated to ${statusLabel(finalStatus)}.`,
        },
      }));
    } catch (err) {
      setFeedbackById((current) => ({
        ...current,
        [request.id]: {
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to update custody request",
        },
      }));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <header style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Ops queue</p>
            <h1 style={headingStyle}>Custody fulfillment</h1>
            <p style={subtleTextStyle}>
              Review redemption and buyback requests, record ops notes, and move eligible requests through the custody workflow.
            </p>
            <p style={{ ...subtleTextStyle, marginTop: 10 }}>
              Approved buybacks may return <strong>CREDITED</strong> immediately when the backend applies the wallet credit.
            </p>
          </div>
          <Link href="/vendor" style={linkStyle}>
            Back to vendor
          </Link>
        </header>

        <section style={toolbarStyle}>
          <label style={fieldLabelStyle}>
            Status filter
            <select value={filter} onChange={(event) => setFilter(event.target.value as FilterStatus)} style={inputStyle}>
              {filterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All statuses" : statusLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" style={buttonStyle} onClick={() => void loadRequests("refresh")} disabled={refreshing || loading}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </section>

        {loading ? <section style={panelStyle}><p style={mutedStyle}>Loading custody queue...</p></section> : null}
        {error ? <section style={errorPanelStyle}><p style={{ margin: 0 }}>{error}</p></section> : null}
        {!loading && !error && requests.length === 0 ? (
          <section style={panelStyle}>
            <p style={mutedStyle}>No custody requests matched this filter.</p>
          </section>
        ) : null}

        {!loading && !error && requests.length > 0 ? (
          <div style={listStyle}>
            {requests.map((request) => {
              const allowedStatuses = allowedActionStatuses(request);
              const terminal = terminalStatuses.has(request.status);
              const feedback = feedbackById[request.id];
              const selectedStatus = actionStatusById[request.id] ?? defaultActionStatus(request);
              const opsNote = opsNoteById[request.id] ?? "";
              const quote = request.quote;
              const item = request.item;
              const customer = request.customer;

              return (
                <article key={request.id} style={cardStyle}>
                  <div style={cardHeaderStyle}>
                    <div>
                      <p style={requestTypeStyle}>{request.type === "BUYBACK" ? "Buyback request" : "Redemption request"}</p>
                      <h2 style={cardTitleStyle}>{request.id}</h2>
                    </div>
                    <span style={statusPillStyle}>{statusLabel(request.status)}</span>
                  </div>

                  <div style={detailGridStyle}>
                    <InfoRow label="Requested" value={formatTime(request.requestedAt)} />
                    <InfoRow label="Reviewed" value={formatTime(request.reviewedAt)} />
                    <InfoRow label="Completed" value={formatTime(request.completedAt)} />
                    <InfoRow label="Customer" value={customer?.name || customer?.email || customer?.id || "Not provided"} />
                    <InfoRow label="Customer id" value={displayValue(customer?.id)} />
                    <InfoRow label="Customer email" value={customer?.email || "Not provided"} />
                    <InfoRow label="Item status" value={statusLabel(item?.status)} />
                    <InfoRow label="Prize" value={item?.prizeLabel || "Not provided"} />
                    <InfoRow label="Provider" value={displayValue(item?.provider)} />
                    <InfoRow label="Set" value={item?.setName || "Not provided"} />
                    <InfoRow label="Card" value={item?.cardName || "Not provided"} />
                    <InfoRow label="Rarity" value={item?.rarity || "Not provided"} />
                    <InfoRow label="Estimated value" value={item?.estimatedValue == null ? "Not provided" : item.estimatedValue.toLocaleString()} />
                    <InfoRow label="Quote" value={formatAmount(quote?.amount, quote?.currency)} />
                    <InfoRow label="Buyback percent" value={formatPercent(quote?.buybackPercent)} />
                    <InfoRow label="Value source" value={displayValue(quote?.valueSource)} />
                    <InfoRow label="Value as of" value={formatTime(quote?.valueAsOf)} />
                    <InfoRow label="Quote expiry" value={formatTime(quote?.expiresAt)} />
                    <InfoRow label="Credited at" value={formatTime(quote?.creditedAt)} />
                    <InfoRow label="Wallet entry" value={displayValue(quote?.walletEntryId)} />
                    <InfoRow label="Policy version" value={displayValue(quote?.policyVersion)} />
                    <InfoRow label="Item id" value={displayValue(item?.id)} />
                  </div>

                  <div style={notesGridStyle}>
                    <div style={noteBlockStyle}>
                      <strong style={noteLabelStyle}>Customer note</strong>
                      <p style={noteBodyStyle}>{request.customerNote?.trim() || "No customer note provided."}</p>
                    </div>
                    <div style={noteBlockStyle}>
                      <strong style={noteLabelStyle}>Existing ops note</strong>
                      <p style={noteBodyStyle}>{request.opsNote?.trim() || "No ops note recorded yet."}</p>
                    </div>
                  </div>

                  {item?.imageUrl || item?.imageLargeUrl ? (
                    <div style={noteBlockStyle}>
                      <strong style={noteLabelStyle}>Item image</strong>
                      <div style={imageRowStyle}>
                        <img
                          src={item.imageLargeUrl || item.imageUrl || ""}
                          alt={item.prizeLabel || item.cardName || "Custody item"}
                          style={imageStyle}
                        />
                        <div style={{ display: "grid", gap: 8 }}>
                          <span style={mutedStyle}>Preview uses the serialized item image if available.</span>
                          {item.imageUrl ? (
                            <a href={item.imageUrl} target="_blank" rel="noreferrer" style={anchorStyle}>
                              Open image URL
                            </a>
                          ) : null}
                          {item.imageLargeUrl ? (
                            <a href={item.imageLargeUrl} target="_blank" rel="noreferrer" style={anchorStyle}>
                              Open large image
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div style={actionPanelStyle}>
                    <div style={actionHeaderStyle}>
                      <div>
                        <h3 style={actionTitleStyle}>Transition request</h3>
                        <p style={actionCopyStyle}>
                          {terminal
                            ? "Terminal requests are locked and cannot be changed from the UI."
                            : "Submit a supported status transition with an ops note. Backend validation remains the source of truth."}
                        </p>
                      </div>
                    </div>

                    <div style={actionFormGridStyle}>
                      <label style={fieldLabelStyle}>
                        Next status
                        <select
                          value={selectedStatus}
                          onChange={(event) => setActionStatusById((current) => ({ ...current, [request.id]: event.target.value as ActionStatus }))}
                          style={inputStyle}
                          disabled={terminal || allowedStatuses.length === 0 || submittingId === request.id}
                        >
                          {(allowedStatuses.length > 0 ? allowedStatuses : actionOptions).map((option) => (
                            <option key={option} value={option}>
                              {statusLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={fieldLabelStyle}>
                        Ops note
                        <textarea
                          value={opsNote}
                          onChange={(event) => setOpsNoteById((current) => ({ ...current, [request.id]: event.target.value }))}
                          style={textareaStyle}
                          disabled={terminal || submittingId === request.id}
                          placeholder="Record packaging, approval, rejection, or fulfillment context."
                          rows={4}
                        />
                      </label>
                    </div>

                    {request.type === "BUYBACK" ? (
                      <p style={hintStyle}>
                        Buyback approvals can return <strong>CREDITED</strong> instead of <strong>APPROVED</strong> after the backend applies the wallet credit.
                      </p>
                    ) : null}
                    {feedback ? (
                      <p style={feedback.kind === "error" ? inlineErrorStyle : inlineSuccessStyle}>{feedback.message}</p>
                    ) : null}

                    <button
                      type="button"
                      style={terminal ? disabledButtonStyle : buttonStyle}
                      disabled={terminal || allowedStatuses.length === 0 || submittingId === request.id}
                      onClick={() => void submitTransition(request)}
                    >
                      {submittingId === request.id ? "Saving..." : "Apply transition"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRowStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{value}</strong>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background:
    "radial-gradient(circle at top, rgba(29,78,216,0.16), transparent 28%), linear-gradient(180deg, #07111f 0%, #091525 46%, #0d1726 100%)",
  color: "#e5eefb",
  padding: "32px 16px 64px",
};

const shellStyle: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  display: "grid",
  gap: 20,
};

const heroStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 24,
  padding: 24,
  background: "rgba(8,15,30,0.88)",
  boxShadow: "0 28px 60px rgba(2,6,23,0.35)",
};

const eyebrowStyle: CSSProperties = {
  margin: "0 0 8px",
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  fontSize: 12,
  color: "#7dd3fc",
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(2rem, 4vw, 3rem)",
  lineHeight: 1,
};

const subtleTextStyle: CSSProperties = {
  margin: "12px 0 0",
  maxWidth: 760,
  color: "#bfd0e8",
  lineHeight: 1.6,
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 20,
  padding: 20,
  background: "rgba(8,15,30,0.8)",
};

const panelStyle: CSSProperties = {
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 20,
  padding: 24,
  background: "rgba(8,15,30,0.76)",
};

const errorPanelStyle: CSSProperties = {
  ...panelStyle,
  border: "1px solid rgba(248,113,113,0.45)",
  background: "rgba(69,10,10,0.45)",
  color: "#fecaca",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 18,
};

const cardStyle: CSSProperties = {
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 24,
  padding: 24,
  background: "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(8,15,30,0.92) 100%)",
  boxShadow: "0 20px 44px rgba(2,6,23,0.28)",
  display: "grid",
  gap: 18,
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const requestTypeStyle: CSSProperties = {
  margin: "0 0 6px",
  color: "#7dd3fc",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontSize: 12,
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  lineHeight: 1.1,
  wordBreak: "break-word",
};

const statusPillStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(125,211,252,0.35)",
  background: "rgba(14,116,144,0.14)",
  color: "#bae6fd",
  textTransform: "capitalize",
  whiteSpace: "nowrap",
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const infoRowStyle: CSSProperties = {
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 16,
  padding: "12px 14px",
  background: "rgba(15,23,42,0.55)",
};

const infoLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#93a9c8",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const infoValueStyle: CSSProperties = {
  display: "block",
  color: "#f8fbff",
  fontSize: 14,
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const notesGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const noteBlockStyle: CSSProperties = {
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 16,
  padding: 16,
  background: "rgba(15,23,42,0.55)",
};

const noteLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#bfdbfe",
  fontSize: 13,
};

const noteBodyStyle: CSSProperties = {
  margin: 0,
  color: "#d7e4f6",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const actionPanelStyle: CSSProperties = {
  border: "1px solid rgba(56,189,248,0.2)",
  borderRadius: 18,
  padding: 18,
  background: "rgba(8,47,73,0.14)",
  display: "grid",
  gap: 14,
};

const actionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const actionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
};

const actionCopyStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#bfd0e8",
  lineHeight: 1.6,
};

const actionFormGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const fieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  color: "#d7e4f6",
  fontSize: 14,
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.3)",
  background: "rgba(15,23,42,0.92)",
  color: "#f8fbff",
  padding: "12px 14px",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 108,
  font: "inherit",
};

const buttonStyle: CSSProperties = {
  border: "1px solid rgba(56,189,248,0.3)",
  borderRadius: 999,
  background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
  color: "#f8fbff",
  padding: "12px 18px",
  fontWeight: 600,
  cursor: "pointer",
  minWidth: 148,
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.5,
  cursor: "not-allowed",
};

const linkStyle: CSSProperties = {
  color: "#e0f2fe",
  textDecoration: "none",
  border: "1px solid rgba(148,163,184,0.24)",
  borderRadius: 999,
  padding: "10px 14px",
  whiteSpace: "nowrap",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "#bfd0e8",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "#bae6fd",
  lineHeight: 1.6,
};

const inlineErrorStyle: CSSProperties = {
  margin: 0,
  color: "#fecaca",
};

const inlineSuccessStyle: CSSProperties = {
  margin: 0,
  color: "#bbf7d0",
};

const imageRowStyle: CSSProperties = {
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const imageStyle: CSSProperties = {
  width: 120,
  height: 168,
  objectFit: "cover",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,23,42,0.8)",
};

const anchorStyle: CSSProperties = {
  color: "#7dd3fc",
  textDecoration: "none",
};
