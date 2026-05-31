"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CatalogItemClass = "CARD" | "SEALED_PRODUCT";

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

export const EMPTY_CATALOG_FILTERS: CatalogFilters = {
  source: "",
  language: "",
  setId: "",
  rarity: "",
};

export const EMPTY_CATALOG_FACETS: CatalogFacets = {
  sources: [],
  languages: [],
  sets: [],
  rarities: [],
};

export const CATALOG_GAME_OPTIONS = [
  { value: "POKEMON", label: "Pokemon" },
  { value: "ONE_PIECE", label: "One Piece" },
] as const;

export const CATALOG_ITEM_CLASS_OPTIONS = [
  { value: "CARD", label: "Cards" },
  { value: "SEALED_PRODUCT", label: "Sealed Products" },
] as const;

type UseVendorCatalogSearchInput = {
  apiBase: string;
  authHeaders: () => Record<string, string>;
  initialGameFilter?: string;
  initialItemClass?: CatalogItemClass;
};

function appendCatalogFilters(url: URL, catalogFilters: CatalogFilters) {
  if (catalogFilters.source) url.searchParams.set("source", catalogFilters.source);
  if (catalogFilters.language) url.searchParams.set("language", catalogFilters.language);
  if (catalogFilters.setId) url.searchParams.set("setId", catalogFilters.setId);
  if (catalogFilters.rarity) url.searchParams.set("rarity", catalogFilters.rarity);
}

