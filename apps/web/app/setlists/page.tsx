"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  resolvedSymbolImageUrl?: string | null;
  resolvedLogoImageUrl?: string | null;
  symbolImageUrl?: string | null;
  logoImageUrl?: string | null;
  bannerImageUrl?: string | null;
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
const SETLIST_SOURCE = "tcgtracking";

type SetlistGame = "pokemon" | "pokemon-japan" | "onepiece";

export default function SetlistsPage() {
  const [game, setGame] = useState<SetlistGame>("pokemon");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("name");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mainData, setMainData] = useState<SetlistResponse>({ total: 0, totalPages: 1, page: 1, limit: PAGE_SIZE, items: [] });
  const [tabCounts, setTabCounts] = useState({ pokemon: 0, pokemonJapan: 0, onepiece: 0 });

  useEffect(() => {
    setPage(1);
  }, [game, query, sort]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const buildListUrl = (gameKey: string, params: { page?: number; limit?: number; q?: string; sort?: string }) => {
      const url = new URL(`${apiBase}/v1/public/setlists`);
      url.searchParams.set("game", gameKey);
      url.searchParams.set("source", SETLIST_SOURCE);
      url.searchParams.set("page", String(params.page ?? 1));
      url.searchParams.set("limit", String(params.limit ?? PAGE_SIZE));
      url.searchParams.set("sort", params.sort ?? sort);
      if (params.q?.trim()) url.searchParams.set("q", params.q.trim());
      return url.toString();
    };

    Promise.all([
      fetch(buildListUrl(game, { page, limit: PAGE_SIZE, q: query, sort }), { cache: "no-store" }).then((r) => r.json()),
      fetch(buildListUrl("pokemon", { page: 1, limit: 1, sort: "newest" }), { cache: "no-store" }).then((r) => r.json()),
      fetch(buildListUrl("pokemon-japan", { page: 1, limit: 1, sort: "newest" }), { cache: "no-store" }).then((r) => r.json()),
      fetch(buildListUrl("onepiece", { page: 1, limit: 1, sort: "newest" }), { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([mainPayload, pokemonCountPayload, japanCountPayload, onepieceCountPayload]) => {
        if (!active) return;
        const pokemonCount = Number(pokemonCountPayload?.total ?? 0);
        const pokemonJapanCount = Number(japanCountPayload?.total ?? 0);
        const onepieceCount = Number(onepieceCountPayload?.total ?? 0);
        setMainData({
          total: Number(mainPayload?.total ?? 0),
          totalPages: Number(mainPayload?.totalPages ?? 1),
          page: Number(mainPayload?.page ?? 1),
          limit: Number(mainPayload?.limit ?? PAGE_SIZE),
          items: Array.isArray(mainPayload?.items) ? mainPayload.items : [],
        });
        setTabCounts({
          pokemon: pokemonCount,
          pokemonJapan: pokemonJapanCount,
          onepiece: onepieceCount,
        });
      })
      .catch(() => {
        if (!active) return;
        setMainData({ total: 0, totalPages: 1, page: 1, limit: PAGE_SIZE, items: [] });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [game, page, query, sort]);

  const totalPages = Math.max(1, mainData.totalPages || 1);
  const currentPage = Math.min(Math.max(1, mainData.page || page), totalPages);
  const selectedLabel = game === "pokemon-japan" ? "Pokemon Japan" : game === "onepiece" ? "One Piece" : "Pokemon";

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>TCGTracking catalog</p>
            <h1 style={styles.title}>Setlists</h1>
            <p style={styles.subtitle}>Source-native releases, promos, sealed buckets, and card sets.</p>
          </div>
          <div style={styles.tabs}>
            <button type="button" style={tabStyle(game === "pokemon")} onClick={() => setGame("pokemon")}>
              Pokemon {tabCounts.pokemon}
            </button>
            <button type="button" style={tabStyle(game === "pokemon-japan", true)} onClick={() => setGame("pokemon-japan")}>
              Pokemon Japan {tabCounts.pokemonJapan}
            </button>
            <button type="button" style={tabStyle(game === "onepiece", false, false, true)} onClick={() => setGame("onepiece")}>
              One Piece {tabCounts.onepiece}
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

        <section style={styles.summaryBar}>
          <div>
            <span style={styles.summaryLabel}>Viewing</span>
            <strong style={styles.summaryValue}>{selectedLabel}</strong>
          </div>
          <div>
            <span style={styles.summaryLabel}>Sets</span>
            <strong style={styles.summaryValue}>{mainData.total}</strong>
          </div>
          <div>
            <span style={styles.summaryLabel}>Page</span>
            <strong style={styles.summaryValue}>{currentPage} / {totalPages}</strong>
          </div>
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

function SetCard({ set, game, recent = false }: { set: SetlistItem; game: string; recent?: boolean }) {
  const imageUrl = imageForSet(set);
  return (
    <Link href={`/setlists/${encodeURIComponent(set.sourceSetId)}?game=${game}&source=${encodeURIComponent(set.source)}`} style={styles.card}>
      <div style={styles.cardMedia}>
        {imageUrl ? <SetImage set={set} style={styles.cardLogo} /> : <span style={styles.codeChip}>{set.setCode || set.name.slice(0, 8)}</span>}
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTopline}>
          <span style={styles.sourceTag}>{set.source}</span>
          {set.setCode ? <span style={styles.inlineCode}>{set.setCode}</span> : null}
        </div>
        <div style={styles.cardName}>{set.name}</div>
        <div style={styles.cardMeta}>
          {(set.releaseDate ? new Date(set.releaseDate).toLocaleDateString() : "Unknown")} • {setCountLabel(set)}
        </div>
      </div>
      {recent ? <span style={styles.cardArrow}>{">"}</span> : null}
    </Link>
  );
}

function imageForSet(set: SetlistItem) {
  return set.bannerImageUrl || set.resolvedLogoImageUrl || set.logoImageUrl || set.resolvedSymbolImageUrl || set.symbolImageUrl || null;
}

function setCountLabel(set: SetlistItem) {
  if (set.cardCount > 0 && set.sealedProductCount > 0) return `${set.cardCount} cards • ${set.sealedProductCount} sealed`;
  if (set.cardCount > 0) return `${set.cardCount} cards`;
  if (set.sealedProductCount > 0) return `${set.sealedProductCount} sealed products`;
  return "No catalog items yet";
}

function SetImage({ set, style }: { set: SetlistItem; style: CSSProperties }) {
  const [failed, setFailed] = useState(false);
  const src = imageForSet(set);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div style={{ ...styles.imageFallback, ...style }} aria-label={set.name}>
        <span style={styles.imageFallbackText}>{set.setCode || set.name.slice(0, 8)}</span>
      </div>
    );
  }
  return <img src={src} alt={set.name} style={style} onError={() => setFailed(true)} />;
}

function tabStyle(active: boolean, alt = false, disabled = false, warm = false): CSSProperties {
  if (disabled) {
    return {
      ...styles.tab,
      opacity: 0.7,
      cursor: "not-allowed",
    };
  }
  const accent = warm ? "#c56a20" : alt ? "#9a3650" : "#315f7d";
  return {
    ...styles.tab,
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : accent,
    border: active ? "1px solid #111827" : "1px solid #d8dee8",
  };
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f3ec",
    color: "#171717",
    padding: "32px 16px 40px",
  },
  container: { maxWidth: 1240, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" },
  eyebrow: { margin: "0 0 8px", color: "#7c5f41", fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" },
  title: { fontSize: "clamp(38px,5vw,58px)", margin: 0, lineHeight: 0.95, letterSpacing: "-0.055em" },
  subtitle: { margin: "10px 0 0", color: "#5f5a52", maxWidth: 560, lineHeight: 1.45 },
  tabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  tab: { padding: "9px 13px", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 0 rgba(17,24,39,.05)" },
  filterRow: { marginTop: 22, display: "grid", gridTemplateColumns: "minmax(220px,1fr) minmax(190px,240px)", gap: 10 },
  input: { background: "#fffdf8", border: "1px solid #d8d1c3", color: "#191714", borderRadius: 10, padding: "12px 14px", outlineColor: "#111827" },
  select: { background: "#fffdf8", border: "1px solid #d8d1c3", color: "#191714", borderRadius: 10, padding: "12px 14px", outlineColor: "#111827" },
  summaryBar: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 },
  summaryLabel: { display: "block", color: "#7b7469", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" },
  summaryValue: { display: "block", marginTop: 3, color: "#171717", fontSize: 18, fontWeight: 900 },
  sectionHeader: { marginTop: 24, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { margin: 0, fontSize: 18, letterSpacing: "-.02em" },
  viewAll: { color: "#6a6258", fontWeight: 800, fontSize: 13 },
  recentGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 10 },
  allGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 10 },
  card: { position: "relative", display: "grid", gridTemplateColumns: "82px minmax(0,1fr)", gap: 12, alignItems: "center", minHeight: 106, textDecoration: "none", color: "inherit", border: "1px solid #d9d0c1", background: "#fffdf8", borderRadius: 14, padding: 10, boxShadow: "0 8px 20px rgba(45,35,22,.05)" },
  cardMedia: { width: 82, height: 82, display: "grid", placeItems: "center", borderRadius: 12, background: "#f1eadf", border: "1px solid #e3d8c8", overflow: "hidden" },
  codeChip: { display: "inline-flex", alignItems: "center", borderRadius: 8, padding: "6px 8px", background: "#171717", color: "#fffdf8", fontWeight: 900, fontSize: 11, letterSpacing: ".06em", maxWidth: 68, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardLogo: { maxWidth: "88%", maxHeight: "74%", objectFit: "contain" },
  cardBody: { minWidth: 0 },
  cardTopline: { display: "flex", gap: 6, alignItems: "center", minHeight: 18, marginBottom: 4 },
  sourceTag: { color: "#8a8174", fontSize: 10, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" },
  inlineCode: { color: "#4a453e", fontSize: 10, fontWeight: 900, letterSpacing: ".08em", border: "1px solid #ded4c4", borderRadius: 6, padding: "2px 5px" },
  imageFallback: { display: "grid", placeItems: "center", borderRadius: 10, background: "#171717" },
  imageFallbackText: { color: "#fffdf8", fontWeight: 900, fontSize: 11, textAlign: "center", padding: 8 },
  cardName: { fontWeight: 900, lineHeight: 1.18, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
  cardMeta: { marginTop: 6, color: "#6b6257", fontSize: 13, lineHeight: 1.3 },
  cardArrow: { position: "absolute", right: 10, bottom: 10, width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 7, background: "#171717", color: "#fffdf8", fontWeight: 900 },
  pagination: { marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" },
  pageBtn: { border: "1px solid #d8d1c3", background: "#fffdf8", color: "#171717", borderRadius: 10, padding: "9px 14px", fontWeight: 800, cursor: "pointer" },
  pageText: { color: "#5f5a52", fontWeight: 800 },
  loading: { color: "#6b6257", fontWeight: 700 },
};
