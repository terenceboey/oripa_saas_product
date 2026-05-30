import { prisma } from "../src/lib/prisma";

type TcgTrackingSet = {
  id?: number | string;
  set_id?: number | string;
  name?: string;
  abbreviation?: string;
  is_supplemental?: boolean;
  published_on?: string;
  product_count?: number;
  set_symbol_url?: string;
};

type TcgTrackingProduct = {
  id?: number | string;
  product_id?: number | string;
  name?: string;
  clean_name?: string;
  number?: string | number | null;
  rarity?: string | null;
  image_url?: string | null;
  image_count?: number;
  is_presale?: boolean;
  presale_release_date?: string | null;
};

const SOURCE = "tcgtracking";
const LANGUAGE = "en";
const BASE_URL = process.env.TCGTRACKING_BASE_URL ?? "https://tcgtracking.com/tcgapi/v1";
const MAX_SETS_PER_GAME = Math.max(0, Number(process.env.TCGTRACKING_MAX_SETS ?? "0"));
const START_SET_INDEX = Math.max(0, Number(process.env.TCGTRACKING_START_SET_INDEX ?? "0"));
const RETRY_COUNT = Math.max(0, Number(process.env.TCGTRACKING_RETRY_COUNT ?? "2"));
const RETRY_DELAY_MS = Math.max(0, Number(process.env.TCGTRACKING_RETRY_DELAY_MS ?? "1000"));

const GAME_CONFIG = [
  { categoryId: "3", gameCode: "POKEMON" },
  { categoryId: "85", gameCode: "POKEMON_JAPAN" },
];

const GAME_BY_CATEGORY = new Map(GAME_CONFIG.map((x) => [x.categoryId, x.gameCode]));

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseDate(value: string | null | undefined): Date | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseSetId(raw: TcgTrackingSet): string | null {
  return asString(raw.id) ?? asString(raw.set_id);
}

function parseProductId(raw: TcgTrackingProduct): string | null {
  return asString(raw.id) ?? asString(raw.product_id);
}

function normalizeSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).toLowerCase().trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelySealedProduct(input: { name: string; number?: string | null; rarity?: string | null }) {
  const number = asString(input.number);
  const rarity = asString(input.rarity);
  if (number || rarity) return false;

  const name = input.name.toLowerCase();
  const sealedKeywords = [
    "booster",
    "box",
    "pack",
    "blister",
    "bundle",
    "elite trainer",
    "etb",
    "tin",
    "collection",
    "deck",
    "starter",
    "premium",
    "sleeves",
    "mini tin",
    "theme deck",
    "build & battle",
  ];
  return sealedKeywords.some((keyword) => name.includes(keyword));
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "oripa-saas-catalog-sync/2.0",
    },
  });

  if (!response.ok) {
    throw new Error(`TCGTracking request failed (${response.status}) url=${url}`);
  }

  return response.json() as Promise<unknown>;
}

async function fetchSets(categoryId: string): Promise<TcgTrackingSet[]> {
  const payload = await fetchJson(`${BASE_URL}/${categoryId}/sets`);
  if (Array.isArray(payload)) return payload as TcgTrackingSet[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { sets?: unknown }).sets)) {
    return (payload as { sets: TcgTrackingSet[] }).sets;
  }
  return [];
}

