"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Alert, Button, Container, Group, Image, Paper, ScrollArea, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";

type CatalogSearchItem = {
  id: string;
  source: string;
  sourceItemId: string;
  itemType: string;
  game?: string | null;
  language?: string | null;
  name: string;
  setName?: string | null;
  localId?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  imageThumbUrl?: string | null;
  imageUrl?: string | null;
  marketPrice?: number | string | null;
  estimatedValue?: number | string | null;
};

type SortMode = "relevance" | "name" | "set" | "value-desc" | "value-asc";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "";

function isLocalhostLike(host: string) {
  const normalized = host.trim().toLowerCase();
  return normalized === "localhost" || normalized.startsWith("localhost:") || normalized === "demo.localhost" || normalized.endsWith(".localhost") || normalized.startsWith("127.0.0.1") || normalized.startsWith("0.0.0.0");
}

function currentVendorHost() {
  if (typeof window !== "undefined" && window.location.host) {
    const host = window.location.host.toLowerCase();
    return isLocalhostLike(host) ? configuredVendorHost || "demo.localhost" : host;
  }
  return configuredVendorHost || "demo.localhost";
}

function numericValue(item: CatalogSearchItem) {
  const raw = item.estimatedValue ?? item.marketPrice ?? 0;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function sortItems(items: CatalogSearchItem[], sortMode: SortMode) {
  const copy = [...items];
  switch (sortMode) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "set":
      return copy.sort((a, b) => `${a.setName ?? ""} ${a.localId ?? ""}`.localeCompare(`${b.setName ?? ""} ${b.localId ?? ""}`));
    case "value-desc":
      return copy.sort((a, b) => numericValue(b) - numericValue(a));
    case "value-asc":
      return copy.sort((a, b) => numericValue(a) - numericValue(b));
    case "relevance":
    default:
      return copy;
  }
}

export default function VendorSortingWorkbenchPage() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">("checking");
  const [query, setQuery] = useState("charizard");
  const [language, setLanguage] = useState("");
  const [source, setSource] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [items, setItems] = useState<CatalogSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedItems = useMemo(() => sortItems(items, sortMode), [items, sortMode]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch(`${apiBase}/v1/vendor/me`, {
          headers: { "x-client-page": "/vendor/working/sorting" },
          credentials: "include",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.status === 401) {
          router.replace(`/vendor/login?returnTo=${encodeURIComponent("/vendor/working/sorting")}`);
          return;
        }
        if (!response.ok || !payload?.isVendorMember) {
          setAccessState("denied");
          return;
        }
        setAccessState("allowed");
      } catch {
        if (active) setAccessState("denied");
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  async function runSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (accessState !== "allowed") return;
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${apiBase}/v1/catalog/search`);
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "80");
      if (language) url.searchParams.set("language", language);
      if (source) url.searchParams.set("source", source);

      const response = await fetch(url.toString(), {
        headers: { "x-client-page": "/vendor/working/sorting" },
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to load catalog search results");
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog search results");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {accessState !== "allowed" ? (
          <Paper withBorder radius="xl" p="xl" shadow="sm">
            <Stack gap="sm">
              <Title order={1}>Vendor Access Required</Title>
              <Text c="dimmed">
                {accessState === "checking" ? "Checking approved vendor access..." : "This page is restricted to approved vendor accounts only."}
              </Text>
            </Stack>
          </Paper>
        ) : (
          <>
            <Paper withBorder radius="xl" p="lg" shadow="sm">
              <Group justify="space-between" align="start" wrap="wrap">
                <Stack gap={4} maw={780}>
                  <Text c="dimmed" fw={700} tt="uppercase" size="sm">
                    Vendor working tools
                  </Text>
                  <Title order={1}>Catalog sorting workbench</Title>
                  <Text c="dimmed">
                    Fast operator view for searching broad TCG catalog results, sorting by set, name, and value, and picking candidates for pack construction.
                  </Text>
                </Stack>
                <Button component={Link} href="/vendor" variant="light">
                  Back to vendor
                </Button>
              </Group>
            </Paper>

            <Paper withBorder radius="xl" p="md" shadow="sm">
              <form onSubmit={runSearch}>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
                  <TextInput label="Search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Charizard, Pikachu, Moonbreon..." />
                  <TextInput label="Source" value={source} onChange={(event) => setSource(event.target.value)} placeholder="tcgplayer" />
                  <TextInput label="Language" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en" />
                  <Select
                    label="Sort"
                    value={sortMode}
                    onChange={(value) => setSortMode((value as SortMode) ?? "relevance")}
                    data={[
                      { value: "relevance", label: "Relevance" },
                      { value: "name", label: "Name A-Z" },
                      { value: "set", label: "Set / number" },
                      { value: "value-desc", label: "Value high-low" },
                      { value: "value-asc", label: "Value low-high" },
                    ]}
                  />
                  <Button type="submit" loading={loading} fullWidth mt={26}>
                    Search
                  </Button>
                </SimpleGrid>
              </form>
            </Paper>

            {error ? <Alert color="red" variant="light">{error}</Alert> : null}

            <Paper withBorder radius="xl" p="0" shadow="sm">
              <ScrollArea type="auto" offsetScrollbars>
                <Table horizontalSpacing="md" verticalSpacing="sm" striped highlightOnHover miw={920}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Card</Table.Th>
                      <Table.Th>Set</Table.Th>
                      <Table.Th>No.</Table.Th>
                      <Table.Th>Rarity</Table.Th>
                      <Table.Th>Language</Table.Th>
                      <Table.Th>Source</Table.Th>
                      <Table.Th>estimatedValue</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sortedItems.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap" align="center">
                            {item.imageThumbUrl || item.imageUrl ? <Image src={item.imageThumbUrl ?? item.imageUrl ?? ""} alt="" w={44} h={60} radius="sm" fit="cover" /> : null}
                            <div>
                              <Text fw={700}>{item.name}</Text>
                              <Text c="dimmed" size="xs">
                                {item.itemType}
                              </Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>{item.setName ?? "-"}</Table.Td>
                        <Table.Td>{item.localId ?? item.cardNumber ?? "-"}</Table.Td>
                        <Table.Td>{item.rarity ?? "-"}</Table.Td>
                        <Table.Td>{item.language ?? "-"}</Table.Td>
                        <Table.Td>{item.source}</Table.Td>
                        <Table.Td>{numericValue(item) ? numericValue(item).toFixed(2) : "-"}</Table.Td>
                      </Table.Tr>
                    ))}
                    {!sortedItems.length ? (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Text c="dimmed" ta="center" py="xl">
                            Search the catalog to populate sorting candidates.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : null}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
