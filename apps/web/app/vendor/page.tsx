"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBackForwardRefresh } from "../../lib/use-back-forward-refresh";
import QRCode from "qrcode";

type Vendor = {
  id: string;
  name: string;
  slug: string;
  host: string;
  isActive: boolean;
  referralCode?: string | null;
  businessLocation?: string | null;
  businessContact?: string | null;
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
  }>;
};

type ItemDraft = {
  label: string;
  estimatedValue: string;
  stock: string;
  imageUrl: string;
};

type TierDraft = {
  name: string;
  percentage: string;
  items: ItemDraft[];
};

type CatalogSuggestion = {
  id: string;
  source: string;
  sourceItemId: string;
  itemType: "CARD" | "SEALED_PRODUCT";
  game: string;
  language: string;
  name: string;
  setId?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  imageThumbUrl?: string | null;
  imageLargeUrl?: string | null;
  imageBaseUrl?: string | null;
};

const DEFAULT_CARD = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const DEFAULT_PACK_BANNER = "/default-pack-banner.png";
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "";
const clientPageHeader = { "x-client-page": "/vendor" };
type ActiveTab = "BUSINESS" | "PACKS";

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

  const [vendorName, setVendorName] = useState("");
  const [vendorSlug, setVendorSlug] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [businessContact, setBusinessContact] = useState("");
  const [referralCode, setReferralCode] = useState("");

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
  const [itemSearchTarget, setItemSearchTarget] = useState<{ tierIndex: number; itemIndex: number } | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemSuggestions, setItemSuggestions] = useState<CatalogSuggestion[]>([]);
  const [itemSuggestLoading, setItemSuggestLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("BUSINESS");

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
      const [limitsRes, summaryRes, packEarningsRes, referralsRes, bannersRes, packsRes, qrRes] = await Promise.all([
        fetch(`${apiBase}/v1/vendor/limits`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/earnings/summary`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/earnings/packs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/referrals`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/banners`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/packs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/points/qr`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
      ]);

      if (!limitsRes.ok || !summaryRes.ok || !packEarningsRes.ok || !bannersRes.ok || !packsRes.ok) {
        throw new Error("Failed to load vendor dashboard data");
      }

      const limitsJson = await limitsRes.json();
      const summaryJson = await summaryRes.json();
      const packEarningsJson = await packEarningsRes.json();
      const referralsJson = await referralsRes.json();
      const qrJson = qrRes.ok ? await qrRes.json() : { qrs: [] };
      const bannersJson = await bannersRes.json();
      const packsJson = await packsRes.json();

      const v = vendorJson.vendor ?? null;
      setVendor(v);
      setVendorName(v?.name ?? "");
      setVendorSlug(v?.slug ?? "");
      setBusinessLocation(v?.businessLocation ?? "");
      setBusinessContact(v?.businessContact ?? "");
      setReferralCode(v?.referralCode ?? "");

      setLimits(limitsJson.limits ?? { planCode: "BASIC", maxPackItems: 50, maxPackTiers: 5, maxDrawQuantity: 100 });
      setSummary(summaryJson.summary ?? null);
      setPackEarnings(packEarningsJson.items ?? []);
      setReferrals(referralsJson.customers ?? []);
      setQrs(qrJson.qrs ?? []);
      setBanners(bannersJson.banners ?? []);
      setPacks(packsJson.packs ?? []);
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
    const target = itemSearchTarget;
    const query = itemSearchQuery.trim();
    if (!target || query.length < 2) {
      setItemSuggestions([]);
      setItemSuggestLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setItemSuggestLoading(true);
      const url = new URL(`${apiBase}/v1/catalog/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "8");
      url.searchParams.set("type", "card");

      fetch(url.toString(), {
        headers: authHeaders(),
        credentials: "include",
        cache: "no-store",
      })
        .then(async (res) => {
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload?.error ?? "Failed to search cards");
          setItemSuggestions((payload.items ?? []) as CatalogSuggestion[]);
        })
        .catch(() => {
          setItemSuggestions([]);
        })
        .finally(() => {
          setItemSuggestLoading(false);
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [authHeaders, itemSearchQuery, itemSearchTarget]);

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
      .then((url) => {
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

  function applyCatalogSuggestion(tierIndex: number, itemIndex: number, suggestion: CatalogSuggestion) {
    const nextLabel = [suggestion.name, suggestion.cardNumber ? `#${suggestion.cardNumber}` : ""].filter(Boolean).join(" ");
    setTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== tierIndex) return tier;
        const items = tier.items.map((item, ii) => {
          if (ii !== itemIndex) return item;
          return {
            ...item,
            label: nextLabel || suggestion.name,
            imageUrl: suggestion.imageLargeUrl || suggestion.imageThumbUrl || suggestion.imageBaseUrl || item.imageUrl || DEFAULT_CARD,
          };
        });
        return { ...tier, items };
      })
    );
    setItemSearchTarget(null);
    setItemSearchQuery("");
    setItemSuggestions([]);
  }

  function addTier() {
    setTiers((prev) => {
      if (prev.length >= limits.maxPackTiers) return prev;
      return [...prev, createTier(prev.length)];
    });
  }

  function removeTier(tierIndex: number) {
    if (itemSearchTarget?.tierIndex === tierIndex) {
      setItemSearchTarget(null);
      setItemSearchQuery("");
      setItemSuggestions([]);
    }
    setTiers((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== tierIndex);
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
    if (itemSearchTarget?.tierIndex === tierIndex && itemSearchTarget?.itemIndex === itemIndex) {
      setItemSearchTarget(null);
      setItemSearchQuery("");
      setItemSuggestions([]);
    }
    setTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== tierIndex) return tier;
        if (tier.items.length <= 1) return tier;
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
        })),
      },
    ]);
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
    <main className="container">
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

              <div className="tier-stack">
                {tiers.map((tier, tierIndex) => (
                  <article key={`tier-${tierIndex}`} className="card tier-card">
                    <div className="heading-row">
                      <strong>Tier {tierIndex + 1}</strong>
                      <button type="button" className="sort-pill" onClick={() => removeTier(tierIndex)} disabled={tiers.length <= 1}>Remove Tier</button>
                    </div>

                    <div className="pack-builder-grid">
                      <label className="muted tiny">
                        Tier name
                        <input value={tier.name} onChange={(e) => updateTier(tierIndex, "name", e.target.value)} placeholder="Tier name (e.g. A Tier)" required />
                      </label>
                      <label className="muted tiny">
                        Tier percentage
                        <input value={tier.percentage} onChange={(e) => updateTier(tierIndex, "percentage", e.target.value)} placeholder="Tier % (optional, auto if blank)" type="number" min={0} max={100} step="0.0001" />
                      </label>
                    </div>

                    <div className="tier-items">
                      {tier.items.map((item, itemIndex) => (
                        <div className="item-row" key={`tier-${tierIndex}-item-${itemIndex}`}>
                          <label className="muted tiny">
                            Item label
                            <input
                              value={item.label}
                              onChange={(e) => {
                                updateItem(tierIndex, itemIndex, "label", e.target.value);
                                setItemSearchTarget({ tierIndex, itemIndex });
                                setItemSearchQuery(e.target.value);
                              }}
                              onFocus={() => {
                                setItemSearchTarget({ tierIndex, itemIndex });
                                setItemSearchQuery(item.label);
                              }}
                              placeholder="Item label"
                              required
                            />
                            {itemSearchTarget?.tierIndex === tierIndex && itemSearchTarget?.itemIndex === itemIndex ? (
                              <div className="card" style={{ marginTop: 6, padding: 8, maxHeight: 220, overflowY: "auto" }}>
                                {itemSuggestLoading ? <div className="muted tiny">Searching cards...</div> : null}
                                {!itemSuggestLoading && itemSuggestions.length === 0 && itemSearchQuery.trim().length >= 2 ? (
                                  <div className="muted tiny">No matching cards found.</div>
                                ) : null}
                                {!itemSuggestLoading && itemSuggestions.map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    type="button"
                                    className="sort-pill catalog-suggestion-button"
                                    style={{ width: "100%", textAlign: "left", marginBottom: 6 }}
                                    onClick={() => applyCatalogSuggestion(tierIndex, itemIndex, suggestion)}
                                  >
                                    <span>
                                      {suggestion.name}
                                      {suggestion.cardNumber ? ` #${suggestion.cardNumber}` : ""}
                                      {suggestion.setId ? ` (${suggestion.setId})` : ""}
                                    </span>
                                    <span className="catalog-suggestion-preview" aria-hidden="true">
                                      <img
                                        src={suggestion.imageThumbUrl || suggestion.imageLargeUrl || suggestion.imageBaseUrl || DEFAULT_CARD}
                                        alt=""
                                      />
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </label>
                          <label className="muted tiny">
                            Estimated value
                            <input value={item.estimatedValue} onChange={(e) => updateItem(tierIndex, itemIndex, "estimatedValue", e.target.value)} placeholder="Estimated value" type="number" min={0} required />
                          </label>
                          <label className="muted tiny">
                            Stock
                            <input value={item.stock} onChange={(e) => updateItem(tierIndex, itemIndex, "stock", e.target.value)} placeholder="Stock" type="number" min={1} required />
                          </label>
                          <label className="muted tiny">
                            Image URL
                            <input value={item.imageUrl} onChange={(e) => updateItem(tierIndex, itemIndex, "imageUrl", e.target.value)} placeholder="Image URL" />
                          </label>
                          <button type="button" className="sort-pill" onClick={() => removeItem(tierIndex, itemIndex)} disabled={tier.items.length <= 1}>Remove</button>
                        </div>
                      ))}
                    </div>

                    <button type="button" className="sort-pill" onClick={() => addItem(tierIndex)} disabled={totalDraftItems >= limits.maxPackItems}>+ Add Item</button>
                  </article>
                ))}
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
            <div className="result-list">
              {packs.map((pack) => (
                <div className="result-row" key={pack.id}>
                  <span>{pack.title} ({pack.status})</span>
                  <span>{pack.pricePoints.toLocaleString()} pts | {pack.remainingStock}/{pack.totalStock}</span>
                  <div className="actions">
                    <button type="button" className="sort-pill" onClick={() => editPack(pack)} disabled={saving}>Edit</button>
                    <button type="button" className="sort-pill" onClick={() => void archivePack(pack.id)} disabled={saving || pack.status === "ARCHIVED"}>Archive</button>
                    <button type="button" className="sort-pill" onClick={() => void deletePack(pack.id)} disabled={saving}>Delete</button>
                  </div>
                </div>
              ))}
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