async function fetchProducts(categoryId: string, setId: string): Promise<TcgTrackingProduct[]> {
  const payload = await fetchJson(`${BASE_URL}/${categoryId}/sets/${setId}`);
  if (Array.isArray(payload)) return payload as TcgTrackingProduct[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { products?: unknown }).products)) {
    return (payload as { products: TcgTrackingProduct[] }).products;
  }
  return [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProductsWithRetry(categoryId: string, setId: string): Promise<TcgTrackingProduct[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      return await fetchProducts(categoryId, setId);
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_COUNT) break;
      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.warn(`[tcgtracking-catalog-sync] retry category=${categoryId} set=${setId} attempt=${attempt + 1}/${RETRY_COUNT} delayMs=${delay}`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function main() {
  const startedAt = Date.now();
  let totalSetsSynced = 0;
  let totalCardsUpserted = 0;
  let totalSealedUpserted = 0;
  let totalProductsScanned = 0;
  let failedSets = 0;

  const requestedCategories = String(process.env.TCGTRACKING_CATEGORY_IDS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const selectedConfigs = requestedCategories.length
    ? requestedCategories
        .map((categoryId) => ({ categoryId, gameCode: GAME_BY_CATEGORY.get(categoryId) ?? `CATEGORY_${categoryId}` }))
    : GAME_CONFIG;

  for (const gameConfig of selectedConfigs) {
    const allSets = await fetchSets(gameConfig.categoryId);
    const offsetSets = allSets.slice(START_SET_INDEX);
    const sets = MAX_SETS_PER_GAME > 0 ? offsetSets.slice(0, MAX_SETS_PER_GAME) : offsetSets;
    console.log(`[tcgtracking-catalog-sync] game=${gameConfig.gameCode} category=${gameConfig.categoryId} totalSets=${allSets.length} startIndex=${START_SET_INDEX} syncing=${sets.length}`);

    for (const rawSet of sets) {
      const sourceSetId = parseSetId(rawSet);
      const setName = asString(rawSet.name);
      if (!sourceSetId || !setName) continue;

      try {
        const catalogSet = await prisma.catalogSet.upsert({
          where: {
            source_sourceSetId_game: {
              source: SOURCE,
              sourceSetId,
              game: gameConfig.gameCode,
            },
          },
          update: {
            setCode: asString(rawSet.abbreviation),
            name: setName,
            releaseDate: parseDate(rawSet.published_on),
            productCount: rawSet.product_count ?? null,
            symbolImageUrl: asString(rawSet.set_symbol_url),
            logoImageUrl: asString(rawSet.set_symbol_url),
            isSupplemental: Boolean(rawSet.is_supplemental),
            searchText: normalizeSearchText([setName, asString(rawSet.abbreviation), gameConfig.gameCode]),
            isActive: true,
          },
          create: {
            source: SOURCE,
            sourceSetId,
            game: gameConfig.gameCode,
            setCode: asString(rawSet.abbreviation),
            name: setName,
            releaseDate: parseDate(rawSet.published_on),
            productCount: rawSet.product_count ?? null,
            symbolImageUrl: asString(rawSet.set_symbol_url),
            logoImageUrl: asString(rawSet.set_symbol_url),
            isSupplemental: Boolean(rawSet.is_supplemental),
            searchText: normalizeSearchText([setName, asString(rawSet.abbreviation), gameConfig.gameCode]),
            isActive: true,
          },
        });

        const products = await fetchProductsWithRetry(gameConfig.categoryId, sourceSetId);
        totalSetsSynced += 1;

        for (const rawProduct of products) {
          const sourceProductId = parseProductId(rawProduct);
          const name = asString(rawProduct.name) ?? asString(rawProduct.clean_name);
          if (!sourceProductId || !name) continue;

          const number = asString(rawProduct.number);
          const rarity = asString(rawProduct.rarity);
          const imageUrl = asString(rawProduct.image_url);
          const searchText = normalizeSearchText([
            name,
            asString(rawProduct.clean_name),
            catalogSet.name,
            number,
            rarity,
            gameConfig.gameCode,
          ]);

          if (isLikelySealedProduct({ name, number, rarity })) {
            await prisma.catalogSealedProduct.upsert({
              where: {
                source_sourceProductId_language_game: {
                  source: SOURCE,
                  sourceProductId,
                  language: LANGUAGE,
                  game: gameConfig.gameCode,
                },
              },
              update: {
                catalogSetId: catalogSet.id,
                name,
                cleanName: asString(rawProduct.clean_name),
                imageUrl,
                imageCount: rawProduct.image_count ?? null,
                isPresale: Boolean(rawProduct.is_presale),
                presaleReleaseDate: parseDate(rawProduct.presale_release_date),
                searchText,
                isActive: true,
              },
              create: {
                source: SOURCE,
                sourceProductId,
                catalogSetId: catalogSet.id,
                game: gameConfig.gameCode,
                language: LANGUAGE,
                name,
                cleanName: asString(rawProduct.clean_name),
                imageUrl,
                imageCount: rawProduct.image_count ?? null,
                isPresale: Boolean(rawProduct.is_presale),
                presaleReleaseDate: parseDate(rawProduct.presale_release_date),
                searchText,
                isActive: true,
              },
            });
            totalSealedUpserted += 1;
          } else {
            await prisma.catalogItem.upsert({
              where: {
                source_sourceItemId_language: {
                  source: SOURCE,
                  sourceItemId: sourceProductId,
                  language: LANGUAGE,
                },
              },
              update: {
                catalogSetId: catalogSet.id,
                itemType: "CARD",
                game: gameConfig.gameCode,
                name,
                setId: sourceSetId,
                setName: catalogSet.name,
                cardNumber: number,
                rarity,
                imageBaseUrl: imageUrl,
                imageThumbUrl: imageUrl,
                imageLargeUrl: imageUrl,
                searchText,
                isActive: true,
              },
              create: {
                source: SOURCE,
                sourceItemId: sourceProductId,
                catalogSetId: catalogSet.id,
                itemType: "CARD",
                game: gameConfig.gameCode,
                language: LANGUAGE,
                name,
                setId: sourceSetId,
                setName: catalogSet.name,
                cardNumber: number,
                rarity,
                imageBaseUrl: imageUrl,
                imageThumbUrl: imageUrl,
                imageLargeUrl: imageUrl,
                searchText,
                isActive: true,
              },
            });
            totalCardsUpserted += 1;
          }
          totalProductsScanned += 1;
        }

        console.log(`[tcgtracking-catalog-sync] game=${gameConfig.gameCode} set=${sourceSetId} products=${products.length}`);
      } catch (error) {
        failedSets += 1;
        console.error(`[tcgtracking-catalog-sync] set failed game=${gameConfig.gameCode} set=${sourceSetId}`, error);
      }
    }
  }

  const durationSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[tcgtracking-catalog-sync] completed sets=${totalSetsSynced} products=${totalProductsScanned} cardsUpserted=${totalCardsUpserted} sealedUpserted=${totalSealedUpserted} failedSets=${failedSets} duration=${durationSec}s`,
  );
}

main()
  .catch((error) => {
    console.error("[tcgtracking-catalog-sync] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
