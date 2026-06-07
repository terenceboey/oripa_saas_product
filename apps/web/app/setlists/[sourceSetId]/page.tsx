"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type SetInfo = {
  sourceSetId: string;
  name: string;
  setCode?: string | null;
  game: string;
  releaseDate?: string | null;
  symbolImageUrl?: string | null;
  logoImageUrl?: string | null;
  bannerImageUrl?: string | null;
};

type SetCard = {
  id: string;
  name: string;
  cardNumber?: string | null;
  rarity?: string | null;
  imageThumbUrl?: string | null;
  imageLargeUrl?: string | null;
  imageBaseUrl?: string | null;
};

type CardResponse = {
  set: SetInfo;
  page: number;
  total: number;
  totalPages: number;
  limit: number;
  rarities: string[];
  items: SetCard[];
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 24;

export default function SetlistDetailPage() {
  const params = useParams<{ sourceSetId: string }>();
  const searchParams = useSearchParams();
  const sourceSetId = String(params?.sourceSetId ?? "");
  const game = (searchParams.get("game") || "pokemon").toLowerCase();
  const source = (searchParams.get("source") || "").trim().toLowerCase();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CardResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, rarity, sourceSetId, game]);

  useEffect(() => {
    if (!sourceSetId) return;
    let active = true;
    setLoading(true);
    setFetchError(null);
    const url = new URL(`${apiBase}/v1/public/setlists/${sourceSetId}/cards`);
    url.searchParams.set("game", game);
    if (source) url.searchParams.set("source", source);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (query.trim()) url.searchParams.set("q", query.trim());
    if (rarity.trim()) url.searchParams.set("rarity", rarity.trim());

    fetch(url.toString(), { cache: "no-store" })
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(payload?.error ?? "Failed to load set cards");
        }
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setData(null);
        setFetchError(error instanceof Error ? error.message : "Failed to load set cards");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [game, source, page, query, rarity, sourceSetId]);

  const currentPage = Math.max(1, Math.min(page, data?.totalPages ?? 1));
  const setInfo = data?.set;
  const cards = data?.items ?? [];
  const pageTitle = setInfo?.name ?? "Set";

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href={`/setlists?game=${game}${source ? `&source=${source}` : ""}`} style={styles.backLink}>
          {"<- All Sets"}
        </Link>

        <section style={styles.setHeader}>
          <div style={styles.logoBox}>
            <SetHeaderImage set={setInfo} title={pageTitle} />
          </div>
          <div>
            <h1 style={styles.setTitle}>{pageTitle}</h1>
            <div style={styles.statsRow}>
              <span style={styles.pillPrimary}>{data?.total ?? 0} cards</span>
              <span style={styles.pillNeutral}>{setInfo?.releaseDate ? new Date(setInfo.releaseDate).toLocaleDateString() : "Unknown date"}</span>
            </div>
            <p style={styles.muted}>Click any card to view details and pricing (later module).</p>
          </div>
        </section>

        <section style={styles.filterBar}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards..." style={styles.input} />
          <select value={rarity} onChange={(e) => setRarity(e.target.value)} style={styles.inputSmall}>
            <option value="">All Rarities</option>
            {(data?.rarities ?? []).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div style={styles.pageCtrls}>
            <button type="button" style={styles.pageBtn} disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {"<"}
            </button>
            <span style={styles.pageInfo}>
              {currentPage} / {Math.max(1, data?.totalPages ?? 1)}
            </span>
            <button
              type="button"
              style={styles.pageBtn}
              disabled={currentPage >= Math.max(1, data?.totalPages ?? 1)}
              onClick={() => setPage((p) => Math.min(Math.max(1, data?.totalPages ?? 1), p + 1))}
            >
              {">"}
            </button>
          </div>
        </section>

        {loading ? <p style={styles.loading}>Loading cards...</p> : null}
        {fetchError ? <p style={styles.loading}>{fetchError}</p> : null}
        <section style={styles.grid}>
          {cards.map((card) => (
            <article key={card.id} style={styles.card}>
              <img src={card.imageLargeUrl || card.imageThumbUrl || card.imageBaseUrl || "/default-pack-banner-desktop.webp"} alt={card.name} style={styles.cardImage} />
              <div style={styles.cardBody}>
                <div style={styles.cardName}>{card.name}</div>
                <div style={styles.cardMeta}>
                  {card.cardNumber ? `#${card.cardNumber}` : "No number"}
                  {card.rarity ? ` | ${card.rarity}` : ""}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function setImageForHeader(set?: SetInfo | null) {
  return set?.bannerImageUrl || set?.logoImageUrl || set?.symbolImageUrl || null;
}

function SetHeaderImage({ set, title }: { set?: SetInfo | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : setImageForHeader(set);
  if (!src) {
    return <div style={styles.logoFallback}>{set?.setCode || title.slice(0, 3).toUpperCase()}</div>;
  }
  return <img src={src} alt={title} style={styles.logo} onError={() => setFailed(true)} />;
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#f3f0ff 0%, #edf6ff 45%, #f9fcff 100%)",
    color: "#2c2450",
    padding: "18px 14px 28px",
  },
  container: { maxWidth: 1320, margin: "0 auto" },
  backLink: { color: "#7668a3", textDecoration: "none", fontWeight: 700 },
  setHeader: {
    marginTop: 12,
    border: "1px solid #d8d0ec",
    borderRadius: 16,
    padding: 16,
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 16,
    alignItems: "center",
    background: "linear-gradient(120deg, rgba(159,144,255,.20), rgba(116,200,255,.18))",
    boxShadow: "0 12px 24px rgba(86,58,170,.12)",
  },
  logoBox: { width: 100, height: 100, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(255,255,255,.6)", border: "1px solid #e3dcf4" },
  logo: { width: 92, height: 92, objectFit: "contain" },
  logoFallback: { width: 92, height: 92, borderRadius: 10, display: "grid", placeItems: "center", background: "#f7f6ff", border: "1px dashed #d8d0ec", color: "#6b5f95", fontWeight: 900, fontSize: 18, letterSpacing: ".06em" },
  setTitle: { margin: 0, fontSize: "clamp(30px,4.2vw,44px)", lineHeight: 1.05 },
  statsRow: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  pillPrimary: { padding: "5px 10px", borderRadius: 8, background: "linear-gradient(135deg,#9f90ff,#74c8ff)", color: "#1c1340", fontWeight: 800, fontSize: 12 },
  pillNeutral: { padding: "5px 10px", borderRadius: 8, border: "1px solid #d8d0ec", background: "#fff", color: "#665a92", fontWeight: 700, fontSize: 12 },
  muted: { marginTop: 8, color: "#7568a2" },
  filterBar: {
    marginTop: 14,
    border: "1px solid #d8d0ec",
    borderRadius: 14,
    background: "#ffffffcc",
    padding: 10,
    display: "grid",
    gridTemplateColumns: "minmax(160px,1fr) minmax(170px,220px) 130px",
    gap: 10,
    alignItems: "center",
  },
  input: { background: "#fff", border: "1px solid #d8d0ec", color: "#2f2455", borderRadius: 10, padding: "10px 12px" },
  inputSmall: { background: "#fff", border: "1px solid #d8d0ec", color: "#2f2455", borderRadius: 10, padding: "10px 12px" },
  pageCtrls: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 },
  pageBtn: { border: "1px solid #d8d0ec", background: "#fff", color: "#483c71", borderRadius: 8, width: 36, height: 36, fontSize: 18, cursor: "pointer" },
  pageInfo: { color: "#70639d", fontWeight: 700, fontSize: 13 },
  loading: { marginTop: 12, color: "#7568a2", fontWeight: 700 },
  grid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 8 },
  card: { border: "1px solid #d8d0ec", borderRadius: 12, padding: 7, background: "#ffffffdd", boxShadow: "0 8px 18px rgba(80,59,150,.08)" },
  cardImage: { width: "100%", aspectRatio: "63/88", objectFit: "cover", borderRadius: 8, border: "1px solid #ebe5f8" },
  cardBody: { marginTop: 8 },
  cardName: { fontWeight: 800, lineHeight: 1.2, minHeight: 38 },
  cardMeta: { color: "#70639d", fontSize: 13, marginTop: 4 },
};

