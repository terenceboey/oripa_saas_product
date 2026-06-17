"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Container, Group, Image, Paper, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Title } from "@mantine/core";
import { StorefrontNav } from "../../components/storefront-nav";
import { applyVendorFavicon } from "../../lib/favicon";
import { normalizeVendorFaviconUrl } from "../../lib/media-url";
import { buildVendorCssVariables, type VendorStorefrontTheme, VendorThemeProvider } from "../../lib/vendor-theme";

type SetlistItem = {
  id: string;
  source: string;
  sourceSetId: string;
  game: string;
  setCode?: string | null;
  name: string;
  releaseDate?: string | null;
  cardCount: number;
  sealedProductCount: number;
  symbolImageUrl?: string | null;
  logoImageUrl?: string | null;
  bannerImageUrl?: string | null;
  resolvedLogoImageUrl?: string | null;
  resolvedSymbolImageUrl?: string | null;
  resolvedBannerImageUrl?: string | null;
};

type SetlistResponse = {
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  items: SetlistItem[];
};

type SetlistStatsResponse = {
  total?: number;
  byGame?: Record<string, number>;
};

type Tenant = {
  name: string;
  logoImageUrl?: string | null;
  faviconImageUrl?: string | null;
  vendorSettings?: VendorStorefrontTheme | null;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const PAGE_SIZE = 18;
const clientPageHeader = { "x-client-page": "/setlists" };
const gameOptions = [
  { value: "pokemon", label: "Pokemon" },
  { value: "one-piece", label: "One Piece" },
  { value: "pokemon-japan", label: "Pokemon Japan" },
] as const;

export default function SetlistsPage() {
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const [game, setGame] = useState<(typeof gameOptions)[number]["value"]>("pokemon");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [mainData, setMainData] = useState<SetlistResponse>({ total: 0, totalPages: 1, page: 1, limit: PAGE_SIZE, items: [] });
  const [recentItems, setRecentItems] = useState<SetlistItem[]>([]);
  const [tabCounts, setTabCounts] = useState({ pokemon: 0, onePiece: 0, pokemonJapan: 0 });

  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/v1/vendor/current`, {
      headers: clientPageHeader,
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((payload) => {
        if (!active || !payload) return;
        setTenant((payload.vendor ?? payload.tenant ?? null) as Tenant | null);
      })
      .catch(() => {
        if (!active) return;
        setTenant(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyVendorFavicon(normalizeVendorFaviconUrl(tenant?.faviconImageUrl, tenant?.logoImageUrl));
  }, [tenant?.faviconImageUrl, tenant?.logoImageUrl]);

  useEffect(() => {
    setPage(1);
  }, [game, query, sort]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const fetchRequiredJson = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Setlist request failed: ${response.status}`);
      }
      return response.json();
    };

    const fetchOptionalJson = async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    };

    const buildListUrl = (gameKey: string, params: { page?: number; limit?: number; q?: string; sort?: string }) => {
      const url = new URL(`${apiBase}/v1/public/setlists`);
      url.searchParams.set("game", gameKey);
      url.searchParams.set("page", String(params.page ?? 1));
      url.searchParams.set("limit", String(params.limit ?? PAGE_SIZE));
      url.searchParams.set("sort", params.sort ?? sort);
      if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
      return url.toString();
    };

    const statsUrl = new URL(`${apiBase}/v1/public/setlists/stats`);

    const fetchTabCounts = async (statsPayload: unknown, mainPayload: SetlistResponse) => {
      const typedStats = (statsPayload ?? {}) as SetlistStatsResponse;
      const byGame = typedStats.byGame ?? {};
      if (Object.keys(byGame).length > 0) {
        return {
          pokemon: Number(byGame.POKEMON ?? 0),
          onePiece: Number(byGame.ONE_PIECE ?? 0),
          pokemonJapan: Number(byGame.POKEMON_JAPAN ?? 0),
        };
      }

      const [pokemonPayload, onePiecePayload, japanPayload] = await Promise.all([
        fetchOptionalJson(buildListUrl("pokemon", { page: 1, limit: 1, sort: "newest" })),
        fetchOptionalJson(buildListUrl("one-piece", { page: 1, limit: 1, sort: "newest" })),
        fetchOptionalJson(buildListUrl("pokemon-japan", { page: 1, limit: 1, sort: "newest" })),
      ]);

      return {
        pokemon: Number((pokemonPayload as SetlistResponse | null)?.total ?? (game === "pokemon" ? mainPayload.total : 0)),
        onePiece: Number((onePiecePayload as SetlistResponse | null)?.total ?? (game === "one-piece" ? mainPayload.total : 0)),
        pokemonJapan: Number((japanPayload as SetlistResponse | null)?.total ?? (game === "pokemon-japan" ? mainPayload.total : 0)),
      };
    };

    Promise.all([
      fetchRequiredJson(buildListUrl(game, { page, limit: PAGE_SIZE, q: query, sort })),
      fetchRequiredJson(buildListUrl(game, { page: 1, limit: 5, sort: "newest" })),
      fetchOptionalJson(statsUrl.toString()),
    ])
      .then(async ([mainPayload, recentPayload, statsPayload]) => {
        if (!active) return;
        const typedMainPayload = mainPayload as SetlistResponse;
        const typedRecentPayload = recentPayload as SetlistResponse;
        const counts = await fetchTabCounts(statsPayload, typedMainPayload);
        if (!active) return;
        setMainData({
          total: Number(typedMainPayload?.total ?? 0),
          totalPages: Number(typedMainPayload?.totalPages ?? 1),
          page: Number(typedMainPayload?.page ?? 1),
          limit: Number(typedMainPayload?.limit ?? PAGE_SIZE),
          items: Array.isArray(typedMainPayload?.items) ? typedMainPayload.items : [],
        });
        setRecentItems(Array.isArray(typedRecentPayload?.items) ? typedRecentPayload.items : []);
        setTabCounts(counts);
      })
      .catch(() => {
        if (!active) return;
        setMainData({ total: 0, totalPages: 1, page: 1, limit: PAGE_SIZE, items: [] });
        setRecentItems([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [game, page, query, sort]);

  const featured = useMemo(() => recentItems[0] ?? mainData.items[0] ?? null, [recentItems, mainData.items]);
  const totalPages = Math.max(1, mainData.totalPages || 1);
  const currentPage = Math.min(Math.max(1, mainData.page || page), totalPages);
  const storefrontThemeStyle = useMemo(() => buildVendorCssVariables(tenant?.vendorSettings), [tenant?.vendorSettings]);

  return (
    <VendorThemeProvider theme={tenant?.vendorSettings}>
    <Container size="xl" py="xl" style={storefrontThemeStyle}>
      <Stack gap="lg">
        <StorefrontNav
          brandName={tenant?.name ?? "Storefront"}
          host={runtimeVendorHost}
          logoUrl={tenant?.logoImageUrl}
          desktopActions={[{ label: "Home", href: "/", variant: "subtle" }]}
          drawerActions={[
            { label: "Home", href: "/", variant: "light" },
            { label: "Fairness Proofs", href: "/fairness-proofs", variant: "subtle" },
          ]}
        />

        <Paper withBorder radius="xl" p="lg" shadow="sm">
          <Stack gap="md">
            <div>
              <Title order={1}>Setlists</Title>
              <Text c="dimmed" mt={4}>
                Browse every release across the platform.
              </Text>
            </div>

            <Tabs value={game} onChange={(value) => setGame((value as typeof game) ?? "pokemon")} variant="pills" radius="xl">
              <Tabs.List>
                {gameOptions.map((option) => (
                  <Tabs.Tab key={option.value} value={option.value}>
                    {option.label} <Badge ml={8} variant="light">{option.value === "pokemon" ? tabCounts.pokemon : option.value === "one-piece" ? tabCounts.onePiece : tabCounts.pokemonJapan}</Badge>
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          </Stack>
        </Paper>

        <Paper withBorder radius="xl" p="md" shadow="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput label="Search sets" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sets..." />
            <Select
              label="Sort"
              value={sort}
              onChange={(value) => setSort((value as "newest" | "oldest" | "name") ?? "newest")}
              data={[
                { value: "newest", label: "Release Date: Newest" },
                { value: "oldest", label: "Release Date: Oldest" },
                { value: "name", label: "Name: A-Z" },
              ]}
            />
          </SimpleGrid>
        </Paper>

        {featured ? (
          <Paper withBorder radius="xl" p="lg" shadow="sm" style={{ background: "linear-gradient(120deg, rgba(159,144,255,.18), rgba(116,200,255,.18))" }}>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" verticalSpacing="lg">
              <SetImage set={featured} hero />
              <Stack gap="sm" justify="center">
                <Badge variant="light">Latest release</Badge>
                <Title order={2}>{featured.name}</Title>
                <Text c="dimmed">
                  {(featured.releaseDate ? new Date(featured.releaseDate).toLocaleDateString() : "Unknown date")} | {featured.cardCount} cards
                </Text>
                <Button component={Link} href={`/setlists/${featured.sourceSetId}?game=${game}&source=${encodeURIComponent(featured.source)}`}>
                  Browse cards
                </Button>
              </Stack>
              <Group justify="center" align="center" wrap="nowrap">
                {fanCards(featured).map((card, index) => (
                  <Card key={`${card.label}-${index}`} withBorder radius="lg" p="xs" style={{ width: 120, transform: index === 0 ? "rotate(-14deg)" : index === 2 ? "rotate(10deg)" : "none" }}>
                    <Image src={card.imageUrl} alt="" radius="md" h={160} fit="cover" />
                  </Card>
                ))}
              </Group>
            </SimpleGrid>
          </Paper>
        ) : null}

        <Paper withBorder radius="xl" p="lg" shadow="sm">
          <Group justify="space-between" mb="md">
            <Title order={2} size="h3">
              Recent Releases
            </Title>
            <Text c="dimmed" fw={700}>
              View all sets
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            {recentItems.map((set) => (
              <SetCard key={`recent-${set.id}`} set={set} game={game} recent />
            ))}
          </SimpleGrid>
        </Paper>

        <Paper withBorder radius="xl" p="lg" shadow="sm">
          <Group justify="space-between" mb="md">
            <Title order={2} size="h3">
              All Sets
            </Title>
            <Text c="dimmed" size="sm">
              {mainData.total} total sets
            </Text>
          </Group>

          {loading ? <Text c="dimmed">Loading setlists...</Text> : null}

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
            {mainData.items.map((set) => (
              <SetCard key={`set-${set.id}`} set={set} game={game} />
            ))}
          </SimpleGrid>

          <Group justify="center" mt="lg">
            <Button variant="default" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </Button>
            <Text c="dimmed" fw={700}>
              {currentPage} / {totalPages}
            </Text>
            <Button variant="default" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Next
            </Button>
          </Group>
        </Paper>
      </Stack>
    </Container>
    </VendorThemeProvider>
  );
}

function imageForSet(set: SetlistItem) {
  return set.resolvedBannerImageUrl || set.bannerImageUrl || set.resolvedLogoImageUrl || set.logoImageUrl || set.resolvedSymbolImageUrl || set.symbolImageUrl || null;
}

function SetImage({ set, hero = false }: { set: SetlistItem; hero?: boolean }) {
  const imageSrc = imageForSet(set);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [imageSrc]);

  const src = imageSrc && failedSrc !== imageSrc ? imageSrc : null;
  const fallback = (
    <Paper withBorder radius="lg" p="lg" ta="center" style={{ minHeight: hero ? 240 : 180, display: "grid", placeItems: "center" }}>
      <Stack gap={4} align="center">
        <Text fw={900} size={hero ? "2rem" : "1.5rem"}>
          {set.setCode || set.name.slice(0, 3).toUpperCase()}
        </Text>
        <Text size="xs" tt="uppercase" c="dimmed" fw={800}>
          image missing
        </Text>
      </Stack>
    </Paper>
  );

  if (!src) return fallback;

  return <Image src={src} alt={set.name} radius="lg" fit="contain" h={hero ? 240 : 180} onError={() => setFailedSrc(src)} />;
}

function SetCard({ set, game, recent = false }: { set: SetlistItem; game: string; recent?: boolean }) {
  return (
    <Card component={Link} href={`/setlists/${set.sourceSetId}?game=${game}&source=${encodeURIComponent(set.source)}`} withBorder radius="lg" p="md">
      <Card.Section>
        <Paper withBorder radius={0} p="xs" style={{ display: "grid", placeItems: "center", minHeight: 180 }}>
          <SetImage set={set} />
        </Paper>
      </Card.Section>
      <Stack gap={4} mt="sm">
        <Title order={4} lineClamp={2}>{set.name}</Title>
        <Text size="sm" c="dimmed">
          {(set.releaseDate ? new Date(set.releaseDate).toLocaleDateString() : "Unknown")} | {set.cardCount} cards
        </Text>
        <Group gap="xs">
          <Badge variant="light">{set.game}</Badge>
          {set.setCode ? <Badge variant="outline">{set.setCode}</Badge> : null}
          {recent ? <Badge color="green">Recent</Badge> : null}
        </Group>
      </Stack>
    </Card>
  );
}

function fanCards(set: SetlistItem) {
  const baseImage = imageForSet(set) ?? "/default-pack-banner-desktop.webp";
  return [
    { label: set.name, imageUrl: baseImage },
    { label: set.name, imageUrl: baseImage },
    { label: set.name, imageUrl: baseImage },
  ];
}
