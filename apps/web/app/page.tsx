"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useBackForwardRefresh } from "../lib/use-back-forward-refresh";
import { applyVendorFavicon } from "../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../lib/media-url";

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl?: string | null;
  sortOrder: number;
};

type Prize = {
  id: string;
  label: string;
  imageUrl?: string | null;
  estimatedValue: number;
  weight: number;
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
  isNew: boolean;
  limitedLabel?: string | null;
  createdAt: string;
  prizes: Prize[];
};

type Wallet = {
  id: string;
  balancePoints: number;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  host: string;
  isActive: boolean;
  logoImageUrl?: string | null;
  faviconImageUrl?: string | null;
  vendorSettings?: {
    storefrontPrimary: string;
    storefrontSecondary: string;
    storefrontAccent: string;
    storefrontSurface: string;
    storefrontText: string;
    storefrontMuted: string;
    storefrontRadius: number;
  } | null;
};

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  fullName?: string | null;
  profileComplete?: boolean;
  status: string;
  lastLoginAt?: string | null;
};

type SortKey = "recommended" | "remaining_asc" | "price_asc" | "price_desc" | "newest";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const categories = ["Pokemon", "ONE PIECE", "Yu-Gi-Oh!", "Dragon Ball"];
const clientPageHeader = { "x-client-page": "/" };
const defaultPackBanner = "/default-pack-banner-desktop.webp";
const defaultPackBannerMobile = "/default-pack-banner-mobile.webp";

