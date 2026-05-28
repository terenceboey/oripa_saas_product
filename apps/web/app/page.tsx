"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useBackForwardRefresh } from "../lib/use-back-forward-refresh";

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
};

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  lastLoginAt?: string | null;
};

type SortKey = "recommended" | "remaining_asc" | "price_asc" | "price_desc" | "newest";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const categories = ["Pokemon", "ONE PIECE", "Yu-Gi-Oh!", "Dragon Ball"];

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
  const [sortKey, setSortKey] = useState<SortKey>("recommended");
  const [activeCategory, setActiveCategory] = useState("Pokemon");

  const headers = useMemo(() => ({ "x-vendor-host": runtimeVendorHost }), [runtimeVendorHost]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [walletResponse, packsResponse, bannersResponse, tenantResponse] = await Promise.all([
        fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/packs`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/banners`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/current`, { headers, credentials: "include", cache: "no-store" }),
      ]);

      if (!walletResponse.ok || !packsResponse.ok || !bannersResponse.ok || !tenantResponse.ok) {
        throw new Error("Failed to load storefront data. Check API and tenant config.");
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
  }, [headers]);

  const loadProfile = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/v1/auth/me`, {
        headers: {
          ...headers,
        },
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
    loadData();
    void loadProfile();
  }, [loadData, loadProfile]);

  useBackForwardRefresh(loadData);

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
    <main className="container">
      <header className="site-header">
        <div className="brand">
          <img src="/brand-cardback.jpg" alt="Oripa logo" />
          <div className="brand-text">
            <strong>{tenant?.name ?? "Storefront"}</strong>
            <span>{runtimeVendorHost}</span>
          </div>
        </div>
        <div className="header-right">
          {user ? (
            <div className="auth-inline-card">
              <strong>{user.displayName || "Customer"}</strong>
              <span>{user.email}</span>
            </div>
          ) : (
            <>
              <a className="sort-pill" href="/login">Login</a>
              <a className="sort-pill" href="/register">Register</a>
            </>
          )}
          {user ? (
            <button type="button" className="sort-pill" onClick={logout}>Logout</button>
          ) : null}
          <a className="sort-pill" href="/fairness-proofs">Fairness Proofs</a>
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
            <img className="banner-image" src={currentBanner.imageUrl} alt={currentBanner.title} />
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
            <p className="muted">Vendor: {tenant?.name ?? runtimeVendorHost}</p>
          </div>
          <button type="button" className="refresh-button" onClick={loadData} disabled={loading}>
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
    </main>
  );
}





