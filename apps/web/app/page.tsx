"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import Link from "next/link";
import { ActionIcon, Badge, Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconCircle, IconCircleFilled } from "@tabler/icons-react";
import { StorefrontFooter } from "../components/storefront-footer";
import { StorefrontNav } from "../components/storefront-nav";
import { buildVendorCssVariables, VendorThemeProvider } from "../lib/vendor-theme";
import { useBackForwardRefresh } from "../lib/use-back-forward-refresh";
import { applyVendorFavicon } from "../lib/favicon";
import { normalizeVendorFaviconUrl, resolvePackBannerMediaUrl } from "../lib/media-url";

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
  packCoverImageUrl?: string | null;
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
    storefrontThemePreset?: string | null;
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
type PackSlideDirection = "next" | "previous";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/" };
const defaultPackBanner = "/default-pack-banner-desktop.webp";
const defaultPackBannerMobile = "/default-pack-banner-mobile.webp";

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
  const [activePackIndex, setActivePackIndex] = useState(0);
  const [packSlideDirection, setPackSlideDirection] = useState<PackSlideDirection>("next");
  const [packSlideNonce, setPackSlideNonce] = useState(0);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const suppressPackClickRef = useRef(false);

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

      if (!packsResponse.ok || !bannersResponse.ok) {
        throw new Error("Failed to load vendor storefront data.");
      }

      const walletPayload = walletResponse.ok ? await walletResponse.json() : { wallet: null };
      const packsPayload = await packsResponse.json();
      const bannersPayload = await bannersResponse.json();
      const tenantPayload = await tenantResponse.json();

      setWallet(walletPayload.wallet ?? null);
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

  useEffect(() => {
    if (!sortedPacks.length) {
      setActivePackIndex(0);
      return;
    }
    setActivePackIndex((current) => Math.min(current, sortedPacks.length - 1));
  }, [sortedPacks.length]);

  const currentBanner = banners[bannerIndex];
  const activePack = sortedPacks[activePackIndex] ?? null;
  const previousPack = sortedPacks.length > 1 ? sortedPacks[(activePackIndex - 1 + sortedPacks.length) % sortedPacks.length] : null;
  const nextPack = sortedPacks.length > 2 ? sortedPacks[(activePackIndex + 1) % sortedPacks.length] : sortedPacks.length === 2 ? sortedPacks[(activePackIndex + 1) % sortedPacks.length] : null;
  const storefrontThemeStyle = useMemo(() => buildVendorCssVariables(tenant?.vendorSettings), [tenant?.vendorSettings]);

  function goToPreviousBanner() {
    if (!banners.length) return;
    setBannerIndex((current) => (current - 1 + banners.length) % banners.length);
  }

  function goToNextBanner() {
    if (!banners.length) return;
    setBannerIndex((current) => (current + 1) % banners.length);
  }

  function goToPack(index: number, direction: PackSlideDirection) {
    if (!sortedPacks.length) return;
    setPackSlideDirection(direction);
    setPackSlideNonce((current) => current + 1);
    setActivePackIndex((index + sortedPacks.length) % sortedPacks.length);
  }

  function goToPreviousPack() {
    goToPack(activePackIndex - 1, "previous");
  }

  function goToNextPack() {
    goToPack(activePackIndex + 1, "next");
  }

  function goToPackDot(index: number) {
    if (index === activePackIndex || sortedPacks.length <= 1) return;
    const forwardDistance = (index - activePackIndex + sortedPacks.length) % sortedPacks.length;
    const backwardDistance = (activePackIndex - index + sortedPacks.length) % sortedPacks.length;
    goToPack(index, forwardDistance <= backwardDistance ? "next" : "previous");
  }

  function handlePackPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (sortedPacks.length <= 1) return;
    swipeStartXRef.current = event.clientX;
    swipeStartYRef.current = event.clientY;
  }

  function handlePackPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;

    const deltaX = event.clientX - swipeStartXRef.current;
    const deltaY = event.clientY - swipeStartYRef.current;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    suppressPackClickRef.current = true;
    if (deltaX < 0) {
      goToNextPack();
    } else {
      goToPreviousPack();
    }
    window.setTimeout(() => {
      suppressPackClickRef.current = false;
    }, 250);
  }

  function handlePackPointerCancel() {
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
  }

  function getTopPrize(pack: Pack) {
    return pack.prizes.reduce<Prize | null>((best, prize) => {
      if (!best || prize.estimatedValue > best.estimatedValue) return prize;
      return best;
    }, null);
  }

  function renderPackCard(pack: Pack, variant: "active" | "side", label: string, onSelect?: () => void) {
    const image = resolvePackBannerMediaUrl(pack.packCoverImageUrl ?? pack.packBannerImageUrl, defaultPackBanner);
    const topPrize = getTopPrize(pack);
    const isActive = variant === "active";
    const coverStyle = {
      backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(5,4,10,0.18)), url(${JSON.stringify(image.fallback)})`,
    } as CSSProperties;

    return (
      <div
        className={isActive ? "pack-carousel-card pack-carousel-card-active" : "pack-carousel-card pack-carousel-card-side"}
        onClick={onSelect ? () => {
          if (suppressPackClickRef.current) return;
          onSelect();
        } : undefined}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onKeyDown={onSelect ? (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (suppressPackClickRef.current) return;
          onSelect();
        } : undefined}
        style={{ cursor: onSelect ? "pointer" : "default" }}
      >
        <div className="pack-carousel-cover" aria-label={`${pack.title} cover`} style={coverStyle}>
          <span className="pack-carousel-cover-glow" aria-hidden="true" />
        </div>

        {isActive ? (
          <Stack className="pack-carousel-details" gap="md" mt="md" align="center">
            <Group justify="center" gap={6}>
              <Badge color="violet" variant="light">{label}</Badge>
                {pack.isNew ? <Badge color="green" variant="light">New</Badge> : null}
                {pack.limitedLabel ? <Badge color="yellow" variant="light">{pack.limitedLabel}</Badge> : null}
            </Group>
            <Stack gap={2} align="center">
              <Title order={2} size="h2" ta="center">
                {pack.title}
              </Title>
              <Text className="pack-carousel-subtitle" ta="center" lineClamp={1}>
                {topPrize ? `Top pull: ${topPrize.label}` : "Mystery prizes inside"}
              </Text>
            </Stack>

            <div className="pack-carousel-stats">
              <div>
                <Text size="xs" fw={700} tt="uppercase">Price</Text>
                <Text fw={900}>{pack.pricePoints.toLocaleString()} pts</Text>
              </div>
              <div>
                <Text size="xs" fw={700} tt="uppercase">Inside</Text>
                <Text fw={900}>{pack.prizes.length.toLocaleString()} prizes</Text>
              </div>
              <div>
                <Text size="xs" fw={700} tt="uppercase">Remaining</Text>
                <Text fw={900}>{pack.remainingStock.toLocaleString()}/{pack.totalStock.toLocaleString()}</Text>
              </div>
            </div>

            <Button component={Link} href={`/pack/${pack.id}`} fullWidth size="lg" radius="xl" className="pack-carousel-action">
              Open Draw Page
            </Button>
          </Stack>
        ) : (
          <div className="pack-carousel-preview-label">
            <Text fw={900} lineClamp={1}>{pack.title}</Text>
            <Text size="xs">{pack.pricePoints.toLocaleString()} pts</Text>
          </div>
        )}
      </div>
    );
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
    <VendorThemeProvider theme={tenant?.vendorSettings}>
      <Container size="xl" py="lg" style={storefrontThemeStyle}>
      <Stack gap="lg">
      <StorefrontNav
        brandName={tenant?.name ?? "Storefront"}
        host={runtimeVendorHost}
        logoUrl={tenant?.logoImageUrl}
        pointsLabel={`Points: ${wallet?.balancePoints?.toLocaleString() ?? "-"}`}
        desktopActions={[{ label: "Setlists", href: "/setlists", variant: "subtle" }]}
        drawerActions={[
          { label: "Setlists", href: "/setlists", variant: "light" },
          { label: "Fairness Proofs", href: "/fairness-proofs", variant: "subtle" },
        ]}
        user={user}
        onLogout={logout}
      />

      <Paper withBorder radius="xl" p={0} shadow="sm" style={{ overflow: "hidden", position: "relative", width: "100%" }}>
        {currentBanner ? (
          <a href={currentBanner.targetUrl ?? "#"} target="_blank" rel="noreferrer" style={{ display: "block", position: "relative", color: "inherit", textDecoration: "none" }}>
            {(() => {
              const image = resolvePackBannerMediaUrl(currentBanner.imageUrl, defaultPackBanner);
              return (
                <picture style={{ display: "block", width: "100%", aspectRatio: "16 / 9" }}>
                  {image.allowSources ? <source media="(max-width: 760px)" srcSet={image.mobile} type={image.mobileType ?? undefined} /> : null}
                  {image.allowSources ? <source srcSet={image.desktop} type={image.desktopType ?? undefined} /> : null}
                  <img
                    src={image.fallback}
                    alt={currentBanner.title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = defaultPackBannerMobile;
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center",
                      background: "transparent",
                    }}
                  />
                </picture>
              );
            })()}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.52))" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "end", padding: 24 }}>
              <Stack gap={4}>
                <Title order={2} c="white">{currentBanner.title}</Title>
                <Text c="white" opacity={0.9}>Limited-time campaign</Text>
              </Stack>
            </div>
          </a>
        ) : (
          <Stack gap="xs" p="xl">
            <Title order={3}>No banner yet</Title>
            <Text c="dimmed">Add banners in vendor dashboard.</Text>
          </Stack>
        )}

        {banners.length > 1 ? (
          <>
            <ActionIcon
              variant="white"
              size="lg"
              radius="xl"
              aria-label="Previous banner"
              onClick={goToPreviousBanner}
              style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }}
            >
              <IconChevronLeft size={20} stroke={2.5} />
            </ActionIcon>
            <ActionIcon
              variant="white"
              size="lg"
              radius="xl"
              aria-label="Next banner"
              onClick={goToNextBanner}
              style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }}
            >
              <IconChevronRight size={20} stroke={2.5} />
            </ActionIcon>
            <Group gap={6} justify="center" style={{ position: "absolute", left: 0, right: 0, bottom: 16 }}>
              {banners.map((banner, index) => (
                <ActionIcon
                  key={banner.id}
                  variant={index === bannerIndex ? "filled" : "light"}
                  size="sm"
                  radius="xl"
                  onClick={() => setBannerIndex(index)}
                  aria-label={'Go to banner ' + (index + 1)}
                >
                  {index === bannerIndex ? <IconCircleFilled size={10} /> : <IconCircle size={10} />}
                </ActionIcon>
              ))}
            </Group>
          </>
        ) : null}
      </Paper>

      <Paper withBorder radius="xl" p={{ base: "md", md: "xl" }} shadow="sm" className="pack-carousel-shell">
        {activePack ? (
          <Stack gap="md">
            {error ? <Text c="red">{error}</Text> : null}
            <div
              className={`pack-carousel-stage pack-carousel-stage-${packSlideDirection}`}
              onPointerDown={handlePackPointerDown}
              onPointerUp={handlePackPointerUp}
              onPointerCancel={handlePackPointerCancel}
              onPointerLeave={handlePackPointerCancel}
            >
              {sortedPacks.length > 1 ? (
                <div className="pack-carousel-floating-controls" aria-label="Pack carousel navigation">
                  <ActionIcon
                    variant="white"
                    size="xl"
                    radius="xl"
                    aria-label="Previous pack"
                    onClick={goToPreviousPack}
                    disabled={sortedPacks.length <= 1}
                    className="pack-carousel-floating-button pack-carousel-floating-button-left"
                  >
                    <IconChevronLeft size={22} stroke={2.5} />
                  </ActionIcon>
                  <ActionIcon
                    variant="white"
                    size="xl"
                    radius="xl"
                    aria-label="Next pack"
                    onClick={goToNextPack}
                    disabled={sortedPacks.length <= 1}
                    className="pack-carousel-floating-button pack-carousel-floating-button-right"
                  >
                    <IconChevronRight size={22} stroke={2.5} />
                  </ActionIcon>
                </div>
              ) : null}
              {previousPack ? (
                <div key={`previous-${previousPack.id}-${packSlideNonce}`} className={`pack-carousel-side pack-carousel-side-left pack-carousel-side-left-${packSlideDirection}`}>
                  {renderPackCard(previousPack, "side", "Previous", goToPreviousPack)}
                </div>
              ) : null}

              <div key={`active-${activePack.id}-${packSlideNonce}`} className={`pack-carousel-active pack-carousel-active-${packSlideDirection}`}>
                {renderPackCard(activePack, "active", `Pack ${activePackIndex + 1} of ${sortedPacks.length}`)}
              </div>

              {nextPack ? (
                <div key={`next-${nextPack.id}-${packSlideNonce}`} className={`pack-carousel-side pack-carousel-side-right pack-carousel-side-right-${packSlideDirection}`}>
                  {renderPackCard(nextPack, "side", "Next", goToNextPack)}
                </div>
              ) : null}
            </div>

            <Group justify="center" gap="sm">
              <ActionIcon variant="light" size="lg" radius="xl" aria-label="Previous pack" onClick={goToPreviousPack} disabled={sortedPacks.length <= 1}>
                <IconChevronLeft size={20} stroke={2.5} />
              </ActionIcon>
              <Group gap={6}>
                {sortedPacks.map((pack, index) => (
                  <ActionIcon
                    key={pack.id}
                    variant={index === activePackIndex ? "filled" : "light"}
                    size="sm"
                    radius="xl"
                    onClick={() => goToPackDot(index)}
                    aria-label={'Go to pack ' + (index + 1)}
                  >
                    {index === activePackIndex ? <IconCircleFilled size={10} /> : <IconCircle size={10} />}
                  </ActionIcon>
                ))}
              </Group>
              <ActionIcon variant="light" size="lg" radius="xl" aria-label="Next pack" onClick={goToNextPack} disabled={sortedPacks.length <= 1}>
                <IconChevronRight size={20} stroke={2.5} />
              </ActionIcon>
            </Group>
          </Stack>
        ) : (
          <Stack gap="xs" align="center" py="xl">
            {error ? <Text c="red">{error}</Text> : null}
            <Title order={3}>No live packs yet</Title>
            <Text c="dimmed">Check back when this storefront publishes a pack.</Text>
          </Stack>
        )}
      </Paper>

      <StorefrontFooter brandName={tenant?.name ?? "Storefront"} host={runtimeVendorHost} user={user} onLogout={logout} />
      </Stack>
      </Container>
    </VendorThemeProvider>
  );
}