function resolveImageUrl(url?: string | null) {
  if (!url) return defaultPackBanner;
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

export default function HomePage() {
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorNotFound, setVendorNotFound] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("recommended");
  const [activeCategory, setActiveCategory] = useState("Pokemon");

  const headers = useMemo(() => ({ ...clientPageHeader }), [runtimeVendorHost]);

  const loadData = useCallback(async (force = false) => {
    if (vendorNotFound && !force) return;
    setLoading(true);
    setError(null);

    try {
      const tenantResponse = await fetch(`${apiBase}/v1/vendor/current`, { headers, credentials: "include", cache: "no-store" });
      if (!tenantResponse.ok) {
        if (tenantResponse.status === 400 || tenantResponse.status === 404) {
          setVendorNotFound(true);
          setTenant(null);
          setPacks([]);
          setBanners([]);
          setWallet(null);
          setError(`No vendor found for host: ${runtimeVendorHost}`);
          return;
        }
        throw new Error("Failed to resolve vendor storefront.");
      }
      setVendorNotFound(false);

      const [walletResponse, packsResponse, bannersResponse] = await Promise.all([
        fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/packs`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/banners`, { headers, credentials: "include", cache: "no-store" }),
      ]);

      if (!walletResponse.ok || !packsResponse.ok || !bannersResponse.ok) {
        throw new Error("Failed to load vendor storefront data.");
      }

      const walletPayload = await walletResponse.json();
      const packsPayload = await packsResponse.json();
      const bannersPayload = await bannersResponse.json();
      const tenantPayload = await tenantResponse.json();

      setWallet(walletPayload.wallet);
      setPacks(packsPayload.packs ?? []);
      setBanners(bannersPayload.banners ?? []);
      setTenant(tenantPayload.vendor ?? tenantPayload.tenant ?? null);
      setBannerIndex(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [headers, runtimeVendorHost, vendorNotFound]);

  const loadProfile = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/v1/auth/me`, {
        headers: clientPageHeader,
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const payload = await response.json();
      setUser(payload.user ?? null);
    } catch {
      setUser(null);
    }
  }, [headers]);

  useEffect(() => {
    loadData(true);
    void loadProfile();
  }, [loadData, loadProfile]);

  useEffect(() => {
    applyVendorFavicon(normalizeVendorFaviconUrl(tenant?.faviconImageUrl, tenant?.logoImageUrl));
  }, [tenant?.faviconImageUrl, tenant?.logoImageUrl]);

  useBackForwardRefresh(() => loadData(false), { enabled: !vendorNotFound, cooldownMs: 15000 });

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = window.setInterval(() => {
      setBannerIndex((current) => (current + 1) % banners.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [banners]);

  const sortedPacks = useMemo(() => {
    const next = [...packs];

    if (sortKey === "remaining_asc") {
      next.sort((a, b) => a.remainingStock - b.remainingStock);
    } else if (sortKey === "price_asc") {
      next.sort((a, b) => a.pricePoints - b.pricePoints);
    } else if (sortKey === "price_desc") {
      next.sort((a, b) => b.pricePoints - a.pricePoints);
    } else if (sortKey === "newest") {
      next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      next.sort((a, b) => {
        const aScore = (a.isNew ? 50 : 0) + (a.remainingStock < 100 ? 20 : 0) + Math.round(10000 / Math.max(1, a.pricePoints));
        const bScore = (b.isNew ? 50 : 0) + (b.remainingStock < 100 ? 20 : 0) + Math.round(10000 / Math.max(1, b.pricePoints));
        return bScore - aScore;
      });
    }

    return next;
  }, [packs, sortKey]);

  const currentBanner = banners[bannerIndex];
  const storefrontThemeStyle = useMemo(() => {
    const theme = tenant?.vendorSettings;
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
  }, [tenant?.vendorSettings]);

  function goToPreviousBanner() {
    if (!banners.length) return;
    setBannerIndex((current) => (current - 1 + banners.length) % banners.length);
  }

  function goToNextBanner() {
    if (!banners.length) return;
    setBannerIndex((current) => (current + 1) % banners.length);
  }

  async function logout() {
    await fetch(`${apiBase}/v1/auth/logout`, {
      method: "POST",
      headers,
      credentials: "include",
    }).catch(() => null);
    setUser(null);
  }

  return (
    <main className="container" style={storefrontThemeStyle}>
      <header className="site-header">
        <div className="brand">
          <img src={normalizeVendorLogoUrl(tenant?.logoImageUrl) || "/default-brand-logo.png"} alt="Vendor logo" />
          <div className="brand-text">
            <strong>{tenant?.name ?? "Storefront"}</strong>
            <span>{runtimeVendorHost}</span>
          </div>
        </div>
        <div className="header-right">
          {user ? (
            <Link href="/profile" className="auth-inline-card">
              <strong>{user.displayName || user.fullName || "Customer"}</strong>
              <span>{user.email}</span>
              {!user.profileComplete ? <span>Complete profile</span> : null}
            </Link>
          ) : (
            <>
              <a className="sort-pill" href="/login">Customer Login</a>
              <a className="sort-pill" href="/register">Customer Register</a>
            </>
          )}
          {user ? (
            <button type="button" className="sort-pill" onClick={logout}>Logout</button>
          ) : null}
          {user ? <Link className="sort-pill" href="/customer/items">My Backpack</Link> : null}
          <a className="sort-pill" href="/setlists">Setlists</a>
          <div className="wallet-chip">Points: {wallet?.balancePoints?.toLocaleString() ?? "-"}</div>
        </div>
      </header>

      <nav className="category-strip category-top">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`chip ${activeCategory === category ? "chip-active" : ""}`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </nav>

      <section className="banner-wrap">
        {currentBanner ? (
          <a className="banner-link" href={currentBanner.targetUrl ?? "#"} target="_blank" rel="noreferrer">
            {(() => {
              const image = responsiveImageFromBase(currentBanner.imageUrl);
              return (
                <picture>
                  <source media="(max-width: 760px)" srcSet={image.mobile} type="image/webp" />
                  <source srcSet={image.desktop} type="image/webp" />
                  <img
                    className="banner-image"
                    src={image.fallback}
                    alt={currentBanner.title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = defaultPackBannerMobile;
                    }}
                  />
                </picture>
              );
            })()}
            <div className="banner-overlay">
              <h2>{currentBanner.title}</h2>
              <p>Limited-time campaign</p>
            </div>
          </a>
        ) : (
          <div className="banner-empty card">
            <p>No banner yet. Add banners in vendor dashboard.</p>
          </div>
        )}

        {banners.length > 1 ? (
          <>
            <button type="button" className="carousel-btn left" onClick={goToPreviousBanner} aria-label="Previous banner">‹</button>
            <button type="button" className="carousel-btn right" onClick={goToNextBanner} aria-label="Next banner">›</button>
          </>
        ) : null}

        {banners.length > 1 ? (
          <div className="dots">
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                className={`dot ${index === bannerIndex ? "active" : ""}`}
                onClick={() => setBannerIndex(index)}
                aria-label={`Go to banner ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="catalog-hero card">
        <div className="heading-row">
          <div>
            <span className="badge">Oripa MVP</span>
            <h1 className="hero-title">{activeCategory} Mystery Packs</h1>
          </div>
          <button type="button" className="refresh-button" onClick={() => void loadData(true)} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="sort-strip">
          <button type="button" className={`sort-pill ${sortKey === "recommended" ? "active" : ""}`} onClick={() => setSortKey("recommended")}>Recommended</button>
          <button type="button" className={`sort-pill ${sortKey === "remaining_asc" ? "active" : ""}`} onClick={() => setSortKey("remaining_asc")}>Nearly Sold Out</button>
          <button type="button" className={`sort-pill ${sortKey === "newest" ? "active" : ""}`} onClick={() => setSortKey("newest")}>Newest</button>
          <button type="button" className={`sort-pill ${sortKey === "price_asc" ? "active" : ""}`} onClick={() => setSortKey("price_asc")}>Low Price</button>
          <button type="button" className={`sort-pill ${sortKey === "price_desc" ? "active" : ""}`} onClick={() => setSortKey("price_desc")}>High Price</button>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="pack-grid">
        {sortedPacks.map((pack) => (
          <article className="card pack-card" key={pack.id}>
            {(() => {
              const image = responsiveImageFromBase(pack.packBannerImageUrl || defaultPackBanner);
              return (
                <picture>
                  <source media="(max-width: 760px)" srcSet={image.mobile} type="image/webp" />
                  <source srcSet={image.desktop} type="image/webp" />
                  <img
                    className="pack-card-banner"
                    src={image.fallback}
                    alt={`${pack.title} banner`}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = defaultPackBannerMobile;
                    }}
                  />
                </picture>
              );
            })()}
            <div className="pack-header">
              <h2>{pack.title}</h2>
              <div className="pack-badges">
                {pack.isNew ? <span className="badge">New</span> : null}
                {pack.limitedLabel ? <span className="badge warn">{pack.limitedLabel}</span> : null}
              </div>
            </div>

            <p className="muted remaining-text">Remaining {pack.remainingStock}/{pack.totalStock}</p>

            <div className="prize-list">
              {pack.prizes.map((prize) => (
                <div className="prize-row" key={prize.id}>
                  <div>
                    <strong>{prize.label}</strong>
                    <div className="muted tiny">Est. {prize.estimatedValue.toLocaleString()} pts</div>
                  </div>
                  <div className="rate-block">
                    <div className="rate">{(prize.dropRatePercent ?? 0).toFixed(4)}%</div>
                    <div className="muted tiny">Stock {prize.remainingStock}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="price-line">
              <span className="muted">1 draw</span>
              <strong>{pack.pricePoints.toLocaleString()} pts</strong>
            </div>

            <div className="actions">
              <Link href={`/pack/${pack.id}`} className="draw-button link-button">
                Open Draw Page
              </Link>
            </div>
          </article>
        ))}
      </section>

      <footer className="site-footer">
        <a className="sort-pill" href="/customer/items">My Backpack</a>
        <a className="sort-pill" href="/fairness-proofs">Fairness Proofs</a>
      </footer>
    </main>
  );
}





