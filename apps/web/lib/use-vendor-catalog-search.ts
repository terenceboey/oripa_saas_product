"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CatalogFilters = {
  source: string;
  language: string;
  setId: string;
  rarity: string;
};

export type CatalogFacetOption = {
  value: string;
  count: number;
};

export type CatalogSetFacet = {
  id: string;
  name?: string | null;
  count: number;
};

export type CatalogFacets = {
  sources: CatalogFacetOption[];
  languages: CatalogFacetOption[];
  sets: CatalogSetFacet[];
  rarities: CatalogFacetOption[];
};

export type CatalogSuggestion = {
  id: string;
  source?: string | null;
  sourceItemId?: string | null;
  itemType?: string | null;
  game: string;
  language?: string | null;
  name: string;
  setId?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  imageThumbUrl?: string | null;
  imageLargeUrl?: string | null;
  imageBaseUrl?: string | null;
};

export const EMPTY_CATALOG_FILTERS: CatalogFilters = { source: "", language: "", setId: "", rarity: "" };
export const EMPTY_CATALOG_FACETS: CatalogFacets = { sources: [], languages: [], sets: [], rarities: [] };

export const CATALOG_GAME_OPTIONS = [
  { value: "ALL", label: "All games" },
  { value: "POKEMON", label: "Pokemon" },
  { value: "POKEMON_JAPAN", label: "Pokemon Japan" },
  { value: "ONE_PIECE", label: "One Piece" },
  { value: "YUGIOH", label: "Yu-Gi-Oh!" },
  { value: "DRAGON_BALL_SUPER", label: "Dragon Ball Super" },
] as const;

type RouterLike = {
  replace: (href: string, options?: { scroll?: boolean }) => void;
};

type UseVendorCatalogSearchInput = {
  apiBase: string;
  authHeaders: () => Record<string, string>;
  pathname: string;
  router: RouterLike;
  initialGameFilter?: string;
};

function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  return {
    source: params.get("source") ?? "",
    language: params.get("language") ?? "",
    setId: params.get("setId") ?? "",
    rarity: params.get("rarity") ?? "",
  };
}

function appendCatalogFilters(url: URL, catalogFilters: CatalogFilters) {
  if (catalogFilters.source) url.searchParams.set("source", catalogFilters.source);
  if (catalogFilters.language) url.searchParams.set("language", catalogFilters.language);
  if (catalogFilters.setId) url.searchParams.set("setId", catalogFilters.setId);
  if (catalogFilters.rarity) url.searchParams.set("rarity", catalogFilters.rarity);
}

function writeCatalogFiltersToUrl(input: {
  pathname: string;
  router: RouterLike;
  nextFilters: CatalogFilters;
}) {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  for (const key of Object.keys(EMPTY_CATALOG_FILTERS) as Array<keyof CatalogFilters>) {
    if (input.nextFilters[key]) params.set(key, input.nextFilters[key]);
    else params.delete(key);
  }
  params.set("tab", "pack-studio");
  input.router.replace(`${input.pathname}?${params.toString()}`, { scroll: false });
}

