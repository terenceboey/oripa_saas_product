"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useBackForwardRefresh } from "../../../lib/use-back-forward-refresh";
import { applyVendorFavicon } from "../../../lib/favicon";

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
};

type Wallet = {
  id: string;
  balancePoints: number;
};

type DrawResult = {
  packId: string;
  quantity: number;
  totalCost: number;
  draws: Array<{
    drawId: string;
    prizeId: string | null;
    prizeLabel?: string | null;
    prizeImageUrl?: string | null;
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

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const defaultPokemonCardImage = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const defaultPackBannerImage = "/default-pack-banner-desktop.webp";
const defaultPackBannerImageMobile = "/default-pack-banner-mobile.webp";
const clientPageHeader = { "x-client-page": "/pack/[packId]" };

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

export default function PackDrawPage() {
  const params = useParams<{ packId: string }>();
  const packId = String(params?.packId ?? "");
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);

  const headers = useMemo(() => ({ "x-vendor-host": runtimeVendorHost, ...clientPageHeader }), [runtimeVendorHost]);

  const [pack, setPack] = useState<Pack | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastDraw, setLastDraw] = useState<DrawResult | null>(null);
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [vendorLogo, setVendorLogo] = useState<string | null>(null);
  const [vendorFavicon, setVendorFavicon] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!packId) return;
    setLoading(true);
    setError(null);

    try {
      const [packResponse, walletResponse, vendorResponse] = await Promise.all([
        fetch(`${apiBase}/v1/packs/${packId}`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/current`, { headers, credentials: "include", cache: "no-store" }),
      ]);

      if (!packResponse.ok) {
        const payload = await packResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "Pack not found");
      }
      if (!walletResponse.ok) throw new Error("Failed to load wallet");

      const packPayload = await packResponse.json();
      const walletPayload = await walletResponse.json();
      const vendorPayload = vendorResponse.ok ? await vendorResponse.json() : null;

      setPack(packPayload.pack);
      setWallet(walletPayload.wallet);
      setTheme(vendorPayload?.vendor?.vendorSettings ?? null);
      setVendorLogo(vendorPayload?.vendor?.logoImageUrl ?? null);
      setVendorFavicon(vendorPayload?.vendor?.faviconImageUrl ?? null);
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
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed");
    } finally {
      setDrawing(false);
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
    applyVendorFavicon(vendorFavicon || vendorLogo);
  }, [vendorFavicon, vendorLogo]);

  return (
    <main className="container" style={storefrontThemeStyle}>
      <div className="pack-draw-header">
        <Link href="/" className="sort-pill">Back to Catalog</Link>
        <div className="actions">
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

          {lastDraw ? (
            <section className="card" style={{ marginTop: 12 }}>
              <h3>Draw Result</h3>
              <p className="muted">Quantity {lastDraw.quantity} | Cost {lastDraw.totalCost.toLocaleString()} pts</p>
              <div className="draw-result-grid">
                {lastDraw.draws.map((draw) => (
                  <article key={draw.drawId} className="draw-result-item">
                    <img src={draw.prizeImageUrl || defaultPokemonCardImage} alt={draw.prizeLabel || "No Prize"} />
                    <div className="card-preview-meta">
                      <strong>{draw.prizeLabel || "No Prize"}</strong>
                      <span className="muted tiny">ID {draw.drawId.slice(0, 10)}</span>
                    </div>
                  </article>
                ))}
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



