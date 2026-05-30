import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import {
  mergeNormalizeStats,
  normalizeTcgtrackingProductForCatalog,
  type CatalogItemProjection,
  type NormalizeStats,
  type TcgTrackingProduct,
  type TcgTrackingSetContext,
} from "../src/modules/catalog/tcgtracking-normalizer";

type TcgTrackingSet = TcgTrackingSetContext & {
  id?: number | string;
  set_id?: number | string;
  name?: string;
  set_name?: string;
  abbreviation?: string;
  set_abbr?: string;
};

export type RuntimeConfig = {
  baseUrl: string;
  categoryId: string;
  dryRun: boolean;
  allowLiveWrite: boolean;
  dbEnv: "local" | "staging" | "production";
  language: string;
  game: string;
  maxSets: number;
  maxCards: number;
  startSetIndex: number;
  continueOnError: boolean;
  retryCount: number;
  retryDelayMs: number;
  requestTimeoutMs: number;
  fetchFullCards: boolean;
  allowFixtureFallback: boolean;
  databaseUrl: string | null;
};

type SmokeInput = {
  status: number;
  contentType: string | null;
  url: string;
  payload: unknown;
};

type SmokeResult = {
  ok: true;
  productCount: number;
};

const ALLOWED_DB_ENVS = new Set(["local", "staging", "production"]);

type ApprovedTcgtrackingCategory = {
  categoryId: string;
  game: string;
  language: string;
  label: string;
};

export const APPROVED_TCGTRACKING_CATEGORIES: Record<string, ApprovedTcgtrackingCategory> = {
  "1": { categoryId: "1", game: "MAGIC", language: "en", label: "Magic: The Gathering" },
  "2": { categoryId: "2", game: "YUGIOH", language: "en", label: "Yu-Gi-Oh!" },
  "3": { categoryId: "3", game: "POKEMON", language: "en", label: "Pokémon EN" },
  "16": { categoryId: "16", game: "CARDFIGHT_VANGUARD", language: "en", label: "Cardfight!! Vanguard" },
  "17": { categoryId: "17", game: "FORCE_OF_WILL", language: "en", label: "Force of Will" },
  "20": { categoryId: "20", game: "WEISS_SCHWARZ", language: "en", label: "Weiss Schwarz" },
  "24": { categoryId: "24", game: "FINAL_FANTASY", language: "en", label: "Final Fantasy TCG" },
  "25": { categoryId: "25", game: "UNIVERSUS", language: "en", label: "UniVersus" },
  "27": { categoryId: "27", game: "DRAGON_BALL_SUPER", language: "en", label: "Dragon Ball Super" },
  "62": { categoryId: "62", game: "FLESH_AND_BLOOD", language: "en", label: "Flesh and Blood" },
  "63": { categoryId: "63", game: "DIGIMON", language: "en", label: "Digimon Card Game" },
  "66": { categoryId: "66", game: "METAZOO", language: "en", label: "MetaZoo" },
  "67": { categoryId: "67", game: "WIXOSS", language: "en", label: "WIXOSS" },
  "68": { categoryId: "68", game: "ONE_PIECE", language: "en", label: "One Piece Card Game" },
  "71": { categoryId: "71", game: "LORCANA", language: "en", label: "Disney Lorcana" },
  "72": { categoryId: "72", game: "BATTLE_SPIRITS_SAGA", language: "en", label: "Battle Spirits Saga" },
  "73": { categoryId: "73", game: "SHADOWVERSE_EVOLVE", language: "en", label: "Shadowverse Evolve" },
  "74": { categoryId: "74", game: "GRAND_ARCHIVE", language: "en", label: "Grand Archive" },
  "75": { categoryId: "75", game: "AKORA", language: "en", label: "Akora" },
  "76": { categoryId: "76", game: "KRYPTIK", language: "en", label: "Kryptik TCG" },
  "77": { categoryId: "77", game: "SORCERY_CONTESTED_REALM", language: "en", label: "Sorcery: Contested Realm" },
  "78": { categoryId: "78", game: "ALPHA_CLASH", language: "en", label: "Alpha Clash" },
  "79": { categoryId: "79", game: "STAR_WARS_UNLIMITED", language: "en", label: "Star Wars Unlimited" },
  "80": { categoryId: "80", game: "DRAGON_BALL_SUPER_FUSION_WORLD", language: "en", label: "Dragon Ball Super Fusion World" },
  "81": { categoryId: "81", game: "UNION_ARENA", language: "en", label: "Union Arena" },
  "83": { categoryId: "83", game: "ELESTRALS", language: "en", label: "Elestrals" },
  "85": { categoryId: "85", game: "POKEMON", language: "ja", label: "Pokémon Japan" },
  "86": { categoryId: "86", game: "GUNDAM", language: "en", label: "Gundam Card Game" },
  "87": { categoryId: "87", game: "HOLOLIVE", language: "en", label: "hololive OFFICIAL CARD GAME" },
  "88": { categoryId: "88", game: "GODZILLA", language: "en", label: "Godzilla Card Game" },
  "89": { categoryId: "89", game: "RIFTBOUND", language: "en", label: "Riftbound: League of Legends TCG" },
};