export function useVendorCatalogSearch({
  apiBase,
  authHeaders,
  pathname,
  router,
  initialGameFilter = "POKEMON",
}: UseVendorCatalogSearchInput) {
  const [cardSearchQuery, setCardSearchQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogSuggestion[]>([]);
  const [catalogResultsLoading, setCatalogResultsLoading] = useState(false);
  const [catalogSearchError, setCatalogSearchError] = useState<string | null>(null);
  const [catalogFacetError, setCatalogFacetError] = useState<string | null>(null);
  const [setOptionQuery, setSetOptionQuery] = useState("");
  const [rarityOptionQuery, setRarityOptionQuery] = useState("");
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(EMPTY_CATALOG_FILTERS);
  const [catalogFacets, setCatalogFacets] = useState<CatalogFacets>(EMPTY_CATALOG_FACETS);
  const [catalogGameFilter, setCatalogGameFilter] = useState(initialGameFilter);
  const catalogSearchCacheRef = useRef<Map<string, CatalogSuggestion[]>>(new Map());
  const skipInitialGameResetRef = useRef(true);

  const filteredSetFacetOptions = useMemo(() => {
    const q = setOptionQuery.trim().toLowerCase();
    if (!q) return catalogFacets.sets;
    return catalogFacets.sets.filter((set) => `${set.name || ""} ${set.id}`.toLowerCase().includes(q));
  }, [catalogFacets.sets, setOptionQuery]);

  const filteredRarityFacetOptions = useMemo(() => {
    const q = rarityOptionQuery.trim().toLowerCase();
    if (!q) return catalogFacets.rarities;
    return catalogFacets.rarities.filter((rarity) => rarity.value.toLowerCase().includes(q));
  }, [catalogFacets.rarities, rarityOptionQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setCatalogFilters(parseCatalogFilters(params));
  }, []);

  useEffect(() => {
    const query = cardSearchQuery.trim();
    const normalizedGameFilter = catalogGameFilter.trim().toUpperCase() || "POKEMON";

    if (query.length < 2) {
      setCatalogResults([]);
      setCatalogResultsLoading(false);
      setCatalogSearchError(null);
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const cacheKey = `card-search:${normalizedGameFilter}:${normalizedQuery}:30:${catalogFilters.source}:${catalogFilters.language}:${catalogFilters.setId}:${catalogFilters.rarity}`;
    const cached = catalogSearchCacheRef.current.get(cacheKey);
    if (cached) {
      setCatalogResults(cached);
      setCatalogResultsLoading(false);
      setCatalogSearchError(null);
      return;
    }

    let isActive = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!isActive) return;
      setCatalogResultsLoading(true);
      setCatalogSearchError(null);
      const url = new URL(`${apiBase}/v1/catalog/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "30");
      url.searchParams.set("type", "card");
      url.searchParams.set("game", normalizedGameFilter);
      appendCatalogFilters(url, catalogFilters);

      fetch(url.toString(), {
        headers: authHeaders(),
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (res) => {
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload?.error ?? "Failed to search cards");
          let nextItems = (payload.items ?? []) as CatalogSuggestion[];
          if (
            nextItems.length === 0 &&
            (catalogFilters.setId || catalogFilters.rarity || catalogFilters.source || catalogFilters.language)
          ) {
            const fallbackUrl = new URL(`${apiBase}/v1/catalog/search`);
            fallbackUrl.searchParams.set("q", query);
            fallbackUrl.searchParams.set("limit", "30");
            fallbackUrl.searchParams.set("type", "card");
            fallbackUrl.searchParams.set("game", normalizedGameFilter);
            const fallbackRes = await fetch(fallbackUrl.toString(), {
              headers: authHeaders(),
              credentials: "include",
              cache: "no-store",
            });
            const fallbackPayload = await fallbackRes.json().catch(() => ({}));
            if (fallbackRes.ok) {
              nextItems = (fallbackPayload.items ?? []) as CatalogSuggestion[];
            }
          }
          if (!isActive) return;
          setCatalogResults(nextItems);
          catalogSearchCacheRef.current.set(cacheKey, nextItems);
          setCatalogSearchError(null);
        })
        .catch((error: unknown) => {
          if (!isActive) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setCatalogResults([]);
          setCatalogSearchError(error instanceof Error ? error.message : "Card search failed");
        })
        .finally(() => {
          if (!isActive) return;
          setCatalogResultsLoading(false);
        });
    }, 250);

    return () => {
      isActive = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiBase, authHeaders, cardSearchQuery, catalogFilters, catalogGameFilter]);

  useEffect(() => {
    const url = new URL(`${apiBase}/v1/catalog/facets`);
    url.searchParams.set("type", "card");
    url.searchParams.set("game", catalogGameFilter);
    if (catalogFilters.source) url.searchParams.set("source", catalogFilters.source);
    if (catalogFilters.language) url.searchParams.set("language", catalogFilters.language);

    fetch(url.toString(), {
      headers: authHeaders(),
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load catalog facets");
        const parsed = (payload ?? EMPTY_CATALOG_FACETS) as CatalogFacets;
        if (
          parsed.sets.length === 0 &&
          parsed.rarities.length === 0 &&
          (catalogFilters.source || catalogFilters.language)
        ) {
          const fallbackUrl = new URL(`${apiBase}/v1/catalog/facets`);
          fallbackUrl.searchParams.set("type", "card");
          fallbackUrl.searchParams.set("game", catalogGameFilter);
          const fallbackRes = await fetch(fallbackUrl.toString(), {
            headers: authHeaders(),
            credentials: "include",
            cache: "no-store",
          });
          const fallbackPayload = await fallbackRes.json().catch(() => ({}));
          if (fallbackRes.ok) {
            setCatalogFacets((fallbackPayload ?? EMPTY_CATALOG_FACETS) as CatalogFacets);
            setCatalogFilters((prev) => ({ ...prev, source: "", language: "" }));
            setCatalogFacetError("Filters were auto-reset because no matching options were found.");
            return;
          }
        }
        setCatalogFacets(parsed);
        setCatalogFacetError(null);
      })
      .catch((error: unknown) => {
        setCatalogFacets(EMPTY_CATALOG_FACETS);
        setCatalogFacetError(error instanceof Error ? error.message : "Failed to load filter options");
      });
  }, [apiBase, authHeaders, catalogFilters.language, catalogFilters.source, catalogGameFilter]);

  useEffect(() => {
    if (skipInitialGameResetRef.current) {
      skipInitialGameResetRef.current = false;
      return;
    }
    setCatalogFilters(EMPTY_CATALOG_FILTERS);
    setCatalogResults([]);
    setSetOptionQuery("");
    setRarityOptionQuery("");
    writeCatalogFiltersToUrl({ pathname, router, nextFilters: EMPTY_CATALOG_FILTERS });
  }, [catalogGameFilter, pathname, router]);

  function setCatalogFilterInUrl(field: keyof CatalogFilters, value: string) {
    const nextFilters = { ...catalogFilters, [field]: value };
    setCatalogFilters(nextFilters);
    setCatalogResults([]);
    writeCatalogFiltersToUrl({ pathname, router, nextFilters });
  }

  function resetCatalogFilters() {
    setCatalogFilters(EMPTY_CATALOG_FILTERS);
    setCatalogResults([]);
    setSetOptionQuery("");
    setRarityOptionQuery("");
    writeCatalogFiltersToUrl({ pathname, router, nextFilters: EMPTY_CATALOG_FILTERS });
  }

  return {
    cardSearchQuery,
    setCardSearchQuery,
    catalogResults,
    catalogResultsLoading,
    catalogSearchError,
    catalogFacetError,
    setOptionQuery,
    setSetOptionQuery,
    rarityOptionQuery,
    setRarityOptionQuery,
    catalogFilters,
    catalogFacets,
    catalogGameFilter,
    setCatalogGameFilter,
    filteredSetFacetOptions,
    filteredRarityFacetOptions,
    setCatalogFilterInUrl,
    resetCatalogFilters,
    setCatalogResults,
  };
}
