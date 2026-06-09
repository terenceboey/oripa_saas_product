"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useBackForwardRefresh } from "../../../lib/use-back-forward-refresh";
import { applyVendorFavicon } from "../../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../../lib/media-url";

type CustodyRequestType = "REDEMPTION" | "BUYBACK";
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
type CustodyItemStatus = "HELD" | "REDEMPTION_REQUESTED" | "BUYBACK_REQUESTED" | "REDEEMED" | "BOUGHT_BACK" | "VOIDED";

type CustodyRequest = {
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

type CustodyItem = {
  id: string;
  status: CustodyItemStatus;
  provider: string;
  prizeLabel: string;
  imageUrl: string | null;
  imageLargeUrl: string | null;
  setName: string | null;
  cardName: string | null;
  rarity: string | null;
  estimatedValue: number | null;
  createdAt: string;
  pendingRequest: CustodyRequest | null;
  requests: CustodyRequest[];
};

type VendorTheme = {
  storefrontPrimary: string;
  storefrontSecondary: string;
  storefrontAccent: string;
  storefrontSurface: string;
  storefrontText: string;
  storefrontMuted: string;
  storefrontRadius: number;
};

type Wallet = {
  id: string;
  balancePoints: number;
};

type BuybackFeedback = {
  kind: "success" | "error";
  message: string;
  walletBalancePoints?: number | null;
};

type RedemptionDraft = {
  note: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/customer/items" };
const fallbackCardImage = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const activeRequestStatuses = new Set<CustodyRequestStatus>(["QUOTED", "PENDING", "OPS_REVIEW", "APPROVED", "PACKED"]);

function formatPoints(value: number | null) {
  if (value == null) return "Value pending";
  return `${value.toLocaleString()} pts`;
}

function formatQuoteAmount(amount: number | null, currency: string | null) {
  if (amount == null) return "Quote pending";
  const code = currency?.trim() || "POINTS";
  return `${amount.toLocaleString()} ${code}`;
}

function formatTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function isQuoteExpired(value: string | null) {
  if (!value) return true;
  const expiresAt = new Date(value).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function formatExpiry(value: string | null) {
  if (!value) return "Expiry not available";
  return isQuoteExpired(value) ? `Expired ${formatTime(value)}` : `Expires ${formatTime(value)}`;
}

function formatValueSource(value: string | null) {
  if (!value) return "Unknown";
  return value.replaceAll("_", " ").toLowerCase();
}

function requestLabel(request: CustodyRequest) {
  const type = request.type === "BUYBACK" ? "Buyback" : "Redemption";
  return `${type} ${request.status.replaceAll("_", " ").toLowerCase()}`;
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function isHeld(item: CustodyItem) {
  return item.status === "HELD" && !item.pendingRequest;
}

function normalizeRedemptionNote(note: string) {
  const normalizedNote = note.trim();
  return normalizedNote ? normalizedNote : null;
}

function findActiveBuybackQuote(item: CustodyItem) {
  const candidates = [item.pendingRequest, ...(item.requests ?? [])].filter((request): request is CustodyRequest => !!request);
  return candidates.find((request) => request.type === "BUYBACK" && (request.status === "QUOTED" || request.status === "EXPIRED")) ?? null;
}

function buildAcceptMessage(request: CustodyRequest, walletBalancePoints: number | null) {
  const quoteLabel = formatQuoteAmount(request.quoteAmount, request.quoteCurrency);
  const walletLabel = walletBalancePoints == null ? null : `Current points balance: ${walletBalancePoints.toLocaleString()}.`;
  if (request.status === "CREDITED" || request.creditedAt) {
    return [`Buyback credited for ${quoteLabel}.`, walletLabel].filter(Boolean).join(" ");
  }
  return [`Buyback request submitted for ${quoteLabel}.`, walletLabel].filter(Boolean).join(" ");
}

function buildQuoteIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export default function CustomerItemsPage() {
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const headers = useMemo(() => ({ "x-vendor-host": runtimeVendorHost, ...clientPageHeader }), [runtimeVendorHost]);

  const [items, setItems] = useState<CustodyItem[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const [buybackFeedbackByItem, setBuybackFeedbackByItem] = useState<Record<string, BuybackFeedback>>({});
  const [buybackQuoteKeys, setBuybackQuoteKeys] = useState<Record<string, string>>({});
  const [redemptionDrafts, setRedemptionDrafts] = useState<Record<string, RedemptionDraft>>({});
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [vendorLogo, setVendorLogo] = useState<string | null>(null);
  const [vendorFavicon, setVendorFavicon] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    const walletResponse = await fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" });
    if (!walletResponse.ok) throw new Error("Failed to load wallet");
    const walletPayload = await walletResponse.json();
    setWallet(walletPayload.wallet ?? null);
    return walletPayload.wallet ?? null;
  }, [headers]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsResponse, vendorResponse, walletResponse] = await Promise.all([
        fetch(`${apiBase}/v1/customer/items`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/current`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" }),
      ]);

      const vendorPayload = vendorResponse.ok ? await vendorResponse.json() : null;
      setTheme(vendorPayload?.vendor?.vendorSettings ?? null);
      setVendorLogo(normalizeVendorLogoUrl(vendorPayload?.vendor?.logoImageUrl) || null);
      setVendorFavicon(normalizeVendorFaviconUrl(vendorPayload?.vendor?.faviconImageUrl, vendorPayload?.vendor?.logoImageUrl) || null);
      if (walletResponse.ok) {
        const walletPayload = await walletResponse.json().catch(() => ({}));
        setWallet(walletPayload.wallet ?? null);
      }

      if (itemsResponse.status === 404) {
        setFeatureUnavailable(true);
        setItems([]);
        return;
      }

      setFeatureUnavailable(false);
      const payload = await itemsResponse.json().catch(() => ({}));
      if (!itemsResponse.ok) throw new Error(payload.error ?? "Failed to load custody items");
      setItems(payload.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load custody items");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useBackForwardRefresh(loadItems, { enabled: !featureUnavailable, cooldownMs: 15000 });

  useEffect(() => {
    applyVendorFavicon(normalizeVendorFaviconUrl(vendorFavicon, vendorLogo));
  }, [vendorFavicon, vendorLogo]);

  const storefrontThemeStyle = useMemo(() => {
    if (!theme) return undefined;
    return {
      ["--brand" as string]: theme.storefrontPrimary,
      ["--card" as string]: theme.storefrontSurface,
      ["--text" as string]: theme.storefrontText,
      ["--muted" as string]: theme.storefrontMuted,
      ["--border" as string]: theme.storefrontSecondary,
      ["--brand-soft" as string]: theme.storefrontSecondary,
      ["--brand-accent" as string]: theme.storefrontAccent,
      ["--radius-lg" as string]: `${theme.storefrontRadius}px`,
    } as CSSProperties;
  }, [theme]);

  const heldCount = items.filter((item) => item.status === "HELD").length;
  const pendingCount = items.filter((item) => item.pendingRequest || activeRequestStatuses.has(item.requests[0]?.status)).length;

  async function createRedemptionRequest(item: CustodyItem) {
    const normalizedNote = normalizeRedemptionNote(redemptionDrafts[item.id]?.note ?? "");
    await runItemAction(item, "redemption", normalizedNote);
  }

  async function createBuybackQuote(item: CustodyItem) {
    await runItemAction(item, "buyback");
  }

  async function markExpiredBuybackQuote(quote: CustodyRequest) {
    if (quote.status === "EXPIRED") return;
    const response = await fetch(`${apiBase}/v1/customer/buyback-quotes/${quote.id}/accept`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && payload.error !== "Buyback quote expired") {
      throw new Error(payload.error ?? "Failed to refresh expired buyback quote");
    }
  }

  async function runItemAction(item: CustodyItem, action: "redemption" | "buyback", normalizedNote: string | null = null) {
    const activeQuote = action === "buyback" ? findActiveBuybackQuote(item) : null;
    const activeQuoteExpired = !!activeQuote && (isQuoteExpired(activeQuote.expiresAt) || activeQuote.status === "EXPIRED");
    if (action === "buyback" && activeQuote && !activeQuoteExpired) {
      setBuybackFeedbackByItem((prev) => ({
        ...prev,
        [item.id]: {
          kind: "success",
          message: "Active buyback quote loaded below.",
          walletBalancePoints: wallet?.balancePoints ?? null,
        },
      }));
      return;
    }
    if (!isHeld(item) && !activeQuoteExpired) return;
    setActionItemId(item.id);
    setActionMessage(null);
    setError(null);
    setBuybackFeedbackByItem((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    const idempotencyKey = activeQuoteExpired ? buildQuoteIdempotencyKey() : buybackQuoteKeys[item.id] ?? buildQuoteIdempotencyKey();
    if (action === "buyback" && (activeQuoteExpired || !buybackQuoteKeys[item.id])) {
      setBuybackQuoteKeys((prev) => ({ ...prev, [item.id]: idempotencyKey }));
    }
    const path = action === "redemption" ? "redemption-requests" : "buyback-quotes";
    try {
      if (action === "buyback" && activeQuoteExpired && activeQuote) {
        await markExpiredBuybackQuote(activeQuote);
      }
      const response = await fetch(`${apiBase}/v1/customer/items/${item.id}/${path}`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        credentials: "include",
        body: JSON.stringify({ note: normalizedNote }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? `Failed to create ${action} request`);
      setActionMessage(action === "redemption" ? "Redemption request submitted." : "Buyback quote requested.");
      if (action === "redemption") {
        setRedemptionDrafts((prev) => ({ ...prev, [item.id]: { note: "" } }));
      }
      if (action === "buyback" && payload.quote) {
        setBuybackFeedbackByItem((prev) => ({
          ...prev,
          [item.id]: {
            kind: "success",
            message: `Buyback quote ready for ${formatQuoteAmount(payload.quote.quoteAmount ?? null, payload.quote.quoteCurrency ?? null)}.`,
            walletBalancePoints: wallet?.balancePoints ?? null,
          },
        }));
      }
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to create ${action} request`);
    } finally {
      setActionItemId(null);
    }
  }

  async function acceptBuybackQuote(item: CustodyItem, quote: CustodyRequest) {
    const expired = isQuoteExpired(quote.expiresAt) || quote.status === "EXPIRED";
    if (expired) {
      setBuybackFeedbackByItem((prev) => ({
        ...prev,
        [item.id]: {
          kind: "error",
          message: "This quote expired and cannot be accepted.",
          walletBalancePoints: wallet?.balancePoints ?? null,
        },
      }));
      return;
    }

    setAcceptingQuoteId(quote.id);
    setError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`${apiBase}/v1/customer/buyback-quotes/${quote.id}/accept`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to accept buyback quote");

      const refreshedWallet = await loadWallet();
      const nextRequest = payload.request ?? quote;
      setBuybackFeedbackByItem((prev) => ({
        ...prev,
        [item.id]: {
          kind: "success",
          message: buildAcceptMessage(nextRequest, refreshedWallet?.balancePoints ?? null),
          walletBalancePoints: refreshedWallet?.balancePoints ?? null,
        },
      }));
      setActionMessage(nextRequest.status === "CREDITED" || nextRequest.creditedAt ? "Buyback credited." : "Buyback request submitted.");
      await loadItems();
    } catch (err) {
      setBuybackFeedbackByItem((prev) => ({
        ...prev,
        [item.id]: {
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to accept buyback quote",
          walletBalancePoints: wallet?.balancePoints ?? null,
        },
      }));
    } finally {
      setAcceptingQuoteId(null);
    }
  }

  return (
    <main className="container customer-items-page" style={storefrontThemeStyle}>
      <header className="site-header customer-items-header">
        <div className="brand-text">
          <strong>My Backpack</strong>
          <span>Custody inventory, requests, and item status.</span>
        </div>
        <div className="actions">
          <Link href="/" className="sort-pill">Catalog</Link>
          <Link href="/fairness-proofs" className="sort-pill">Fairness Proofs</Link>
          <div className="wallet-chip">Points: {wallet?.balancePoints?.toLocaleString() ?? "-"}</div>
          <button type="button" className="sort-pill" onClick={() => void loadItems()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      <section className="card backpack-summary-card">
        <div>
          <p className="muted tiny">Custody inventory</p>
          <h1>Items you have pulled</h1>
          <p className="muted backpack-intro">Track held cards, pending requests, and recent custody activity in one place.</p>
        </div>
        <div className="backpack-stats">
          <div><strong>{items.length}</strong><span>Total items</span></div>
          <div><strong>{heldCount}</strong><span>Held</span></div>
          <div><strong>{pendingCount}</strong><span>Pending</span></div>
        </div>
      </section>

      {actionMessage ? <p className="inline-success-banner">{actionMessage}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {loading ? <section className="card"><p className="muted">Loading backpack...</p></section> : null}

      {!loading && featureUnavailable ? (
        <section className="card backpack-empty-state">
          <h2>Backpack is not available yet</h2>
          <p className="muted">Custody inventory is disabled for this storefront. Pack draws and fairness proofs still work normally.</p>
          <Link href="/" className="draw-button link-button">Back to Catalog</Link>
        </section>
      ) : null}

      {!loading && !featureUnavailable && !error && items.length === 0 ? (
        <section className="card backpack-empty-state">
          <h2>No custody items yet</h2>
          <p className="muted">Draw a physical prize from a pack and it will appear here with its custody status.</p>
          <Link href="/" className="draw-button link-button">Browse Packs</Link>
        </section>
      ) : null}

      {!loading && !featureUnavailable && !error && items.length > 0 ? (
        <section className="backpack-item-grid" aria-label="Custody items">
          {items.map((item) => {
            const canRequest = isHeld(item);
            const busy = actionItemId === item.id;
            const recentRequests = item.requests ?? [];
            const quote = findActiveBuybackQuote(item);
            const expired = quote ? isQuoteExpired(quote.expiresAt) || quote.status === "EXPIRED" : false;
            const acceptBusy = acceptingQuoteId === quote?.id;
            const buybackFeedback = buybackFeedbackByItem[item.id] ?? null;
            const redemptionNote = redemptionDrafts[item.id]?.note ?? "";
            return (
              <article className="card backpack-item-card" key={item.id}>
                <div className="backpack-item-image-wrap">
                  <img
                    className="backpack-item-image"
                    src={item.imageLargeUrl || item.imageUrl || fallbackCardImage}
                    alt={item.prizeLabel}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = fallbackCardImage;
                    }}
                  />
                  <span className={`backpack-status-pill status-${item.status.toLowerCase().replaceAll("_", "-")}`}>{statusLabel(item.status)}</span>
                </div>

                <div className="backpack-item-body">
                  <div>
                    <h2>{item.prizeLabel}</h2>
                    <p className="muted">{[item.setName, item.cardName, item.rarity].filter(Boolean).join(" | ") || "Card details pending"}</p>
                  </div>

                  <div className="backpack-meta-grid">
                    <div><span>Value</span><strong>{formatPoints(item.estimatedValue)}</strong></div>
                    <div><span>Provider</span><strong>{item.provider.replaceAll("_", " ").toLowerCase()}</strong></div>
                    <div><span>Added</span><strong>{formatTime(item.createdAt)}</strong></div>
                  </div>

                  {item.pendingRequest ? (
                    <div className="pending-request-banner">
                      <strong>Pending request</strong>
                      <span>{requestLabel(item.pendingRequest)}</span>
                      <small>Requested {formatTime(item.pendingRequest.requestedAt)}</small>
                      {item.pendingRequest.customerNote ? <small>Note: {item.pendingRequest.customerNote}</small> : null}
                    </div>
                  ) : null}

                  {quote ? (
                    <div className={expired ? "inline-error-banner" : "pending-request-banner"}>
                      <strong>Buyback quote card</strong>
                      <span>{formatQuoteAmount(quote.quoteAmount, quote.quoteCurrency)}</span>
                      <small>Buyback rate {quote.buybackPercent != null ? `${quote.buybackPercent}%` : "Not available"}</small>
                      <small>Value source {formatValueSource(quote.valueSource)}</small>
                      <small>Value as of {formatTime(quote.valueAsOf)}</small>
                      <small>{formatExpiry(quote.expiresAt)}</small>
                      <div className="actions backpack-actions">
                        <button type="button" className="draw-button alt" disabled={acceptBusy || expired} onClick={() => void acceptBuybackQuote(item, quote)}>
                          {acceptBusy ? "Submitting..." : expired ? "Quote expired" : "Accept Buyback Quote"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="backpack-request-panel">
                    <label className="backpack-note-field">
                      <span>Redemption note (optional)</span>
                      <textarea
                        value={redemptionNote}
                        maxLength={500}
                        placeholder="Add delivery notes or anything the team should know."
                        onChange={(event) => {
                          const nextNote = event.currentTarget.value;
                          setRedemptionDrafts((prev) => ({ ...prev, [item.id]: { note: nextNote } }));
                        }}
                        disabled={!canRequest || busy}
                      />
                    </label>
                    <div className="actions backpack-actions">
                      <button type="button" className="draw-button" disabled={!canRequest || busy} onClick={() => void createRedemptionRequest(item)}>
                        {busy ? "Submitting..." : "Request Redemption"}
                      </button>
                      <button type="button" className="draw-button alt" disabled={!canRequest || busy} onClick={() => void createBuybackQuote(item)}>
                        {busy ? "Submitting..." : "Request Buyback"}
                      </button>
                    </div>
                  </div>
                  {!canRequest ? <p className="muted tiny">Redemption and buyback actions unlock when the item is HELD with no active request.</p> : null}
                  {buybackFeedback ? (
                    <div className={buybackFeedback.kind === "success" ? "pending-request-banner" : "inline-error-banner"}>
                      <strong>{buybackFeedback.message}</strong>
                      {buybackFeedback.walletBalancePoints != null ? <small>Current points balance: {buybackFeedback.walletBalancePoints.toLocaleString()}</small> : null}
                    </div>
                  ) : null}

                  <details className="recent-requests-panel">
                    <summary>Recent requests</summary>
                    {recentRequests.length > 0 ? (
                      <ol>
                        {recentRequests.map((request) => (
                          <li key={request.id}>
                            <span>{requestLabel(request)}</span>
                            <small>Requested {formatTime(request.requestedAt)}</small>
                            {request.quoteAmount != null ? <strong>{request.quoteAmount.toLocaleString()} {request.quoteCurrency ?? "pts"}</strong> : null}
                            {request.customerNote ? <small>Note: {request.customerNote}</small> : null}
                          </li>
                        ))}
                      </ol>
                    ) : <p className="muted tiny">No requests for this item yet.</p>}
                  </details>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
