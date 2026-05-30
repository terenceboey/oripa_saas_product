import { prisma } from "../src/lib/prisma";

type PokemonCard = {
  id?: string;
  card_number?: string;
  name?: string;
  setCode?: string;
  setName?: string;
  number?: string;
  rarity?: string | null;
  language?: string;
  releaseDate?: string | null;
  image_url?: string | null;
  high_res_image_url?: string | null;
};

type CardsResponse = {
  current_page?: number;
  last_page?: number;
  data?: PokemonCard[];
};

const SOURCE = "pokemoncardio";
const GAME = "POKEMON";
const LANGUAGE = "en";
const API_BASE = process.env.POKEMONCARDIO_API_BASE_URL ?? "https://pokemoncard.io";
const MAX_CARD_PAGES = Math.max(1, Number(process.env.POKEMONCARDIO_MAX_CARD_PAGES ?? "9999"));
const REQUEST_DELAY_MS = Math.max(0, Number(process.env.POKEMONCARDIO_REQUEST_DELAY_MS ?? "120"));

const CF_CLEARANCE = process.env.POKEMONCARDIO_CF_CLEARANCE ?? "";
const COOKIE_HEADER = process.env.POKEMONCARDIO_COOKIE ?? "";
const USER_AGENT = process.env.POKEMONCARDIO_USER_AGENT ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

function clean(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeSearch(parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .map((x) => String(x).toLowerCase().trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value: string | null | undefined) {
  const text = clean(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCookieHeader() {
  if (COOKIE_HEADER) return COOKIE_HEADER;
  if (CF_CLEARANCE) return `cf_clearance=${CF_CLEARANCE}`;
  return "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const cookie = buildCookieHeader();
  const headers: Record<string, string> = {
    accept: "application/json, text/plain, */*",
    "user-agent": USER_AGENT,
    referer: `${API_BASE}/card-database?sort=name&sortdirection=asc`,
  };
  if (cookie) headers.cookie = cookie;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request failed status=${res.status} url=${url} body=${body.slice(0, 240)}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await res.text();
    throw new Error(`Expected JSON but got ${contentType}. url=${url} body=${body.slice(0, 240)}`);
  }

  return (await res.json()) as T;
}

async function main() {
  const startedAt = Date.now();
  const setStats = new Map<string, { cardCount: number; name: string; releaseDate: Date | null }>();

  let page = 1;
  let totalCards = 0;
  let totalSets = 0;
  let lastPage = 1;

  while (page <= lastPage && page <= MAX_CARD_PAGES) {
    const url = `${API_BASE}/api/cards/database?page=${page}&sort=name&sortdirection=asc`;
    const payload = await fetchJson<CardsResponse>(url);
    const rows = Array.isArray(payload.data) ? payload.data : [];
    lastPage = Math.max(page, Number(payload.last_page ?? page));

    for (const row of rows) {
      const sourceItemId = clean(row.card_number) ?? clean(row.id);
      const setCode = clean(row.setCode);
      const setName = clean(row.setName);
      const name = clean(row.name);
      if (!sourceItemId || !setCode || !setName || !name) continue;

      const imageThumbUrl = clean(row.image_url);
      const imageLargeUrl = clean(row.high_res_image_url) ?? imageThumbUrl;
      const releaseDate = parseDate(row.releaseDate);

      const existing = setStats.get(setCode);
      if (existing) {
        existing.cardCount += 1;
        if (!existing.releaseDate && releaseDate) existing.releaseDate = releaseDate;
      } else {
        setStats.set(setCode, { cardCount: 1, name: setName, releaseDate });
      }

      const setRecord = await prisma.catalogSet.upsert({
        where: {
          source_sourceSetId_game: {
            source: SOURCE,
            sourceSetId: setCode,
            game: GAME,
          },
        },
        update: {
          setCode,
          name: setName,
          releaseDate,
          searchText: normalizeSearch([setName, setCode, GAME]),
          isActive: true,
        },
        create: {
          source: SOURCE,
          sourceSetId: setCode,
          game: GAME,
          setCode,
          name: setName,
          releaseDate,
          searchText: normalizeSearch([setName, setCode, GAME]),
          isActive: true,
        },
      });

      await prisma.catalogItem.upsert({
        where: {
          source_sourceItemId_language: {
            source: SOURCE,
            sourceItemId,
            language: LANGUAGE,
          },
        },
        update: {
          catalogSetId: setRecord.id,
          itemType: "CARD",
          game: GAME,
          name,
          setId: setCode,
          setName,
          cardNumber: clean(row.number) ?? clean(row.card_number),
          rarity: clean(row.rarity),
          imageBaseUrl: imageLargeUrl,
          imageThumbUrl,
          imageLargeUrl,
          searchText: normalizeSearch([name, setName, setCode, clean(row.rarity), GAME]),
          isActive: true,
        },
        create: {
          source: SOURCE,
          sourceItemId,
          catalogSetId: setRecord.id,
          itemType: "CARD",
          game: GAME,
          language: LANGUAGE,
          name,
          setId: setCode,
          setName,
          cardNumber: clean(row.number) ?? clean(row.card_number),
          rarity: clean(row.rarity),
          imageBaseUrl: imageLargeUrl,
          imageThumbUrl,
          imageLargeUrl,
          searchText: normalizeSearch([name, setName, setCode, clean(row.rarity), GAME]),
          isActive: true,
        },
      });

      totalCards += 1;
    }

    console.log(`[pokemoncardio-sync] page=${page}/${lastPage} cards=${rows.length}`);
    page += 1;
    await sleep(REQUEST_DELAY_MS);
  }

  for (const [setCode, stats] of setStats.entries()) {
    await prisma.catalogSet.updateMany({
      where: { source: SOURCE, sourceSetId: setCode, game: GAME },
      data: { productCount: stats.cardCount, releaseDate: stats.releaseDate },
    });
    totalSets += 1;
  }

  const sec = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[pokemoncardio-sync] done sets=${totalSets} cards=${totalCards} seconds=${sec}`);
}

main()
  .catch((error) => {
    console.error("[pokemoncardio-sync] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
