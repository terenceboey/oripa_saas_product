"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useBackForwardRefresh } from "../../lib/use-back-forward-refresh";

type Vendor = {
  id: string;
  name: string;
  slug: string;
  host: string;
  isActive: boolean;
};

type VendorLimits = {
  maxPackItems: number;
  maxDrawQuantity: number;
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
  pricePoints: number;
  totalStock: number;
  remainingStock: number;
  createdAt: string;
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

const DEFAULT_CARD = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const vendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";

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

export default function VendorPage() {
  const headers = useMemo(() => ({ "x-vendor-host": vendorHost, "content-type": "application/json" }), []);

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [limits, setLimits] = useState<VendorLimits>({ maxPackItems: 500, maxDrawQuantity: 100 });
  const [banners, setBanners] = useState<Banner[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);

  const [vendorName, setVendorName] = useState("");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerTargetUrl, setBannerTargetUrl] = useState("");

  const [packTitle, setPackTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pricePoints, setPricePoints] = useState("100");
  const [totalStock, setTotalStock] = useState("100");
  const [isNew, setIsNew] = useState(true);
  const [limitedLabel, setLimitedLabel] = useState("");
  const [tiers, setTiers] = useState<TierDraft[]>([createTier(0)]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalDraftItems = tiers.reduce((sum, tier) => sum + tier.items.length, 0);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [vendorRes, limitsRes, bannersRes, packsRes] = await Promise.all([
        fetch(`${apiBase}/v1/vendor/current`, { headers: { "x-vendor-host": vendorHost }, cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/limits`, { headers: { "x-vendor-host": vendorHost }, cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/banners`, { headers: { "x-vendor-host": vendorHost }, cache: "no-store" }),
        fetch(`${apiBase}/v1/packs`, { headers: { "x-vendor-host": vendorHost }, cache: "no-store" }),
      ]);

      if (!vendorRes.ok || !limitsRes.ok || !bannersRes.ok || !packsRes.ok) {
        throw new Error("Failed to load vendor dashboard data");
      }

      const vendorJson = await vendorRes.json();
      const limitsJson = await limitsRes.json();
      const bannersJson = await bannersRes.json();
      const packsJson = await packsRes.json();

      setVendor(vendorJson.vendor ?? null);
      setVendorName(vendorJson.vendor?.name ?? "");
      setLimits(limitsJson.limits ?? { maxPackItems: 500, maxDrawQuantity: 100 });
      setBanners(bannersJson.banners ?? []);
      setPacks(packsJson.packs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useBackForwardRefresh(loadAll);

  async function saveVendorProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiBase}/v1/vendor/profile`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: vendorName }),
      });
      if (!res.ok) throw new Error("Failed to update vendor profile");
      setSuccess("Vendor profile updated.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update vendor profile");
    } finally {
      setSaving(false);
    }
  }

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
        headers,
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
        headers: { "x-vendor-host": vendorHost },
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

  function addTier() {
    setTiers((prev) => {
      if (prev.length >= 10) return prev;
      return [...prev, createTier(prev.length)];
    });
  }

  function removeTier(tierIndex: number) {
    setTiers((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== tierIndex);
    });
  }

  function addItem(tierIndex: number) {
    setTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== tierIndex) return tier;
        return { ...tier, items: [...tier.items, createItem()] };
      })
    );
  }

  function removeItem(tierIndex: number, itemIndex: number) {
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

  async function createPack(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (totalDraftItems > limits.maxPackItems) {
        throw new Error(`Item count exceeds vendor limit (${limits.maxPackItems}).`);
      }

      const payload = {
        title: packTitle,
        pricePoints: Number(pricePoints),
        totalStock: Number(totalStock),
        startsAt: toIsoDateTime(startsAt),
        endsAt: toIsoDateTime(endsAt),
        isNew,
        limitedLabel: limitedLabel.trim() ? limitedLabel.trim() : undefined,
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

      const res = await fetch(`${apiBase}/v1/packs`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create pack");
      }

      setSuccess("Pack created successfully.");
      setPackTitle("");
      setStartsAt("");
      setEndsAt("");
      setPricePoints("100");
      setTotalStock("100");
      setLimitedLabel("");
      setTiers([createTier(0)]);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pack");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container">
      <header className="site-header">
        <div className="brand-text">
          <strong>Vendor Dashboard</strong>
          <span>{vendor?.name ?? "-"} ({vendorHost})</span>
        </div>
        <a className="sort-pill" href="/">Back to Homepage</a>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="badge">{success}</p> : null}

      <section className="card">
        <h2>Vendor Profile</h2>
        <form className="vendor-form" onSubmit={saveVendorProfile}>
          <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" required minLength={2} maxLength={80} />
          <button type="submit" className="draw-button" disabled={saving || loading}>Save Profile</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Banners</h2>
        <form className="vendor-form" onSubmit={addBanner}>
          <input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="Banner title" required />
          <input value={bannerImageUrl} onChange={(e) => setBannerImageUrl(e.target.value)} placeholder="Banner image URL" required />
          <input value={bannerTargetUrl} onChange={(e) => setBannerTargetUrl(e.target.value)} placeholder="Target URL (optional)" />
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
        <h2>Create Pack (Interactive)</h2>
        <p className="muted tiny">Item limit: {totalDraftItems}/{limits.maxPackItems} | Tier limit: {tiers.length}/10</p>

        <form className="pack-builder" onSubmit={createPack}>
          <div className="pack-builder-grid">
            <input value={packTitle} onChange={(e) => setPackTitle(e.target.value)} placeholder="Pack Name" required minLength={2} maxLength={120} />
            <input type="number" min={1} value={pricePoints} onChange={(e) => setPricePoints(e.target.value)} placeholder="Price (points)" required />
            <input type="number" min={1} value={totalStock} onChange={(e) => setTotalStock(e.target.value)} placeholder="Total stock" required />
            <input type="text" value={limitedLabel} onChange={(e) => setLimitedLabel(e.target.value)} placeholder="Limited label (optional)" />
            <label className="muted tiny">
              Start date-time
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="muted tiny">
              End date-time
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
          </div>

          <label className="muted tiny">
            <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} /> Mark as New
          </label>

          <div className="tier-stack">
            {tiers.map((tier, tierIndex) => (
              <article key={`tier-${tierIndex}`} className="card tier-card">
                <div className="heading-row">
                  <strong>Tier {tierIndex + 1}</strong>
                  <button type="button" className="sort-pill" onClick={() => removeTier(tierIndex)} disabled={tiers.length <= 1}>Remove Tier</button>
                </div>

                <div className="pack-builder-grid">
                  <input value={tier.name} onChange={(e) => updateTier(tierIndex, "name", e.target.value)} placeholder="Tier name (e.g. A Tier)" required />
                  <input value={tier.percentage} onChange={(e) => updateTier(tierIndex, "percentage", e.target.value)} placeholder="Tier % (optional, auto if blank)" type="number" min={0} max={100} step="0.0001" />
                </div>

                <div className="tier-items">
                  {tier.items.map((item, itemIndex) => (
                    <div className="item-row" key={`tier-${tierIndex}-item-${itemIndex}`}>
                      <input value={item.label} onChange={(e) => updateItem(tierIndex, itemIndex, "label", e.target.value)} placeholder="Item label" required />
                      <input value={item.estimatedValue} onChange={(e) => updateItem(tierIndex, itemIndex, "estimatedValue", e.target.value)} placeholder="Estimated value" type="number" min={0} required />
                      <input value={item.stock} onChange={(e) => updateItem(tierIndex, itemIndex, "stock", e.target.value)} placeholder="Stock" type="number" min={1} required />
                      <input value={item.imageUrl} onChange={(e) => updateItem(tierIndex, itemIndex, "imageUrl", e.target.value)} placeholder="Image URL" />
                      <button type="button" className="sort-pill" onClick={() => removeItem(tierIndex, itemIndex)} disabled={tier.items.length <= 1}>Remove</button>
                    </div>
                  ))}
                </div>

                <button type="button" className="sort-pill" onClick={() => addItem(tierIndex)}>+ Add Item</button>
              </article>
            ))}
          </div>

          <div className="actions">
            <button type="button" className="draw-button alt" onClick={addTier} disabled={tiers.length >= 10}>+ Add Tier</button>
            <button type="submit" className="draw-button" disabled={saving || loading}>Create Pack</button>
          </div>
        </form>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Existing Packs</h2>
        <div className="result-list">
          {packs.map((pack) => (
            <div className="result-row" key={pack.id}>
              <span>{pack.title}</span>
              <span>{pack.pricePoints.toLocaleString()} pts | {pack.remainingStock}/{pack.totalStock}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
