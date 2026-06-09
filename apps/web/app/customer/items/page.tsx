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

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/customer/items" };
const fallbackCardImage = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const activeRequestStatuses = new Set<CustodyRequestStatus>(["QUOTED", "PENDING", "OPS_REVIEW", "APPROVED", "PACKED"]);

function formatPoints(value: number | null) {
  if (value == null) return "Value pending";
  return `${value.toLocaleString()} pts`;
}

function formatTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
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

export default function CustomerItemsPage() {
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const headers = useMemo(() => ({ "x-vendor-host": runtimeVendorHost, ...clientPageHeader }), [runtimeVendorHost]);

  const [items, setItems] = useState<CustodyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [vendorLogo, setVendorLogo] = useState<string | null>(null);
  const [vendorFavicon, setVendorFavicon] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsResponse, vendorResponse] = await Promise.all([
        fetch(`${apiBase}/v1/customer/items`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/current`, { headers, credentials: "include", cache: "no-store" }),
      ]);

      const vendorPayload = vendorResponse.ok ? await vendorResponse.json() : null;
      setTheme(vendorPayload?.vendor?.vendorSettings ?? null);
      setVendorLogo(normalizeVendorLogoUrl(vendorPayload?.vendor?.logoImageUrl) || null);
      setVendorFavicon(normalizeVendorFaviconUrl(vendorPayload?.vendor?.faviconImageUrl, vendorPayload?.vendor?.logoImageUrl) || null);

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
    await runItemAction(item, "redemption");
  }

  async function createBuybackQuote(item: CustodyItem) {
    await runItemAction(item, "buyback");
  }

  async function runItemAction(item: CustodyItem, action: "redemption" | "buyback") {
    if (!isHeld(item)) return;
    setActionItemId(item.id);
    setActionMessage(null);
    setError(null);
    const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const path = action === "redemption" ? "redemption-requests" : "buyback-quotes";
    try {
      const response = await fetch(`${apiBase}/v1/customer/items/${item.id}/${path}`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? `Failed to create ${action} request`);
      setActionMessage(action === "redemption" ? "Redemption request submitted." : "Buyback quote requested.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to create ${action} request`);
    } finally {
      setActionItemId(null);
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
                    </div>
                  ) : null}

                  <div className="actions backpack-actions">
                    <button type="button" className="draw-button" disabled={!canRequest || busy} onClick={() => void createRedemptionRequest(item)}>
                      {busy ? "Submitting..." : "Request Redemption"}
                    </button>
                    <button type="button" className="draw-button alt" disabled={!canRequest || busy} onClick={() => void createBuybackQuote(item)}>
                      {busy ? "Submitting..." : "Request Buyback"}
                    </button>
                  </div>
                  {!canRequest ? <p className="muted tiny">Actions unlock when the item is HELD with no active request.</p> : null}

                  <details className="recent-requests-panel">
                    <summary>Recent requests</summary>
                    {recentRequests.length > 0 ? (
                      <ol>
                        {recentRequests.map((request) => (
                          <li key={request.id}>
                            <span>{requestLabel(request)}</span>
                            <small>{formatTime(request.requestedAt)}</small>
                            {request.quoteAmount != null ? <strong>{request.quoteAmount.toLocaleString()} {request.quoteCurrency ?? "pts"}</strong> : null}
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
