"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge, Button, Card, Container, FileButton, Group, Image, Modal, Paper, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Textarea, Title } from "@mantine/core";
import { useBackForwardRefresh } from "../../lib/use-back-forward-refresh";
import QRCode from "qrcode";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../lib/media-url";
import {
  buildVendorCssVariables,
  VENDOR_THEME_PRESETS,
  VendorThemeProvider,
  type VendorStorefrontTheme,
} from "../../lib/vendor-theme";
import { packTierSnapshotSchema, type PackTierSnapshot, vendorDrawAnimationPresetIds } from "@oripa/shared";
import {
  CATALOG_GAME_OPTIONS,
  CATALOG_ITEM_CLASS_OPTIONS,
  type CatalogSuggestion,
  useVendorCatalogSearch,
} from "../../lib/use-vendor-catalog-search";

type Vendor = {
  id: string;
  name: string;
  slug: string;
  host: string;
  isActive: boolean;
  referralCode?: string | null;
  businessLocation?: string | null;
  businessContact?: string | null;
  applicationStatus?: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | null;
  entityName?: string | null;
  yearsOfOperations?: "LT_1" | "ONE_TO_THREE" | "THREE_TO_FIVE" | "FIVE_PLUS" | null;
  personInCharge?: string | null;
  personInChargeDateOfBirth?: string | null;
  personInChargeCountry?: string | null;
  identificationDocumentType?: "PASSPORT" | "DRIVING_LICENCE" | null;
  identificationDocumentUrl?: string | null;
  applicationSubmittedAt?: string | null;
  logoImageUrl?: string | null;
  faviconImageUrl?: string | null;
  vendorSettings?: {
    storefrontThemePreset?: string | null;
    drawAnimationPreset?: string | null;
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
  platformFeePoints?: number;
  tenantNetPoints?: number;
  vendorSpentPoints: number;
  topupPoints?: number;
  topupCount?: number;
  vendorWalletBalance?: number;
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

type TopupActivity = {
  id: string;
  pointsToCredit: number;
  amountCurrency: number | null;
  currencyCode: string | null;
  createdAt: string;
  user?: {
    email: string;
    displayName?: string | null;
  } | null;
};

type PackWinner = {
  id: string;
  packId: string;
  packTitle: string;
  drawSequence: number;
  pointsSpent: number;
  createdAt: string;
  drawOrderId: string;
  drawOrderQuantity: number;
  customer?: {
    id: string;
    email: string;
    displayName?: string | null;
    fullName?: string | null;
    phoneNumber?: string | null;
    shippingAddressLine1?: string | null;
    shippingAddressLine2?: string | null;
    shippingAddressCity?: string | null;
    shippingAddressState?: string | null;
    shippingAddressPostalCode?: string | null;
    shippingAddressCountry?: string | null;
  } | null;
  prize: {
    id: string | null;
    label: string;
    imageUrl?: string | null;
    estimatedValue?: number | null;
    rarity?: string | null;
  };
};

type FulfilmentItem = {
  id: string;
  status: "HELD" | "REDEMPTION_REQUESTED" | "BUYBACK_REQUESTED" | "REDEEMED" | "BOUGHT_BACK" | "VOIDED";
  provider?: string | null;
  providerMemo?: string | null;
  providerTxSig?: string | null;
  prizeLabel: string;
  prizeImageUrl?: string | null;
  prizeEstimatedValue?: number | null;
  prizeRarity?: string | null;
  setName?: string | null;
  cardName?: string | null;
  drawOrderId: string;
  drawOrderQuantity: number;
  pack: {
    id: string;
    title: string;
  };
  createdAt: string;
  updatedAt: string;
  shippingComplete: boolean;
  customer?: {
    id: string;
    email: string;
    displayName?: string | null;
    fullName?: string | null;
    phoneNumber?: string | null;
    shippingAddressLine1?: string | null;
    shippingAddressLine2?: string | null;
    shippingAddressCity?: string | null;
    shippingAddressState?: string | null;
    shippingAddressPostalCode?: string | null;
    shippingAddressCountry?: string | null;
  } | null;
};

type FulfilmentSummary = {
  total: number;
  shippingComplete: number;
  shippingMissing: number;
  byStatus: Record<string, number>;
};

type FulfilmentDraft = {
  status: string;
  providerMemo: string;
  providerTxSig: string;
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
  packCoverImageUrl?: string | null;
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
  tierSnapshotJson?: PackTierSnapshot | null;
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

type TierDraft = {
  uiId: string;
  name: string;
  percentage: string;
  items: ItemDraft[];
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
const DEFAULT_PACK_COVER = "/pack-covers/grand-line-treasure-cover.webp";
const DEFAULT_PACK_BANNER_OPTIONS = [
  { label: "Default Green", desktop: "/default-pack-banner-desktop.webp", mobile: "/default-pack-banner-mobile.webp" },
  { label: "S+ TIER REWARDS", desktop: "/pack-presets/splus-tier-rewards.png", mobile: "/pack-presets/splus-tier-rewards.png" },
  { label: "GACHAPON", desktop: "/pack-presets/gachapon.png", mobile: "/pack-presets/gachapon.png" },
  { label: "MYSTERY PACK RUSH", desktop: "/pack-presets/mystery-pack-rush.png", mobile: "/pack-presets/mystery-pack-rush.png" },
] as const;
const DEFAULT_PACK_COVER_OPTIONS = [
  { label: "Grand Line Treasure", image: "/pack-covers/grand-line-treasure-cover.webp" },
  { label: "Charizard Chase Rush", image: "/pack-covers/charizard-chase-rush-cover.webp" },
  { label: "Pikachu Promo Party", image: "/pack-covers/pikachu-promo-party-cover.webp" },
  { label: "Grand Line Jackpot", image: "/pack-covers/grand-line-jackpot-cover.webp" },
  { label: "Shadow Ghost Jackpot", image: "/pack-covers/shadow-ghost-jackpot-cover.webp" },
  { label: "Thunder Phoenix Jackpot", image: "/pack-covers/thunder-phoenix-jackpot-cover.webp" },
  { label: "Fire Dragon Jackpot", image: "/pack-covers/fire-dragon-jackpot-cover.webp" },
  { label: "Futuristic Cyber Vault", image: "/pack-covers/futuristic-cyber-vault-cover.webp" },
  { label: "Neon Arcade Jackpot", image: "/pack-covers/neon-arcade-jackpot-cover.webp" },
  { label: "Matrix Data Relic", image: "/pack-covers/matrix-data-relic-cover.webp" },
  { label: "Fairyland Crystal Chest", image: "/pack-covers/fairyland-crystal-chest-cover.webp" },
  { label: "Volcanic Dragon Forge", image: "/pack-covers/volcanic-dragon-forge-cover.webp" },
] as const;
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "";
const clientPageHeader = { "x-client-page": "/vendor" };
type ActiveTab = "BUSINESS" | "GROWTH" | "STORE_SETTINGS" | "PACKS" | "FULFILMENT";

function formatFulfillmentAddress(customer?: PackWinner["customer"] | null) {
  if (!customer) return "No customer record";
  const parts = [
    customer.shippingAddressLine1,
    customer.shippingAddressLine2,
    customer.shippingAddressCity,
    customer.shippingAddressState,
    customer.shippingAddressPostalCode,
    customer.shippingAddressCountry,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No shipping address on file";
}

function isLocalhostLike(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "demo.localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.startsWith("127.0.0.1") ||
    normalized.startsWith("0.0.0.0")
  );
}

const DEFAULT_THEME: VendorStorefrontTheme = {
  storefrontPrimary: VENDOR_THEME_PRESETS[0].storefrontPrimary,
  storefrontSecondary: VENDOR_THEME_PRESETS[0].storefrontSecondary,
  storefrontAccent: VENDOR_THEME_PRESETS[0].storefrontAccent,
  storefrontSurface: VENDOR_THEME_PRESETS[0].storefrontSurface,
  storefrontText: VENDOR_THEME_PRESETS[0].storefrontText,
  storefrontMuted: VENDOR_THEME_PRESETS[0].storefrontMuted,
  storefrontRadius: VENDOR_THEME_PRESETS[0].storefrontRadius,
};

const DRAW_ANIMATION_PRESET_OPTIONS = vendorDrawAnimationPresetIds.map((id) => ({
  value: id,
  label:
    id === "reel" ? "Reel spin" : id === "wheel" ? "Lottery wheel" : "Card flip",
}));

const THEME_PRESETS = VENDOR_THEME_PRESETS.map((preset) => ({
  ...preset,
  label: preset.id === "lavender-dawn" ? "Lavender Dawn (Default)" : preset.label,
}));

function matchesPreset(
  theme: VendorStorefrontTheme,
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
  if (tab === "growth" || tab === "referrals") return "GROWTH";
  if (tab === "store-settings" || tab === "store_settings") return "STORE_SETTINGS";
  if (tab === "fulfilment" || tab === "fulfillment") return "FULFILMENT";
  return "BUSINESS";
}

function toTabValue(tab: ActiveTab): "business" | "growth" | "store-settings" | "pack-studio" | "fulfilment" {
  if (tab === "PACKS") return "pack-studio";
  if (tab === "GROWTH") return "growth";
  if (tab === "STORE_SETTINGS") return "store-settings";
  if (tab === "FULFILMENT") return "fulfilment";
  return "business";
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
    uiId: crypto.randomUUID(),
    name: `${String.fromCharCode(65 + index)} Tier`,
    percentage: "",
    items: [createItem()],
  };
}

function tierSnapshotToDrafts(snapshot: unknown): TierDraft[] | null {
  const parsed = packTierSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return null;

  return parsed.data.tiers.map((tier) => ({
    uiId: crypto.randomUUID(),
    name: tier.name,
    percentage: typeof tier.percentage === "number" ? String(tier.percentage) : "",
    items: tier.items.map((item) => ({
      label: item.label,
      estimatedValue: String(item.estimatedValue),
      stock: String(item.stock),
      imageUrl: item.imageUrl || DEFAULT_CARD,
      catalogItemId: item.catalogItemId ?? undefined,
      catalogSource: item.catalogSource ?? undefined,
      catalogSourceItemId: item.catalogSourceItemId ?? undefined,
      language: item.language ?? undefined,
    })),
  }));
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
      const host = window.location.host.toLowerCase();
      return isLocalhostLike(host) ? configuredVendorHost || "demo.localhost" : host;
    }
    return configuredVendorHost || "demo.localhost";
  }, []);
  const vendorBaseDomain = useMemo(() => {
    const host = configuredVendorHost || runtimeVendorHost;
    return host.replace(/^[^.]+\./, "");
  }, [runtimeVendorHost]);
  const headers = useMemo(() => ({ ...clientPageHeader }), [runtimeVendorHost]);
  const authHeaders = useCallback(() => {
    return {
      ...headers,
    };
  }, [headers]);

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [limits, setLimits] = useState<VendorLimits>({ planCode: "BASIC", maxPackItems: 50, maxPackTiers: 5, maxDrawQuantity: 100 });
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [packEarnings, setPackEarnings] = useState<PackEarning[]>([]);
  const [topups, setTopups] = useState<TopupActivity[]>([]);
  const [packWins, setPackWins] = useState<PackWinner[]>([]);
  const [fulfilmentItems, setFulfilmentItems] = useState<FulfilmentItem[]>([]);
  const [fulfilmentSummary, setFulfilmentSummary] = useState<FulfilmentSummary | null>(null);
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
  const [themePresetId, setThemePresetId] = useState<string>("lavender-dawn");
  const [drawAnimationPresetId, setDrawAnimationPresetId] = useState<string>("reel");

  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerTargetUrl, setBannerTargetUrl] = useState("");

  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editingPackStatus, setEditingPackStatus] = useState<"DRAFT" | "LIVE" | "ARCHIVED">("DRAFT");
  const [packTitle, setPackTitle] = useState("");
  const [packBannerImageUrl, setPackBannerImageUrl] = useState(DEFAULT_PACK_BANNER);
  const [packCoverImageUrl, setPackCoverImageUrl] = useState(DEFAULT_PACK_COVER);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pricePoints, setPricePoints] = useState("100");
  const [totalStock, setTotalStock] = useState("100");
  const [isNew, setIsNew] = useState(true);
  const [limitedLabel, setLimitedLabel] = useState("");
  const [importantNotes, setImportantNotes] = useState("");
  const [drawLimitMode, setDrawLimitMode] = useState<"NONE" | "ONCE_PER_CUSTOMER" | "DAILY_RESET">("NONE");
  const [drawLimitValue, setDrawLimitValue] = useState("1");
  const [drawLimitResetTimezone, setDrawLimitResetTimezone] = useState("Asia/Singapore");
  const [tiers, setTiers] = useState<TierDraft[]>([createTier(0)]);
  const [collapsedTierIds, setCollapsedTierIds] = useState<Record<string, boolean>>({});
  const [qrPoints, setQrPoints] = useState("100");
  const [qrExpiryMinutes, setQrExpiryMinutes] = useState("15");
  const [activeQr, setActiveQr] = useState<VendorQr | null>(null);
  const [activeQrDataUrl, setActiveQrDataUrl] = useState<string | null>(null);
  const [activeReferralQrLink, setActiveReferralQrLink] = useState<string | null>(null);
  const [activeReferralQrDataUrl, setActiveReferralQrDataUrl] = useState<string | null>(null);
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [uploadingPackBannerImage, setUploadingPackBannerImage] = useState(false);
  const [uploadingVendorLogo, setUploadingVendorLogo] = useState(false);
  const [importingPackCsv, setImportingPackCsv] = useState(false);
  const [csvImportSummary, setCsvImportSummary] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [packWinsLoading, setPackWinsLoading] = useState(true);
  const [selectedPackWinnerId, setSelectedPackWinnerId] = useState("all");
  const [fulfilmentLoading, setFulfilmentLoading] = useState(true);
  const [selectedFulfilmentPackId, setSelectedFulfilmentPackId] = useState("all");
  const [selectedFulfilmentStatus, setSelectedFulfilmentStatus] = useState("all");
  const [fulfilmentSearch, setFulfilmentSearch] = useState("");
  const [fulfilmentDrafts, setFulfilmentDrafts] = useState<Record<string, FulfilmentDraft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("BUSINESS");
  const selectedThemePresetId = useMemo(() => resolveThemePresetId(themeDraft, themePresetId), [themeDraft, themePresetId]);
  const selectedThemePreset = useMemo(
    () => THEME_PRESETS.find((preset) => preset.id === selectedThemePresetId) ?? THEME_PRESETS[0],
    [selectedThemePresetId]
  );
  const vendorDashboardThemeStyle = useMemo(() => buildVendorCssVariables(themeDraft), [themeDraft]);
  const allTiersCollapsed = useMemo(() => tiers.length > 0 && tiers.every((tier) => collapsedTierIds[tier.uiId]), [tiers, collapsedTierIds]);
  const referralSignupUrl = useMemo(() => {
    const code = referralCode.trim() || vendorSlug.trim() || vendor?.slug?.trim() || "";
    if (!code) return "";
    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : `https://${runtimeVendorHost}`;
    const url = new URL("/register", origin);
    url.searchParams.set("ref", code);
    return url.toString();
  }, [referralCode, vendor?.slug, vendorSlug, runtimeVendorHost]);
  const packWinsInitialLoadRef = useRef(false);

  const totalDraftItems = tiers.reduce((sum, tier) => sum + tier.items.length, 0);
  const {
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
    catalogHasMore,
    loadMoreCatalogResults,
  } = useVendorCatalogSearch({
    apiBase,
    authHeaders,
    initialGameFilter: "",
    initialItemClass: "CARD",
  });
  const gameSelected = Boolean(catalogGameFilter);
  const setSelected = Boolean(catalogFilters.setId);
  const isCardPicker = catalogItemClass === "CARD";
  const fulfilmentStatusOptions = useMemo(
    () => [
      { value: "all", label: "All statuses" },
      { value: "HELD", label: "Held" },
      { value: "REDEMPTION_REQUESTED", label: "Redemption requested" },
      { value: "BUYBACK_REQUESTED", label: "Buyback requested" },
      { value: "REDEEMED", label: "Redeemed" },
      { value: "BOUGHT_BACK", label: "Bought back" },
      { value: "VOIDED", label: "Voided" },
    ],
    []
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const accessRes = await fetch(`${apiBase}/v1/vendor/me`, { headers: authHeaders(), credentials: "include", cache: "no-store" });
      const accessJson = await accessRes.json().catch(() => ({}));
      if (accessRes.status === 401) {
        router.replace(`/vendor/login?returnTo=${encodeURIComponent(pathname || "/vendor")}`);
        return;
      }
      if (accessRes.status === 400) {
        throw new Error("Vendor access is only available from an approved vendor URL.");
      }
      if (!accessRes.ok) {
        throw new Error(accessJson?.error ?? "Unable to verify vendor access.");
      }
      if (!accessJson?.isVendorMember) {
        throw new Error("This account is not approved for this vendor.");
      }

      const vendorRes = await fetch(`${apiBase}/v1/vendor/current`, { headers: authHeaders(), credentials: "include", cache: "no-store" });
      if (!vendorRes.ok) {
        if (vendorRes.status === 400) {
          throw new Error("Vendor access is only available from an approved vendor URL.");
        }
        if (vendorRes.status === 401) {
          router.replace(`/vendor/login?returnTo=${encodeURIComponent(pathname || "/vendor")}`);
          return;
        }
        throw new Error("Failed to resolve vendor context.");
      }

      const vendorJson = await vendorRes.json();
      const [limitsRes, summaryRes, packEarningsRes, topupsRes, referralsRes, bannersRes, packsRes, qrRes, creativeJobsRes] = await Promise.all([
        fetch(`${apiBase}/v1/vendor/limits`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/earnings/summary`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/earnings/packs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/earnings/topups`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/referrals`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/banners`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/packs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/points/qr`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/creative-jobs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
      ]);

      if (!limitsRes.ok || !summaryRes.ok || !packEarningsRes.ok || !topupsRes.ok || !referralsRes.ok || !bannersRes.ok || !packsRes.ok || !creativeJobsRes.ok) {
        throw new Error("Failed to load vendor dashboard data");
      }

      const limitsJson = await limitsRes.json();
      const summaryJson = await summaryRes.json();
      const packEarningsJson = await packEarningsRes.json();
      const topupsJson = await topupsRes.json();
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
      const nextTheme = {
        storefrontPrimary: v?.vendorSettings?.storefrontPrimary ?? DEFAULT_THEME.storefrontPrimary,
        storefrontSecondary: v?.vendorSettings?.storefrontSecondary ?? DEFAULT_THEME.storefrontSecondary,
        storefrontAccent: v?.vendorSettings?.storefrontAccent ?? DEFAULT_THEME.storefrontAccent,
        storefrontSurface: v?.vendorSettings?.storefrontSurface ?? DEFAULT_THEME.storefrontSurface,
        storefrontText: v?.vendorSettings?.storefrontText ?? DEFAULT_THEME.storefrontText,
        storefrontMuted: v?.vendorSettings?.storefrontMuted ?? DEFAULT_THEME.storefrontMuted,
        storefrontRadius: v?.vendorSettings?.storefrontRadius ?? DEFAULT_THEME.storefrontRadius,
      };
      setThemeDraft(nextTheme);
      setThemePresetId(resolveThemePresetId(nextTheme, v?.vendorSettings?.storefrontThemePreset));
      setDrawAnimationPresetId(v?.vendorSettings?.drawAnimationPreset ?? "reel");

      setLimits(limitsJson.limits ?? { planCode: "BASIC", maxPackItems: 50, maxPackTiers: 5, maxDrawQuantity: 100 });
      setSummary(summaryJson.summary ?? null);
      setPackEarnings(packEarningsJson.items ?? []);
      setTopups(topupsJson.topups ?? []);
      setReferrals(referralsJson.customers ?? []);
      setQrs(qrJson.qrs ?? []);
      setBanners(bannersJson.banners ?? []);
      setPacks(packsJson.packs ?? []);
      setCreativeJobs(creativeJobsJson.creativeJobs ?? []);
    } catch (err) {
      setVendor(null);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, pathname, router]);

  const loadPackWins = useCallback(async () => {
    setPackWinsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (selectedPackWinnerId !== "all") {
        params.set("packId", selectedPackWinnerId);
      }
      const response = await fetch(`${apiBase}/v1/vendor/wins?${params.toString()}`, {
        headers: authHeaders(),
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to load winner dashboard");
      setPackWins(payload.wins ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load winner dashboard");
      setPackWins([]);
    } finally {
      setPackWinsLoading(false);
    }
  }, [authHeaders, selectedPackWinnerId]);

  const loadFulfilment = useCallback(async () => {
    setFulfilmentLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (selectedFulfilmentPackId !== "all") {
        params.set("packId", selectedFulfilmentPackId);
      }
      if (selectedFulfilmentStatus !== "all") {
        params.set("status", selectedFulfilmentStatus);
      }
      if (fulfilmentSearch.trim()) {
        params.set("q", fulfilmentSearch.trim());
      }
      const response = await fetch(`${apiBase}/v1/vendor/fulfilment?${params.toString()}`, {
        headers: authHeaders(),
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to load fulfilment dashboard");
      setFulfilmentItems(payload.items ?? []);
      setFulfilmentSummary(payload.summary ?? null);
      const nextDrafts: Record<string, FulfilmentDraft> = {};
      for (const item of payload.items ?? []) {
        nextDrafts[item.id] = {
          status: String(item.status ?? "HELD"),
          providerMemo: String(item.providerMemo ?? ""),
          providerTxSig: String(item.providerTxSig ?? ""),
        };
      }
      setFulfilmentDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fulfilment dashboard");
      setFulfilmentItems([]);
      setFulfilmentSummary(null);
      setFulfilmentDrafts({});
    } finally {
      setFulfilmentLoading(false);
    }
  }, [authHeaders, fulfilmentSearch, selectedFulfilmentPackId, selectedFulfilmentStatus]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([loadAll(), loadPackWins(), loadFulfilment()]);
  }, [loadAll, loadPackWins, loadFulfilment]);

  function updateFulfilmentDraft(itemId: string, patch: Partial<FulfilmentDraft>) {
    setFulfilmentDrafts((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        status: current[itemId]?.status ?? "HELD",
        providerMemo: current[itemId]?.providerMemo ?? "",
        providerTxSig: current[itemId]?.providerTxSig ?? "",
        ...patch,
      },
    }));
  }

  async function saveFulfilmentItem(itemId: string) {
    const draft = fulfilmentDrafts[itemId];
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${apiBase}/v1/vendor/fulfilment/${itemId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          status: draft.status,
          providerMemo: draft.providerMemo,
          providerTxSig: draft.providerTxSig,
          provider: draft.providerTxSig ? "MANUAL" : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to update fulfilment item");
      setSuccess("Fulfilment item updated.");
      await loadFulfilment();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update fulfilment item");
    } finally {
      setSaving(false);
    }
  }

  async function quickFulfilmentAction(itemId: string, status: FulfilmentDraft["status"]) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${apiBase}/v1/vendor/fulfilment/${itemId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status, providerMemo: `Marked ${status.toLowerCase().replace(/_/g, " ")} from vendor dashboard` }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to update fulfilment status");
      setSuccess("Fulfilment status updated.");
      await loadFulfilment();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update fulfilment status");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch(`${apiBase}/v1/auth/logout`, {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);
    router.replace("/vendor/login");
  }

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useBackForwardRefresh(refreshDashboard, { cooldownMs: 20000 });

  useEffect(() => {
    if (!packWinsInitialLoadRef.current) {
      packWinsInitialLoadRef.current = true;
      return;
    }
    void loadPackWins();
  }, [loadPackWins]);

  const fulfilmentInitialLoadRef = useRef(false);

  useEffect(() => {
    if (!fulfilmentInitialLoadRef.current) {
      fulfilmentInitialLoadRef.current = true;
      return;
    }
    void loadFulfilment();
  }, [loadFulfilment]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setActiveTab(parseTabValue(params.get("tab")));
  }, []);

  function setActiveTabInUrl(tab: ActiveTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    params.set("tab", toTabValue(tab));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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
        body: JSON.stringify({
          storefrontThemePreset: selectedThemePresetId === "custom" ? null : selectedThemePresetId,
          drawAnimationPreset: drawAnimationPresetId,
          ...themeDraft,
        }),
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

  async function openReferralQrPopup() {
    if (!referralSignupUrl) {
      setError("Referral code is not set.");
      return;
    }
    setActiveReferralQrLink(referralSignupUrl);
  }

  async function copyReferralSignupLink() {
    if (!referralSignupUrl) return;
    try {
      await navigator.clipboard.writeText(referralSignupUrl);
      setSuccess("Referral signup link copied.");
    } catch {
      setError("Unable to copy referral signup link.");
    }
  }

  async function saveReferralQrImage() {
    if (!activeReferralQrDataUrl || !activeReferralQrLink) return;
    const anchor = document.createElement("a");
    anchor.href = activeReferralQrDataUrl;
    anchor.download = `referral-signup-${referralCode.trim() || "link"}.png`;
    anchor.click();
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

  useEffect(() => {
    if (!activeReferralQrLink) {
      setActiveReferralQrDataUrl(null);
      return;
    }
    let mounted = true;
    QRCode.toDataURL(activeReferralQrLink, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url: string) => {
        if (mounted) setActiveReferralQrDataUrl(url);
      })
      .catch(() => {
        if (mounted) setActiveReferralQrDataUrl(null);
      });
    return () => {
      mounted = false;
    };
  }, [activeReferralQrLink]);

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
        uiId: crypto.randomUUID(),
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
      setCollapsedTierIds({});
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
    const nextTier = createTier(tiers.length);
    setTiers((prev) => {
      if (prev.length >= limits.maxPackTiers) return prev;
      return [...prev, nextTier];
    });
    if (allTiersCollapsed) {
      setCollapsedTierIds((current) => ({ ...current, [nextTier.uiId]: true }));
    }
    setSelectedTierIndex((prev) => Math.min(prev + 1, limits.maxPackTiers - 1));
  }

  function collapseAllTiers() {
    setCollapsedTierIds(Object.fromEntries(tiers.map((tier) => [tier.uiId, true])));
  }

  function expandAllTiers() {
    setCollapsedTierIds({});
  }

  function toggleTierCollapsed(tierId: string) {
    setCollapsedTierIds((current) => ({
      ...current,
      [tierId]: !current[tierId],
    }));
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
    setEditingPackStatus("DRAFT");
    setPackTitle("");
    setPackBannerImageUrl(DEFAULT_PACK_BANNER);
    setPackCoverImageUrl(DEFAULT_PACK_COVER);
    setStartsAt("");
    setEndsAt("");
    setPricePoints("100");
    setTotalStock("100");
    setIsNew(true);
    setLimitedLabel("");
    setImportantNotes("");
    setDrawLimitMode("NONE");
    setDrawLimitValue("1");
    setDrawLimitResetTimezone("Asia/Singapore");
    setTiers([createTier(0)]);
    setCollapsedTierIds({});
    setSelectedTierIndex(0);
    setCardSearchQuery("");
    setCatalogResults([]);
  }

  function editPack(pack: Pack) {
    setEditingPackId(pack.id);
    setEditingPackStatus(pack.status);
    setPackTitle(pack.title);
    setPackBannerImageUrl(pack.packBannerImageUrl ?? DEFAULT_PACK_BANNER);
    setPackCoverImageUrl(pack.packCoverImageUrl ?? DEFAULT_PACK_COVER);
    setPricePoints(String(pack.pricePoints));
    setTotalStock(String(pack.totalStock));
    setStartsAt(toLocalInputValue(pack.startsAt));
    setEndsAt(toLocalInputValue(pack.endsAt));
    setIsNew(Boolean(pack.isNew ?? true));
    setLimitedLabel(pack.limitedLabel ?? "");
    setImportantNotes(pack.importantNotes ?? "");
    setDrawLimitMode(pack.drawLimitMode ?? "NONE");
    setDrawLimitValue(String(pack.drawLimitValue ?? 1));
    setDrawLimitResetTimezone(pack.drawLimitResetTimezone ?? "Asia/Singapore");

    const snapshotTiers = tierSnapshotToDrafts(pack.tierSnapshotJson);
    setTiers(
      snapshotTiers && snapshotTiers.length > 0
        ? snapshotTiers
        : [
            {
              uiId: crypto.randomUUID(),
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
          ]
    );
    setCollapsedTierIds({});
    setSelectedTierIndex(0);
  }

  async function submitPack(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const canEditPrizePool = !editingPackId || editingPackStatus === "DRAFT";
      if (canEditPrizePool && tiers.length > limits.maxPackTiers) {
        throw new Error(`Tier count exceeds plan limit (${limits.maxPackTiers}).`);
      }
      if (canEditPrizePool && totalDraftItems > limits.maxPackItems) {
        throw new Error(`Item count exceeds plan limit (${limits.maxPackItems}).`);
      }

      const payload = {
        title: packTitle,
        packBannerImageUrl: packBannerImageUrl.trim() ? packBannerImageUrl.trim() : DEFAULT_PACK_BANNER,
        packCoverImageUrl: packCoverImageUrl.trim() ? packCoverImageUrl.trim() : DEFAULT_PACK_COVER,
        pricePoints: Number(pricePoints),
        totalStock: canEditPrizePool ? Number(totalStock) : undefined,
        startsAt: toIsoDateTime(startsAt),
        endsAt: toIsoDateTime(endsAt),
        isNew,
        limitedLabel: limitedLabel.trim() ? limitedLabel.trim() : undefined,
        importantNotes: importantNotes.trim() ? importantNotes.trim() : undefined,
        drawLimitMode,
        drawLimitValue: drawLimitMode === "DAILY_RESET" ? Number(drawLimitValue) : undefined,
        drawLimitResetTimezone,
        tiers: canEditPrizePool
          ? tiers.map((tier) => ({
              name: tier.name,
              percentage: tier.percentage.trim() ? Number(tier.percentage) : undefined,
              items: tier.items.map((item) => ({
                label: item.label,
                estimatedValue: Number(item.estimatedValue),
                stock: item.stock.trim() ? Number(item.stock) : undefined,
                imageUrl: item.imageUrl.trim() ? item.imageUrl.trim() : undefined,
                catalogItemId: item.catalogItemId,
                catalogSource: item.catalogSource,
                catalogSourceItemId: item.catalogSourceItemId,
                language: item.language,
              })),
            }))
          : undefined,
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

  if (loading && !vendor) {
    return (
      <Container size="md" py="xl">
        <Paper withBorder radius="xl" p="xl" shadow="sm">
          <Stack gap="sm">
            <Title order={1}>Verifying Vendor Access</Title>
            <Text c="dimmed">Checking whether this account is approved for this vendor.</Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  async function publishPack(packId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`${apiBase}/v1/vendor/packs/${packId}/publish`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        credentials: "include",
        body: JSON.stringify({ publishIdempotencyKey: idempotencyKey }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? "Failed to publish pack");
      setSuccess(body?.published ? "Pack published." : "Pack already published.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish pack");
    } finally {
      setSaving(false);
    }
  }

  if (!vendor) {
    return (
      <Container size="md" py="xl">
        <Paper withBorder radius="xl" p="xl" shadow="sm">
          <Stack gap="sm">
            <Title order={1}>Vendor Access Required</Title>
            <Text c="dimmed">This page is restricted to approved vendor accounts only.</Text>
            {error ? <Text c="red">{error}</Text> : null}
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <VendorThemeProvider theme={themeDraft}>
    <Container size="xl" py="lg" style={vendorDashboardThemeStyle}>
      <Stack gap="md">
        <Paper withBorder radius="xl" p="md" shadow="sm">
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <div>
              <Title order={1} size="h2">
                Vendor Dashboard
              </Title>
              <Text c="dimmed">
                {vendor?.name ?? "-"} ({vendor?.host ?? runtimeVendorHost})
              </Text>
              {vendor?.applicationStatus ? (
                <Text size="sm" c="dimmed">
                  Application status: {vendor.applicationStatus}
                </Text>
              ) : null}
            </div>
            <Group gap="xs" wrap="wrap">
              <Button variant="light" component={Link} href="/vendor/profile">
                Vendor Profile
              </Button>
              <Button variant="subtle" component={Link} href="/">
                Back to Homepage
              </Button>
              <Button variant="outline" onClick={() => void logout()}>
                Logout
              </Button>
            </Group>
          </Group>
        </Paper>

        {error ? <Text c="red">{error}</Text> : null}
        {success ? <Badge variant="light">{success}</Badge> : null}

        <Tabs value={activeTab} onChange={(value) => value && setActiveTabInUrl(value as "BUSINESS" | "GROWTH" | "STORE_SETTINGS" | "PACKS" | "FULFILMENT")}>
          <Tabs.List grow>
            <Tabs.Tab value="BUSINESS">Business</Tabs.Tab>
            <Tabs.Tab value="GROWTH">Referrals & QR</Tabs.Tab>
            <Tabs.Tab value="STORE_SETTINGS">Store Settings</Tabs.Tab>
            <Tabs.Tab value="PACKS">Pack Studio</Tabs.Tab>
            <Tabs.Tab value="FULFILMENT">Fulfilment</Tabs.Tab>
          </Tabs.List>
        </Tabs>

      {activeTab === "BUSINESS" ? (
        <>
          <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
            <h2>Plan & Earnings</h2>
            <p className="muted tiny">Current plan: <strong>{limits.planCode}</strong> | Pack tiers max: {limits.maxPackTiers} | Pack items max: {limits.maxPackItems}</p>
            <div className="actions">
              <button type="button" className="sort-pill" disabled={saving || limits.planCode === "BASIC"} onClick={() => void switchPlan("BASIC")}>Switch to BASIC</button>
              <button type="button" className="sort-pill" disabled={saving || limits.planCode === "ELITE"} onClick={() => void switchPlan("ELITE")}>Switch to ELITE</button>
            </div>
            <div className="stats-grid">
              <div className="stat"><div className="stat-label">Total Revenue Points</div><div className="stat-value">{summary?.totalRevenuePoints?.toLocaleString() ?? "0"}</div></div>
              <div className="stat"><div className="stat-label">Platform Fee</div><div className="stat-value">{summary?.platformFeePoints?.toLocaleString() ?? "0"}</div></div>
              <div className="stat"><div className="stat-label">Tenant Net</div><div className="stat-value">{summary?.tenantNetPoints?.toLocaleString() ?? "0"}</div></div>
              <div className="stat"><div className="stat-label">Wallet Balance</div><div className="stat-value">{summary?.vendorWalletBalance?.toLocaleString() ?? "0"}</div></div>
              <div className="stat"><div className="stat-label">Currency Revenue</div><div className="stat-value">{summary ? `${summary.totalRevenueCurrency.toFixed(2)} ${summary.currencyCode}` : "0"}</div></div>
              <div className="stat"><div className="stat-label">Successful Wallet Top-ups</div><div className="stat-value">{summary?.topupPoints?.toLocaleString() ?? "0"}</div></div>
              <div className="stat"><div className="stat-label">Completed Top-ups</div><div className="stat-value">{summary?.topupCount?.toLocaleString() ?? "0"}</div></div>
            </div>
          </Card>

          <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
            <h2>Wallet Funding</h2>
            <p className="muted tiny">This shows completed wallet top-ups on this storefront.</p>
            <div className="result-list">
              {topups.map((row) => (
                <div className="result-row" key={row.id}>
                  <span>
                    {row.user?.displayName || row.user?.email || "Customer"} · {row.pointsToCredit.toLocaleString()} pts
                    {row.amountCurrency !== null ? ` (${row.amountCurrency.toFixed(2)} ${row.currencyCode ?? "USD"})` : ""}
                  </span>
                  <span>
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
                  </span>
                </div>
              ))}
              {topups.length === 0 ? <p className="muted tiny">No completed top-ups yet.</p> : null}
            </div>
          </Card>

          <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
            <h2>Prize Winners</h2>
            <p className="muted tiny">Latest completed draws showing which customer won which prize on each pack.</p>
            <div className="vendor-form" style={{ marginTop: 12, gridTemplateColumns: "minmax(0, 320px)" }}>
              <label className="muted tiny">
                Pack filter
                <select value={selectedPackWinnerId} onChange={(e) => setSelectedPackWinnerId(e.target.value)}>
                  <option value="all">All packs</option>
                  {packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {packWinsLoading ? <p className="muted tiny">Loading winner dashboard...</p> : null}
            <div className="result-list">
              {packWins.map((row) => (
                <div className="result-row" key={row.id} style={{ alignItems: "start", gap: 12 }}>
                  <img
                    src={row.prize.imageUrl || DEFAULT_CARD}
                    alt={row.prize.label}
                    style={{
                      width: 72,
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "#fff",
                      flex: "0 0 auto",
                    }}
                  />
                  <div style={{ display: "grid", gap: 6, minWidth: 0, flex: "1 1 auto" }}>
                    <div>
                      <strong>{row.customer?.displayName || row.customer?.fullName || row.customer?.email || "Customer"}</strong>{" "}
                      won <strong>{row.prize.label}</strong>
                      {row.prize.rarity ? ` (${row.prize.rarity})` : ""} from <strong>{row.packTitle}</strong>
                    </div>
                    <div className="muted tiny">
                      Draw #{row.drawSequence}, {row.pointsSpent.toLocaleString()} pts, {row.drawOrderQuantity}x
                    </div>
                    <div className="muted tiny">
                      <strong>Customer:</strong> {row.customer?.email ?? "-"}{" "}
                      {row.customer?.phoneNumber ? `· ${row.customer.phoneNumber}` : ""}
                    </div>
                    <div className="muted tiny">
                      <strong>Shipping:</strong> {formatFulfillmentAddress(row.customer)}
                    </div>
                  </div>
                  <span style={{ whiteSpace: "nowrap" }}>{row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}</span>
                </div>
              ))}
              {packWins.length === 0 && !packWinsLoading ? <p className="muted tiny">No winner records found for this filter.</p> : null}
            </div>
          </Card>
        </>
      ) : null}

      {activeTab === "GROWTH" ? (
        <>
          <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
            <h2>Referral Signups</h2>
            <p className="muted tiny">
              Use this link on your own site, social channels, or customer support flows. Signups using the code are recorded here.
            </p>
            <div className="vendor-form" style={{ marginTop: 12 }}>
              <label className="muted tiny">
                Referral signup link
                <input value={referralSignupUrl} readOnly />
              </label>
              <div className="actions">
                <button type="button" className="sort-pill" onClick={() => void copyReferralSignupLink()} disabled={!referralSignupUrl}>
                  Copy Link
                </button>
                <button type="button" className="sort-pill" onClick={() => void openReferralQrPopup()} disabled={!referralSignupUrl}>
                  Show QR
                </button>
              </div>
            </div>
            <div className="result-list">
              {referrals.map((row) => (
                <div className="result-row" key={row.id}>
                  <span>{row.displayName || row.email}</span>
                  <span>{new Date(row.referredAt).toLocaleString()}</span>
                </div>
              ))}
              {referrals.length === 0 ? <p className="muted tiny">No referral signups yet.</p> : null}
            </div>
          </Card>

          <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
            <h2>Generate QR Points</h2>
            <p className="muted tiny">Create a short-lived QR token for adding points to a customer wallet.</p>
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
          </Card>
        </>
      ) : null}

      {activeTab === "STORE_SETTINGS" ? (
        <Stack gap="md" mt="md">
          <Card withBorder radius="xl" p="lg" shadow="sm">
            <Stack gap="md">
              <div>
                <Title order={2} size="h3">Vendor Profile / Business</Title>
                <Text c="dimmed" size="sm">Update the core business identity and public vendor URL.</Text>
              </div>
              <form onSubmit={saveVendorProfile}>
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    <TextInput label="Vendor name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" required minLength={2} maxLength={80} />
                    <TextInput label="Business location" value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} placeholder="Business location" />
                    <TextInput label="Business contact" value={businessContact} onChange={(e) => setBusinessContact(e.target.value)} placeholder="Business contact" />
                    <TextInput label="Referral code URL slug" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="Referral code URL slug" required minLength={3} maxLength={40} />
                  </SimpleGrid>
                  <Button type="submit" loading={saving || loading}>Save Vendor Info</Button>
                </Stack>
              </form>
              <form onSubmit={saveVendorPrefix}>
                <Stack gap="md">
                  <TextInput
                    label="Vendor URL prefix (slug)"
                    value={vendorSlug}
                    onChange={(e) => setVendorSlug(e.target.value)}
                    placeholder="Vendor URL prefix (slug)"
                    required
                    minLength={2}
                    maxLength={50}
                    pattern="^[a-z0-9-]+$"
                  />
                  <Text size="sm" c="dimmed">
                    New vendor URL: <code>{'https://' + (vendorSlug || 'your-prefix') + '.' + vendorBaseDomain}</code>
                  </Text>
                  <Button type="submit" loading={saving || loading}>Update Vendor Prefix</Button>
                </Stack>
              </form>
            </Stack>
          </Card>

          <Card withBorder radius="xl" p="lg" shadow="sm">
            <Stack gap="md">
              <div>
                <Title order={2} size="h3">Storefront Theme</Title>
                <Text c="dimmed" size="sm">Choose a light or dark premium theme for your landing and pack pages.</Text>
              </div>
              <form onSubmit={saveTheme}>
                <Stack gap="md">
                  <Paper
                    withBorder
                    radius="lg"
                    p="md"
                    style={{
                      background:
                        selectedThemePreset.storefrontSurface.toLowerCase() === "#ffffff" || selectedThemePreset.storefrontSurface.toLowerCase().startsWith("#fff")
                          ? `linear-gradient(135deg, ${selectedThemePreset.storefrontSecondary}, #ffffff)`
                          : `radial-gradient(circle at 50% 4%, ${selectedThemePreset.storefrontAccent}55, transparent 34%), radial-gradient(circle at 50% 78%, ${selectedThemePreset.storefrontPrimary}38, transparent 48%), linear-gradient(180deg, ${selectedThemePreset.storefrontSurface}, #090812)`,
                    }}
                  >
                    <Group justify="space-between" align="center" wrap="wrap">
                      <div>
                        <Text fw={800}>Current theme</Text>
                        <Text size="sm" c="dimmed">
                          {selectedThemePreset.label}
                        </Text>
                      </div>
                      <Badge variant="filled" color="grape">
                        {selectedThemePresetId === "custom" ? "Custom" : "Preset"}
                      </Badge>
                    </Group>
                    <Group gap="sm" mt="md" wrap="wrap">
                      <Card withBorder radius="md" p="sm" style={{ background: selectedThemePreset.storefrontSurface }}>
                        <Stack gap={6}>
                          <Text fw={700} c={selectedThemePreset.storefrontText}>
                            {vendorName || "Vendor storefront"}
                          </Text>
                          <Text size="sm" c={selectedThemePreset.storefrontMuted}>
                            Previewing how your storefront header and cards will feel.
                          </Text>
                          <Group gap={6}>
                            <span style={{ width: 14, height: 14, borderRadius: 999, background: selectedThemePreset.storefrontPrimary, display: "inline-block" }} />
                            <span style={{ width: 14, height: 14, borderRadius: 999, background: selectedThemePreset.storefrontSecondary, display: "inline-block" }} />
                            <span style={{ width: 14, height: 14, borderRadius: 999, background: selectedThemePreset.storefrontAccent, display: "inline-block" }} />
                          </Group>
                        </Stack>
                      </Card>
                      <Stack gap={4} style={{ flex: 1, minWidth: 220 }}>
                        <Button variant="filled" color="grape" radius={selectedThemePreset.storefrontRadius}>
                          Primary button
                        </Button>
                        <Button variant="light" color="grape" radius={selectedThemePreset.storefrontRadius}>
                          Secondary button
                        </Button>
                      </Stack>
                    </Group>
                  </Paper>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                    {THEME_PRESETS.map((preset) => {
                      const active = selectedThemePresetId === preset.id;
                      return (
                        <Button
                          key={preset.id}
                          type="button"
                          variant={active ? "filled" : "light"}
                          color="grape"
                          onClick={() => {
                            setThemeDraft({
                              storefrontPrimary: preset.storefrontPrimary,
                              storefrontSecondary: preset.storefrontSecondary,
                              storefrontAccent: preset.storefrontAccent,
                              storefrontSurface: preset.storefrontSurface,
                              storefrontText: preset.storefrontText,
                              storefrontMuted: preset.storefrontMuted,
                              storefrontRadius: preset.storefrontRadius,
                            });
                            setThemePresetId(preset.id);
                          }}
                          styles={{ root: { height: "auto", padding: 16, justifyContent: "flex-start" }, inner: { width: "100%", display: "block" } }}
                        >
                          <Stack gap={8} align="flex-start">
                            <Group justify="space-between" align="center" w="100%">
                              <Text fw={700}>{preset.label}</Text>
                              {active ? <Badge size="sm" color="grape">Current</Badge> : null}
                            </Group>
                            <Group gap={6}>
                              <span style={{ width: 14, height: 14, borderRadius: 999, background: preset.storefrontPrimary, display: "inline-block" }} />
                              <span style={{ width: 14, height: 14, borderRadius: 999, background: preset.storefrontSecondary, display: "inline-block" }} />
                              <span style={{ width: 14, height: 14, borderRadius: 999, background: preset.storefrontAccent, display: "inline-block" }} />
                              <span style={{ width: 14, height: 14, borderRadius: 999, background: preset.storefrontSurface, border: "1px solid #d9d9ef", display: "inline-block" }} />
                            </Group>
                          <Text size="xs" c="dimmed">Tap to apply this theme preset.</Text>
                        </Stack>
                      </Button>
                      );
                    })}
                  </SimpleGrid>
                  <Select
                    label="Pack draw animation"
                    description="Choose how the prize draw reveal animates for customers on mobile and desktop."
                    value={drawAnimationPresetId}
                    onChange={(value) => setDrawAnimationPresetId(value ?? "reel")}
                    data={DRAW_ANIMATION_PRESET_OPTIONS}
                  />
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <Paper withBorder radius="md" p="sm">
                      <Text fw={700}>Reel spin</Text>
                      <Text size="xs" c="dimmed">Fast moving card reel with a strong lottery feel.</Text>
                    </Paper>
                    <Paper withBorder radius="md" p="sm">
                      <Text fw={700}>Lottery wheel</Text>
                      <Text size="xs" c="dimmed">A circular wheel that rotates before locking on the winner.</Text>
                    </Paper>
                    <Paper withBorder radius="md" p="sm">
                      <Text fw={700}>Card flip</Text>
                      <Text size="xs" c="dimmed">A face-down prize card flips into the final result.</Text>
                    </Paper>
                  </SimpleGrid>
                  <Button type="submit" loading={saving || loading}>Save Theme</Button>
                </Stack>
              </form>
            </Stack>
          </Card>

          <Card withBorder radius="xl" p="lg" shadow="sm">
            <Stack gap="md">
              <div>
                <Title order={2} size="h3">Storefront Logo & Favicon</Title>
                <Text c="dimmed" size="sm">Recommended: square logo 1024x1024 (or at least 512x512), PNG/WebP/JPG, max 5MB. This logo is used in header and favicon.</Text>
              </div>
              <form onSubmit={saveVendorLogo}>
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    <TextInput label="Logo image URL" value={logoImageUrl} onChange={(e) => setLogoImageUrl(e.target.value)} placeholder="Logo image URL" required />
                    <TextInput label="Favicon URL (optional)" value={faviconImageUrl} onChange={(e) => setFaviconImageUrl(e.target.value)} placeholder="Favicon URL (optional)" />
                  </SimpleGrid>
                  <FileButton onChange={(file) => void handleVendorLogoUpload(file)} accept="image/png,image/jpeg,image/webp">
                    {(props) => <Button {...props} variant="light" loading={uploadingVendorLogo}>Upload logo</Button>}
                  </FileButton>
                  <Button type="submit" loading={saving || loading}>Save Logo</Button>
                </Stack>
              </form>
              {logoImageUrl ? <Image src={logoImageUrl} alt="Vendor logo preview" w={96} h={96} fit="contain" radius="md" /> : null}
            </Stack>
          </Card>

          <Card withBorder radius="xl" p="lg" shadow="sm">
            <Stack gap="md">
              <div>
                <Title order={2} size="h3">Banners</Title>
                <Text c="dimmed" size="sm">Create and manage homepage banners for this vendor storefront.</Text>
              </div>
              <form onSubmit={addBanner}>
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    <TextInput label="Banner title" value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="Banner title" required />
                    <TextInput label="Banner image URL" value={bannerImageUrl} onChange={(e) => setBannerImageUrl(e.target.value)} placeholder="Banner image URL" required />
                    <TextInput label="Target URL (optional)" value={bannerTargetUrl} onChange={(e) => setBannerTargetUrl(e.target.value)} placeholder="Target URL (optional)" />
                  </SimpleGrid>
                  <FileButton onChange={(file) => void handleBannerImageUpload(file)} accept="image/png,image/jpeg,image/webp">
                    {(props) => <Button {...props} variant="light" loading={uploadingBannerImage}>Upload banner image</Button>}
                  </FileButton>
                  <Button type="submit" loading={saving || loading}>Add Banner</Button>
                </Stack>
              </form>

              <Stack gap="sm">
                {banners.map((banner) => (
                  <Paper key={banner.id} withBorder radius="md" p="sm">
                    <Group align="center" justify="space-between" wrap="nowrap">
                      <Group align="center" wrap="nowrap">
                        <Image src={banner.imageUrl} alt={banner.title} w={72} h={48} fit="cover" radius="sm" />
                        <div>
                          <Text fw={600}>{banner.title}</Text>
                          <Text size="xs" c="dimmed">Order {banner.sortOrder}</Text>
                        </div>
                      </Group>
                      <Button variant="subtle" color="red" onClick={() => void deleteBanner(banner.id)} loading={saving}>Delete</Button>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Card>
        </Stack>
      ) : null}
      {activeTab === "FULFILMENT" ? (
        <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
          <Stack gap="md">
            <Group justify="space-between" align="start" wrap="wrap">
              <div>
                <Title order={2} size="h3">Fulfilment Dashboard</Title>
                <Text c="dimmed" size="sm">Customer shipping details and prize winners for your own packs only.</Text>
              </div>
              <Badge variant="light" size="lg">{fulfilmentSummary?.total?.toLocaleString() ?? '0'} items</Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <Card withBorder radius="lg" p="md">
                <Text size="sm" c="dimmed">Ready for fulfilment</Text>
                <Title order={3}>{fulfilmentSummary?.shippingComplete?.toLocaleString() ?? '0'}</Title>
              </Card>
              <Card withBorder radius="lg" p="md">
                <Text size="sm" c="dimmed">Needs shipping details</Text>
                <Title order={3}>{fulfilmentSummary?.shippingMissing?.toLocaleString() ?? '0'}</Title>
              </Card>
              <Card withBorder radius="lg" p="md">
                <Text size="sm" c="dimmed">Held</Text>
                <Title order={3}>{fulfilmentSummary?.byStatus?.HELD?.toLocaleString() ?? '0'}</Title>
              </Card>
              <Card withBorder radius="lg" p="md">
                <Text size="sm" c="dimmed">Redemption requested</Text>
                <Title order={3}>{fulfilmentSummary?.byStatus?.REDEMPTION_REQUESTED?.toLocaleString() ?? '0'}</Title>
              </Card>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Select
                label="Pack filter"
                value={selectedFulfilmentPackId}
                onChange={(value) => setSelectedFulfilmentPackId(value ?? 'all')}
                data={[{ value: 'all', label: 'All packs' }, ...packs.map((pack) => ({ value: pack.id, label: pack.title }))]}
              />
              <Select
                label="Status filter"
                value={selectedFulfilmentStatus}
                onChange={(value) => setSelectedFulfilmentStatus(value ?? 'all')}
                data={fulfilmentStatusOptions.map((option) => ({ value: option.value, label: option.label }))}
              />
              <TextInput
                label="Search customer / prize"
                value={fulfilmentSearch}
                onChange={(e) => setFulfilmentSearch(e.target.value)}
                placeholder="Search customer, pack, prize, or shipping..."
              />
            </SimpleGrid>

            {fulfilmentLoading ? <Text size="sm" c="dimmed">Loading fulfilment dashboard...</Text> : null}

            <Stack gap="md">
              {fulfilmentItems.map((row) => (
                <Card key={row.id} withBorder radius="lg" p="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="start" wrap="wrap">
                      <div>
                        <Text fw={700}>
                          {row.customer?.displayName || row.customer?.fullName || row.customer?.email || 'Customer'} won {row.prizeLabel}
                          {row.prizeRarity ? ' (' + row.prizeRarity + ')' : ''} from {row.pack.title}
                        </Text>
                        <Text size="sm" c="dimmed">
                          Status: {row.status} - Draw qty {row.drawOrderQuantity} - Created {row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}
                        </Text>
                        <Text size="sm" c="dimmed">
                          Customer: {row.customer?.email ?? '-'}{row.customer?.phoneNumber ? ' - ' + row.customer.phoneNumber : ''}
                        </Text>
                        <Text size="sm" c="dimmed">Shipping: {formatFulfillmentAddress(row.customer)}</Text>
                        <Text size="sm" c="dimmed">Fulfilment readiness: {row.shippingComplete ? 'Ready' : 'Missing shipping details'}</Text>
                        {row.providerMemo ? <Text size="sm" c="dimmed">Vendor memo: {row.providerMemo}</Text> : null}
                      </div>
                      <Badge variant="light">{row.status}</Badge>
                    </Group>

                    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                      <Select
                        label="Status"
                        value={fulfilmentDrafts[row.id]?.status ?? row.status}
                        onChange={(value) => updateFulfilmentDraft(row.id, { status: value ?? row.status })}
                        data={fulfilmentStatusOptions.filter((option) => option.value !== 'all').map((option) => ({ value: option.value, label: option.label }))}
                      />
                      <TextInput
                        label="Provider reference / tracking ID"
                        value={fulfilmentDrafts[row.id]?.providerTxSig ?? ''}
                        onChange={(e) => updateFulfilmentDraft(row.id, { providerTxSig: e.target.value })}
                        placeholder="Tracking ID or provider reference"
                      />
                      <TextInput
                        label="Vendor memo"
                        value={fulfilmentDrafts[row.id]?.providerMemo ?? ''}
                        onChange={(e) => updateFulfilmentDraft(row.id, { providerMemo: e.target.value })}
                        placeholder="Add fulfilment note"
                      />
                    </SimpleGrid>

                    <Group gap="sm" wrap="wrap">
                      <Button variant="light" onClick={() => void quickFulfilmentAction(row.id, 'REDEMPTION_REQUESTED')} loading={saving}>Mark ready</Button>
                      <Button variant="light" onClick={() => void quickFulfilmentAction(row.id, 'REDEEMED')} loading={saving}>Mark fulfilled</Button>
                      <Button variant="outline" color="red" onClick={() => void quickFulfilmentAction(row.id, 'VOIDED')} loading={saving}>Void</Button>
                      <Button onClick={() => void saveFulfilmentItem(row.id)} loading={saving}>Save update</Button>
                    </Group>
                  </Stack>
                </Card>
              ))}
              {fulfilmentItems.length === 0 && !fulfilmentLoading ? <Text size="sm" c="dimmed">No fulfilment records found for this filter.</Text> : null}
            </Stack>
          </Stack>
        </Card>
      ) : null}
      {activeTab === "PACKS" ? (
        <>
          <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
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
                <label className="muted tiny">
                  Pack carousel cover URL
                  <input value={packCoverImageUrl} onChange={(e) => setPackCoverImageUrl(e.target.value)} placeholder="Pack carousel cover URL" required />
                </label>
                <div className="muted tiny" style={{ gridColumn: "1 / -1" }}>
                  Choose a homepage carousel pack cover
                  <div className="theme-preset-grid" style={{ marginTop: 8 }}>
                    {DEFAULT_PACK_COVER_OPTIONS.map((option) => (
                      <button
                        key={option.image}
                        type="button"
                        className={`theme-preset-card ${packCoverImageUrl === option.image ? "active" : ""}`}
                        onClick={() => setPackCoverImageUrl(option.image)}
                      >
                        <strong>{option.label}</strong>
                        <img
                          src={option.image}
                          alt={option.label}
                          style={{
                            width: "100%",
                            aspectRatio: "4 / 5",
                            objectFit: "contain",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "color-mix(in srgb, var(--card) 86%, transparent)",
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="muted tiny" style={{ gridColumn: "1 / -1" }}>
                  Choose from wide pack banners
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
                  <div className="banner-admin-row" style={{ gridColumn: "1 / -1", gridTemplateColumns: "160px 220px 1fr" }}>
                    <img src={packCoverImageUrl} alt="Pack carousel cover preview" style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "contain", background: "color-mix(in srgb, var(--card) 86%, transparent)" }} />
                    <img src={packBannerImageUrl} alt="Pack banner preview" style={{ width: "100%", height: "auto", objectFit: "contain", background: "#fff" }} />
                    <div className="muted tiny">Carousel cover and wide pack banner preview</div>
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
                <Textarea value={importantNotes} onChange={(e) => setImportantNotes(e.target.value)} placeholder="Important notes shown on pack page" maxLength={2000} autosize minRows={3} />
              </label>

              <SimpleGrid className="pack-builder-two-panel" cols={{ base: 1, xl: 2 }} spacing="md">
                <Card withBorder radius="xl" p="lg" shadow="sm">
                  <div className="heading-row">
                    <div style={{ display: "grid", gap: 2 }}>
                      <h3>Pack Contents</h3>
                      <span className="muted tiny">{totalDraftItems}/{limits.maxPackItems} cards</span>
                    </div>
                    <div className="actions" style={{ gap: 8 }}>
                      <button type="button" className="sort-pill" onClick={collapseAllTiers} disabled={tiers.length === 0 || allTiersCollapsed}>
                        Collapse All
                      </button>
                      <button type="button" className="sort-pill" onClick={expandAllTiers} disabled={tiers.length === 0 || !allTiersCollapsed}>
                        Expand All
                      </button>
                    </div>
                  </div>
                  <div className="tier-stack">
                    {tiers.map((tier, tierIndex) => (
                      <article
                        key={tier.uiId}
                        className={`tier-bucket ${selectedTierIndex === tierIndex ? "active" : ""}`}
                        onClick={() => setSelectedTierIndex(tierIndex)}
                      >
                        <div className="heading-row">
                          <div style={{ display: "grid", gap: 2 }}>
                            <strong>{tier.name || `Tier ${tierIndex + 1}`}</strong>
                            <span className="muted tiny">{tier.items.length} cards | {tier.percentage.trim() ? `${tier.percentage}%` : "auto rate"}</span>
                          </div>
                          <div className="actions" style={{ gap: 6 }}>
                            <span className="muted tiny">{collapsedTierIds[tier.uiId] ? "Collapsed" : "Expanded"}</span>
                            <button
                              type="button"
                              className="sort-pill"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTierCollapsed(tier.uiId);
                              }}
                            >
                              {collapsedTierIds[tier.uiId] ? "Expand" : "Collapse"}
                            </button>
                          </div>
                        </div>
                        {!collapsedTierIds[tier.uiId] ? (
                          <>
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
                                <div
                                  className="tier-item-editor"
                                  key={`tier-${tier.uiId}-item-${itemIndex}`}
                                >
                                  <div className="tier-item-preview">
                                    <img src={item.imageUrl || DEFAULT_CARD} alt={item.label || "Card"} />
                                    <div className="tier-item-preview-meta">
                                      <strong>{item.label || "Untitled card"}</strong>
                                      <span className="muted tiny">
                                        {item.catalogItemId ? "Catalog item" : "Manual item"}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className="sort-pill"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeItem(tierIndex, itemIndex);
                                      }}
                                      title={`Remove ${item.label || "card"}`}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <div className="tier-item-fields">
                                    <label className="muted tiny">
                                      Item label
                                      <input
                                        value={item.label}
                                        onChange={(e) => updateItem(tierIndex, itemIndex, "label", e.target.value)}
                                        placeholder="Item label"
                                      />
                                    </label>
                                    <label className="muted tiny">
                                      Estimated value
                                      <input
                                        value={item.estimatedValue}
                                        onChange={(e) => updateItem(tierIndex, itemIndex, "estimatedValue", e.target.value)}
                                        type="number"
                                        min={0}
                                        step="1"
                                        placeholder="Estimated value"
                                      />
                                    </label>
                                    <label className="muted tiny">
                                      Quantity available
                                      <input
                                        value={item.stock}
                                        onChange={(e) => updateItem(tierIndex, itemIndex, "stock", e.target.value)}
                                        type="number"
                                        min={1}
                                        step="1"
                                        placeholder="How many times this item can be won"
                                      />
                                    </label>
                                  </div>
                                  <div className="tier-item-presets">
                                    {[1, 5, 10, 25, 50].map((qty) => (
                                      <button
                                        key={`${tier.uiId}-${itemIndex}-qty-${qty}`}
                                        type="button"
                                        className={`sort-pill ${item.stock === String(qty) ? "active" : ""}`}
                                        onClick={() => updateItem(tierIndex, itemIndex, "stock", String(qty))}
                                      >
                                        {qty}x
                                      </button>
                                    ))}
                                  </div>
                                  <p className="muted tiny">
                                    This controls how many winning copies of this exact prize are allowed in the pack.
                                  </p>
                                </div>
                              ))}
                              {tier.items.length === 0 ? <p className="muted tiny">No cards added yet.</p> : null}
                            </div>
                            <div className="actions" style={{ marginTop: 8 }}>
                              <button type="button" className="sort-pill" onClick={(e) => { e.stopPropagation(); addItem(tierIndex); }} disabled={totalDraftItems >= limits.maxPackItems}>+ Add blank item</button>
                              <button type="button" className="sort-pill" onClick={(e) => { e.stopPropagation(); removeTier(tierIndex); }} disabled={tiers.length <= 1}>Remove Tier</button>
                            </div>
                          </>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </Card>

                <Card withBorder radius="xl" p="lg" shadow="sm">
                  <div className="heading-row">
                    <h3>Add Cards</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="muted tiny">Selected tier: {tiers[selectedTierIndex]?.name || `Tier ${selectedTierIndex + 1}`}</span>
                      <button type="button" className="sort-pill" onClick={resetCatalogFilters}>Reset Filters</button>
                    </div>
                  </div>
                  <div className="pack-builder-grid">
                    <label className="muted tiny">
                      Game
                      <select value={catalogGameFilter} onChange={(e) => setCatalogGameFilter(e.target.value)}>
                        <option value="">Select game</option>
                        {CATALOG_GAME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="muted tiny">
                      Product type
                      <select value={catalogItemClass} onChange={(e) => setCatalogItemClass(e.target.value as "CARD" | "SEALED_PRODUCT")} disabled={!gameSelected}>
                        {CATALOG_ITEM_CLASS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="muted tiny">
                      Search catalog
                      <input
                        value={cardSearchQuery}
                        onChange={(e) => setCardSearchQuery(e.target.value)}
                        placeholder={gameSelected ? "Optional: refine by name..." : "Select game first"}
                        disabled={!gameSelected}
                      />
                    </label>
                  </div>
                  <div className="pack-builder-grid">
                    <label className="muted tiny">
                      Filter set options
                      <input
                        value={setOptionQuery}
                        onChange={(e) => setSetOptionQuery(e.target.value)}
                        placeholder="Type to filter set dropdown..."
                        disabled={!gameSelected}
                      />
                    </label>
                    <label className="muted tiny">
                      Card set
                      <select value={catalogFilters.setId} onChange={(e) => setCatalogFilter("setId", e.target.value)} disabled={!gameSelected}>
                        <option value="">{isCardPicker ? "Select set (recommended)" : "Select set"}</option>
                        {filteredSetFacetOptions.map((set) => (
                          <option key={set.id} value={set.id}>{set.name || set.id} ({set.count})</option>
                        ))}
                      </select>
                      <span className="muted tiny">Showing {filteredSetFacetOptions.length} / {catalogFacets.sets.length} sets</span>
                    </label>
                    <label className="muted tiny">
                      Filter rarity options
                      <input
                        value={rarityOptionQuery}
                        onChange={(e) => setRarityOptionQuery(e.target.value)}
                        placeholder="Type to filter rarity dropdown..."
                        disabled={!gameSelected || !isCardPicker || !setSelected}
                      />
                    </label>
                    <label className="muted tiny">
                      Rarity
                      <select
                        value={catalogFilters.rarity}
                        onChange={(e) => setCatalogFilter("rarity", e.target.value)}
                        disabled={!gameSelected || !isCardPicker || !setSelected}
                      >
                        <option value="">All rarities</option>
                        {filteredRarityFacetOptions.map((rarity) => (
                          <option key={rarity.value} value={rarity.value}>{rarity.value} ({rarity.count})</option>
                        ))}
                      </select>
                      <span className="muted tiny">Showing {filteredRarityFacetOptions.length} / {catalogFacets.rarities.length} rarities</span>
                    </label>
                  </div>
                  <div className="pack-builder-grid">
                    <label className="muted tiny">
                      Source
                      <select value={catalogFilters.source} onChange={(e) => setCatalogFilter("source", e.target.value)} disabled={!gameSelected}>
                        <option value="">All sources</option>
                        {catalogFacets.sources.map((source) => (
                          <option key={source.value} value={source.value}>{source.value} ({source.count})</option>
                        ))}
                      </select>
                    </label>
                    <label className="muted tiny">
                      Language
                      <select value={catalogFilters.language} onChange={(e) => setCatalogFilter("language", e.target.value)} disabled={!gameSelected}>
                        <option value="">All languages</option>
                        {catalogFacets.languages.map((language) => (
                          <option key={language.value} value={language.value}>{language.value} ({language.count})</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {catalogFacetError ? (
                    <div className="inline-error-banner" role="alert">
                      Filter options unavailable: {catalogFacetError}
                    </div>
                  ) : null}
                  {catalogSearchError ? (
                    <div className="inline-error-banner" role="alert">
                      Catalog search failed: {catalogSearchError}
                    </div>
                  ) : null}
                  {!gameSelected ? (
                    <p className="muted tiny">Select a game to enable set, rarity, and source filters.</p>
                  ) : null}
                  {gameSelected && !catalogCanSearch ? (
                    <p className="muted tiny">Select a set to load results instantly, or type in search to browse by name.</p>
                  ) : null}
                  {catalogResultsLoading ? <p className="muted tiny">Loading catalog results...</p> : null}
                  {!catalogResultsLoading && catalogCanSearch && catalogResults.length === 0 ? (
                    <p className="muted tiny">No results found for the selected filters.</p>
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
                        <span className="muted tiny">
                          {suggestion.cardNumber ? `#${suggestion.cardNumber}` : suggestion.setId || (suggestion.itemType === "SEALED_PRODUCT" ? "Sealed product" : "Card")}
                        </span>
                      </button>
                    ))}
                  </div>
                  {catalogHasMore ? (
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button type="button" className="sort-pill" onClick={() => void loadMoreCatalogResults()} disabled={catalogResultsLoadingMore || catalogResultsLoading}>
                        {catalogResultsLoadingMore ? "Loading more..." : "Load 50 more"}
                      </button>
                    </div>
                  ) : null}
                </Card>
              </SimpleGrid>

              <div className="actions">
                <button type="button" className="draw-button alt" onClick={addTier} disabled={tiers.length >= limits.maxPackTiers}>+ Add Tier</button>
                {editingPackId ? <button type="button" className="sort-pill" onClick={resetPackForm}>Cancel Edit</button> : null}
              <button type="submit" className="draw-button" disabled={saving || loading}>{editingPackId ? "Update Pack" : "Create Pack"}</button>
              {editingPackId && editingPackStatus === "DRAFT" ? (
                <button type="button" className="draw-button alt" onClick={() => void publishPack(editingPackId)} disabled={saving || loading}>
                  Publish Pack
                </button>
              ) : null}
            </div>
          </form>
        </Card>

          <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
            <Stack gap="md">
              <Title order={2} size="h3">Pack Revenue</Title>
              <Stack gap="xs">
                {packEarnings.map((row) => (
                  <Paper key={row.packId} withBorder radius="md" p="sm">
                    <Group justify="space-between" wrap="wrap">
                      <Text fw={600}>{row.packTitle}</Text>
                      <Text size="sm" c="dimmed">{row.totalPoints.toLocaleString()} pts | {row.totalDrawQuantity} draws</Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Card>

          <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
            <Stack gap="md">
              <div>
                <Title order={2} size="h3">Existing Packs</Title>
                <Text c="dimmed" size="sm">Creative MVP is pack-anchored: generated drafts use only this pack's prize images and a safe abstract background prompt.</Text>
              </div>
              <Stack gap="sm">
                {packs.map((pack) => (
                  <Paper key={pack.id} withBorder radius="md" p="sm">
                    <Stack gap="sm">
                      <Group justify="space-between" align="start" wrap="wrap">
                        <div>
                          <Text fw={600}>{pack.title}</Text>
                          <Text size="sm" c="dimmed">[{pack.status}]</Text>
                        </div>
                        <Text size="sm" c="dimmed">{pack.pricePoints.toLocaleString()} pts | {pack.remainingStock}/{pack.totalStock}</Text>
                      </Group>
                      <Group gap="xs" wrap="wrap">
                        <Button variant="light" size="xs" onClick={() => void generateCreativeDraft(pack.id)} disabled={saving || pack.prizes.length === 0}>Generate creative draft</Button>
                        <Button variant="light" size="xs" onClick={() => editPack(pack)} disabled={saving}>Edit</Button>
                        {pack.status === "DRAFT" ? <Button variant="light" size="xs" onClick={() => void publishPack(pack.id)} disabled={saving}>Publish</Button> : null}
                        <Button variant="outline" size="xs" onClick={() => void archivePack(pack.id)} disabled={saving || pack.status === "ARCHIVED"}>Archive</Button>
                        <Button variant="outline" color="red" size="xs" onClick={() => void deletePack(pack.id)} disabled={saving}>Delete</Button>
                      </Group>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Card>

          <Card withBorder radius="xl" p="lg" shadow="sm" mt="md">
            <Stack gap="md">
              <div>
                <Title order={2} size="h3">Private Creative Drafts</Title>
                <Text c="dimmed" size="sm">Publish is intentionally blocked in MVP until legal image-use approval, immutable storage, and publish-time revalidation are implemented.</Text>
              </div>
              <Stack gap="sm">
                {creativeJobs.flatMap((job) => job.assets.map((asset) => ({ job, asset }))).map(({ job, asset }) => (
                  <Paper key={asset.id} withBorder radius="md" p="sm">
                    <Group align="center" justify="space-between" wrap="wrap">
                      <Group align="center" wrap="nowrap">
                        <Image src={asset.imageUrl} alt={asset.title} w={72} h={72} fit="cover" radius="sm" />
                        <div>
                          <Text fw={600}>{asset.title}</Text>
                          <Text size="xs" c="dimmed">{job.status} | {job.stylePreset} | {asset.status}</Text>
                          <Text size="xs" c="dimmed">Hash {asset.contentHash.slice(0, 12)}? | Prompt: {job.safePrompt}</Text>
                        </div>
                      </Group>
                      <Button variant="light" size="xs" onClick={() => void attemptPublishCreative(job.id, asset.id)} loading={saving}>Publish gate check</Button>
                    </Group>
                  </Paper>
                ))}
                {creativeJobs.length === 0 ? <Text size="sm" c="dimmed">No creative drafts yet. Generate one from an existing pack.</Text> : null}
              </Stack>
            </Stack>
          </Card>

        </>
      ) : null}

      <Modal opened={Boolean(activeQr)} onClose={() => setActiveQr(null)} centered radius="lg" title="QR Token">
        {activeQr ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Points: {activeQr.points} | Status: {activeQr.status}
            </Text>
            {activeQrDataUrl ? (
              <Image src={activeQrDataUrl} alt={`QR for token ${activeQr.token}`} radius="md" />
            ) : (
              <Text size="sm" c="dimmed">
                Generating QR image...
              </Text>
            )}
            <Text size="xs" style={{ wordBreak: "break-all" }}>
              {activeQr.token}
            </Text>
          </Stack>
        ) : null}
      </Modal>

      <Modal opened={Boolean(activeReferralQrLink)} onClose={() => setActiveReferralQrLink(null)} centered radius="lg" title="Referral Signup QR">
        {activeReferralQrLink ? (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Use this QR for vendor signup referrals. New registrations using the link are recorded under this vendor.
            </Text>
            {activeReferralQrDataUrl ? (
              <Image src={activeReferralQrDataUrl} alt={`QR for referral link ${activeReferralQrLink}`} radius="md" />
            ) : (
              <Text size="sm" c="dimmed">
                Generating QR image...
              </Text>
            )}
            <Text size="xs" style={{ wordBreak: "break-all" }}>
              {activeReferralQrLink}
            </Text>
            <Group mt="xs">
              <Button variant="light" onClick={() => void copyReferralSignupLink()} disabled={!referralSignupUrl}>
                Copy Link
              </Button>
              <Button variant="outline" onClick={() => void saveReferralQrImage()} disabled={!activeReferralQrDataUrl}>
                Save QR
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
      </Stack>
    </Container>
    </VendorThemeProvider>
  );
}

function resolveThemePresetId(theme: typeof DEFAULT_THEME, explicitPreset?: string | null) {
  const explicitMatch = THEME_PRESETS.find((preset) => preset.id === explicitPreset);
  if (explicitMatch) return explicitMatch.id;
  const found = THEME_PRESETS.find((preset) => matchesPreset(theme, preset));
  return found?.id ?? "custom";
}