export function getApprovedTcgtrackingCategory(categoryId: string): ApprovedTcgtrackingCategory {
  const category = APPROVED_TCGTRACKING_CATEGORIES[categoryId];
  if (!category) {
    throw new Error(`Unsupported TCGTracking category ${categoryId}; add it to APPROVED_TCGTRACKING_CATEGORIES after source/key/language review.`);
  }
  return category;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseSetId(raw: TcgTrackingSet): string | null {
  return asString(raw.id) ?? asString(raw.set_id);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function parseIntOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRenderUrl(url: string | null): boolean {
  return Boolean(url && /render\.com/i.test(url));
}

export function buildRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  const dryRun = parseBoolean(env.TCGTRACKING_DRY_RUN, true);
  const dbEnvRaw = asString(env.TCGTRACKING_DB_ENV) ?? "local";
  if (!ALLOWED_DB_ENVS.has(dbEnvRaw)) {
    throw new Error(`Invalid TCGTRACKING_DB_ENV=${dbEnvRaw}; expected local|staging|production`);
  }
  const dbEnv = dbEnvRaw as RuntimeConfig["dbEnv"];
  const categoryId = asString(env.TCGTRACKING_CATEGORY_ID) ?? "3";
  const category = getApprovedTcgtrackingCategory(categoryId);

  const config: RuntimeConfig = {
    baseUrl: asString(env.TCGTRACKING_BASE_URL) ?? "https://tcgtracking.com/tcgapi/v1",
    categoryId,
    dryRun,
    allowLiveWrite: parseBoolean(env.TCGTRACKING_ALLOW_LIVE_WRITE, false),
    dbEnv,
    language: asString(env.TCGTRACKING_LANGUAGE) ?? category.language,
    game: asString(env.TCGTRACKING_GAME) ?? category.game,
    maxSets: Math.max(0, parseIntOr(env.TCGTRACKING_MAX_SETS, 0)),
    maxCards: Math.max(0, parseIntOr(env.TCGTRACKING_MAX_CARDS, 0)),
    startSetIndex: Math.max(0, parseIntOr(env.TCGTRACKING_START_SET_INDEX, 0)),
    continueOnError: parseBoolean(env.TCGTRACKING_CONTINUE_ON_ERROR, false),
    retryCount: Math.max(0, parseIntOr(env.TCGTRACKING_RETRY_COUNT, 2)),
    retryDelayMs: Math.max(0, parseIntOr(env.TCGTRACKING_RETRY_DELAY_MS, 1000)),
    requestTimeoutMs: Math.max(1000, parseIntOr(env.TCGTRACKING_REQUEST_TIMEOUT_MS, 15000)),
    fetchFullCards: parseBoolean(env.TCGTRACKING_FETCH_FULL_CARDS, false),
    allowFixtureFallback: parseBoolean(env.TCGTRACKING_ALLOW_FIXTURE_FALLBACK, false),
    databaseUrl: asString(env.DATABASE_URL),
  };

  if (!dryRun && !env.TCGTRACKING_DB_ENV) {
    throw new Error("TCGTRACKING_DB_ENV must be explicitly set for non-dry-run execution.");
  }

  if (isRenderUrl(config.databaseUrl) && config.dbEnv === "local") {
    throw new Error("Render DATABASE_URL cannot be used with TCGTRACKING_DB_ENV=local. Set staging or production explicitly.");
  }

  return config;
}

export function ensureWriteAllowed(config: RuntimeConfig) {
  if (config.dryRun) return;
  if (config.dbEnv === "production" && !config.allowLiveWrite) {
    throw new Error("Refusing production write: set TCGTRACKING_ALLOW_LIVE_WRITE=true with TCGTRACKING_DB_ENV=production.");
  }
}

function looksCloudflareOrHtml(input: SmokeInput): boolean {
  const contentType = (input.contentType ?? "").toLowerCase();
  if (contentType.includes("text/html")) return true;
  const text = typeof input.payload === "string" ? input.payload.toLowerCase() : "";
  return text.includes("cloudflare") || text.includes("<html");
}

export function validateSmokePayload(input: SmokeInput, config: RuntimeConfig): SmokeResult {
  if (input.status < 200 || input.status >= 300) {
    throw new Error(`Smoke check failed status=${input.status} url=${input.url}`);
  }
  const contentType = (input.contentType ?? "").toLowerCase();
  if (!contentType.includes("application/json") || looksCloudflareOrHtml(input)) {
    throw new Error(`Smoke check failed: non-JSON/Cloudflare/html response url=${input.url} contentType=${input.contentType}`);
  }

  const payload = input.payload;
  let count = 0;
  if (Array.isArray(payload)) count = payload.length;
  else if (payload && typeof payload === "object" && Array.isArray((payload as { sets?: unknown[] }).sets)) {
    count = (payload as { sets: unknown[] }).sets.length;
  } else if (payload && typeof payload === "object" && Array.isArray((payload as { products?: unknown[] }).products)) {
    count = (payload as { products: unknown[] }).products.length;
  }

  if (count <= 0) {
    throw new Error(`Smoke check failed: empty or missing expected keys url=${input.url}`);
  }

  console.log(
    `[tcgtracking-sync] smoke ok dbEnv=${config.dbEnv} status=${input.status} contentType=${input.contentType} url=${input.url} category=${config.categoryId} productCount=${count}`,
  );
  return { ok: true, productCount: count };
}

export function buildSyncSummaryLine(input: {
  sets: number;
  cards: number;
  normalized: number;
  upserted: number;
  failures: number;
  durationSec: number;
}): string {
  return `[tcgtracking-sync] completed sets=${input.sets} cards=${input.cards} normalized=${input.normalized} upserted=${input.upserted} failures=${input.failures} duration=${input.durationSec}s`;
}

function fixtureDir() {
  return path.resolve(__dirname, "../src/modules/catalog/fixtures/tcgtracking/category-3");
}

function readFixtureJson<T>(filename: string): T {
  const filePath = path.join(fixtureDir(), filename);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function loadFixtureSets(): TcgTrackingSet[] {
  const payload = readFixtureJson<unknown>("3_sets.json");
  if (Array.isArray(payload)) return payload as TcgTrackingSet[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { sets?: unknown }).sets)) {
    return (payload as { sets: TcgTrackingSet[] }).sets;
  }
  return [];
}

