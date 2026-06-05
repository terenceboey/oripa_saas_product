"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

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

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 18;

export default function SetlistsPage() {
  const [game, setGame] = useState<"pokemon" | "pokemon-japan">("pokemon");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mainData, setMainData] = useState<SetlistResponse>({ total: 0, totalPages: 1, page: 1, limit: PAGE_SIZE, items: [] });
  const [recentItems, setRecentItems] = useState<SetlistItem[]>([]);
  const [tabCounts, setTabCounts] = useState({ pokemon: 0, pokemonJapan: 0, parallel: 0 });

  useEffect(() => {
    setPage(1);
  }, [game, query, sort]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const buildListUrl = (gameKey: string, params: { page?: number; limit?: number; q?: string; sort?: string }) => {
      const url = new URL(`${apiBase}/v1/public/setlists`);
      url.searchParams.set("game", gameKey);
      url.searchParams.set("page", String(params.page ?? 1));
      url.searchParams.set("limit", String(params.limit ?? PAGE_SIZE));
      url.searchParams.set("sort", params.sort ?? sort);
      if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
      return url.toString();
    };

    Promise.all([
      fetch(buildListUrl(game, { page, limit: PAGE_SIZE, q: query, sort }), { cache: "no-store" }).then((r) => r.json()),
      fetch(buildListUrl(game, { page: 1, limit: 5, sort: "newest" }), { cache: "no-store" }).then((r) => r.json()),
      fetch(buildListUrl("pokemon", { page: 1, limit: 1, sort: "newest" }), { cache: "no-store" }).then((r) => r.json()),
      fetch(buildListUrl("pokemon-japan", { page: 1, limit: 1, sort: "newest" }), { cache: "no-store" }).then((r) => r.json()),
      fetch(buildListUrl("all", { page: 1, limit: 1, sort: "newest" }), { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([mainPayload, recentPayload, pokemonCountPayload, japanCountPayload, allPayload]) => {
        if (!active) return;
        const pokemonCount = Number(pokemonCountPayload?.total ?? 0);
        const pokemonJapanCount = Number(japanCountPayload?.total ?? 0);
        const allCount = Number(allPayload?.total ?? 0);
        setMainData({
          total: Number(mainPayload?.total ?? 0),
          totalPages: Number(mainPayload?.totalPages ?? 1),
          page: Number(mainPayload?.page ?? 1),
          limit: Number(mainPayload?.limit ?? PAGE_SIZE),
          items: Array.isArray(mainPayload?.items) ? mainPayload.items : [],
        });
        setRecentItems(Array.isArray(recentPayload?.items) ? recentPayload.items : []);
        setTabCounts({
          pokemon: pokemonCount,
          pokemonJapan: pokemonJapanCount,
          parallel: Math.max(0, allCount - pokemonCount - pokemonJapanCount),
        });
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

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Setlists</h1>
            <p style={styles.subtitle}>Browse every release across the platform.</p>
          </div>
          <div style={styles.tabs}>
            <button type="button" style={tabStyle(game === "pokemon")} onClick={() => setGame("pokemon")}>
              Pokemon {tabCounts.pokemon}
            </button>
            <button type="button" style={tabStyle(game === "pokemon-japan", true)} onClick={() => setGame("pokemon-japan")}>
              Pokemon Japan {tabCounts.pokemonJapan}
            </button>
            <button type="button" style={tabStyle(false, false, true)} disabled>
              Parallel {tabCounts.parallel}
            </button>
          </div>
        </header>

        <section style={styles.filterRow}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sets..." style={styles.input} />
          <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest" | "name")} style={styles.select}>
            <option value="newest">Release Date: Newest</option>
            <option value="oldest">Release Date: Oldest</option>
            <option value="name">Name: A-Z</option>
          </select>
        </section>

        {featured ? (
          <section style={styles.hero}>
            <div style={styles.heroInner}>
              <div style={styles.heroSide}>{fanCards(featured)}</div>
              <div style={styles.heroCenter}>
                <span style={styles.latest}>LATEST RELEASE</span>
                <SetImage set={featured} hero />
                <h2 style={styles.heroTitle}>{featured.name}</h2>
                <p style={styles.heroMeta}>
                  {(featured.releaseDate ? new Date(featured.releaseDate).toLocaleDateString() : "Unknown date")} • {featured.cardCount} cards
                </p>
                <Link
                  href={`/setlists/${featured.sourceSetId}?game=${game}&source=${encodeURIComponent(featured.source)}`}
                  style={styles.heroButton}
                >
                  Browse Cards →
                </Link>
              </div>
              <div style={styles.heroSide}>{fanCards(featured, true)}</div>
            </div>
          </section>
        ) : null}

        <section style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Recent Releases</h3>
          <span style={styles.viewAll}>{"View all ->"}</span>
        </section>

        <section style={styles.recentGrid}>
          {recentItems.map((set) => (
            <SetCard key={`recent-${set.id}`} set={set} game={game} recent />
          ))}
        </section>

        <section style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>All Sets</h3>
        </section>

        {loading ? <p style={styles.loading}>Loading setlists...</p> : null}
        <section style={styles.allGrid}>
          {mainData.items.map((set) => (
            <SetCard key={`set-${set.id}`} set={set} game={game} />
          ))}
        </section>

        <footer style={styles.pagination}>
          <button type="button" style={styles.pageBtn} disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </button>
          <span style={styles.pageText}>
            {currentPage} / {totalPages} ({mainData.total} sets)
          </span>
          <button type="button" style={styles.pageBtn} disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next
          </button>
        </footer>
      </div>
    </main>
  );
}

function imageForSet(set: SetlistItem) {
  return set.resolvedBannerImageUrl || set.bannerImageUrl || set.resolvedLogoImageUrl || set.logoImageUrl || set.resolvedSymbolImageUrl || set.symbolImageUrl || null;
}

function SetImage({ set, hero = false }: { set: SetlistItem; hero?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : imageForSet(set);
  if (!src) {
    return (
      <div style={hero ? styles.heroImageFallback : styles.cardImageFallback}>
        <span style={hero ? styles.fallbackCodeHero : styles.fallbackCode}>{set.setCode || set.name.slice(0, 3).toUpperCase()}</span>
        <span style={hero ? styles.fallbackLabelHero : styles.fallbackLabel}>set badge</span>
      </div>
    );
  }
  return <img src={src} alt={set.name} style={hero ? styles.heroLogo : styles.cardLogo} onError={() => setFailed(true)} />;
}

function SetCard({ set, game, recent = false }: { set: SetlistItem; game: string; recent?: boolean }) {
  return (
    <Link href={`/setlists/${set.sourceSetId}?game=${game}&source=${encodeURIComponent(set.source)}`} style={styles.card}>
      <div style={styles.cardLogoWrap}>
        <SetImage set={set} />
      </div>
      <div style={styles.cardName}>{set.name}</div>
      <div style={styles.cardMeta}>
        {(set.releaseDate ? new Date(set.releaseDate).toLocaleDateString() : "Unknown")} • {set.cardCount} cards
      </div>
      {recent ? <span style={styles.cardArrow}>{">"}</span> : null}
    </Link>
  );
}

function fanCards(set: SetlistItem, reverse = false) {
  const baseImage = imageForSet(set);
  if (!baseImage) return <div style={styles.fanRoot} />;
  return (
    <div style={{ ...styles.fanRoot, transform: reverse ? "scaleX(-1)" : "none" }}>
      <img src={baseImage} alt="" style={{ ...styles.fanCard, top: 56, left: 6, transform: "rotate(-16deg)" }} />
      <img src={baseImage} alt="" style={{ ...styles.fanCard, top: 28, left: 66, transform: "rotate(-4deg)" }} />
      <img src={baseImage} alt="" style={{ ...styles.fanCard, top: 56, left: 128, transform: "rotate(11deg)" }} />
    </div>
  );
}

function tabStyle(active: boolean, alt = false, disabled = false): CSSProperties {
  if (disabled) {
    return {
      ...styles.tab,
      opacity: 0.7,
      cursor: "not-allowed",
    };
  }
  const gradient = alt ? "linear-gradient(135deg,#ff9eb5,#ff6c8a)" : "linear-gradient(135deg,#9f90ff,#74c8ff)";
  return {
    ...styles.tab,
    background: active ? gradient : "#f7f6ff",
    color: active ? "#20153a" : "#473d66",
    border: active ? "1px solid transparent" : "1px solid #d8d0ec",
  };
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#f3f0ff 0%, #edf6ff 45%, #f9fcff 100%)",
    color: "#2c2450",
    padding: "18px 14px 28px",
  },
  container: { maxWidth: 1280, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  title: { fontSize: "clamp(34px,4.4vw,46px)", margin: 0, lineHeight: 1.05, letterSpacing: "-0.02em" },
  subtitle: { margin: "8px 0 0", color: "#70639d" },
  tabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  tab: { padding: "9px 14px", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer" },
  filterRow: { marginTop: 18, display: "grid", gridTemplateColumns: "minmax(160px,1fr) minmax(190px,240px)", gap: 10 },
  input: { background: "#fff", border: "1px solid #d8d0ec", color: "#2f2455", borderRadius: 12, padding: "11px 14px", boxShadow: "0 5px 20px rgba(77,52,146,.08)" },
  select: { background: "#fff", border: "1px solid #d8d0ec", color: "#2f2455", borderRadius: 12, padding: "11px 14px", boxShadow: "0 5px 20px rgba(77,52,146,.08)" },
  hero: { marginTop: 20, borderRadius: 18, border: "1px solid #d7cfed", background: "linear-gradient(120deg, rgba(159,144,255,.20), rgba(116,200,255,.18))", boxShadow: "0 14px 28px rgba(93,69,172,.14)" },
  heroInner: { display: "grid", gridTemplateColumns: "minmax(120px,1fr) minmax(230px, 430px) minmax(120px,1fr)", gap: 8, alignItems: "center", padding: 12 },
  heroSide: { display: "grid", placeItems: "center" },
  heroCenter: { textAlign: "center", padding: "8px 6px" },
  latest: { display: "inline-block", padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,.78)", border: "1px solid #e2daf4", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#5a4b88" },
  heroLogo: { width: "min(390px,90%)", maxHeight: 140, objectFit: "contain", marginTop: 12 },
  heroTitle: { margin: "10px 0 4px", fontSize: "clamp(28px,3.4vw,40px)", lineHeight: 1.06 },
  heroMeta: { margin: 0, color: "#6f629f", fontWeight: 600 },
  heroButton: { display: "inline-block", marginTop: 12, padding: "10px 18px", borderRadius: 10, background: "linear-gradient(135deg,#9f90ff,#74c8ff)", color: "#1c1340", textDecoration: "none", fontWeight: 800 },
  sectionHeader: { marginTop: 20, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { margin: 0, fontSize: 22 },
  viewAll: { color: "#7d71a8", fontWeight: 700, fontSize: 14 },
  recentGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10 },
  allGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(185px,1fr))", gap: 10 },
  card: { position: "relative", textDecoration: "none", color: "inherit", border: "1px solid #d8d0ec", background: "#ffffffcc", borderRadius: 14, padding: 10, boxShadow: "0 10px 24px rgba(80,59,150,.08)" },
  cardLogoWrap: { height: 100, display: "grid", placeItems: "center", borderRadius: 10, background: "linear-gradient(180deg,#fbf9ff,#f1ecff)", overflow: "hidden" },
  cardLogo: { maxWidth: "100%", maxHeight: 88, objectFit: "contain" },
  cardImageFallback: { width: "100%", height: "100%", display: "grid", placeItems: "center", alignContent: "center", gap: 3, borderRadius: 10, background: "radial-gradient(circle at 20% 15%, rgba(255,255,255,.55), transparent 24%), linear-gradient(135deg,#8f7cff,#62c7ff 52%,#ff9eb5)", color: "#20153a", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45)" },
  fallbackCode: { fontSize: 27, lineHeight: 1, fontWeight: 950, letterSpacing: ".02em", textShadow: "0 1px 0 rgba(255,255,255,.35)" },
  fallbackLabel: { fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", opacity: .72 },
  heroImageFallback: { width: "min(390px,90%)", minHeight: 136, margin: "12px auto 0", display: "grid", placeItems: "center", alignContent: "center", gap: 4, borderRadius: 18, background: "radial-gradient(circle at 20% 15%, rgba(255,255,255,.55), transparent 24%), linear-gradient(135deg,#8f7cff,#62c7ff 52%,#ff9eb5)", color: "#20153a", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45), 0 14px 26px rgba(80,59,150,.18)" },
  fallbackCodeHero: { fontSize: 46, lineHeight: 1, fontWeight: 950, letterSpacing: ".02em", textShadow: "0 1px 0 rgba(255,255,255,.35)" },
  fallbackLabelHero: { fontSize: 12, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase", opacity: .72 },
  cardName: { marginTop: 8, fontWeight: 800, lineHeight: 1.2, minHeight: 36 },
  cardMeta: { marginTop: 6, color: "#72669f", fontSize: 13 },
  cardArrow: { position: "absolute", right: 10, bottom: 10, width: 20, height: 20, display: "grid", placeItems: "center", borderRadius: 6, background: "#efeafe", color: "#6f5ea8", fontWeight: 900 },
  pagination: { marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 },
  pageBtn: { border: "1px solid #d7cfee", background: "#fff", color: "#433869", borderRadius: 10, padding: "9px 14px", fontWeight: 700, cursor: "pointer" },
  pageText: { color: "#6a5f97", fontWeight: 700 },
  loading: { color: "#6f639d", fontWeight: 600 },
  fanRoot: { position: "relative", width: "min(240px,42vw)", height: 190 },
  fanCard: { position: "absolute", width: 110, aspectRatio: "63/88", objectFit: "cover", borderRadius: 10, border: "1px solid #f4f0ff", boxShadow: "0 10px 20px rgba(64,42,133,.26)" },
};
