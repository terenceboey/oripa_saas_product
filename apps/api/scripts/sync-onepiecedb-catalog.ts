import { prisma } from "../src/lib/prisma";

type OnePieceDbCard = {
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
  data?: OnePieceDbCard[];
};

type PackEntry = {
  setCode: string;
  name: string;
  logoImageUrl: string;
  releaseDate: Date | null;
  releaseType: string | null;
  packUrl: string;
};

const SOURCE = "onepiecedb";
const GAME = "ONE_PIECE";
const LANGUAGE = "en";
const API_BASE = process.env.ONEPIECEDB_API_BASE_URL ?? "https://onepiecedb.io";
const MAX_CARD_PAGES = Math.max(1, Number(process.env.ONEPIECEDB_MAX_CARD_PAGES ?? "9999"));
const MAX_PACK_PAGES = Math.max(1, Number(process.env.ONEPIECEDB_MAX_PACK_PAGES ?? "20"));
const REQUEST_DELAY_MS = Math.max(0, Number(process.env.ONEPIECEDB_REQUEST_DELAY_MS ?? "80"));

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

function setCodeFromImage(url: string | null) {
  if (!url) return null;
  const m = url.match(/\/images\/([^/]+)\//i);
  return m?.[1] ?? null;
}

function logoFromSetCode(setCode: string) {
  return `https://images.onepiecedb.io/images/${setCode}/icons/${setCode}_logo.png`;
}

function symbolFromSetCode(setCode: string) {
  return `https://images.onepiecedb.io/images/${setCode}/icons/${setCode}_symbol.png`;
}

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "oripa-saas-catalog-sync/onepiecedb-v1",
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed status=${res.status} url=${url}`);
  }

  return (await res.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "oripa-saas-catalog-sync/onepiecedb-v1",
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed status=${res.status} url=${url}`);
  }

  return await res.text();
}

function parsePackEntriesFromHtml(html: string): PackEntry[] {
  const entries: PackEntry[] = [];
  const anchorRegex = /<a href="https:\/\/onepiecedb\.io\/pack\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const packPath = decodeURIComponent(match[1] ?? "");
    const chunk = match[2] ?? "";

    const imageMatch = chunk.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
    const titleMatch = chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const typeMatch = chunk.match(/<div class="text-xs text-gray-500[\s\S]*?">\s*([\s\S]*?)\s*<\/div>/i);
    const dateMatch = chunk.match(/<span>([A-Za-z]{3} \d{1,2}, \d{4})<\/span>/i);

    const rawImage = clean(imageMatch?.[1]);
    const rawTitle = clean(titleMatch?.[1]?.replace(/<[^>]+>/g, " "));
    const rawType = clean(typeMatch?.[1]?.replace(/<[^>]+>/g, " "));
    const dateText = clean(dateMatch?.[1]);

    if (!rawImage || !rawTitle) continue;

    const derivedSetCode = setCodeFromImage(rawImage);
    if (!derivedSetCode) continue;

    entries.push({
      setCode: derivedSetCode,
      name: rawTitle,
      logoImageUrl: rawImage,
      releaseDate: parseDate(dateText),
      releaseType: rawType,
      packUrl: `https://onepiecedb.io/pack/${encodeURIComponent(packPath)}`,
    });
  }

  return entries;
}

async function fetchAllPackEntries() {
  const all = new Map<string, PackEntry>();

  for (let page = 1; page <= MAX_PACK_PAGES; page += 1) {
    const url = `${API_BASE}/packs?page=${page}`;
    const html = await fetchText(url);
    const parsed = parsePackEntriesFromHtml(html);
    if (!parsed.length) break;

    for (const entry of parsed) {
      if (!all.has(entry.setCode)) {
        all.set(entry.setCode, entry);
      }
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return all;
}

async function main() {
  const startedAt = Date.now();
  const setStats = new Map<string, { cardCount: number; name: string; releaseDate: Date | null }>();

  let page = 1;
  let totalCards = 0;
  let totalSets = 0;
  let totalSealed = 0;
  let lastPage = 1;

  const packEntries = await fetchAllPackEntries();

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

      const existingSetStats = setStats.get(setCode);
      if (existingSetStats) {
        existingSetStats.cardCount += 1;
        if (!existingSetStats.releaseDate && releaseDate) {
          existingSetStats.releaseDate = releaseDate;
        }
      } else {
        setStats.set(setCode, {
          cardCount: 1,
          name: setName,
          releaseDate,
        });
      }

      const packMeta = packEntries.get(setCode);

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
          releaseDate: packMeta?.releaseDate ?? releaseDate,
          logoImageUrl: packMeta?.logoImageUrl ?? logoFromSetCode(setCode),
          symbolImageUrl: symbolFromSetCode(setCode),
          searchText: normalizeSearch([setName, setCode, GAME, packMeta?.releaseType]),
          isActive: true,
        },
        create: {
          source: SOURCE,
          sourceSetId: setCode,
          game: GAME,
          setCode,
          name: setName,
          releaseDate: packMeta?.releaseDate ?? releaseDate,
          logoImageUrl: packMeta?.logoImageUrl ?? logoFromSetCode(setCode),
          symbolImageUrl: symbolFromSetCode(setCode),
          searchText: normalizeSearch([setName, setCode, GAME, packMeta?.releaseType]),
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

    console.log(`[onepiecedb-sync] page=${page}/${lastPage} cards=${rows.length}`);
    page += 1;
    await sleep(REQUEST_DELAY_MS);
  }

  for (const [setCode, stats] of setStats.entries()) {
    const setRecord = await prisma.catalogSet.findUnique({
      where: {
        source_sourceSetId_game: {
          source: SOURCE,
          sourceSetId: setCode,
          game: GAME,
        },
      },
      select: { id: true },
    });

    if (!setRecord) continue;

    const packMeta = packEntries.get(setCode);

    await prisma.catalogSet.update({
      where: { id: setRecord.id },
      data: {
        productCount: stats.cardCount,
        releaseDate: packMeta?.releaseDate ?? stats.releaseDate,
      },
    });

    if (packMeta) {
      await prisma.catalogSealedProduct.upsert({
        where: {
          source_sourceProductId_language_game: {
            source: SOURCE,
            sourceProductId: setCode,
            language: LANGUAGE,
            game: GAME,
          },
        },
        update: {
          catalogSetId: setRecord.id,
          name: packMeta.name,
          cleanName: packMeta.name,
          imageUrl: packMeta.logoImageUrl,
          imageCount: 1,
          isPresale: false,
          presaleReleaseDate: packMeta.releaseDate,
          searchText: normalizeSearch([packMeta.name, setCode, packMeta.releaseType, GAME]),
          isActive: true,
        },
        create: {
          source: SOURCE,
          sourceProductId: setCode,
          catalogSetId: setRecord.id,
          game: GAME,
          language: LANGUAGE,
          name: packMeta.name,
          cleanName: packMeta.name,
          imageUrl: packMeta.logoImageUrl,
          imageCount: 1,
          isPresale: false,
          presaleReleaseDate: packMeta.releaseDate,
          searchText: normalizeSearch([packMeta.name, setCode, packMeta.releaseType, GAME]),
          isActive: true,
        },
      });
      totalSealed += 1;
    }

    totalSets += 1;
  }

  const sec = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[onepiecedb-sync] done sets=${totalSets} cards=${totalCards} sealed=${totalSealed} seconds=${sec}`);
}

main()
  .catch((error) => {
    console.error("[onepiecedb-sync] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