export function useVendorCatalogSearch({
  apiBase,
  authHeaders,
  initialGameFilter = "",
  initialItemClass = "CARD",
}: UseVendorCatalogSearchInput) {
  const [cardSearchQuery, setCardSearchQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogSuggestion[]>([]);
  const [catalogResultsLoading, setCatalogResultsLoading] = useState(false);
  const [catalogResultsLoadingMore, setCatalogResultsLoadingMore] = useState(false);
  const [catalogSearchError, setCatalogSearchError] = useState<string | null>(null);
  const [catalogFacetError, setCatalogFacetError] = useState<string | null>(null);
  const [setOptionQuery, setSetOptionQuery] = useState("");
  const [rarityOptionQuery, setRarityOptionQuery] = useState("");
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(EMPTY_CATALOG_FILTERS);
  const [catalogFacets, setCatalogFacets] = useState<CatalogFacets>(EMPTY_CATALOG_FACETS);
  const [catalogGameFilter, setCatalogGameFilter] = useState(initialGameFilter);
  const [catalogItemClass, setCatalogItemClass] = useState<CatalogItemClass>(initialItemClass);
  const [catalogNextCursor, setCatalogNextCursor] = useState<string | null>(null);
  const skipInitialResetRef = useRef(true);

  const normalizedGameFilter = catalogGameFilter.trim().toUpperCase();
  const normalizedQuery = cardSearchQuery.trim();
  const catalogCanSearch = Boolean(normalizedGameFilter) && Boolean(catalogFilters.setId || normalizedQuery);

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

  const fetchCatalogFacets = useCallback(async () => {
    if (!normalizedGameFilter) {
      setCatalogFacets(EMPTY_CATALOG_FACETS);
      setCatalogFacetError(null);
      return;
    }

    try {
      const url = new URL(`${apiBase}/v1/catalog/facets`);
      url.searchParams.set("game", normalizedGameFilter);
      url.searchParams.set("itemClass", catalogItemClass);
      url.searchParams.set("limit", "200");
      if (catalogFilters.source) url.searchParams.set("source", catalogFilters.source);
      if (catalogFilters.language) url.searchParams.set("language", catalogFilters.language);
      if (catalogFilters.setId) url.searchParams.set("setId", catalogFilters.setId);

      const res = await fetch(url.toString(), {
        headers: authHeaders(),
        credentials: "include",
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to load catalog facets");
      setCatalogFacets((payload ?? EMPTY_CATALOG_FACETS) as CatalogFacets);
      setCatalogFacetError(null);
    } catch (error) {
      setCatalogFacets(EMPTY_CATALOG_FACETS);
      setCatalogFacetError(error instanceof Error ? error.message : "Failed to load filter options");
    }
  }, [apiBase, authHeaders, catalogFilters.language, catalogFilters.setId, catalogFilters.source, catalogItemClass, normalizedGameFilter]);

  const fetchCatalogSearchPage = useCallback(
    async (cursor?: string) => {
      if (!catalogCanSearch) {
        setCatalogResults([]);
        setCatalogSearchError(null);
        setCatalogNextCursor(null);
        return;
      }

      const url = new URL(`${apiBase}/v1/catalog/search`);
      url.searchParams.set("game", normalizedGameFilter);
      url.searchParams.set("itemClass", catalogItemClass);
      url.searchParams.set("limit", "50");
      if (normalizedQuery) url.searchParams.set("q", normalizedQuery);
      appendCatalogFilters(url, catalogFilters);
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), {
        headers: authHeaders(),
        credentials: "include",
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to search catalog");
      return payload as { items?: CatalogSuggestion[]; nextCursor?: string | null };
    },
    [apiBase, authHeaders, catalogCanSearch, catalogFilters, catalogItemClass, normalizedGameFilter, normalizedQuery],
  );

  useEffect(() => {
    void fetchCatalogFacets();
  }, [fetchCatalogFacets]);

  useEffect(() => {
    if (!catalogCanSearch) {
      setCatalogResults([]);
      setCatalogResultsLoading(false);
      setCatalogSearchError(null);
      setCatalogNextCursor(null);
      return;
    }

    let isActive = true;
    const timer = window.setTimeout(() => {
      if (!isActive) return;
      setCatalogResultsLoading(true);
      setCatalogSearchError(null);
      setCatalogNextCursor(null);
      fetchCatalogSearchPage()
        .then((payload) => {
          if (!isActive) return;
          setCatalogResults(payload?.items ?? []);
          setCatalogNextCursor(payload?.nextCursor ?? null);
        })
        .catch((error: unknown) => {
          if (!isActive) return;
          setCatalogResults([]);
          setCatalogNextCursor(null);
          setCatalogSearchError(error instanceof Error ? error.message : "Catalog search failed");
        })
        .finally(() => {
          if (!isActive) return;
          setCatalogResultsLoading(false);
        });
    }, 220);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [catalogCanSearch, fetchCatalogSearchPage]);

  useEffect(() => {
    if (skipInitialResetRef.current) {
      skipInitialResetRef.current = false;
      return;
    }
    setCatalogFilters(EMPTY_CATALOG_FILTERS);
    setSetOptionQuery("");
    setRarityOptionQuery("");
    setCatalogResults([]);
    setCatalogNextCursor(null);
    setCatalogSearchError(null);
    setCardSearchQuery("");
  }, [catalogGameFilter, catalogItemClass]);

  function setCatalogFilter(field: keyof CatalogFilters, value: string) {
    setCatalogFilters((prev) => {
      if (field === "setId") {
        return { ...prev, setId: value, rarity: "" };
      }
      return { ...prev, [field]: value };
    });
    setCatalogNextCursor(null);
    if (field === "setId" && !value) {
      setCatalogResults([]);
    }
  }

  function resetCatalogFilters() {
    setCatalogFilters(EMPTY_CATALOG_FILTERS);
    setSetOptionQuery("");
    setRarityOptionQuery("");
    setCatalogResults([]);
    setCatalogNextCursor(null);
    setCatalogSearchError(null);
    setCardSearchQuery("");
  }

  async function loadMoreCatalogResults() {
    if (!catalogNextCursor || catalogResultsLoadingMore || !catalogCanSearch) return;
    setCatalogResultsLoadingMore(true);
    setCatalogSearchError(null);
    try {
      const payload = await fetchCatalogSearchPage(catalogNextCursor);
      const nextItems = payload?.items ?? [];
      setCatalogResults((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        const merged = [...prev];
        for (const item of nextItems) {
          if (seen.has(item.id)) continue;
          merged.push(item);
          seen.add(item.id);
        }
        return merged;
      });
      setCatalogNextCursor(payload?.nextCursor ?? null);
    } catch (error) {
      setCatalogSearchError(error instanceof Error ? error.message : "Failed to load more results");
    } finally {
      setCatalogResultsLoadingMore(false);
    }
  }

  return {
    cardSearchQuery,
    setCardSearchQuery,
    catalogResults,
    catalogResultsLoading,
    catalogResultsLoadingMore,
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
    catalogItemClass,
    setCatalogItemClass,
    filteredSetFacetOptions,
    filteredRarityFacetOptions,
    setCatalogFilter,
    resetCatalogFilters,
    setCatalogResults,
    catalogCanSearch,
    catalogHasMore: Boolean(catalogNextCursor),
    loadMoreCatalogResults,
  };
}
