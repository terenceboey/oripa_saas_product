"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ActionIcon, Avatar, Badge, Button, Card, Container, Divider, Drawer, Group, Paper, SimpleGrid, Stack, Text, Title, Burger } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronLeft, IconChevronRight, IconCircle, IconCircleFilled } from "@tabler/icons-react";
import { VendorThemeProvider } from "../lib/vendor-theme";
import { useBackForwardRefresh } from "../lib/use-back-forward-refresh";
import { applyVendorFavicon } from "../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl, resolvePackBannerMediaUrl } from "../lib/media-url";

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
  const [navOpened, { open: openNav, close: closeNav }] = useDisclosure(false);

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
    <VendorThemeProvider theme={tenant?.vendorSettings}>
      <Container size="xl" py="lg" style={storefrontThemeStyle}>
      <Stack gap="lg">
      <Paper withBorder radius="xl" p="md" shadow="sm">
        <Group justify="space-between" align="center" gap="md" wrap="nowrap">
          <Group gap="sm" align="center" wrap="nowrap">
            <img
              src={normalizeVendorLogoUrl(tenant?.logoImageUrl) || "/default-brand-logo.png"}
              alt="Vendor logo"
              style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 12, flexShrink: 0 }}
            />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Title order={2} size="h3">
                {tenant?.name ?? "Storefront"}
              </Title>
              <Text size="sm" c="dimmed" lineClamp={1}>
                {runtimeVendorHost}
              </Text>
            </Stack>
          </Group>

          <Group gap="xs" justify="flex-end" wrap="nowrap" visibleFrom="sm">
            <Badge variant="light" size="lg">
              Points: {wallet?.balancePoints?.toLocaleString() ?? "-"}
            </Badge>
            <Button variant="subtle" component={Link} href="/setlists">
              Setlists
            </Button>
            {user ? (
              <Paper component={Link} href="/profile" withBorder radius="md" p="sm" style={{ textDecoration: "none" }}>
                <Group gap="sm" wrap="nowrap" align="center">
                  <Avatar radius="xl" color="violet" size="sm">
                    {(user.displayName || user.fullName || "C").slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Stack gap={0}>
                    <Text fw={600}>{user.displayName || user.fullName || "Customer"}</Text>
                    <Text size="sm" c="dimmed">
                      {user.email}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            ) : (
              <>
                <Button variant="light" component={Link} href="/login">
                  Customer Login
                </Button>
                <Button variant="outline" component={Link} href="/register">
                  Customer Register
                </Button>
              </>
            )}
            {user ? <Button variant="subtle" onClick={logout}>Logout</Button> : null}
          </Group>

          <Group gap="xs" wrap="nowrap" hiddenFrom="sm">
            <Badge variant="light" size="md">
              {wallet?.balancePoints?.toLocaleString() ?? "-"} pts
            </Badge>
            <Burger opened={navOpened} onClick={navOpened ? closeNav : openNav} aria-label="Open navigation" />
          </Group>
        </Group>
      </Paper>

      <Drawer
        opened={navOpened}
        onClose={closeNav}
        title="Menu"
        position="right"
        size="sm"
        padding="md"
      >
        <Stack gap="md">
          <Paper withBorder radius="lg" p="md">
            <Group gap="sm" align="center" wrap="nowrap">
              <Avatar radius="xl" color="violet">
                {(user?.displayName || user?.fullName || tenant?.name || "S").slice(0, 1).toUpperCase()}
              </Avatar>
              <Stack gap={2}>
                <Text fw={700}>{user?.displayName || user?.fullName || "Guest"}</Text>
                <Text size="sm" c="dimmed">
                  {user?.email || "Sign in to manage your profile"}
                </Text>
                <Text size="xs" c="dimmed">
                  {runtimeVendorHost}
                </Text>
              </Stack>
            </Group>
          </Paper>

          <Badge variant="light" size="lg" fullWidth>
            Points: {wallet?.balancePoints?.toLocaleString() ?? "-"}
          </Badge>

          <Button component={Link} href="/setlists" variant="light" fullWidth onClick={closeNav}>
            Setlists
          </Button>

          {user ? (
            <>
              <Button component={Link} href="/profile" variant="outline" fullWidth onClick={closeNav}>
                My Profile
              </Button>
              <Button
                variant="subtle"
                fullWidth
                onClick={() => {
                  closeNav();
                  void logout();
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button component={Link} href="/login" variant="light" fullWidth onClick={closeNav}>
                Customer Login
              </Button>
              <Button component={Link} href="/register" variant="outline" fullWidth onClick={closeNav}>
                Customer Register
              </Button>
            </>
          )}

          <Divider />

          <Button component={Link} href="/fairness-proofs" variant="subtle" fullWidth onClick={closeNav}>
            Fairness Proofs
          </Button>
        </Stack>
      </Drawer>

      <Paper withBorder radius="xl" p={0} shadow="sm" style={{ overflow: "hidden", position: "relative" }}>
        {currentBanner ? (
          <a href={currentBanner.targetUrl ?? "#"} target="_blank" rel="noreferrer" style={{ display: "block", position: "relative", color: "inherit", textDecoration: "none" }}>
            {(() => {
              const image = resolvePackBannerMediaUrl(currentBanner.imageUrl, defaultPackBanner);
              return (
                <picture style={{ display: "block", width: "100%", height: "clamp(220px, 32vw, 420px)" }}>
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

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {sortedPacks.map((pack) => (
          <Card key={pack.id} withBorder radius="xl" shadow="sm" padding="lg">
            {(() => {
              const image = resolvePackBannerMediaUrl(pack.packBannerImageUrl, defaultPackBanner);
              return (
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
                    style={{
                      display: "block",
                      width: "100%",
                      height: 220,
                      objectFit: "cover",
                      objectPosition: "center",
                      borderRadius: 16,
                      background: "transparent",
                    }}
                  />
                </picture>
              );
            })()}
            <Group justify="space-between" align="start" mt="md" mb="xs">
              <div>
                <Title order={3} size="h4">
                  {pack.title}
                </Title>
                <Text size="sm" c="dimmed">
                  Remaining {pack.remainingStock}/{pack.totalStock}
                </Text>
              </div>
              <Group gap="xs">
                {pack.isNew ? <Badge color="green" variant="light">New</Badge> : null}
                {pack.limitedLabel ? <Badge color="yellow" variant="light">{pack.limitedLabel}</Badge> : null}
              </Group>
            </Group>

            <Group justify="space-between" mt="md">
              <Text size="sm" c="dimmed">1 draw</Text>
              <Text fw={700} size="lg">{pack.pricePoints.toLocaleString()} pts</Text>
            </Group>

            <Button component={Link} href={`/pack/${pack.id}`} fullWidth mt="md">
              Open Draw Page
            </Button>
          </Card>
        ))}
      </SimpleGrid>

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