function loadFixtureSetProducts(setId: string): TcgTrackingProduct[] {
  const payload = readFixtureJson<{ products?: unknown[] }>(`3_sets_${setId}.json`);
  return Array.isArray(payload.products) ? (payload.products as TcgTrackingProduct[]) : [];
}

async function fetchJson(url: string, config: RuntimeConfig) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const response = await fetch(url, {
    signal: controller.signal,
    headers: { accept: "application/json", "user-agent": "oripa-saas-catalog-sync/1.0" },
  }).finally(() => clearTimeout(timeout));

  const contentType = response.headers.get("content-type");
  const raw = await response.text();
  let payload: unknown = raw;
  try {
    payload = raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    payload = raw;
  }

  return { status: response.status, contentType, payload, url };
}

function shouldUseLocalFixtureFallback(config: RuntimeConfig): boolean {
  return config.dbEnv === "local" && config.allowFixtureFallback;
}

async function fetchSets(config: RuntimeConfig): Promise<TcgTrackingSet[]> {
  try {
    const result = await fetchJson(`${config.baseUrl}/${config.categoryId}/sets`, config);
    validateSmokePayload(result, config);
    const { payload } = result;
    if (Array.isArray(payload)) return payload as TcgTrackingSet[];
    if (payload && typeof payload === "object" && Array.isArray((payload as { sets?: unknown }).sets)) {
      return (payload as { sets: TcgTrackingSet[] }).sets;
    }
    return [];
  } catch (error) {
    if (shouldUseLocalFixtureFallback(config)) {
      console.warn(`[tcgtracking-sync] set list fallback to fixtures (NON-AUTHORITATIVE local test mode) due to fetch failure: ${String(error)}`);
      return loadFixtureSets();
    }
    throw error;
  }
}

