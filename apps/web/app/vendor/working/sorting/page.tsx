"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "demo.localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.startsWith("127.0.0.1") ||
    normalized.startsWith("0.0.0.0")
  );
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
          headers: {
            "x-vendor-host": currentVendorHost(),
            "x-client-page": "/vendor/working/sorting",
          },
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
        headers: {
          "x-vendor-host": currentVendorHost(),
          "x-client-page": "/vendor/working/sorting",
        },
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
    <main style={{ minHeight: "100vh", background: "#080b12", color: "#f8fafc", padding: "32px" }}>
      <section style={{ margin: "0 auto", maxWidth: "1180px" }}>
        {accessState !== "allowed" ? (
          <div style={{ border: "1px solid #1e293b", borderRadius: "16px", background: "#0f172a", padding: "24px" }}>
            <h1 style={{ fontSize: "28px", lineHeight: 1.1, margin: "0 0 8px" }}>Vendor Access Required</h1>
            <p style={{ color: "#cbd5e1", margin: 0 }}>
              {accessState === "checking" ? "Checking approved vendor access..." : "This page is restricted to approved vendor accounts only."}
            </p>
          </div>
        ) : (
          <>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <p style={{ color: "#94a3b8", margin: "0 0 6px" }}>Vendor working tools</p>
            <h1 style={{ fontSize: "32px", lineHeight: 1.1, margin: 0 }}>Catalog sorting workbench</h1>
            <p style={{ color: "#cbd5e1", maxWidth: "720px" }}>
              Fast operator view for searching broad TCG catalog results, sorting by set/name/value, and picking candidates for pack construction.
            </p>
          </div>
          <Link href="/vendor" style={{ color: "#93c5fd", textDecoration: "none", border: "1px solid #334155", padding: "10px 14px", borderRadius: "999px" }}>
            Back to vendor
          </Link>
        </div>

        <form onSubmit={runSearch} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "12px", marginBottom: "20px" }}>
          <label style={{ display: "grid", gap: "6px", color: "#cbd5e1" }}>
            Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Charizard, Pikachu, Moonbreon..." style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "6px", color: "#cbd5e1" }}>
            Source
            <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="tcgplayer" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "6px", color: "#cbd5e1" }}>
            Language
            <input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "6px", color: "#cbd5e1" }}>
            Sort
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} style={inputStyle}>
              <option value="relevance">Relevance</option>
              <option value="name">Name A-Z</option>
              <option value="set">Set / number</option>
              <option value="value-desc">Value high-low</option>
              <option value="value-asc">Value low-high</option>
            </select>
          </label>
          <button disabled={loading} style={{ ...buttonStyle, alignSelf: "end" }}>{loading ? "Searching..." : "Search"}</button>
        </form>

        {error && <div style={{ color: "#fecaca", background: "#7f1d1d", border: "1px solid #ef4444", borderRadius: "12px", padding: "12px", marginBottom: "16px" }}>{error}</div>}

        <div style={{ overflowX: "auto", border: "1px solid #1e293b", borderRadius: "16px", background: "#0f172a" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "920px" }}>
            <thead>
              <tr style={{ color: "#93c5fd", textAlign: "left", background: "#111827" }}>
                <th style={thStyle}>Card</th>
                <th style={thStyle}>Set</th>
                <th style={thStyle}>No.</th>
                <th style={thStyle}>Rarity</th>
                <th style={thStyle}>Language</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>estimatedValue</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid #1e293b" }}>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      {item.imageThumbUrl || item.imageUrl ? <img src={item.imageThumbUrl ?? item.imageUrl ?? ""} alt="" style={{ width: "40px", height: "56px", objectFit: "cover", borderRadius: "6px" }} /> : null}
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.name}</div>
                        <div style={{ color: "#94a3b8", fontSize: "12px" }}>{item.itemType}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>{item.setName ?? "—"}</td>
                  <td style={tdStyle}>{item.localId ?? item.cardNumber ?? "—"}</td>
                  <td style={tdStyle}>{item.rarity ?? "—"}</td>
                  <td style={tdStyle}>{item.language ?? "—"}</td>
                  <td style={tdStyle}>{item.source}</td>
                  <td style={tdStyle}>{numericValue(item) ? numericValue(item).toFixed(2) : "—"}</td>
                </tr>
              ))}
              {!sortedItems.length && (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, color: "#94a3b8", textAlign: "center", padding: "36px" }}>
                    Search the catalog to populate sorting candidates.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </>
        )}
      </section>
    </main>
  );
}

const inputStyle = {
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "10px",
  color: "#f8fafc",
  padding: "10px 12px",
} as const;

const buttonStyle = {
  background: "#2563eb",
  border: "0",
  borderRadius: "10px",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  padding: "11px 16px",
} as const;

const thStyle = { padding: "12px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" } as const;
const tdStyle = { padding: "12px", color: "#e2e8f0", verticalAlign: "middle" } as const;
