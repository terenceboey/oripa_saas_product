import { prisma } from "../src/lib/prisma";
import { CatalogItemProjection, normalizeTcgdexCardForCatalog, TcgdexCard } from "../src/modules/catalog/tcgdex-normalizer";

const BASE_URL = process.env.TCGDEX_BASE_URL ?? "https://api.tcgdex.net/v2";
const LANGUAGE = process.env.TCGDEX_LANGUAGE ?? "en";
const GAME = process.env.TCGDEX_GAME ?? "POKEMON";
const MAX_SETS = Math.max(0, Number(process.env.TCGDEX_MAX_SETS ?? "1"));
const MAX_CARDS = Math.max(0, Number(process.env.TCGDEX_MAX_CARDS ?? "0"));
const START_SET_INDEX = Math.max(0, Number(process.env.TCGDEX_START_SET_INDEX ?? "0"));
const DRY_RUN = process.env.TCGDEX_DRY_RUN !== "false";
const CONTINUE_ON_ERROR = process.env.TCGDEX_CONTINUE_ON_ERROR === "true";
const RETRY_COUNT = Math.max(0, Number(process.env.TCGDEX_RETRY_COUNT ?? "2"));
const RETRY_DELAY_MS = Math.max(0, Number(process.env.TCGDEX_RETRY_DELAY_MS ?? "1000"));
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.TCGDEX_REQUEST_TIMEOUT_MS ?? "15000"));
const FETCH_FULL_CARDS = process.env.TCGDEX_FETCH_FULL_CARDS === "true";
const ALLOW_LIVE_WRITE = process.env.TCGDEX_ALLOW_LIVE_WRITE === "true";

type TcgdexSetResume = {
  id?: unknown;
  name?: unknown;
};

type TcgdexSet = TcgdexSetResume & {
  cards?: TcgdexCard[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asNonEmptyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function isLiveRenderDatabase() {
  return /render\.com/i.test(process.env.DATABASE_URL ?? "");
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE_URL}/${LANGUAGE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "oripa-saas-tcgdex-sync/1.0",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`TCGdex request failed status=${response.status} url=${url}`);
  }

  return response.json() as Promise<T>;
}

async function fetchJsonWithRetry<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      return await fetchJson<T>(path);
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_COUNT) break;
      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.warn(`[tcgdex-sync] retry path=${path} attempt=${attempt + 1}/${RETRY_COUNT} delayMs=${delay}`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function fetchSets(): Promise<TcgdexSetResume[]> {
  const payload = await fetchJsonWithRetry<unknown>("/sets");
  return Array.isArray(payload) ? (payload as TcgdexSetResume[]) : [];
}

async function fetchSet(setId: string): Promise<TcgdexSet> {
  return fetchJsonWithRetry<TcgdexSet>(`/sets/${encodeURIComponent(setId)}`);
}

async function fetchCard(cardId: string): Promise<TcgdexCard> {
  return fetchJsonWithRetry<TcgdexCard>(`/cards/${encodeURIComponent(cardId)}`);
}

async function upsertCatalogItem(row: CatalogItemProjection) {
  await prisma.catalogItem.upsert({
    where: {
      source_sourceItemId_language: {
        source: row.source,
        sourceItemId: row.sourceItemId,
        language: row.language,
      },
    },
    update: {
      localId: row.localId,
      itemType: row.itemType,
      game: row.game,
      name: row.name,
      setId: row.setId,
      setName: row.setName,
      cardNumber: row.cardNumber,
      rarity: row.rarity,
      imageBaseUrl: row.imageBaseUrl,
      imageThumbUrl: row.imageThumbUrl,
      imageLargeUrl: row.imageLargeUrl,
      searchText: row.searchText,
      sourcePayload: row.sourcePayload,
      isActive: true,
    },
    create: row,
  });
}

async function main() {
  const startedAt = Date.now();

  if (!DRY_RUN && isLiveRenderDatabase() && !ALLOW_LIVE_WRITE) {
    throw new Error(
      "Refusing to write TCGdex catalog rows to a Render DATABASE_URL without TCGDEX_ALLOW_LIVE_WRITE=true. Use dry-run first or point DATABASE_URL at staging/local.",
    );
  }

  const allSets = await fetchSets();
  const selectedSets = allSets.slice(START_SET_INDEX, MAX_SETS > 0 ? START_SET_INDEX + MAX_SETS : undefined);

  let scannedSets = 0;
  let scannedCards = 0;
  let normalizedCards = 0;
  let upsertedCards = 0;
  let failedSets = 0;
  let failedCards = 0;

  console.log(
    `[tcgdex-sync] start language=${LANGUAGE} game=${GAME} dryRun=${DRY_RUN} fetchFullCards=${FETCH_FULL_CARDS} totalSets=${allSets.length} startSetIndex=${START_SET_INDEX} maxSets=${MAX_SETS || "all"} maxCards=${MAX_CARDS || "all"}`,
  );

  for (const setResume of selectedSets) {
    if (MAX_CARDS > 0 && scannedCards >= MAX_CARDS) break;

    const setId = asNonEmptyString(setResume.id);
    if (!setId) continue;

    try {
      const set = await fetchSet(setId);
      const cardRefs = Array.isArray(set.cards) ? set.cards : [];
      scannedSets += 1;
      console.log(`[tcgdex-sync] set=${setId} cards=${cardRefs.length}`);

      for (const cardRef of cardRefs) {
        if (MAX_CARDS > 0 && scannedCards >= MAX_CARDS) break;
        const cardId = asNonEmptyString(cardRef.id);
        if (!cardId) continue;

        try {
          const card = FETCH_FULL_CARDS
            ? await fetchCard(cardId)
            : {
                ...cardRef,
                set: {
                  id: setId,
                  name: asNonEmptyString(set.name) ?? asNonEmptyString(setResume.name),
                },
              };
          scannedCards += 1;
          const row = normalizeTcgdexCardForCatalog(card, { language: LANGUAGE, game: GAME });
          if (!row) continue;
          normalizedCards += 1;

          if (DRY_RUN) {
            if (normalizedCards <= 5) {
              console.log(`[tcgdex-sync] dry-run sample ${JSON.stringify({
                source: row.source,
                sourceItemId: row.sourceItemId,
                name: row.name,
                setId: row.setId,
                setName: row.setName,
                cardNumber: row.cardNumber,
                rarity: row.rarity,
                imageThumbUrl: row.imageThumbUrl,
              })}`);
            }
          } else {
            await upsertCatalogItem(row);
            upsertedCards += 1;
          }
        } catch (error) {
          failedCards += 1;
          console.error(`[tcgdex-sync] card failed cardId=${cardId}`, error);
          if (!CONTINUE_ON_ERROR) throw error;
        }
      }
    } catch (error) {
      failedSets += 1;
      console.error(`[tcgdex-sync] set failed setId=${setId}`, error);
      if (!CONTINUE_ON_ERROR) throw error;
    }
  }

  const durationSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[tcgdex-sync] completed dryRun=${DRY_RUN} sets=${scannedSets} cards=${scannedCards} normalized=${normalizedCards} upserted=${upsertedCards} failedSets=${failedSets} failedCards=${failedCards} duration=${durationSec}s`,
  );
}

main()
  .catch((error) => {
    console.error("[tcgdex-sync] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
