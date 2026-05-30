"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBackForwardRefresh } from "../../lib/use-back-forward-refresh";
import QRCode from "qrcode";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../lib/media-url";

type Vendor = {
  id: string;
  name: string;
  slug: string;
  host: string;
  isActive: boolean;
  referralCode?: string | null;
  businessLocation?: string | null;
  businessContact?: string | null;
  logoImageUrl?: string | null;
  faviconImageUrl?: string | null;
  vendorSettings?: {
    storefrontPrimary: string;
    storefrontSecondary: string;
    storefrontAccent: string;
    storefrontSurface: string;
    storefrontText: string;
    storefrontMuted: string;
    storefrontRadius: number;
  } | null;
};

type VendorLimits = {
  planCode: "BASIC" | "ELITE";
  maxPackItems: number;
  maxPackTiers: number;
  maxDrawQuantity: number;
};

type EarningsSummary = {
  totalRevenuePoints: number;
  totalRevenueCurrency: number;
  vendorSpentPoints: number;
  netPoints: number;
  currencyCode: string;
};

type PackEarning = {
  packId: string;
  packTitle: string;
  drawOrders: number;
  totalDrawQuantity: number;
  totalPoints: number;
};

type ReferralCustomer = {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt: string;
  referredAt: string;
  referralCode: string;
};

type VendorQr = {
  id: string;
  token: string;
  points: number;
  status: "ACTIVE" | "REDEEMED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  createdAt: string;
};

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Pack = {
  id: string;
  title: string;
  packBannerImageUrl?: string | null;
  pricePoints: number;
  totalStock: number;
  remainingStock: number;
  isNew?: boolean;
  limitedLabel?: string | null;
  status: "DRAFT" | "LIVE" | "ARCHIVED";
  importantNotes?: string | null;
  drawLimitMode: "NONE" | "ONCE_PER_CUSTOMER" | "DAILY_RESET";
  drawLimitValue?: number | null;
  drawLimitResetTimezone?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  prizes: Array<{
  id: string;
  label: string;
  imageUrl?: string | null;
  estimatedValue: number;
  stock: number;
  remainingStock: number;
  catalogItemId?: string | null;
  catalogSource?: string | null;
  catalogSourceItemId?: string | null;
  language?: string | null;
  }>;
};

type CreativeAsset = {
  id: string;
  status: "PRIVATE_DRAFT" | "PUBLIC_IMMUTABLE" | "REJECTED";
  title: string;
  imageUrl: string;
  targetUrl: string;
  contentHash: string;
  createdAt: string;
};

type CreativeJob = {
  id: string;
  packId: string;
  status: "DRAFT" | "COMPLETED" | "FAILED" | "PUBLISH_BLOCKED" | "PUBLISHED";
  stylePreset: string;
  safePrompt: string;
  errorMessage?: string | null;
  createdAt: string;
  assets: CreativeAsset[];
};

type ItemDraft = {
  label: string;
  estimatedValue: string;
  stock: string;
  imageUrl: string;
  catalogItemId?: string;
  catalogSource?: string;
  catalogSourceItemId?: string;
  language?: string;
};

type CatalogFilters = {
  source: string;
  language: string;
  setId: string;
  rarity: string;
};

type CatalogFacetOption = {
  value: string;
  count: number;
};

type CatalogSetFacet = {
  id: string;
  name?: string | null;
  count: number;
};

type CatalogFacets = {
  sources: CatalogFacetOption[];
  languages: CatalogFacetOption[];
  sets: CatalogSetFacet[];
  rarities: CatalogFacetOption[];
};

type TierDraft = {
  name: string;
  percentage: string;
  items: ItemDraft[];
};

