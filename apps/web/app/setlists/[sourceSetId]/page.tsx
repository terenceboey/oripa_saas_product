"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Container, Group, Image, Paper, Select, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { applyVendorFavicon } from "../../../lib/favicon";
import { normalizeVendorFaviconUrl } from "../../../lib/media-url";
import { buildVendorCssVariables, type VendorStorefrontTheme, VendorThemeProvider } from "../../../lib/vendor-theme";

type SetInfo = {
  sourceSetId: string;
  name: string;
  setCode?: string | null;
  game: string;
  releaseDate?: string | null;
  symbolImageUrl?: string | null;
  logoImageUrl?: string | null;
  bannerImageUrl?: string | null;
};

type SetCard = {
  id: string;
  name: string;
  cardNumber?: string | null;
  rarity?: string | null;
  imageThumbUrl?: string | null;
  imageLargeUrl?: string | null;
  imageBaseUrl?: string | null;
};

type CardResponse = {
  set: SetInfo;
  page: number;
  total: number;
  totalPages: number;
  limit: number;
  rarities: string[];
  items: SetCard[];
};

type Tenant = {
  logoImageUrl?: string | null;
  faviconImageUrl?: string | null;
  vendorSettings?: VendorStorefrontTheme | null;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 24;
const clientPageHeader = { "x-client-page": "/setlists/[sourceSetId]" };

export default function SetlistDetailPage() {
  const params = useParams<{ sourceSetId: string }>();
  const searchParams = useSearchParams();
  const sourceSetId = String(params?.sourceSetId ?? "");
  const game = (searchParams.get("game") || "pokemon").toLowerCase();
  const source = (searchParams.get("source") || "").trim().toLowerCase();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CardResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("");
  const [page, setPage] = useState(1);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const storefrontThemeStyle = useMemo(() => buildVendorCssVariables(tenant?.vendorSettings), [tenant?.vendorSettings]);

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
  }, [query, rarity, sourceSetId, game]);

  useEffect(() => {
    if (!sourceSetId) return;
    let active = true;
    setLoading(true);
    setFetchError(null);

    const url = new URL(`${apiBase}/v1/public/setlists/${sourceSetId}/cards`);
    url.searchParams.set("game", game);
    if (source) url.searchParams.set("source", source);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (query.trim()) url.searchParams.set("q", query.trim());
    if (rarity.trim()) url.searchParams.set("rarity", rarity.trim());

    fetch(url.toString(), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load set cards");
        }
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setData(null);
        setFetchError(error instanceof Error ? error.message : "Failed to load set cards");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [game, source, page, query, rarity, sourceSetId]);

  const currentPage = Math.max(1, Math.min(page, data?.totalPages ?? 1));
  const setInfo = data?.set;
  const cards = data?.items ?? [];
  const pageTitle = setInfo?.name ?? "Set";

  return (
    <VendorThemeProvider theme={tenant?.vendorSettings}>
    <Container size="xl" py="xl" style={storefrontThemeStyle}>
      <Stack gap="lg">
        <Group justify="space-between" align="center" wrap="wrap">
          <Button component={Link} href={`/setlists?game=${game}${source ? `&source=${source}` : ""}`} variant="light">
            Back to setlists
          </Button>
          <Group gap="xs" wrap="wrap">
            <Badge variant="light">{game}</Badge>
            <Badge variant="outline">{data?.total ?? 0} cards</Badge>
          </Group>
        </Group>

        <Paper withBorder radius="xl" p="lg" shadow="sm" style={{ background: "linear-gradient(120deg, rgba(159,144,255,.18), rgba(116,200,255,.16))" }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <SetHeaderImage set={setInfo} title={pageTitle} />
            <Stack gap="sm" justify="center">
              <Title order={1}>{pageTitle}</Title>
              <Text c="dimmed">
                {setInfo?.releaseDate ? new Date(setInfo.releaseDate).toLocaleDateString() : "Unknown date"}
              </Text>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light">{data?.total ?? 0} cards</Badge>
                {setInfo?.setCode ? <Badge variant="outline">{setInfo.setCode}</Badge> : null}
              </Group>
              <Text c="dimmed">Click any card to view details and pricing later.</Text>
            </Stack>
          </SimpleGrid>
        </Paper>

        <Paper withBorder radius="xl" p="md" shadow="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            <TextInput label="Search cards" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards..." />
            <Select
              label="Rarity"
              value={rarity}
              onChange={(value) => setRarity(value ?? "")}
              clearable
              data={(data?.rarities ?? []).map((item) => ({ value: item, label: item }))}
            />
            <Group align="end" grow>
              <Button variant="default" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Previous
              </Button>
              <Button variant="default" disabled={currentPage >= Math.max(1, data?.totalPages ?? 1)} onClick={() => setPage((value) => Math.min(Math.max(1, data?.totalPages ?? 1), value + 1))}>
                Next
              </Button>
            </Group>
          </SimpleGrid>
        </Paper>

        {loading ? <Text c="dimmed">Loading cards...</Text> : null}
        {fetchError ? <Alert color="red" variant="light">{fetchError}</Alert> : null}

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {cards.map((card) => (
            <Card key={card.id} withBorder radius="lg" p="md">
              <Card.Section>
                <Image src={card.imageLargeUrl || card.imageThumbUrl || card.imageBaseUrl || "/default-pack-banner-desktop.webp"} alt={card.name} h={280} fit="cover" />
              </Card.Section>
              <Stack gap={4} mt="sm">
                <Text fw={800} lineClamp={2}>{card.name}</Text>
                <Text c="dimmed" size="sm">
                  {card.cardNumber ? `#${card.cardNumber}` : "No number"}{card.rarity ? ` | ${card.rarity}` : ""}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
    </VendorThemeProvider>
  );
}

function setImageForHeader(set?: SetInfo | null) {
  return set?.bannerImageUrl || set?.logoImageUrl || set?.symbolImageUrl || null;
}

function SetHeaderImage({ set, title }: { set?: SetInfo | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : setImageForHeader(set);

  if (!src) {
    return (
      <Paper withBorder radius="lg" p="xl" ta="center" style={{ minHeight: 280, display: "grid", placeItems: "center" }}>
        <Text fw={900} size="2rem">
          {set?.setCode || title.slice(0, 3).toUpperCase()}
        </Text>
      </Paper>
    );
  }

  return <Image src={src} alt={title} radius="lg" fit="contain" h={280} onError={() => setFailed(true)} />;
}
