"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { packTierSnapshotSchema, type PackTierSnapshot } from "@oripa/shared";
import { useBackForwardRefresh } from "../../../lib/use-back-forward-refresh";
import { applyVendorFavicon } from "../../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../../lib/media-url";

type Prize = {
  id: string;
  label: string;
  imageUrl?: string | null;
  estimatedValue: number;
  remainingStock: number;
  dropRatePercent?: number;
};

type Pack = {
  id: string;
  title: string;
  packBannerImageUrl?: string | null;
  pricePoints: number;
  remainingStock: number;
  totalStock: number;
  limitedLabel?: string | null;
  prizes: Prize[];
  tierSnapshotJson?: PackTierSnapshot | null;
};

type Wallet = {
  id: string;
  balancePoints: number;
};

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

type CustodyRequest = {
  id: string;
  type: "REDEMPTION" | "BUYBACK";
  status: CustodyRequestStatus;
  quoteAmount: number | null;
  quoteCurrency: string | null;
  buybackPercent?: number | null;
  valueSource?: string | null;
  valueAsOf?: string | null;
  expiresAt: string | null;
  acceptedAt?: string | null;
  creditedAt?: string | null;
};

type DrawResult = {
  packId: string;
  drawOrderId?: string | null;
  quantity: number;
  totalCost: number;
  draws: Array<{
    drawId: string;
    prizeId: string | null;
    prizeLabel?: string | null;
    prizeImageUrl?: string | null;
    custodyItemId?: string | null;
    custodyStatus?: string | null;
  }>;
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
type ImagePreview = {
  label: string;
  imageUrl: string;
};

type ResultActionState = {
  itemId: string;
  action: "buyback" | "redemption";
} | null;

type ResultActionFeedback = {
  itemId: string;
  action: "buyback" | "redemption";
  kind: "success" | "error";
  message: string;
  quote?: CustodyRequest | null;
  walletBalancePoints?: number | null;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const defaultPokemonCardImage = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const defaultPackBannerImage = "/default-pack-banner-desktop.webp";
const defaultPackBannerImageMobile = "/default-pack-banner-mobile.webp";
const clientPageHeader = { "x-client-page": "/pack/[packId]" };
const activeCustodyRequestStatuses = new Set(["QUOTED", "PENDING", "OPS_REVIEW", "APPROVED", "PACKED", "REDEMPTION_REQUESTED", "BUYBACK_REQUESTED"]);

function resolveImageUrl(url?: string | null) {
  if (!url) return defaultPackBannerImage;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

function responsiveImageFromBase(url?: string | null) {
  const resolved = resolveImageUrl(url);
  if (!resolved.startsWith("/")) {
    return { mobile: resolved, desktop: resolved, fallback: resolved };
  }
  if (resolved.endsWith("-desktop.webp")) {
    const mobile = resolved.replace("-desktop.webp", "-mobile.webp");
    return { mobile, desktop: resolved, fallback: resolved };
  }
  if (resolved.endsWith(".png")) {
    const base = resolved.slice(0, -4);
    return { mobile: `${base}-mobile.webp`, desktop: `${base}-desktop.webp`, fallback: resolved };
  }
  return { mobile: resolved, desktop: resolved, fallback: resolved };
}

function formatStatus(value?: string | null) {
  if (!value) return "custody unavailable";
  return value.replaceAll("_", " ").toLowerCase();
}

function isQuoteExpired(value?: string | null) {
  if (!value) return false;
  const expiresAt = new Date(value).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function formatExpiry(value?: string | null) {
  if (!value) return "Quote expiry was not returned.";
  if (isQuoteExpired(value)) return `Quote expired ${new Date(value).toLocaleString()}`;
  return `Expires ${new Date(value).toLocaleString()}`;
}

function formatQuoteAmount(amount: number | null, currency: string | null) {
  if (amount == null) return "Quote pending";
  const code = currency?.trim() || "POINTS";
  return `${amount.toLocaleString()} ${code}`;
}

function formatValueSource(value?: string | null) {
  if (!value) return "Unknown";
  return value.replaceAll("_", " ").toLowerCase();
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

function isActiveCustodyStatus(value?: string | null) {
  return !!value && activeCustodyRequestStatuses.has(value);
}

function canRequestResultCustodyAction(value?: string | null) {
  return value === "HELD";
}

function resolveTierOdds(tiers: PackTierSnapshot["tiers"]) {
  const fixedPercentTotal = tiers.reduce((sum, tier) => sum + (typeof tier.percentage === "number" ? tier.percentage : 0), 0);
  const flexCount = tiers.filter((tier) => typeof tier.percentage !== "number").length;
  const remainingPercent = Math.max(0, 100 - fixedPercentTotal);
  const fallbackPercent = flexCount > 0 ? remainingPercent / flexCount : 0;

  return tiers.map((tier) => (typeof tier.percentage === "number" ? tier.percentage : fallbackPercent));
}

export default function PackDrawPage() {
  const params = useParams<{ packId: string }>();
  const packId = String(params?.packId ?? "");
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);

  const headers = useMemo(() => ({ ...clientPageHeader }), [runtimeVendorHost]);

  const [pack, setPack] = useState<Pack | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastDraw, setLastDraw] = useState<DrawResult | null>(null);
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [resultActionState, setResultActionState] = useState<ResultActionState>(null);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const [resultActionFeedback, setResultActionFeedback] = useState<Record<string, ResultActionFeedback>>({});
  const [buybackQuoteKeys, setBuybackQuoteKeys] = useState<Record<string, string>>({});
  const [custodyActionsAvailable, setCustodyActionsAvailable] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [vendorLogo, setVendorLogo] = useState<string | null>(null);
  const [vendorFavicon, setVendorFavicon] = useState<string | null>(null);
  const tierSnapshot = useMemo(() => {
    const parsed = packTierSnapshotSchema.safeParse(pack?.tierSnapshotJson);
    return parsed.success ? parsed.data : null;
  }, [pack?.tierSnapshotJson]);
  const tierOdds = useMemo(() => {
    if (!tierSnapshot) return [];
    return resolveTierOdds(tierSnapshot.tiers);
  }, [tierSnapshot]);

  const loadData = useCallback(async () => {
    if (!packId) return;
    setLoading(true);
    setError(null);

    try {
      const [packResponse, walletResponse, vendorResponse, customerSummaryResponse] = await Promise.all([
        fetch(`${apiBase}/v1/packs/${packId}`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/current`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/customer/summary`, { headers, credentials: "include", cache: "no-store" }),
      ]);

      if (!packResponse.ok) {
        const payload = await packResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "Pack not found");
      }
      if (!walletResponse.ok) throw new Error("Failed to load wallet");

      const packPayload = await packResponse.json();
      const walletPayload = await walletResponse.json();
      const vendorPayload = vendorResponse.ok ? await vendorResponse.json() : null;
      const customerSummaryPayload = customerSummaryResponse.ok ? await customerSummaryResponse.json().catch(() => null) : null;

      setPack(packPayload.pack);
      setWallet(walletPayload.wallet);
      setTheme(vendorPayload?.vendor?.vendorSettings ?? null);
      setVendorLogo(normalizeVendorLogoUrl(vendorPayload?.vendor?.logoImageUrl) || null);
      setVendorFavicon(normalizeVendorFaviconUrl(vendorPayload?.vendor?.faviconImageUrl, vendorPayload?.vendor?.logoImageUrl) || null);
      setCustodyActionsAvailable(typeof customerSummaryPayload?.custody?.enabled === "boolean" ? customerSummaryPayload.custody.enabled : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pack");
    } finally {
      setLoading(false);
    }
  }, [headers, packId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useBackForwardRefresh(loadData, { cooldownMs: 15000 });

  const loadWallet = useCallback(async () => {
    const walletResponse = await fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" });
    if (!walletResponse.ok) throw new Error("Failed to load wallet");
    const walletPayload = await walletResponse.json();
    setWallet(walletPayload.wallet ?? null);
    return walletPayload.wallet ?? null;
  }, [headers]);

  async function handleDraw(quantity: number) {
    if (!pack) return;
    setDrawing(true);
    setError(null);

    const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

    try {
      const response = await fetch(`${apiBase}/v1/draws`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        credentials: "include",
        body: JSON.stringify({ packId: pack.id, quantity }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Draw failed");

      setLastDraw(payload);
      setResultActionFeedback({});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed");
    } finally {
      setDrawing(false);
    }
  }

  async function runResultAction(itemId: string | null | undefined, action: "buyback" | "redemption") {
    if (!itemId) return;
    if (resultActionState?.itemId === itemId) return;

    const existingFeedback = resultActionFeedback[itemId];
    if (action === "buyback" && existingFeedback?.quote && (existingFeedback.quote.status === "QUOTED" || existingFeedback.quote.status === "EXPIRED")) {
      setResultActionFeedback((prev) => ({
        ...prev,
        [itemId]: {
          ...existingFeedback,
          kind: "success",
          message: isQuoteExpired(existingFeedback.quote?.expiresAt) ? "This quote has expired." : "Active buyback quote loaded below.",
        },
      }));
      return;
    }

    setResultActionState({ itemId, action });
    setResultActionFeedback((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setError(null);

    const idempotencyKey = buybackQuoteKeys[itemId] ?? (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
    if (action === "buyback" && !buybackQuoteKeys[itemId]) {
      setBuybackQuoteKeys((prev) => ({ ...prev, [itemId]: idempotencyKey }));
    }
    const path = action === "redemption" ? "redemption-requests" : "buyback-quotes";

    try {
      const response = await fetch(`${apiBase}/v1/customer/items/${itemId}/${path}`, {
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
      if (!response.ok) {
        const unavailable = response.status === 404 && typeof payload.error === "string" && payload.error.toLowerCase().includes("custody");
        if (unavailable) setCustodyActionsAvailable(false);
        throw new Error(unavailable ? "Custody actions are not available for this storefront." : payload.error ?? `Failed to request ${action}`);
      }

      setResultActionFeedback((prev) => ({
        ...prev,
        [itemId]: {
          itemId,
          action,
          kind: "success",
          message: action === "redemption" ? "Redemption request submitted." : "Buyback quote ready.",
          quote: payload.quote ?? null,
          walletBalancePoints: wallet?.balancePoints ?? null,
        },
      }));
      setLastDraw((prev) => prev ? {
        ...prev,
        draws: prev.draws.map((draw) => draw.custodyItemId === itemId
          ? { ...draw, custodyStatus: action === "redemption" ? "REDEMPTION_REQUESTED" : "QUOTED" }
          : draw),
      } : prev);
    } catch (err) {
      setResultActionFeedback((prev) => ({
        ...prev,
        [itemId]: {
          itemId,
          action,
          kind: "error",
          message: err instanceof Error ? err.message : `Failed to request ${action}`,
          walletBalancePoints: wallet?.balancePoints ?? null,
        },
      }));
    } finally {
      setResultActionState(null);
    }
  }

  async function acceptBuybackQuote(itemId: string | null | undefined, quote: CustodyRequest | null | undefined) {
    if (!itemId || !quote) return;
    if (isQuoteExpired(quote.expiresAt) || quote.status === "EXPIRED") {
      setResultActionFeedback((prev) => ({
        ...prev,
        [itemId]: {
          itemId,
          action: "buyback",
          kind: "error",
          message: "This quote expired and cannot be accepted.",
          quote: { ...quote, status: "EXPIRED" },
          walletBalancePoints: wallet?.balancePoints ?? null,
        },
      }));
      return;
    }

    setAcceptingQuoteId(quote.id);
    setError(null);
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
      const request = payload.request ?? quote;
      setResultActionFeedback((prev) => ({
        ...prev,
        [itemId]: {
          itemId,
          action: "buyback",
          kind: "success",
          message: buildAcceptMessage(request, refreshedWallet?.balancePoints ?? null),
          quote: request,
          walletBalancePoints: refreshedWallet?.balancePoints ?? null,
        },
      }));
      setLastDraw((prev) => prev ? {
        ...prev,
        draws: prev.draws.map((draw) => draw.custodyItemId === itemId
          ? { ...draw, custodyStatus: payload.item?.status ?? "BUYBACK_REQUESTED" }
          : draw),
      } : prev);
      await loadData();
    } catch (err) {
      setResultActionFeedback((prev) => ({
        ...prev,
        [itemId]: {
          itemId,
          action: "buyback",
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to accept buyback quote",
          quote,
          walletBalancePoints: wallet?.balancePoints ?? null,
        },
      }));
    } finally {
      setAcceptingQuoteId(null);
    }
  }

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

  useEffect(() => {
    applyVendorFavicon(normalizeVendorFaviconUrl(vendorFavicon, vendorLogo));
  }, [vendorFavicon, vendorLogo]);

  return (
    <main className="container" style={storefrontThemeStyle}>
      <div className="pack-draw-header">
        <Link href="/" className="sort-pill">Back to Catalog</Link>
        <div className="actions">
          <Link href="/customer/items" className="sort-pill">My Backpack</Link>
          <Link href="/fairness-proofs" className="sort-pill">Fairness Proofs</Link>
          <div className="wallet-chip">Points: {wallet?.balancePoints?.toLocaleString() ?? "-"}</div>
        </div>
      </div>

      {loading ? <section className="card"><p className="muted">Loading pack...</p></section> : null}
      {!loading && !pack ? <section className="card"><p className="error">Pack not found</p></section> : null}

      {pack ? (
        <>
          <section className="card">
            {(() => {
              const image = responsiveImageFromBase(pack.packBannerImageUrl || defaultPackBannerImage);
              return (
                <picture>
                  <source media="(max-width: 760px)" srcSet={image.mobile} type="image/webp" />
                  <source srcSet={image.desktop} type="image/webp" />
                  <img
                    className="pack-detail-banner"
                    src={image.fallback}
                    alt={`${pack.title} banner`}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = defaultPackBannerImageMobile;
                    }}
                  />
                </picture>
              );
            })()}
            <div className="pack-header">
              <h1>{pack.title}</h1>
              {pack.limitedLabel ? <span className="badge warn">{pack.limitedLabel}</span> : null}
            </div>
            <p className="muted remaining-text">Remaining {pack.remainingStock}/{pack.totalStock}</p>
            <div className="price-line">
              <span className="muted">1 draw</span>
              <strong>{pack.pricePoints.toLocaleString()} pts</strong>
            </div>

            <div className="actions">
              <button type="button" className="draw-button" disabled={drawing || pack.remainingStock < 1} onClick={() => handleDraw(1)}>Draw</button>
              <button type="button" className="draw-button alt" disabled={drawing || pack.remainingStock < 10} onClick={() => handleDraw(10)}>10 Draws</button>
              <button type="button" className="draw-button alt-2" disabled={drawing || pack.remainingStock < 100} onClick={() => handleDraw(100)}>100 Draws</button>
            </div>
            {error ? <p className="error">{error}</p> : null}
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Card Preview</h2>
            <p className="muted">Each item can have vendor-uploaded art. Rates shown below are current weighted odds.</p>
            <div className="card-preview-grid">
              {pack.prizes.map((prize) => (
                <article key={prize.id} className="card-preview-item">
                  <button
                    type="button"
                    className="card-image-button"
                    onClick={() =>
                      setImagePreview({
                        label: prize.label,
                        imageUrl: prize.imageUrl || defaultPokemonCardImage,
                      })
                    }
                  >
                    <img src={prize.imageUrl || defaultPokemonCardImage} alt={prize.label} />
                  </button>
                  <div className="card-preview-meta">
                    <strong>{prize.label}</strong>
                    <span className="muted tiny">Rate {(prize.dropRatePercent ?? 0).toFixed(4)}%</span>
                    <span className="muted tiny">Stock {prize.remainingStock}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {tierSnapshot && tierSnapshot.tiers.length > 0 ? (
            <section className="card" style={{ marginTop: 12 }}>
              <h2>Tier Breakdown</h2>
              <p className="muted">This reflects the vendor-configured tier structure preserved with the pack.</p>
              <div className="tier-stack">
                {tierSnapshot.tiers.map((tier, tierIndex) => {
                  const tierChance = tierOdds[tierIndex] ?? 0;
                  const itemChance = tier.items.length > 0 ? tierChance / tier.items.length : 0;
                  return (
                    <article key={`${tier.name}-${tierIndex}`} className="tier-bucket">
                      <div className="heading-row">
                        <strong>{tier.name}</strong>
                        <span className="muted tiny">{tierChance.toFixed(4)}%</span>
                      </div>
                      <p className="muted tiny" style={{ marginBottom: 8 }}>
                        {tier.items.length} items | {itemChance.toFixed(4)}% per item
                      </p>
                      <div className="card-preview-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
                        {tier.items.map((item, itemIndex) => (
                          <article key={`${tier.name}-${item.label}-${itemIndex}`} className="card-preview-item">
                            <button
                              type="button"
                              className="card-image-button"
                              onClick={() =>
                                setImagePreview({
                                  label: item.label,
                                  imageUrl: item.imageUrl || defaultPokemonCardImage,
                                })
                              }
                            >
                              <img src={item.imageUrl || defaultPokemonCardImage} alt={item.label} />
                            </button>
                            <div className="card-preview-meta">
                              <strong>{item.label}</strong>
                              <span className="muted tiny">Stock {item.stock}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {lastDraw ? (
            <section className="card draw-result-panel" style={{ marginTop: 12 }} aria-live="polite">
              <div className="heading-row">
                <div>
                  <h3>Draw Result</h3>
                  <p className="muted">Quantity {lastDraw.quantity} | Cost {lastDraw.totalCost.toLocaleString()} pts</p>
                </div>
                {lastDraw.drawOrderId ? <Link href="/fairness-proofs" className="sort-pill">Fairness Proof</Link> : null}
              </div>
              <div className="draw-result-grid">
                {lastDraw.draws.map((draw, index) => {
                  const custodyItemId = draw.custodyItemId ?? null;
                  const busy = !!custodyItemId && resultActionState?.itemId === custodyItemId;
                  const feedback = custodyItemId ? resultActionFeedback[custodyItemId] : null;
                  const quote = feedback?.quote ?? null;
                  const expired = !!quote && isQuoteExpired(quote.expiresAt);
                  const acceptBusy = acceptingQuoteId === quote?.id;
                  const unavailable = !custodyItemId || custodyActionsAvailable === false;
                  const activeRequest = isActiveCustodyStatus(draw.custodyStatus);
                  const canAct = !!custodyItemId && custodyActionsAvailable !== false && !busy && !activeRequest && !quote && canRequestResultCustodyAction(draw.custodyStatus);
                  const buybackBusy = busy && resultActionState?.action === "buyback";
                  const redemptionBusy = busy && resultActionState?.action === "redemption";
                  return (
                    <article key={draw.drawId} className="draw-result-item result-action-card">
                      <img src={draw.prizeImageUrl || defaultPokemonCardImage} alt={draw.prizeLabel || "Drawn prize"} />
                      <div className="card-preview-meta result-action-body">
                        <div>
                          <strong>{draw.prizeLabel || "Drawn prize"}</strong>
                          <span className="muted tiny">Pull {index + 1} | ID {draw.drawId.slice(0, 10)}</span>
                        </div>
                        <div className="result-status-row">
                          <span className={`backpack-status-pill inline-status status-${formatStatus(draw.custodyStatus).replaceAll(" ", "-")}`}>{formatStatus(draw.custodyStatus)}</span>
                        </div>
                        {lastDraw.drawOrderId ? <Link href="/fairness-proofs" className="sort-pill result-proof-link">View fairness proof</Link> : null}
                        <div className="result-action-stack">
                          <Link
                            href="/customer/items"
                            className={`draw-button link-button result-keep-link${unavailable ? " disabled-link" : ""}`}
                            aria-disabled={unavailable}
                            tabIndex={unavailable ? -1 : undefined}
                          >
                            Keep in Backpack
                          </Link>
                          <button type="button" className="draw-button alt" disabled={!canAct} onClick={() => void runResultAction(custodyItemId, "buyback")}>
                            {buybackBusy ? "Requesting..." : "Request Buyback Quote"}
                          </button>
                          <button type="button" className="draw-button alt-2" disabled={!canAct} onClick={() => void runResultAction(custodyItemId, "redemption")}>
                            {redemptionBusy ? "Submitting..." : "Request Redemption"}
                          </button>
                        </div>
                        {unavailable ? <p className="muted tiny">Custody actions are unavailable for this storefront. The prize is shown, but backpack actions are disabled.</p> : null}
                        {activeRequest ? <p className="muted tiny">This item already has an active request.</p> : null}
                        {!activeRequest && draw.custodyStatus === "BOUGHT_BACK" ? <p className="muted tiny">Buyback is already complete for this item.</p> : null}
                        {!activeRequest && draw.custodyStatus === "REDEEMED" ? <p className="muted tiny">Redemption is already complete for this item.</p> : null}
                        {!activeRequest && draw.custodyStatus === "VOIDED" ? <p className="muted tiny">This item is no longer available for redemption or buyback.</p> : null}
                        {canAct ? <p className="muted tiny">Need to add a note? Open My Backpack before submitting redemption.</p> : null}
                        {feedback ? (
                          <div className={feedback.kind === "success" ? "pending-request-banner" : "inline-error-banner"}>
                            <strong>{feedback.message}</strong>
                            {feedback.quote ? <span>{formatQuoteAmount(feedback.quote.quoteAmount ?? null, feedback.quote.quoteCurrency ?? null)}</span> : null}
                            {feedback.kind === "success" && feedback.action === "buyback" && !feedback.quote ? <span>Quote details were not returned. Refresh backpack before accepting.</span> : null}
                            {feedback.walletBalancePoints != null ? <small>Current points balance: {feedback.walletBalancePoints.toLocaleString()}</small> : null}
                            {feedback.quote ? (
                              <>
                                <small>Buyback rate {feedback.quote.buybackPercent != null ? `${feedback.quote.buybackPercent}%` : "Not available"}</small>
                                <small>Value source {formatValueSource(feedback.quote.valueSource)}</small>
                                <small>Value as of {feedback.quote.valueAsOf ? new Date(feedback.quote.valueAsOf).toLocaleString() : "Not available"}</small>
                                <small>{formatExpiry(feedback.quote.expiresAt)}</small>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                        {quote ? (
                          <div className={expired ? "inline-error-banner" : "pending-request-banner"}>
                            <strong>Buyback quote card</strong>
                            <span>{formatQuoteAmount(quote.quoteAmount ?? null, quote.quoteCurrency ?? null)}</span>
                            <small>Buyback rate {quote.buybackPercent != null ? `${quote.buybackPercent}%` : "Not available"}</small>
                            <small>Value source {formatValueSource(quote.valueSource)}</small>
                            <small>Value as of {quote.valueAsOf ? new Date(quote.valueAsOf).toLocaleString() : "Not available"}</small>
                            <small>{formatExpiry(quote.expiresAt)}</small>
                            <button type="button" className="draw-button alt" disabled={acceptBusy || expired} onClick={() => void acceptBuybackQuote(custodyItemId, quote)}>
                              {acceptBusy ? "Submitting..." : expired ? "Quote expired" : "Accept Buyback Quote"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {imagePreview ? (
        <div className="qr-modal-backdrop" onClick={() => setImagePreview(null)}>
          <div className="qr-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="heading-row">
              <h3>{imagePreview.label}</h3>
              <button type="button" className="sort-pill" onClick={() => setImagePreview(null)}>Close</button>
            </div>
            <img className="card-image-preview" src={imagePreview.imageUrl} alt={imagePreview.label} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
