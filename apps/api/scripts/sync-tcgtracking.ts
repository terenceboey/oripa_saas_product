import { prisma } from "../src/lib/prisma";

type TcgTrackingSet = {
  id?: number | string;
  set_id?: number | string;
  name?: string;
  set_name?: string;
  abbreviation?: string;
  set_abbr?: string;
};

type TcgTrackingProduct = {
  id?: number | string;
  product_id?: number | string;
  name?: string;
  clean_name?: string;
  set_name?: string;
  set_abbr?: string;
  number?: string | number;
  rarity?: string;
  image_url?: string;
};

const SOURCE = "tcgtracking";
const GAME = "POKEMON";
const LANGUAGE = "en";
const BASE_URL = process.env.TCGTRACKING_BASE_URL ?? "https://tcgtracking.com/tcgapi/v1";
const CATEGORY_ID = process.env.TCGTRACKING_CATEGORY_ID ?? "3"; // Pokemon
const MAX_SETS = Number(process.env.TCGTRACKING_MAX_SETS ?? "0");
const START_SET_INDEX = Math.max(0, Number(process.env.TCGTRACKING_START_SET_INDEX ?? "0"));
const CONTINUE_ON_ERROR = process.env.TCGTRACKING_CONTINUE_ON_ERROR === "true";
const RETRY_COUNT = Math.max(0, Number(process.env.TCGTRACKING_RETRY_COUNT ?? "2"));
const RETRY_DELAY_MS = Math.max(0, Number(process.env.TCGTRACKING_RETRY_DELAY_MS ?? "1000"));

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseSetId(raw: TcgTrackingSet): string | null {
  return asString(raw.id) ?? asString(raw.set_id);
}

function parseProductId(raw: TcgTrackingProduct): string | null {
  return asString(raw.id) ?? asString(raw.product_id);
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "oripa-saas-catalog-sync/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`TCGTracking request failed (${response.status}) url=${url}`);
  }

  return response.json() as Promise<unknown>;
}

async function fetchSets(): Promise<TcgTrackingSet[]> {
  const payload = await fetchJson(`${BASE_URL}/${CATEGORY_ID}/sets`);
  if (Array.isArray(payload)) return payload as TcgTrackingSet[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { sets?: unknown }).sets)) {
    return (payload as { sets: TcgTrackingSet[] }).sets;
  }
  return [];
}

async function fetchProducts(setId: string): Promise<TcgTrackingProduct[]> {
  const payload = await fetchJson(`${BASE_URL}/${CATEGORY_ID}/sets/${setId}`);
  if (Array.isArray(payload)) return payload as TcgTrackingProduct[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { products?: unknown }).products)) {
    return (payload as { products: TcgTrackingProduct[] }).products;
  }
  return [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProductsWithRetry(setId: string): Promise<TcgTrackingProduct[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      return await fetchProducts(setId);
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_COUNT) break;
      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.warn(`[tcgtracking-sync] retry set=${setId} attempt=${attempt + 1}/${RETRY_COUNT} delayMs=${delay}`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function main() {
  const startedAt = Date.now();
  const allSets = await fetchSets();
  const sets = allSets.slice(START_SET_INDEX);

  let totalSets = 0;
  let totalProducts = 0;
  let totalUpserted = 0;
  let failedSets = 0;

  console.log(
    `[tcgtracking-sync] start category=${CATEGORY_ID} totalSets=${allSets.length} startIndex=${START_SET_INDEX} maxSets=${MAX_SETS || "all"} continueOnError=${CONTINUE_ON_ERROR}`,
  );

  for (let idx = 0; idx < sets.length; idx += 1) {
    if (MAX_SETS > 0 && totalSets >= MAX_SETS) break;
    const rawSet = sets[idx];
    const setId = parseSetId(rawSet);
    if (!setId) continue;

    try {
      const products = await fetchProductsWithRetry(setId);
      totalSets += 1;

      for (const rawProduct of products) {
        const sourceItemId = parseProductId(rawProduct);
        const name = asString(rawProduct.name) ?? asString(rawProduct.clean_name);
        if (!sourceItemId || !name) continue;

        const setName = asString(rawProduct.set_name) ?? asString(rawSet.name) ?? asString(rawSet.set_name);
        const cardNumber = asString(rawProduct.number);
        const rarity = asString(rawProduct.rarity);
        const image = asString(rawProduct.image_url);

        const searchText = [name, setName ?? "", cardNumber ?? "", rarity ?? "", "pokemon", "card"]
          .join(" ")
          .toLowerCase()
          .trim();

        await prisma.catalogItem.upsert({
          where: {
            source_sourceItemId_language: {
              source: SOURCE,
              sourceItemId,
              language: LANGUAGE,
            },
          },
          update: {
            itemType: "CARD",
            game: GAME,
            name,
            setId,
            setName,
            cardNumber,
            rarity,
            imageBaseUrl: image,
            imageThumbUrl: image,
            imageLargeUrl: image,
            searchText,
            isActive: true,
          },
          create: {
            source: SOURCE,
            sourceItemId,
            itemType: "CARD",
            game: GAME,
            language: LANGUAGE,
            name,
            setId,
            setName,
            cardNumber,
            rarity,
            imageBaseUrl: image,
            imageThumbUrl: image,
            imageLargeUrl: image,
            searchText,
            isActive: true,
          },
        });

        totalProducts += 1;
        totalUpserted += 1;
      }

      const absoluteSetIndex = START_SET_INDEX + idx;
      console.log(
        `[tcgtracking-sync] set=${setId} products=${products.length} scannedSets=${totalSets} absoluteSetIndex=${absoluteSetIndex}`,
      );
    } catch (error) {
      failedSets += 1;
      const absoluteSetIndex = START_SET_INDEX + idx;
      console.error(`[tcgtracking-sync] set failed setId=${setId} absoluteSetIndex=${absoluteSetIndex}`, error);
      if (!CONTINUE_ON_ERROR) {
        throw error;
      }
    }
  }

  const durationSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[tcgtracking-sync] completed sets=${totalSets} products=${totalProducts} upserted=${totalUpserted} failedSets=${failedSets} duration=${durationSec}s`,
  );
}

main()
  .catch((error) => {
    console.error("[tcgtracking-sync] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