type CatalogSuggestion = {
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

type CsvImportResponse = {
  tiers: Array<{
    name: string;
    percentage?: number;
    items: Array<{
      label: string;
      estimatedValue: number;
      stock: number;
      imageUrl: string;
    }>;
  }>;
  summary: {
    totalRows: number;
    matchedRows: number;
    unmatchedRows: number;
    tierCount: number;
  };
  unmatchedRows: Array<{
    rowNumber: number;
    itemLabel: string;
    setId?: string;
    cardNumber?: string;
    reason: string;
  }>;
};

const DEFAULT_CARD = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const DEFAULT_PACK_BANNER = "/default-pack-banner-desktop.webp";
const DEFAULT_PACK_BANNER_OPTIONS = [
  { label: "Default Green", desktop: "/default-pack-banner-desktop.webp", mobile: "/default-pack-banner-mobile.webp" },
  { label: "S+ TIER REWARDS", desktop: "/pack-presets/splus-tier-rewards.png", mobile: "/pack-presets/splus-tier-rewards.png" },
  { label: "GACHAPON", desktop: "/pack-presets/gachapon.png", mobile: "/pack-presets/gachapon.png" },
  { label: "MYSTERY PACK RUSH", desktop: "/pack-presets/mystery-pack-rush.png", mobile: "/pack-presets/mystery-pack-rush.png" },
] as const;
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "";
const clientPageHeader = { "x-client-page": "/vendor" };
type ActiveTab = "BUSINESS" | "PACKS";
const emptyCatalogFilters: CatalogFilters = { source: "", language: "", setId: "", rarity: "" };
const emptyCatalogFacets: CatalogFacets = { sources: [], languages: [], sets: [], rarities: [] };

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

const DEFAULT_THEME = {
  storefrontPrimary: "#7A5CFA",
  storefrontSecondary: "#EEE7FF",
  storefrontAccent: "#A66BFF",
  storefrontSurface: "#FFFFFF",
  storefrontText: "#2D2350",
  storefrontMuted: "#6E6395",
  storefrontRadius: 18,
};

const THEME_PRESETS = [
  { id: "lavender-dawn", label: "Lavender Dawn (Default)", ...DEFAULT_THEME },
  {
    id: "mint-cloud",
    label: "Mint Cloud",
    storefrontPrimary: "#4FB7A5",
    storefrontSecondary: "#E2F7F3",
    storefrontAccent: "#7A8BFF",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#1F3B44",
    storefrontMuted: "#5E7F86",
    storefrontRadius: 18,
  },
  {
    id: "peach-sorbet",
    label: "Peach Sorbet",
    storefrontPrimary: "#F28D8D",
    storefrontSecondary: "#FFEAE5",
    storefrontAccent: "#FFB26B",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#4A2A33",
    storefrontMuted: "#8E6D78",
    storefrontRadius: 18,
  },
  {
    id: "sky-bloom",
    label: "Sky Bloom",
    storefrontPrimary: "#5E8BFF",
    storefrontSecondary: "#E8EEFF",
    storefrontAccent: "#7CC8FF",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#1F2F56",
    storefrontMuted: "#60739B",
    storefrontRadius: 18,
  },
  {
    id: "rose-mist",
    label: "Rose Mist",
    storefrontPrimary: "#D471B8",
    storefrontSecondary: "#FCEAF7",
    storefrontAccent: "#8D7CFF",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#3D2747",
    storefrontMuted: "#7B6687",
    storefrontRadius: 18,
  },
] as const;

function matchesPreset(
  theme: typeof DEFAULT_THEME,
  preset: (typeof THEME_PRESETS)[number]
) {
  return (
    theme.storefrontPrimary === preset.storefrontPrimary &&
    theme.storefrontSecondary === preset.storefrontSecondary &&
    theme.storefrontAccent === preset.storefrontAccent &&
    theme.storefrontSurface === preset.storefrontSurface &&
    theme.storefrontText === preset.storefrontText &&
    theme.storefrontMuted === preset.storefrontMuted &&
    theme.storefrontRadius === preset.storefrontRadius
  );
}

function parseTabValue(tab: string | null): ActiveTab {
  if (tab === "pack-studio") return "PACKS";
  return "BUSINESS";
}

function toTabValue(tab: ActiveTab): "business" | "pack-studio" {
  return tab === "PACKS" ? "pack-studio" : "business";
}

function createItem(): ItemDraft {
  return {
    label: "",
    estimatedValue: "50",
    stock: "1",
    imageUrl: DEFAULT_CARD,
  };
}

function createTier(index: number): TierDraft {
  return {
    name: `${String.fromCharCode(65 + index)} Tier`,
    percentage: "",
    items: [createItem()],
  };
}

function toLocalInputValue(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function VendorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) {
      return window.location.host.toLowerCase();
    }
    return configuredVendorHost || "demo.localhost";
  }, []);
  const vendorBaseDomain = useMemo(() => {
    const host = configuredVendorHost || runtimeVendorHost;
    return host.replace(/^[^.]+\./, "");
  }, [runtimeVendorHost]);
  const headers = useMemo(() => ({ "x-vendor-host": runtimeVendorHost, ...clientPageHeader }), [runtimeVendorHost]);
  const authHeaders = useCallback(() => {
    return {
      ...headers,
    };
  }, [headers]);

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [limits, setLimits] = useState<VendorLimits>({ planCode: "BASIC", maxPackItems: 50, maxPackTiers: 5, maxDrawQuantity: 100 });
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [packEarnings, setPackEarnings] = useState<PackEarning[]>([]);
  const [referrals, setReferrals] = useState<ReferralCustomer[]>([]);
  const [qrs, setQrs] = useState<VendorQr[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [creativeJobs, setCreativeJobs] = useState<CreativeJob[]>([]);

  const [vendorName, setVendorName] = useState("");
  const [vendorSlug, setVendorSlug] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [businessContact, setBusinessContact] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [logoImageUrl, setLogoImageUrl] = useState("");
  const [faviconImageUrl, setFaviconImageUrl] = useState("");
  const [themeDraft, setThemeDraft] = useState(DEFAULT_THEME);

  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerTargetUrl, setBannerTargetUrl] = useState("");

  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [packTitle, setPackTitle] = useState("");
  const [packBannerImageUrl, setPackBannerImageUrl] = useState(DEFAULT_PACK_BANNER);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pricePoints, setPricePoints] = useState("100");
  const [totalStock, setTotalStock] = useState("100");
  const [status, setStatus] = useState<"DRAFT" | "LIVE">("DRAFT");
  const [isNew, setIsNew] = useState(true);
  const [limitedLabel, setLimitedLabel] = useState("");
  const [importantNotes, setImportantNotes] = useState("");
  const [drawLimitMode, setDrawLimitMode] = useState<"NONE" | "ONCE_PER_CUSTOMER" | "DAILY_RESET">("NONE");
  const [drawLimitValue, setDrawLimitValue] = useState("1");
  const [drawLimitResetTimezone, setDrawLimitResetTimezone] = useState("Asia/Singapore");
  const [tiers, setTiers] = useState<TierDraft[]>([createTier(0)]);
  const [qrPoints, setQrPoints] = useState("100");
  const [qrExpiryMinutes, setQrExpiryMinutes] = useState("15");
  const [activeQr, setActiveQr] = useState<VendorQr | null>(null);
  const [activeQrDataUrl, setActiveQrDataUrl] = useState<string | null>(null);
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [cardSearchQuery, setCardSearchQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogSuggestion[]>([]);
  const [catalogResultsLoading, setCatalogResultsLoading] = useState(false);
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(emptyCatalogFilters);
  const [catalogFacets, setCatalogFacets] = useState<CatalogFacets>(emptyCatalogFacets);
  const [catalogGameFilter, setCatalogGameFilter] = useState("POKEMON");
  const catalogSearchCacheRef = useRef<Map<string, CatalogSuggestion[]>>(new Map());
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [uploadingPackBannerImage, setUploadingPackBannerImage] = useState(false);
  const [uploadingVendorLogo, setUploadingVendorLogo] = useState(false);
  const [importingPackCsv, setImportingPackCsv] = useState(false);
  const [csvImportSummary, setCsvImportSummary] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("BUSINESS");
  const selectedThemePresetId = useMemo(() => {
    const found = THEME_PRESETS.find((preset) => matchesPreset(themeDraft, preset));
    return found?.id ?? "custom";
  }, [themeDraft]);

  const totalDraftItems = tiers.reduce((sum, tier) => sum + tier.items.length, 0);

  async function resolveVendorHomeHost() {
    const response = await fetch(`${apiBase}/v1/auth/vendor-home`, {
      headers: clientPageHeader,
      credentials: "include",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    const host = String(payload.vendorHost ?? "").trim().toLowerCase();
    return host || null;
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const vendorRes = await fetch(`${apiBase}/v1/vendor/current`, { headers: authHeaders(), credentials: "include", cache: "no-store" });
      if (!vendorRes.ok) {
        if (vendorRes.status === 400) {
          const membershipHost = await resolveVendorHomeHost();
          const currentHost = window.location.host.toLowerCase();
          if (membershipHost && membershipHost !== currentHost) {
            window.location.href = `${window.location.protocol}//${membershipHost}/vendor`;
            return;
          }
          throw new Error("Vendor context not resolved for this host. Please use your vendor subdomain.");
        }
        if (vendorRes.status === 401) {
          throw new Error("Please login with your vendor account.");
        }
        throw new Error("Failed to resolve vendor context.");
      }

      const vendorJson = await vendorRes.json();
      const [limitsRes, summaryRes, packEarningsRes, referralsRes, bannersRes, packsRes, qrRes, creativeJobsRes] = await Promise.all([
        fetch(`${apiBase}/v1/vendor/limits`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/earnings/summary`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/earnings/packs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/referrals`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/banners`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/packs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/points/qr`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/creative-jobs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
      ]);

      if (!limitsRes.ok || !summaryRes.ok || !packEarningsRes.ok || !referralsRes.ok || !bannersRes.ok || !packsRes.ok || !creativeJobsRes.ok) {
        throw new Error("Failed to load vendor dashboard data");
      }

      const limitsJson = await limitsRes.json();
      const summaryJson = await summaryRes.json();
      const packEarningsJson = await packEarningsRes.json();
      const referralsJson = await referralsRes.json();
      const qrJson = qrRes.ok ? await qrRes.json() : { qrs: [] };
      const bannersJson = await bannersRes.json();
      const packsJson = await packsRes.json();
      const creativeJobsJson = await creativeJobsRes.json();

      const v = vendorJson.vendor ?? null;
      setVendor(v);
      setVendorName(v?.name ?? "");
      setVendorSlug(v?.slug ?? "");
      setBusinessLocation(v?.businessLocation ?? "");
      setBusinessContact(v?.businessContact ?? "");
      setReferralCode(v?.referralCode ?? "");
      setLogoImageUrl(normalizeVendorLogoUrl(v?.logoImageUrl));
      setFaviconImageUrl(normalizeVendorFaviconUrl(v?.faviconImageUrl, v?.logoImageUrl));
      setThemeDraft({
        storefrontPrimary: v?.vendorSettings?.storefrontPrimary ?? DEFAULT_THEME.storefrontPrimary,
        storefrontSecondary: v?.vendorSettings?.storefrontSecondary ?? DEFAULT_THEME.storefrontSecondary,
        storefrontAccent: v?.vendorSettings?.storefrontAccent ?? DEFAULT_THEME.storefrontAccent,
        storefrontSurface: v?.vendorSettings?.storefrontSurface ?? DEFAULT_THEME.storefrontSurface,
        storefrontText: v?.vendorSettings?.storefrontText ?? DEFAULT_THEME.storefrontText,
        storefrontMuted: v?.vendorSettings?.storefrontMuted ?? DEFAULT_THEME.storefrontMuted,
        storefrontRadius: v?.vendorSettings?.storefrontRadius ?? DEFAULT_THEME.storefrontRadius,
      });

      setLimits(limitsJson.limits ?? { planCode: "BASIC", maxPackItems: 50, maxPackTiers: 5, maxDrawQuantity: 100 });
      setSummary(summaryJson.summary ?? null);
      setPackEarnings(packEarningsJson.items ?? []);
      setReferrals(referralsJson.customers ?? []);
      setQrs(qrJson.qrs ?? []);
      setBanners(bannersJson.banners ?? []);
      setPacks(packsJson.packs ?? []);
      setCreativeJobs(creativeJobsJson.creativeJobs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useBackForwardRefresh(loadAll, { cooldownMs: 20000 });

  useEffect(() => {
    const query = cardSearchQuery.trim();
    const normalizedGameFilter = catalogGameFilter.trim().toUpperCase() || "ALL";

    if (query.length < 2) {
      setCatalogResults([]);
      setCatalogResultsLoading(false);
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const cacheKey = `card-search:${normalizedGameFilter}:${normalizedQuery}:60:${catalogFilters.source}:${catalogFilters.language}:${catalogFilters.setId}:${catalogFilters.rarity}`;
    const cached = catalogSearchCacheRef.current.get(cacheKey);
    if (cached) {
      setCatalogResults(cached);
      setCatalogResultsLoading(false);
      return;
    }

    let isActive = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!isActive) return;
      setCatalogResultsLoading(true);
      const url = new URL(`${apiBase}/v1/catalog/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "60");
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
          const nextItems = (payload.items ?? []) as CatalogSuggestion[];
          if (!isActive) return;
          setCatalogResults(nextItems);
          catalogSearchCacheRef.current.set(cacheKey, nextItems);
        })
        .catch((error: unknown) => {
          if (!isActive) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setCatalogResults([]);
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
  }, [authHeaders, cardSearchQuery, catalogFilters, catalogGameFilter]);

  useEffect(() => {
    const url = new URL(`${apiBase}/v1/catalog/facets`);
    url.searchParams.set("type", "card");
    appendCatalogFilters(url, catalogFilters);

    fetch(url.toString(), {
      headers: authHeaders(),
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error ?? "Failed to load catalog facets");
        setCatalogFacets((payload.facets ?? emptyCatalogFacets) as CatalogFacets);
      })
      .catch(() => {
        setCatalogFacets(emptyCatalogFacets);
      });
  }, [authHeaders, catalogFilters]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setActiveTab(parseTabValue(params.get("tab")));
    setCatalogFilters(parseCatalogFilters(params));
  }, []);

  function setCatalogFilterInUrl(field: keyof CatalogFilters, value: string) {
    const nextFilters = { ...catalogFilters, [field]: value };
    setCatalogFilters(nextFilters);
    setCatalogResults([]);
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    for (const key of Object.keys(emptyCatalogFilters) as Array<keyof CatalogFilters>) {
      if (nextFilters[key]) params.set(key, nextFilters[key]);
      else params.delete(key);
    }
    params.set("tab", "pack-studio");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setActiveTabInUrl(tab: ActiveTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    params.set("tab", toTabValue(tab));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function bootstrapOwner() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${apiBase}/v1/vendor/bootstrap-owner`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to bootstrap vendor owner");
      setSuccess(body?.membership?.bootstrapped ? "Vendor owner access granted." : "Vendor membership already exists.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bootstrap owner");
    } finally {
      setSaving(false);
    }
  }

  async function saveVendorProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const profileRes = await fetch(`${apiBase}/v1/vendor/profile`, {
        method: "PATCH",
        headers: { ...authHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: vendorName }),
      });
      if (!profileRes.ok) {
        const body = await profileRes.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update vendor profile name");
      }

      const businessRes = await fetch(`${apiBase}/v1/vendor/business`, {
        method: "PATCH",
        headers: { ...authHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ businessLocation, businessContact }),
      });
      if (!businessRes.ok) {
        const body = await businessRes.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update business information");
      }

      const trimmedReferral = referralCode.trim();
      if (trimmedReferral.length > 0) {
        const referralRes = await fetch(`${apiBase}/v1/vendor/referral`, {
          method: "PATCH",
          headers: { ...authHeaders(), "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ referralCode: trimmedReferral }),
        });
        if (!referralRes.ok) {
          const body = await referralRes.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to update referral code");
        }
      }

      setSuccess("Vendor profile updated.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update vendor profile");
    } finally {
      setSaving(false);
    }
  }

  async function saveVendorLogo(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const normalizedLogo = normalizeVendorLogoUrl(logoImageUrl);
      const normalizedFavicon = normalizeVendorFaviconUrl(faviconImageUrl, normalizedLogo);
      const res = await fetch(`${apiBase}/v1/vendor/logo`, {
        method: "PATCH",
        headers: { ...authHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          logoImageUrl: normalizedLogo,
          faviconImageUrl: normalizedFavicon || normalizedLogo,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to update vendor logo");
      setSuccess("Vendor logo and favicon updated.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update vendor logo");
    } finally {
      setSaving(false);
    }
  }

  async function handleVendorLogoUpload(file: File | null) {
    if (!file) return;
    setUploadingVendorLogo(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "vendor-logo");
      const response = await fetch(`${apiBase}/v1/vendor/media/images`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Logo upload failed");
      setLogoImageUrl(normalizeVendorLogoUrl(String(payload.desktopUrl ?? "")));
      setFaviconImageUrl(normalizeVendorFaviconUrl(String(payload.faviconUrl ?? ""), String(payload.desktopUrl ?? "")));
      setSuccess("Logo uploaded. Save to apply across storefront and favicon.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setUploadingVendorLogo(false);
    }
  }

  async function saveVendorPrefix(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiBase}/v1/vendor/prefix`, {
        method: "PATCH",
        headers: { ...authHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug: vendorSlug.trim().toLowerCase() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to update vendor prefix");

      setSuccess(body?.message ?? "Vendor prefix updated.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update vendor prefix");
    } finally {
      setSaving(false);
    }
  }

  async function switchPlan(nextPlanCode: "BASIC" | "ELITE") {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiBase}/v1/vendor/plan`, {
        method: "PATCH",
        headers: { ...authHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planCode: nextPlanCode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update plan");
      }
      setSuccess(`Plan updated to ${nextPlanCode}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  async function saveTheme(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${apiBase}/v1/vendor/theme`, {
        method: "PATCH",
        headers: { ...authHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(themeDraft),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to save storefront theme");
      setSuccess("Storefront theme updated.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save storefront theme");
    } finally {
      setSaving(false);
    }
  }

  async function generateQr(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${apiBase}/v1/vendor/points/qr`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          points: Number(qrPoints),
          expiresInMinutes: Number(qrExpiryMinutes),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create QR");
      }
      setSuccess("QR generated.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!activeQr?.token) {
      setActiveQrDataUrl(null);
      return;
    }
    let mounted = true;
    QRCode.toDataURL(activeQr.token, {
      width: 300,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url: string) => {
        if (mounted) setActiveQrDataUrl(url);
      })
      .catch(() => {
        if (mounted) setActiveQrDataUrl(null);
      });
    return () => {
      mounted = false;
    };
  }, [activeQr]);

  async function addBanner(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        title: bannerTitle,
        imageUrl: bannerImageUrl,
      };

      if (bannerTargetUrl.trim()) payload.targetUrl = bannerTargetUrl.trim();

      const res = await fetch(`${apiBase}/v1/vendor/banners`, {
        method: "POST",
        headers: { ...authHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add banner");

      setBannerTitle("");
      setBannerImageUrl("");
      setBannerTargetUrl("");
      setSuccess("Banner added.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add banner");
    } finally {
      setSaving(false);
    }
  }

  async function uploadVendorImage(file: File, kind: "carousel-banner" | "pack-banner" | "card-art") {
    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);
    const res = await fetch(`${apiBase}/v1/vendor/media/images`, {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      body: form,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error ?? "Failed to upload image");
    return payload as { desktopUrl?: string };
  }

  async function handleBannerImageUpload(file: File | null) {
    if (!file) return;
    setUploadingBannerImage(true);
    setError(null);
    setSuccess(null);
    try {
      const uploaded = await uploadVendorImage(file, "carousel-banner");
      const nextUrl = uploaded.desktopUrl ?? "";
      if (!nextUrl) throw new Error("Upload response missing desktopUrl");
      setBannerImageUrl(nextUrl);
      setSuccess("Banner image uploaded and applied.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload banner image");
    } finally {
      setUploadingBannerImage(false);
    }
  }

  async function handlePackBannerImageUpload(file: File | null) {
    if (!file) return;
    setUploadingPackBannerImage(true);
    setError(null);
    setSuccess(null);
    try {
      const uploaded = await uploadVendorImage(file, "pack-banner");
      const nextUrl = uploaded.desktopUrl ?? "";
      if (!nextUrl) throw new Error("Upload response missing desktopUrl");
      setPackBannerImageUrl(nextUrl);
      setSuccess("Pack banner uploaded and applied.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload pack banner");
    } finally {
      setUploadingPackBannerImage(false);
    }
  }

  function downloadPackCsvTemplate() {
    const sample = [
      "tier_name,tier_percentage,item_label,estimated_value,stock,set_id,card_number,catalog_item_id,source_item_id,image_url,game",
      "S Tier,8,Charizard ex,1800,1,24655,021/086,,,,POKEMON",
      "S Tier,8,Umbreon VMAX,2200,1,24655,095/203,,,,POKEMON",
      "S Tier,8,Gengar VMAX,1500,1,24655,157/264,,,,POKEMON",
      "A Tier,32,Pikachu ex,450,3,24655,025/086,,,,POKEMON",
      "A Tier,32,Mew ex,500,2,24655,151/165,,,,POKEMON",
      "A Tier,32,Blastoise ex,480,2,24655,009/165,,,,POKEMON",
      "B Tier,60,Basic Booster Pack,120,15,,,,,https://example.com/booster-pack.webp,POKEMON",
      "B Tier,60,Trainer Bundle,95,20,,,,,https://example.com/trainer-bundle.webp,POKEMON",
      "B Tier,60,Energy Set,60,30,,,,,https://example.com/energy-set.webp,POKEMON",
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pack-contents-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePackCsvImport(file: File | null) {
    if (!file) return;
    setImportingPackCsv(true);
    setError(null);
    setSuccess(null);
    setCsvImportSummary(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`${apiBase}/v1/vendor/packs/import-csv`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: form,
      });
      const body = (await res.json().catch(() => null)) as CsvImportResponse | { error?: string; validationErrors?: Array<{ rowNumber: number; message: string }> } | null;
      if (!res.ok) {
        if (body && "validationErrors" in body && Array.isArray(body.validationErrors) && body.validationErrors.length > 0) {
          const first = body.validationErrors[0];
          throw new Error(`CSV row ${first.rowNumber}: ${first.message}`);
        }
        throw new Error((body as { error?: string } | null)?.error ?? "Failed to import CSV");
      }
      const payload = body as CsvImportResponse;
      const nextTiers: TierDraft[] = payload.tiers.map((tier) => ({
        name: tier.name,
        percentage: typeof tier.percentage === "number" ? String(tier.percentage) : "",
        items: tier.items.map((item) => ({
          label: item.label,
          estimatedValue: String(item.estimatedValue),
          stock: String(item.stock),
          imageUrl: item.imageUrl || DEFAULT_CARD,
        })),
      }));
      setTiers(nextTiers.length > 0 ? nextTiers : [createTier(0)]);
      setCsvImportSummary(
        `Imported ${payload.summary.totalRows} rows across ${payload.summary.tierCount} tiers. Matched: ${payload.summary.matchedRows}, fallback image: ${payload.summary.unmatchedRows}.`
      );
      setSuccess("CSV imported into pack builder.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setImportingPackCsv(false);
    }
  }

  async function deleteBanner(id: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiBase}/v1/vendor/banners/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete banner");
      setSuccess("Banner removed.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete banner");
    } finally {
      setSaving(false);
    }
  }

  async function generateCreativeDraft(packId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiBase}/v1/vendor/packs/${packId}/creative-jobs`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "content-type": "application/json",
          "x-idempotency-key": `creative-${packId}-${Date.now()}`,
        },
        credentials: "include",
        body: JSON.stringify({ stylePreset: "premium_foil", aspectRatio: "16:9" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error ?? "Failed to generate creative draft"));
      setSuccess("Private creative draft generated. Publish is intentionally blocked until legal/storage gates clear.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate creative draft");
    } finally {
      setSaving(false);
    }
  }

  async function attemptPublishCreative(jobId: string, assetId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiBase}/v1/vendor/creative-jobs/${jobId}/publish`, {
        method: "POST",
        headers: { ...authHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assetId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError(`Publish blocked: ${(payload.blockers ?? []).join(", ")}`);
        await loadAll();
        return;
      }
      if (!res.ok) throw new Error(String(payload.error ?? "Failed to publish creative"));
      setSuccess("Creative published.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish creative");
    } finally {
      setSaving(false);
    }
  }

  function updateTier(index: number, field: keyof Omit<TierDraft, "items">, value: string) {
    setTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)));
  }

  function updateItem(tierIndex: number, itemIndex: number, field: keyof ItemDraft, value: string) {
    setTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== tierIndex) return tier;
        const items = tier.items.map((item, ii) => (ii === itemIndex ? { ...item, [field]: value } : item));
        return { ...tier, items };
      })
    );
  }

  function applyCatalogSuggestion(tierIndex: number, suggestion: CatalogSuggestion) {
    const nextLabel = [suggestion.name, suggestion.cardNumber ? `#${suggestion.cardNumber}` : ""].filter(Boolean).join(" ");
    setTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== tierIndex) return tier;
        if (totalDraftItems >= limits.maxPackItems) return tier;
        const items = [
          ...tier.items,
          {
            label: nextLabel || suggestion.name,
            estimatedValue: "50",
            stock: "1",
            imageUrl: suggestion.imageLargeUrl || suggestion.imageThumbUrl || suggestion.imageBaseUrl || DEFAULT_CARD,
            catalogItemId: suggestion.id,
            catalogSource: suggestion.source ?? undefined,
            catalogSourceItemId: suggestion.sourceItemId ?? undefined,
            language: suggestion.language ?? undefined,
          },
        ];
        return { ...tier, items };
      })
    );
  }

  function addTier() {
    setTiers((prev) => {
      if (prev.length >= limits.maxPackTiers) return prev;
      return [...prev, createTier(prev.length)];
    });
    setSelectedTierIndex((prev) => Math.min(prev + 1, limits.maxPackTiers - 1));
  }

  function removeTier(tierIndex: number) {
    setTiers((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== tierIndex);
    });
    setSelectedTierIndex((prev) => {
      if (prev === tierIndex) return Math.max(0, tierIndex - 1);
      if (prev > tierIndex) return prev - 1;
      return prev;
    });
  }

  function addItem(tierIndex: number) {
    setTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== tierIndex) return tier;
        if (totalDraftItems >= limits.maxPackItems) return tier;
        return { ...tier, items: [...tier.items, createItem()] };
      })
    );
  }

  function removeItem(tierIndex: number, itemIndex: number) {
    setTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== tierIndex) return tier;
        return { ...tier, items: tier.items.filter((_, ii) => ii !== itemIndex) };
      })
    );
  }

  function toIsoDateTime(localValue: string) {
    if (!localValue) return undefined;
    const date = new Date(localValue);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }

  function resetPackForm() {
    setEditingPackId(null);
    setPackTitle("");
    setPackBannerImageUrl(DEFAULT_PACK_BANNER);
    setStartsAt("");
    setEndsAt("");
    setPricePoints("100");
    setTotalStock("100");
    setStatus("DRAFT");
    setIsNew(true);
    setLimitedLabel("");
    setImportantNotes("");
    setDrawLimitMode("NONE");
    setDrawLimitValue("1");
    setDrawLimitResetTimezone("Asia/Singapore");
    setTiers([createTier(0)]);
    setSelectedTierIndex(0);
    setCardSearchQuery("");
    setCatalogResults([]);
  }

  function editPack(pack: Pack) {
    setEditingPackId(pack.id);
    setPackTitle(pack.title);
    setPackBannerImageUrl(pack.packBannerImageUrl ?? DEFAULT_PACK_BANNER);
    setPricePoints(String(pack.pricePoints));
    setTotalStock(String(pack.totalStock));
    setStartsAt(toLocalInputValue(pack.startsAt));
    setEndsAt(toLocalInputValue(pack.endsAt));
    setStatus(pack.status === "ARCHIVED" ? "DRAFT" : pack.status);
    setIsNew(Boolean(pack.isNew ?? true));
    setLimitedLabel(pack.limitedLabel ?? "");
    setImportantNotes(pack.importantNotes ?? "");
    setDrawLimitMode(pack.drawLimitMode ?? "NONE");
    setDrawLimitValue(String(pack.drawLimitValue ?? 1));
    setDrawLimitResetTimezone(pack.drawLimitResetTimezone ?? "Asia/Singapore");

    setTiers([
      {
        name: "A Tier",
        percentage: "",
        items: pack.prizes.map((prize) => ({
          label: prize.label,
          estimatedValue: String(prize.estimatedValue),
          stock: String(prize.stock),
          imageUrl: prize.imageUrl ?? DEFAULT_CARD,
          catalogItemId: prize.catalogItemId ?? undefined,
          catalogSource: prize.catalogSource ?? undefined,
          catalogSourceItemId: prize.catalogSourceItemId ?? undefined,
          language: prize.language ?? undefined,
        })),
      },
    ]);
    setSelectedTierIndex(0);
  }

  async function submitPack(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (tiers.length > limits.maxPackTiers) {
        throw new Error(`Tier count exceeds plan limit (${limits.maxPackTiers}).`);
      }
      if (totalDraftItems > limits.maxPackItems) {
        throw new Error(`Item count exceeds plan limit (${limits.maxPackItems}).`);
      }

      const payload = {
        title: packTitle,
        packBannerImageUrl: packBannerImageUrl.trim() ? packBannerImageUrl.trim() : DEFAULT_PACK_BANNER,
        pricePoints: Number(pricePoints),
        totalStock: Number(totalStock),
        startsAt: toIsoDateTime(startsAt),
        endsAt: toIsoDateTime(endsAt),
        status,
        isNew,
        limitedLabel: limitedLabel.trim() ? limitedLabel.trim() : undefined,
        importantNotes: importantNotes.trim() ? importantNotes.trim() : undefined,
        drawLimitMode,
        drawLimitValue: drawLimitMode === "DAILY_RESET" ? Number(drawLimitValue) : undefined,
        drawLimitResetTimezone,
        tiers: tiers.map((tier) => ({
          name: tier.name,
          percentage: tier.percentage.trim() ? Number(tier.percentage) : undefined,
          items: tier.items.map((item) => ({
            label: item.label,
            estimatedValue: Number(item.estimatedValue),
            stock: Number(item.stock),
            imageUrl: item.imageUrl.trim() ? item.imageUrl.trim() : undefined,
            catalogItemId: item.catalogItemId,
            catalogSource: item.catalogSource,
            catalogSourceItemId: item.catalogSourceItemId,
            language: item.language,
          })),
        })),
      };

      const endpoint = editingPackId ? `${apiBase}/v1/vendor/packs/${editingPackId}` : `${apiBase}/v1/vendor/packs`;
      const method = editingPackId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { ...authHeaders(), "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save pack");
      }

      setSuccess(editingPackId ? "Pack updated successfully." : "Pack created successfully.");
      resetPackForm();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pack");
    } finally {
      setSaving(false);
    }
  }

  async function archivePack(packId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${apiBase}/v1/vendor/packs/${packId}/archive`, {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to archive pack");
      setSuccess("Pack archived.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive pack");
    } finally {
      setSaving(false);
    }
  }

  async function deletePack(packId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${apiBase}/v1/vendor/packs/${packId}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to delete pack");
      if (body?.mode === "retired") {
        setSuccess(body?.message ?? "Pack has history and was archived/hidden instead of hard deleted.");
      } else {
        setSuccess("Pack deleted.");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete pack");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container vendor-dashboard">
      <header className="site-header">
        <div className="brand-text">
          <strong>Vendor Dashboard</strong>
          <span>{vendor?.name ?? "-"} ({vendor?.host ?? runtimeVendorHost})</span>
        </div>
        <div className="actions">
          <button type="button" className="sort-pill" onClick={() => void bootstrapOwner()} disabled={saving}>Bootstrap Owner Access</button>
          <a className="sort-pill" href="/">Back to Homepage</a>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="badge">{success}</p> : null}

      <section className="card">
        <div className="actions">
          <button
            type="button"
            className={`sort-pill ${activeTab === "BUSINESS" ? "active" : ""}`}
            onClick={() => setActiveTabInUrl("BUSINESS")}
          >
            Business
          </button>
          <button
            type="button"
            className={`sort-pill ${activeTab === "PACKS" ? "active" : ""}`}
            onClick={() => setActiveTabInUrl("PACKS")}
          >
            Pack Studio
          </button>
        </div>
      </section>

      {activeTab === "BUSINESS" ? (
        <>
          <section className="card" style={{ marginTop: 12 }}>
            <h2>Plan & Earnings</h2>
            <p className="muted tiny">Current plan: <strong>{limits.planCode}</strong> | Pack tiers max: {limits.maxPackTiers} | Pack items max: {limits.maxPackItems}</p>
            <div className="actions">
              <button type="button" className="sort-pill" disabled={saving || limits.planCode === "BASIC"} onClick={() => void switchPlan("BASIC")}>Switch to BASIC</button>
              <button type="button" className="sort-pill" disabled={saving || limits.planCode === "ELITE"} onClick={() => void switchPlan("ELITE")}>Switch to ELITE</button>
            </div>
            <div className="stats-grid">
              <div className="stat"><div className="stat-label">Total Revenue Points</div><div className="stat-value">{summary?.totalRevenuePoints?.toLocaleString() ?? "0"}</div></div>
              <div className="stat"><div className="stat-label">Net Points</div><div className="stat-value">{summary?.netPoints?.toLocaleString() ?? "0"}</div></div>
              <div className="stat"><div className="stat-label">Currency Revenue</div><div className="stat-value">{summary ? `${summary.totalRevenueCurrency.toFixed(2)} ${summary.currencyCode}` : "0"}</div></div>
            </div>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Vendor Profile / Business / Referral</h2>
            <form className="vendor-form" onSubmit={saveVendorProfile}>
              <label className="muted tiny">
                Vendor name
                <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" required minLength={2} maxLength={80} />
              </label>
              <label className="muted tiny">
                Business location
                <input value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} placeholder="Business location" />
              </label>
              <label className="muted tiny">
                Business contact
                <input value={businessContact} onChange={(e) => setBusinessContact(e.target.value)} placeholder="Business contact" />
              </label>
              <label className="muted tiny">
                Referral code URL slug
                <input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="Referral code URL slug" required minLength={3} maxLength={40} />
              </label>
              <button type="submit" className="draw-button" disabled={saving || loading}>Save Vendor Info</button>
            </form>
            <form className="vendor-form" onSubmit={saveVendorPrefix}>
              <label className="muted tiny">
                Vendor URL prefix (slug)
                <input
                  value={vendorSlug}
                  onChange={(e) => setVendorSlug(e.target.value)}
                  placeholder="Vendor URL prefix (slug)"
                  required
                  minLength={2}
                  maxLength={50}
                  pattern="^[a-z0-9-]+$"
                />
              </label>
              <p className="muted tiny">New vendor URL: <code>https://{vendorSlug || "your-prefix"}.{vendorBaseDomain}</code></p>
              <button type="submit" className="draw-button" disabled={saving || loading}>Update Vendor Prefix</button>
            </form>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Storefront Theme</h2>
            <p className="muted tiny">Choose a preset pastel theme for your landing and pack pages.</p>
            <form className="vendor-form" onSubmit={saveTheme}>
              <div className="theme-preset-grid" style={{ gridColumn: "1 / -1" }}>
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`theme-preset-card ${selectedThemePresetId === preset.id ? "active" : ""}`}
                    onClick={() => setThemeDraft({
                      storefrontPrimary: preset.storefrontPrimary,
                      storefrontSecondary: preset.storefrontSecondary,
                      storefrontAccent: preset.storefrontAccent,
                      storefrontSurface: preset.storefrontSurface,
                      storefrontText: preset.storefrontText,
                      storefrontMuted: preset.storefrontMuted,
                      storefrontRadius: preset.storefrontRadius,
                    })}
                  >
                    <strong>{preset.label}</strong>
                    <span className="theme-preset-swatches">
                      <i style={{ background: preset.storefrontPrimary }} />
                      <i style={{ background: preset.storefrontSecondary }} />
                      <i style={{ background: preset.storefrontAccent }} />
                      <i style={{ background: preset.storefrontSurface, border: "1px solid #d9d9ef" }} />
                    </span>
                    <div
                      className="theme-preset-mini"
                      style={
                        {
                          ["--mini-primary" as string]: preset.storefrontPrimary,
                          ["--mini-secondary" as string]: preset.storefrontSecondary,
                          ["--mini-accent" as string]: preset.storefrontAccent,
                          ["--mini-surface" as string]: preset.storefrontSurface,
                          ["--mini-text" as string]: preset.storefrontText,
                          ["--mini-muted" as string]: preset.storefrontMuted,
                        } as CSSProperties
                      }
                    >
                      <div className="theme-preset-mini-top" />
                      <div className="theme-preset-mini-card">
                        <span className="theme-preset-mini-title">Mystery Pack</span>
                        <span className="theme-preset-mini-sub">Pastel preview</span>
                        <span className="theme-preset-mini-btn">Open</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button type="submit" className="draw-button" disabled={saving || loading}>Save Theme</button>
            </form>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Storefront Logo & Favicon</h2>
            <p className="muted tiny">
              Recommended: square logo 1024x1024 (or at least 512x512), PNG/WebP/JPG, max 5MB. This logo is used in header and favicon.
            </p>
            <form className="vendor-form" onSubmit={saveVendorLogo}>
              <label className="muted tiny">
                Logo image URL
                <input value={logoImageUrl} onChange={(e) => setLogoImageUrl(e.target.value)} placeholder="Logo image URL" required />
              </label>
              <label className="muted tiny">
                Favicon URL (optional)
                <input value={faviconImageUrl} onChange={(e) => setFaviconImageUrl(e.target.value)} placeholder="Favicon URL (optional)" />
              </label>
              <label className="muted tiny">
                Upload logo (square recommended, max 5MB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void handleVendorLogoUpload(e.target.files?.[0] ?? null)}
                  disabled={uploadingVendorLogo}
                />
              </label>
              <button type="submit" className="draw-button" disabled={saving || loading}>Save Logo</button>
            </form>
            {logoImageUrl ? (
              <div className="banner-admin-row" style={{ marginTop: 10, gridTemplateColumns: "96px 1fr" }}>
                <img src={logoImageUrl} alt="Vendor logo preview" style={{ width: 96, height: 96, objectFit: "contain", background: "#fff" }} />
                <div className="muted tiny">Logo preview</div>
              </div>
            ) : null}
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Banners</h2>
            <form className="vendor-form" onSubmit={addBanner}>
              <label className="muted tiny">
                Banner title
                <input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="Banner title" required />
              </label>
                <label className="muted tiny">
                  Banner image URL
                  <input value={bannerImageUrl} onChange={(e) => setBannerImageUrl(e.target.value)} placeholder="Banner image URL" required />
                </label>
                <label className="muted tiny">
                  Upload banner image (max 5MB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handleBannerImageUpload(e.target.files?.[0] ?? null)}
                    disabled={uploadingBannerImage}
                  />
                </label>
              <label className="muted tiny">
                Target URL (optional)
                <input value={bannerTargetUrl} onChange={(e) => setBannerTargetUrl(e.target.value)} placeholder="Target URL (optional)" />
              </label>
              <button type="submit" className="draw-button" disabled={saving || loading}>Add Banner</button>
            </form>

            <div className="banner-admin-list">
              {banners.map((banner) => (
                <div className="banner-admin-row" key={banner.id}>
                  <img src={banner.imageUrl} alt={banner.title} />
                  <div>
                    <strong>{banner.title}</strong>
                    <div className="muted tiny">Order {banner.sortOrder}</div>
                  </div>
                  <button type="button" className="sort-pill" onClick={() => void deleteBanner(banner.id)} disabled={saving}>Delete</button>
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Referral Signups</h2>
            <p className="muted tiny">Referral URL: <code>/register?ref={vendor?.referralCode ?? ""}</code></p>
            <div className="result-list">
              {referrals.map((row) => (
                <div className="result-row" key={row.id}>
                  <span>{row.displayName || row.email}</span>
                  <span>{new Date(row.referredAt).toLocaleString()}</span>
                </div>
              ))}
              {referrals.length === 0 ? <p className="muted tiny">No referral signups yet.</p> : null}
            </div>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Generate QR Points</h2>
            <form className="vendor-form" onSubmit={generateQr}>
              <label className="muted tiny">
                Points to grant
                <input value={qrPoints} onChange={(e) => setQrPoints(e.target.value)} type="number" min={1} placeholder="Points to grant" required />
              </label>
              <label className="muted tiny">
                Expiry minutes
                <input value={qrExpiryMinutes} onChange={(e) => setQrExpiryMinutes(e.target.value)} type="number" min={1} max={1440} placeholder="Expiry minutes" required />
              </label>
              <button type="submit" className="draw-button" disabled={saving}>Generate QR Token</button>
            </form>
            <div className="result-list">
              {qrs.map((row) => (
                <div className="result-row" key={row.id}>
                  <span>{row.token}</span>
                  <span>{row.points} pts | {row.status}</span>
                  <button type="button" className="sort-pill" onClick={() => setActiveQr(row)}>Display QR</button>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "PACKS" ? (
        <>
          <section className="card" style={{ marginTop: 12 }}>
            <h2>{editingPackId ? "Edit Pack" : "Create Pack"}</h2>
            <p className="muted tiny">Item limit: {totalDraftItems}/{limits.maxPackItems} | Tier limit: {tiers.length}/{limits.maxPackTiers}</p>
            <div className="actions" style={{ marginTop: 8 }}>
              <button type="button" className="sort-pill" onClick={downloadPackCsvTemplate}>Download CSV Template</button>
              <label className="sort-pill" style={{ cursor: "pointer" }}>
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => void handlePackCsvImport(e.target.files?.[0] ?? null)}
                  disabled={importingPackCsv}
                />
              </label>
            </div>
            {csvImportSummary ? <p className="muted tiny" style={{ marginTop: 8 }}>{csvImportSummary}</p> : null}
            <label className="muted tiny" style={{ marginTop: 8, display: "inline-flex", flexDirection: "column", gap: 6 }}>
              Catalog game search scope
              <select value={catalogGameFilter} onChange={(e) => setCatalogGameFilter(e.target.value)}>
                <option value="POKEMON">Pokemon</option>
                <option value="ONE PIECE">One Piece</option>
                <option value="YU-GI-OH!">Yu-Gi-Oh!</option>
                <option value="DRAGON BALL">Dragon Ball</option>
                <option value="ALL">All games</option>
              </select>
            </label>

            <form className="pack-builder" onSubmit={submitPack}>
              <div className="pack-builder-grid">
                <label className="muted tiny">
                  Pack name
                  <input value={packTitle} onChange={(e) => setPackTitle(e.target.value)} placeholder="Pack Name" required minLength={2} maxLength={120} />
                </label>
                <label className="muted tiny">
                  Pack banner image URL
                  <input value={packBannerImageUrl} onChange={(e) => setPackBannerImageUrl(e.target.value)} placeholder="Pack banner image URL" required />
                </label>
                <div className="muted tiny" style={{ gridColumn: "1 / -1" }}>
                  Choose from default pack banners
                  <div className="theme-preset-grid" style={{ marginTop: 8 }}>
                    {DEFAULT_PACK_BANNER_OPTIONS.map((option) => (
                      <button
                        key={option.desktop}
                        type="button"
                        className={`theme-preset-card ${packBannerImageUrl === option.desktop ? "active" : ""}`}
                        onClick={() => setPackBannerImageUrl(option.desktop)}
                      >
                        <strong>{option.label}</strong>
                        <img
                          src={option.desktop}
                          alt={option.label}
                          style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <label className="muted tiny">
                  Upload pack banner (max 5MB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handlePackBannerImageUpload(e.target.files?.[0] ?? null)}
                    disabled={uploadingPackBannerImage}
                  />
                </label>
                {packBannerImageUrl ? (
                  <div className="banner-admin-row" style={{ gridColumn: "1 / -1", gridTemplateColumns: "220px 1fr" }}>
                    <img src={packBannerImageUrl} alt="Pack banner preview" style={{ width: "100%", height: "auto", objectFit: "contain", background: "#fff" }} />
                    <div className="muted tiny">Pack banner preview</div>
                  </div>
                ) : null}
                <label className="muted tiny">
                  Price (points)
                  <input type="number" min={1} value={pricePoints} onChange={(e) => setPricePoints(e.target.value)} placeholder="Price (points)" required />
                </label>
                <label className="muted tiny">
                  Total stock
                  <input type="number" min={1} value={totalStock} onChange={(e) => setTotalStock(e.target.value)} placeholder="Total stock" required />
                </label>
                <label className="muted tiny">
                  Limited label (optional)
                  <input type="text" value={limitedLabel} onChange={(e) => setLimitedLabel(e.target.value)} placeholder="Limited label (optional)" />
                </label>
                <label className="muted tiny">
                  Start date-time
                  <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </label>
                <label className="muted tiny">
                  End date-time
                  <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </label>
                <label className="muted tiny">
                  Pack status
                  <select value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "LIVE")}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="LIVE">LIVE</option>
                  </select>
                </label>
                <label className="muted tiny">
                  Draw limit mode
                  <select value={drawLimitMode} onChange={(e) => setDrawLimitMode(e.target.value as "NONE" | "ONCE_PER_CUSTOMER" | "DAILY_RESET")}>
                    <option value="NONE">No limit</option>
                    <option value="ONCE_PER_CUSTOMER">One time per customer</option>
                    <option value="DAILY_RESET">Daily limit (GMT+8 default)</option>
                  </select>
                </label>
                {drawLimitMode === "DAILY_RESET" ? (
                  <>
                    <label className="muted tiny">
                      Daily max draws per customer
                      <input type="number" min={1} value={drawLimitValue} onChange={(e) => setDrawLimitValue(e.target.value)} placeholder="Daily max draws per customer" />
                    </label>
                    <label className="muted tiny">
                      Reset timezone
                      <input type="text" value={drawLimitResetTimezone} onChange={(e) => setDrawLimitResetTimezone(e.target.value)} placeholder="Timezone e.g. Asia/Singapore" />
                    </label>
                  </>
                ) : null}
              </div>

              <label className="muted tiny">
                <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} /> Mark as New
              </label>

              <label className="muted tiny">
                Important notes shown on pack page
                <textarea value={importantNotes} onChange={(e) => setImportantNotes(e.target.value)} placeholder="Important notes shown on pack page" maxLength={2000} />
              </label>

              <div className="pack-builder-two-panel">
                <section className="card tier-pane">
                  <div className="heading-row">
                    <h3>Pack Contents</h3>
                    <span className="muted tiny">{totalDraftItems}/{limits.maxPackItems} cards</span>
                  </div>
                  <div className="tier-stack">
                    {tiers.map((tier, tierIndex) => (
                      <article
                        key={`tier-${tierIndex}`}
                        className={`tier-bucket ${selectedTierIndex === tierIndex ? "active" : ""}`}
                        onClick={() => setSelectedTierIndex(tierIndex)}
                      >
                        <div className="heading-row">
                          <strong>{tier.name || `Tier ${tierIndex + 1}`}</strong>
                          <span className="muted tiny">{tier.items.length} cards</span>
                        </div>
                        <div className="pack-builder-grid">
                          <label className="muted tiny">
                            Tier label
                            <input value={tier.name} onChange={(e) => updateTier(tierIndex, "name", e.target.value)} placeholder="Tier name (e.g. A Tier)" required />
                          </label>
                          <label className="muted tiny">
                            Tier rate %
                            <input value={tier.percentage} onChange={(e) => updateTier(tierIndex, "percentage", e.target.value)} placeholder="Tier % (optional, auto if blank)" type="number" min={0} max={100} step="0.0001" />
                          </label>
                        </div>
                        <div className="tier-card-strip">
                          {tier.items.map((item, itemIndex) => (
                            <button
                              type="button"
                              className="tier-card-tile"
                              key={`tier-${tierIndex}-item-${itemIndex}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem(tierIndex, itemIndex);
                              }}
                              title={`Remove ${item.label || "card"}`}
                            >
                              <img src={item.imageUrl || DEFAULT_CARD} alt={item.label || "Card"} />
                              <span>{item.label || "Untitled card"}</span>
                            </button>
                          ))}
                          {tier.items.length === 0 ? <p className="muted tiny">No cards added yet.</p> : null}
                        </div>
                        <div className="actions" style={{ marginTop: 8 }}>
                          <button type="button" className="sort-pill" onClick={(e) => { e.stopPropagation(); addItem(tierIndex); }} disabled={totalDraftItems >= limits.maxPackItems}>+ Add blank item</button>
                          <button type="button" className="sort-pill" onClick={(e) => { e.stopPropagation(); removeTier(tierIndex); }} disabled={tiers.length <= 1}>Remove Tier</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="card search-pane">
                  <div className="heading-row">
                    <h3>Add Cards</h3>
                    <span className="muted tiny">Selected tier: {tiers[selectedTierIndex]?.name || `Tier ${selectedTierIndex + 1}`}</span>
                  </div>
                  <label className="muted tiny">
                    Search cards
                    <input
                      value={cardSearchQuery}
                      onChange={(e) => setCardSearchQuery(e.target.value)}
                      placeholder="Search by card name..."
                    />
                  </label>
                  <div className="pack-builder-grid">
                    <label className="muted tiny">
                      Card set
                      <select value={catalogFilters.setId} onChange={(e) => setCatalogFilterInUrl("setId", e.target.value)}>
                        <option value="">All sets</option>
                        {catalogFacets.sets.map((set) => (
                          <option key={set.id} value={set.id}>{set.name || set.id} ({set.count})</option>
                        ))}
                      </select>
                    </label>
                    <label className="muted tiny">
                      Rarity
                      <select value={catalogFilters.rarity} onChange={(e) => setCatalogFilterInUrl("rarity", e.target.value)}>
                        <option value="">All rarities</option>
                        {catalogFacets.rarities.map((rarity) => (
                          <option key={rarity.value} value={rarity.value}>{rarity.value} ({rarity.count})</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="pack-builder-grid">
                    <label className="muted tiny">
                      Source
                      <select value={catalogFilters.source} onChange={(e) => setCatalogFilterInUrl("source", e.target.value)}>
                        <option value="">All sources</option>
                        {catalogFacets.sources.map((source) => (
                          <option key={source.value} value={source.value}>{source.value} ({source.count})</option>
                        ))}
                      </select>
                    </label>
                    <label className="muted tiny">
                      Language
                      <select value={catalogFilters.language} onChange={(e) => setCatalogFilterInUrl("language", e.target.value)}>
                        <option value="">All languages</option>
                        {catalogFacets.languages.map((language) => (
                          <option key={language.value} value={language.value}>{language.value} ({language.count})</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {catalogResultsLoading ? <p className="muted tiny">Searching cards...</p> : null}
                  {!catalogResultsLoading && cardSearchQuery.trim().length >= 2 && catalogResults.length === 0 ? (
                    <p className="muted tiny">No cards found for this search.</p>
                  ) : null}
                  <div className="catalog-result-grid">
                    {catalogResults.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className="catalog-result-tile"
                        onClick={() => applyCatalogSuggestion(selectedTierIndex, suggestion)}
                        disabled={totalDraftItems >= limits.maxPackItems || !tiers[selectedTierIndex]}
                        title={`Add to ${tiers[selectedTierIndex]?.name || `Tier ${selectedTierIndex + 1}`}`}
                      >
                        <img src={suggestion.imageThumbUrl || suggestion.imageLargeUrl || suggestion.imageBaseUrl || DEFAULT_CARD} alt={suggestion.name} />
                        <span className="catalog-result-name">{suggestion.name}</span>
                        <span className="muted tiny">{suggestion.cardNumber ? `#${suggestion.cardNumber}` : suggestion.setId || "Card"}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="actions">
                <button type="button" className="draw-button alt" onClick={addTier} disabled={tiers.length >= limits.maxPackTiers}>+ Add Tier</button>
                {editingPackId ? <button type="button" className="sort-pill" onClick={resetPackForm}>Cancel Edit</button> : null}
                <button type="submit" className="draw-button" disabled={saving || loading}>{editingPackId ? "Update Pack" : "Create Pack"}</button>
              </div>
            </form>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Pack Revenue</h2>
            <div className="result-list">
              {packEarnings.map((row) => (
                <div className="result-row" key={row.packId}>
                  <span>{row.packTitle}</span>
                  <span>{row.totalPoints.toLocaleString()} pts | {row.totalDrawQuantity} draws</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Existing Packs</h2>
            <p className="muted tiny">Creative MVP is pack-anchored: generated drafts use only this pack's prize images and a safe abstract background prompt.</p>
            <div className="result-list">
              {packs.map((pack) => (
                <div className="result-row" key={pack.id}>
                  <span>{pack.title} ({pack.status})</span>
                  <span>{pack.pricePoints.toLocaleString()} pts | {pack.remainingStock}/{pack.totalStock}</span>
                  <div className="actions">
                    <button type="button" className="sort-pill" onClick={() => void generateCreativeDraft(pack.id)} disabled={saving || pack.prizes.length === 0}>Generate creative draft</button>
                    <button type="button" className="sort-pill" onClick={() => editPack(pack)} disabled={saving}>Edit</button>
                    <button type="button" className="sort-pill" onClick={() => void archivePack(pack.id)} disabled={saving || pack.status === "ARCHIVED"}>Archive</button>
                    <button type="button" className="sort-pill" onClick={() => void deletePack(pack.id)} disabled={saving}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Private Creative Drafts</h2>
            <p className="muted tiny">Publish is intentionally blocked in MVP until legal image-use approval, immutable storage, and publish-time revalidation are implemented.</p>
            <div className="banner-admin-list">
              {creativeJobs.flatMap((job) => job.assets.map((asset) => ({ job, asset }))).map(({ job, asset }) => (
                <div className="banner-admin-row" key={asset.id}>
                  <img src={asset.imageUrl} alt={asset.title} />
                  <div>
                    <strong>{asset.title}</strong>
                    <div className="muted tiny">{job.status} | {job.stylePreset} | {asset.status}</div>
                    <div className="muted tiny">Hash {asset.contentHash.slice(0, 12)}… | Prompt: {job.safePrompt}</div>
                  </div>
                  <button type="button" className="sort-pill" onClick={() => void attemptPublishCreative(job.id, asset.id)} disabled={saving}>Publish gate check</button>
                </div>
              ))}
              {creativeJobs.length === 0 ? <p className="muted tiny">No creative drafts yet. Generate one from an existing pack.</p> : null}
            </div>
          </section>
        </>
      ) : null}

      {activeQr ? (
        <div className="qr-modal-backdrop" onClick={() => setActiveQr(null)}>
          <div className="qr-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="heading-row">
              <h3>QR Token</h3>
              <button type="button" className="sort-pill" onClick={() => setActiveQr(null)}>Close</button>
            </div>
            <p className="muted tiny">Points: {activeQr.points} | Status: {activeQr.status}</p>
            {activeQrDataUrl ? (
              <img
                className="qr-image"
                src={activeQrDataUrl}
                alt={`QR for token ${activeQr.token}`}
              />
            ) : (
              <p className="muted tiny">Generating QR image...</p>
            )}
            <p className="muted tiny" style={{ wordBreak: "break-all" }}>{activeQr.token}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
