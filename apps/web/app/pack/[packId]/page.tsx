"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { packTierSnapshotSchema, type PackTierSnapshot } from "@oripa/shared";
import { useBackForwardRefresh } from "../../../lib/use-back-forward-refresh";
import { applyVendorFavicon } from "../../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl, resolvePackBannerMediaUrl } from "../../../lib/media-url";

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
type DrawShowcaseCard = {
  label: string;
  imageUrl: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const defaultPokemonCardImage = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const defaultPackBannerImage = "/default-pack-banner-desktop.webp";
const defaultPackBannerImageMobile = "/default-pack-banner-mobile.webp";
const clientPageHeader = { "x-client-page": "/pack/[packId]" };

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
  const [drawShowcase, setDrawShowcase] = useState<DrawResult | null>(null);
  const [drawShowcaseIndex, setDrawShowcaseIndex] = useState(0);
  const [drawShowcasePhase, setDrawShowcasePhase] = useState<"spinning" | "revealing" | "done" | null>(null);
  const [drawShowcaseCard, setDrawShowcaseCard] = useState<DrawShowcaseCard | null>(null);
  const [drawShowcaseSoundEnabled, setDrawShowcaseSoundEnabled] = useState(true);
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [vendorLogo, setVendorLogo] = useState<string | null>(null);
  const [vendorFavicon, setVendorFavicon] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const drawShowcaseSoundEnabledRef = useRef(drawShowcaseSoundEnabled);
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
      const [packResponse, walletResponse, vendorResponse] = await Promise.all([
        fetch(`${apiBase}/v1/packs/${packId}`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/current`, { headers, credentials: "include", cache: "no-store" }),
      ]);

      if (!packResponse.ok) {
        const payload = await packResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "Pack not found");
      }
      const packPayload = await packResponse.json();
      const walletPayload = walletResponse.ok ? await walletResponse.json() : { wallet: null };
      const vendorPayload = vendorResponse.ok ? await vendorResponse.json() : null;

      setPack(packPayload.pack);
      setWallet(walletPayload.wallet ?? null);
      setTheme(vendorPayload?.vendor?.vendorSettings ?? null);
      setVendorLogo(normalizeVendorLogoUrl(vendorPayload?.vendor?.logoImageUrl) || null);
      setVendorFavicon(normalizeVendorFaviconUrl(vendorPayload?.vendor?.faviconImageUrl, vendorPayload?.vendor?.logoImageUrl) || null);
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

  const isDrawShowcaseOpen = Boolean(drawShowcase);
  const drawShowcasePool = useMemo(() => {
    return (pack?.prizes ?? []).map((prize) => ({
      label: prize.label,
      imageUrl: prize.imageUrl || defaultPokemonCardImage,
    }));
  }, [pack?.prizes]);

  async function ensureAudioContext() {
    if (typeof window === "undefined") return null;
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume().catch(() => null);
    }
    return audioContextRef.current;
  }

  async function playTone(frequency: number, durationMs: number, options?: { type?: OscillatorType; gain?: number; whenMs?: number }) {
    const context = await ensureAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = options?.type ?? "sine";
    oscillator.frequency.value = frequency;
    gainNode.gain.value = options?.gain ?? 0.04;
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    const startAt = context.currentTime + ((options?.whenMs ?? 0) / 1000);
    oscillator.start(startAt);
    gainNode.gain.setValueAtTime(options?.gain ?? 0.04, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
    oscillator.stop(startAt + durationMs / 1000 + 0.05);
  }

  async function playSpinTick() {
    if (!drawShowcaseSoundEnabledRef.current) return;
    void playTone(760, 55, { type: "square", gain: 0.015 });
  }

  async function playRevealChime() {
    if (!drawShowcaseSoundEnabledRef.current) return;
    void playTone(523.25, 120, { type: "triangle", gain: 0.03 });
    void playTone(659.25, 140, { type: "triangle", gain: 0.03, whenMs: 110 });
    void playTone(783.99, 180, { type: "triangle", gain: 0.035, whenMs: 220 });
  }

  function closeDrawShowcase() {
    setDrawShowcase(null);
    setDrawShowcaseIndex(0);
    setDrawShowcasePhase(null);
    setDrawShowcaseCard(null);
    setConfettiBurstKey((value) => value + 1);
  }

  async function handleDraw(quantity: number) {
    if (!pack) return;
    setDrawing(true);
    setError(null);
    setDrawShowcase(null);
    setDrawShowcaseIndex(0);
    setDrawShowcasePhase(null);
    setDrawShowcaseCard(null);
    setConfettiBurstKey((value) => value + 1);
    void ensureAudioContext();

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
      setDrawShowcase(payload);
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
    applyVendorFavicon(normalizeVendorFaviconUrl(vendorFavicon, vendorLogo));
  }, [vendorFavicon, vendorLogo]);

  useEffect(() => {
    drawShowcaseSoundEnabledRef.current = drawShowcaseSoundEnabled;
  }, [drawShowcaseSoundEnabled]);

  useEffect(() => {
    if (!drawShowcase || !pack) return undefined;
    let active = true;
    const currentDraw = drawShowcase.draws[drawShowcaseIndex];
    const fallbackCard = drawShowcasePool[0] ?? { label: "Mystery Card", imageUrl: defaultPokemonCardImage };
    const spinPool = drawShowcasePool.length > 0 ? drawShowcasePool : [fallbackCard];
    let spinInterval: number | null = null;
    let revealTimeout: number | null = null;
    let nextTimeout: number | null = null;

    setDrawShowcasePhase("spinning");
    setDrawShowcaseCard((current) => current ?? fallbackCard);

    spinInterval = window.setInterval(() => {
      if (!active) return;
      const randomCard = spinPool[Math.floor(Math.random() * spinPool.length)] ?? fallbackCard;
      setDrawShowcaseCard(randomCard);
      void playSpinTick();
    }, 85);

    revealTimeout = window.setTimeout(() => {
      if (!active || !currentDraw) return;
      if (spinInterval) window.clearInterval(spinInterval);
      const finalCard = {
        label: currentDraw.prizeLabel || "No Prize",
        imageUrl: currentDraw.prizeImageUrl || defaultPokemonCardImage,
      };
      setDrawShowcaseCard(finalCard);
      setDrawShowcasePhase("revealing");
      setConfettiBurstKey((value) => value + 1);
      void playRevealChime();

      nextTimeout = window.setTimeout(() => {
        if (!active) return;
        if (drawShowcaseIndex < drawShowcase.draws.length - 1) {
          setDrawShowcaseIndex((value) => value + 1);
          return;
        }
        setDrawShowcasePhase("done");
      }, 1000);
    }, 1200);

    return () => {
      active = false;
      if (spinInterval) window.clearInterval(spinInterval);
      if (revealTimeout) window.clearTimeout(revealTimeout);
      if (nextTimeout) window.clearTimeout(nextTimeout);
    };
  }, [drawShowcase, drawShowcaseIndex, drawShowcasePool, pack]);

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
              const image = resolvePackBannerMediaUrl(pack.packBannerImageUrl, defaultPackBannerImage);
              return (
                <picture>
                  {image.allowSources ? <source media="(max-width: 760px)" srcSet={image.mobile} type={image.mobileType ?? undefined} /> : null}
                  {image.allowSources ? <source srcSet={image.desktop} type={image.desktopType ?? undefined} /> : null}
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
              <button type="button" className="draw-button" disabled={drawing || isDrawShowcaseOpen || pack.remainingStock < 1} onClick={() => handleDraw(1)}>Draw</button>
              <button type="button" className="draw-button alt" disabled={drawing || isDrawShowcaseOpen || pack.remainingStock < 10} onClick={() => handleDraw(10)}>10x Draw</button>
            </div>
            {error ? <p className="error">{error}</p> : null}
          </section>

          {tierSnapshot && tierSnapshot.tiers.length > 0 ? (
            <section className="card" style={{ marginTop: 12 }}>
              <h2>Contents</h2>
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

      {drawShowcase ? (
        <div className="draw-showcase-backdrop" onClick={drawShowcasePhase === "done" ? closeDrawShowcase : undefined}>
          <section className="draw-showcase-modal card" onClick={(event) => event.stopPropagation()}>
            <div key={confettiBurstKey} className="draw-showcase-confetti" aria-hidden="true">
              {Array.from({ length: 36 }).map((_, index) => {
                const left = (index * 13) % 100;
                const delay = (index % 6) * 0.05;
                const duration = 1.6 + (index % 5) * 0.18;
                const hue = (index * 37) % 360;
                const drift = ((index % 9) - 4) * 14;
                return <span key={`${confettiBurstKey}-${index}`} className="confetti-piece" style={{ ["--drift" as string]: `${drift}px`, left: `${left}%`, background: `hsl(${hue} 85% 60%)`, animationDelay: `${delay}s`, animationDuration: `${duration}s` }} />;
              })}
            </div>
            <div className="heading-row">
              <div>
                <h3>Lottery Reveal</h3>
                <p className="muted tiny">
                  {drawShowcasePhase === "spinning"
                    ? "Spinning the lottery..."
                    : drawShowcasePhase === "revealing"
                      ? "Result locked in."
                      : "Draw complete."}
                </p>
              </div>
              <div className="actions">
                <button type="button" className={`sort-pill ${drawShowcaseSoundEnabled ? "active" : ""}`} onClick={() => setDrawShowcaseSoundEnabled((value) => !value)}>
                  Sound {drawShowcaseSoundEnabled ? "On" : "Off"}
                </button>
                {drawShowcasePhase === "done" ? (
                  <button type="button" className="sort-pill" onClick={closeDrawShowcase}>
                    Close
                  </button>
                ) : null}
              </div>
            </div>

            <div className={`draw-lottery-stage ${drawShowcasePhase ?? "spinning"}`}>
              <div className="draw-lottery-badge">#{drawShowcaseIndex + 1} of {drawShowcase.draws.length}</div>
              <div className="draw-lottery-card">
                <img src={drawShowcaseCard?.imageUrl ?? defaultPokemonCardImage} alt={drawShowcaseCard?.label ?? "Lottery draw"} />
              </div>
              <div className="draw-lottery-label">
                <strong>{drawShowcaseCard?.label ?? "Spinning..."}</strong>
                {drawShowcasePhase === "revealing" ? <span className="badge warn">Winner</span> : null}
              </div>
            </div>

            <div className="draw-showcase-footer">
              <p className="muted tiny">
                {drawShowcase.quantity} draw{drawShowcase.quantity > 1 ? "s" : ""} | Cost {drawShowcase.totalCost.toLocaleString()} pts
              </p>
              {drawShowcasePhase === "done" ? (
                <button type="button" className="draw-button" onClick={closeDrawShowcase}>
                  Continue
                </button>
              ) : null}
            </div>
          </section>
        </div>
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



