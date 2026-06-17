"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ActionIcon, Badge, Button, Card, Container, Divider, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconCircle, IconCircleFilled } from "@tabler/icons-react";
import { StorefrontNav } from "../components/storefront-nav";
import { VendorThemeProvider } from "../lib/vendor-theme";
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

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const categories = ["Pokemon", "ONE PIECE", "Yu-Gi-Oh!", "Dragon Ball"];
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
  const [activeCategory, setActiveCategory] = useState("Pokemon");
  const [activePackIndex, setActivePackIndex] = useState(0);

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

  function goToPreviousPack() {
    if (!sortedPacks.length) return;
    setActivePackIndex((current) => (current - 1 + sortedPacks.length) % sortedPacks.length);
  }

  function goToNextPack() {
    if (!sortedPacks.length) return;
    setActivePackIndex((current) => (current + 1) % sortedPacks.length);
  }

  function getTopPrize(pack: Pack) {
    return pack.prizes.reduce<Prize | null>((best, prize) => {
      if (!best || prize.estimatedValue > best.estimatedValue) return prize;
      return best;
    }, null);
  }

  function renderPackCard(pack: Pack, variant: "active" | "side", label: string, onSelect?: () => void) {
    const image = resolvePackBannerMediaUrl(pack.packBannerImageUrl, defaultPackBanner);
    const topPrize = getTopPrize(pack);
    const isActive = variant === "active";

    return (
      <Card
        withBorder
        radius="lg"
        shadow={isActive ? "lg" : "sm"}
        padding={isActive ? "lg" : "sm"}
        className={isActive ? "pack-carousel-card pack-carousel-card-active" : "pack-carousel-card pack-carousel-card-side"}
        onClick={onSelect}
        style={{ cursor: onSelect ? "pointer" : "default" }}
      >
        <picture style={{ display: "block", width: "100%" }}>
          {image.allowSources ? <source media="(max-width: 760px)" srcSet={image.mobile} type={image.mobileType ?? undefined} /> : null}
          {image.allowSources ? <source srcSet={image.desktop} type={image.desktopType ?? undefined} /> : null}
          <img
            src={image.fallback}
            alt={`${pack.title} banner`}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = defaultPackBannerMobile;
            }}
            className="pack-carousel-image"
          />
        </picture>

        <Stack gap={isActive ? "md" : 6} mt={isActive ? "md" : "xs"}>
          <Group justify="space-between" align="start" gap="sm">
            <div>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                {label}
              </Text>
              <Title order={isActive ? 2 : 4} size={isActive ? "h3" : "h5"}>
                {pack.title}
              </Title>
            </div>
            <Group gap={6}>
              {pack.isNew ? <Badge color="green" variant="light">New</Badge> : null}
              {pack.limitedLabel ? <Badge color="yellow" variant="light">{pack.limitedLabel}</Badge> : null}
            </Group>
          </Group>

          {isActive ? (
            <>
              <div className="pack-carousel-stats">
                <div>
                  <Text size="xs" c="dimmed" fw={700} tt="uppercase">Price</Text>
                  <Text fw={900}>{pack.pricePoints.toLocaleString()} pts</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700} tt="uppercase">Remaining</Text>
                  <Text fw={900}>{pack.remainingStock.toLocaleString()}/{pack.totalStock.toLocaleString()}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700} tt="uppercase">Top Prize</Text>
                  <Text fw={900} lineClamp={1}>{topPrize?.label ?? "Mystery prize"}</Text>
                </div>
              </div>

              <Button component={Link} href={`/pack/${pack.id}`} fullWidth size="md">
                Open Draw Page
              </Button>
            </>
          ) : (
            <Text size="sm" c="dimmed">
              {pack.pricePoints.toLocaleString()} pts per draw
            </Text>
          )}
        </Stack>
      </Card>
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

      <Paper withBorder radius="xl" p="lg" shadow="sm">
        <Group justify="space-between" align="center" mb="md">
          <div>
            <Title order={1} size="h2">
              {activeCategory} Mystery Packs
            </Title>
            <Text c="dimmed">Browse live packs on this storefront.</Text>
          </div>
          <Button onClick={() => void loadData(true)} loading={loading} variant="light">
            Refresh
          </Button>
        </Group>
        {error ? <Text c="red">{error}</Text> : null}
      </Paper>

      <Paper withBorder radius="xl" p={{ base: "md", md: "xl" }} shadow="sm" className="pack-carousel-shell">
        {activePack ? (
          <Stack gap="md">
            <div className="pack-carousel-stage">
              {previousPack ? (
                <div className="pack-carousel-side pack-carousel-side-left">
                  {renderPackCard(previousPack, "side", "Previous", goToPreviousPack)}
                </div>
              ) : null}

              <div className="pack-carousel-active">
                {renderPackCard(activePack, "active", `Pack ${activePackIndex + 1} of ${sortedPacks.length}`)}
              </div>

              {nextPack ? (
                <div className="pack-carousel-side pack-carousel-side-right">
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
                    onClick={() => setActivePackIndex(index)}
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
            <Title order={3}>No live packs yet</Title>
            <Text c="dimmed">Check back when this storefront publishes a pack.</Text>
          </Stack>
        )}
      </Paper>

      <Paper withBorder radius="xl" p="lg" shadow="sm">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          <Stack gap={6}>
            <Text fw={800} size="lg">
              {tenant?.name ?? "Storefront"}
            </Text>
            <Text c="dimmed" size="sm">
              Browse live packs, check setlists, and manage your profile from a mobile-first storefront.
            </Text>
            <Badge variant="light" size="lg" w="fit-content">
              {runtimeVendorHost}
            </Badge>
          </Stack>

          <Stack gap={8}>
            <Text fw={700}>Quick links</Text>
            <Button component={Link} href="/setlists" variant="subtle" justify="flex-start" px={0}>
              Setlists
            </Button>
            <Button component={Link} href="/fairness-proofs" variant="subtle" justify="flex-start" px={0}>
              Fairness Proofs
            </Button>
            <Button component={Link} href="/profile" variant="subtle" justify="flex-start" px={0}>
              My Profile
            </Button>
          </Stack>

          <Stack gap={8}>
            <Text fw={700}>Account</Text>
            {user ? (
              <>
                <Text size="sm" c="dimmed">
                  {user.displayName || user.fullName || "Customer"}
                </Text>
                <Text size="sm" c="dimmed">
                  {user.email}
                </Text>
                <Button variant="light" onClick={logout} fullWidth>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button component={Link} href="/login" variant="light" fullWidth>
                  Customer Login
                </Button>
                <Button component={Link} href="/register" variant="outline" fullWidth>
                  Customer Register
                </Button>
              </>
            )}
          </Stack>
        </SimpleGrid>

        <Divider my="lg" />

        <Group justify="space-between" align="center" gap="md" wrap="wrap">
          <Text size="sm" c="dimmed">
            Powered by Oripa. {new Date().getFullYear()}.
          </Text>
          <Text size="sm" c="dimmed">
            Use the mobile menu for account actions and quick access.
          </Text>
        </Group>
      </Paper>
      </Stack>
      </Container>
    </VendorThemeProvider>
  );
}