async function fetchProducts(setId: string, config: RuntimeConfig): Promise<TcgTrackingProduct[]> {
  try {
    const result = await fetchJson(`${config.baseUrl}/${config.categoryId}/sets/${setId}`, config);
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`TCGTracking request failed (${result.status}) url=${result.url}`);
    }
    if (looksCloudflareOrHtml(result)) {
      throw new Error(`TCGTracking request failed: Cloudflare/HTML response url=${result.url}`);
    }

    if (Array.isArray(result.payload)) return result.payload as TcgTrackingProduct[];
    if (result.payload && typeof result.payload === "object" && Array.isArray((result.payload as { products?: unknown }).products)) {
      return (result.payload as { products: TcgTrackingProduct[] }).products;
    }
    return [];
  } catch (error) {
    if (shouldUseLocalFixtureFallback(config)) {
      console.warn(`[tcgtracking-sync] set=${setId} fallback to fixtures (NON-AUTHORITATIVE local test mode) due to fetch failure: ${String(error)}`);
      return loadFixtureSetProducts(setId);
    }
    throw error;
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProductsWithRetry(setId: string, config: RuntimeConfig): Promise<TcgTrackingProduct[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.retryCount; attempt += 1) {
    try {
      return await fetchProducts(setId, config);
    } catch (error) {
      lastError = error;
      if (attempt >= config.retryCount) break;
      const delay = config.retryDelayMs * (attempt + 1);
      console.warn(`[tcgtracking-sync] retry set=${setId} attempt=${attempt + 1}/${config.retryCount} delayMs=${delay}`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function upsertRow(row: CatalogItemProjection) {
  await prisma.catalogItem.upsert({
    where: {
      source_sourceItemId_language: {
        source: row.source,
        sourceItemId: row.sourceItemId,
        language: row.language,
      },
    },
    update: row,
    create: row,
  });
}

async function runSourceSmokeIfNeeded(config: RuntimeConfig, setId: string) {
  if (config.dryRun || shouldUseLocalFixtureFallback(config)) return;
  const smoke = await fetchJson(`${config.baseUrl}/${config.categoryId}/sets/${setId}`, config);
  const smokeResult = validateSmokePayload(smoke, config);
  console.log(`[tcgtracking-sync] source smoke productCount=${smokeResult.productCount} set=${setId}`);
}

export async function runSync(config: RuntimeConfig): Promise<void> {
  ensureWriteAllowed(config);

  const startedAt = Date.now();
  const allSets = await fetchSets(config);
  const sets = allSets.slice(config.startSetIndex);

  let totalSets = 0;
  let totalCards = 0;
  let totalNormalized = 0;
  let totalUpserted = 0;
  let failures = 0;
  const statsBag: NormalizeStats[] = [];
  const seenSourceKeys = new Set<string>();
  let duplicateSourceKeyCount = 0;
  let missingImageCount = 0;
  let dryRunSamples = 0;

  console.log(
    `[tcgtracking-sync] start dbEnv=${config.dbEnv} category=${config.categoryId} dryRun=${config.dryRun} language=${config.language} game=${config.game} totalSets=${allSets.length} startIndex=${config.startSetIndex} maxSets=${config.maxSets || "all"} maxCards=${config.maxCards || "all"} allowFixtureFallback=${config.allowFixtureFallback}`,
  );

  for (let idx = 0; idx < sets.length; idx += 1) {
    if (config.maxSets > 0 && totalSets >= config.maxSets) break;
    const rawSet = sets[idx];
    const setId = parseSetId(rawSet);
    if (!setId) continue;

    try {
      await runSourceSmokeIfNeeded(config, setId);
      const products = await fetchProductsWithRetry(setId, config);
      totalSets += 1;
      console.log(`[tcgtracking-sync] set-progress set=${setId} index=${config.startSetIndex + idx} products=${products.length}`);

      for (const product of products) {
        if (config.maxCards > 0 && totalCards >= config.maxCards) break;
        totalCards += 1;

        const normalized = normalizeTcgtrackingProductForCatalog(product, {
          language: config.language,
          game: config.game,
          categoryId: config.categoryId,
          set: rawSet,
          sourceContext: { importer: "sync-tcgtracking", dbEnv: config.dbEnv },
        });
        statsBag.push(normalized.stats);

        if (!normalized.row) {
          console.warn(
            `[tcgtracking-sync] skip set=${setId} productId=${asString((product as { id?: unknown }).id) ?? "unknown"} reason=${normalized.skippedReason ?? "unknown"}`,
          );
          continue;
        }

        totalNormalized += 1;

        const dedupeKey = `${normalized.row.source}|${normalized.row.sourceItemId}|${normalized.row.language}`;
        if (seenSourceKeys.has(dedupeKey)) {
          duplicateSourceKeyCount += 1;
        } else {
          seenSourceKeys.add(dedupeKey);
        }
        if (!normalized.row.imageLargeUrl && !normalized.row.imageThumbUrl) {
          missingImageCount += 1;
        }

        if (config.dryRun) {
          if (dryRunSamples < 5) {
            dryRunSamples += 1;
            console.log(
              `[tcgtracking-sync] dry-run sample ${dryRunSamples}/5 sourceItemId=${normalized.row.sourceItemId} name=${normalized.row.name} setId=${normalized.row.setId ?? "null"} localId=${normalized.row.localId ?? "null"}`,
            );
          }
          continue;
        }

        await upsertRow(normalized.row);
        totalUpserted += 1;
      }
    } catch (error) {
      failures += 1;
      console.error(`[tcgtracking-sync] set failed setId=${setId}`, error);
      if (!config.continueOnError) throw error;
    }
  }

  const merged = mergeNormalizeStats(statsBag);
  const durationSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[tcgtracking-sync] normalize-stats missing_id=${merged.missing_id} missing_name=${merged.missing_name} missing_image=${merged.missing_image} missing_set_metadata=${merged.missing_set_metadata} non_card_product=${merged.non_card_product} rows_written=${merged.rows_written} rows_skipped=${merged.rows_skipped}`,
  );
  console.log(
    `[tcgtracking-sync] quality-check duplicate_source_keys=${duplicateSourceKeyCount} missing_image_rows=${missingImageCount}`,
  );
  console.log(
    buildSyncSummaryLine({
      sets: totalSets,
      cards: totalCards,
      normalized: totalNormalized,
      upserted: config.dryRun ? 0 : totalUpserted,
      failures,
      durationSec,
    }),
  );
}

async function main() {
  const config = buildRuntimeConfig(process.env);
  try {
    await runSync(config);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.env.TCGTRACKING_SYNC_TEST_MODE !== "1") {
  main().catch((error) => {
    console.error("[tcgtracking-sync] failed:", error);
    process.exitCode = 1;
  });
}
