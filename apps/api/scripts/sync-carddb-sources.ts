import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "../src/lib/prisma";
import {
  asNonEmptyString,
  BULBAPEDIA_SOURCE,
  CatalogItemProjection,
  CatalogSetProjection,
  normalizeBulbapediaExpansionSet,
  normalizeOnePieceDbCardForCatalog,
  normalizeOnePieceDbSetFromCard,
  normalizePokemonCardIoCardForCatalog,
  normalizePokemonCardIoSetFromCard,
  ONEPIECEDB_IO_SOURCE,
  POKEMONCARD_IO_SOURCE,
} from "../src/modules/catalog/card-db-sources-normalizer";

type RuntimeConfig = {
  dryRun: boolean;
  allowLiveWrite: boolean;
  dbEnv: "local" | "staging" | "production";
  sources: Set<string>;
  maxPages: number;
  maxCards: number;
  startPage: number;
  requestTimeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  pageDelayMs: number;
  databaseUrl: string | null;
};

type PagePayload = {
  current_page?: number;
  data?: unknown[];
  last_page?: number;
  total?: number;
  per_page?: number;
};

type SourceConfig = {
  key: string;
  label: string;
  baseUrl: string;
  normalizeCard: (card: Record<string, unknown>) => CatalogItemProjection | null;
  normalizeSet: (card: Record<string, unknown>) => CatalogSetProjection | null;
};

type SourceStats = {
  source: string;
  pages: number;
  fetchedCards: number;
  normalizedCards: number;
  upsertedCards: number;
  normalizedSets: number;
  upsertedSets: number;
  failures: number;
};

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    key: POKEMONCARD_IO_SOURCE,
    label: "PokemonCard.io",
    baseUrl: "https://pokemoncard.io",
    normalizeCard: normalizePokemonCardIoCardForCatalog,
    normalizeSet: normalizePokemonCardIoSetFromCard,
  },
  {
    key: ONEPIECEDB_IO_SOURCE,
    label: "OnePieceDB.io",
    baseUrl: "https://onepiecedb.io",
    normalizeCard: normalizeOnePieceDbCardForCatalog,
    normalizeSet: normalizeOnePieceDbSetFromCard,
  },
];

const ALLOWED_DB_ENVS = new Set(["local", "staging", "production"]);
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_RE = new RegExp(`(?:${MONTHS})\\s+\\d{1,2},\\s+\\d{4}`);
const MONTH_INDEX: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};
const execFileAsync = promisify(execFile);

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

function parseSources(value: string | undefined): Set<string> {
  const raw = value ?? "pokemoncard.io,onepiecedb.io,bulbapedia";
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

function buildRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  const dryRun = parseBoolean(env.CARDDB_DRY_RUN, true);
  const dbEnvRaw = asNonEmptyString(env.CARDDB_DB_ENV) ?? "local";
  if (!ALLOWED_DB_ENVS.has(dbEnvRaw)) {
    throw new Error(`Invalid CARDDB_DB_ENV=${dbEnvRaw}; expected local|staging|production`);
  }
  if (!dryRun && !env.CARDDB_DB_ENV) {
    throw new Error("CARDDB_DB_ENV must be explicitly set for non-dry-run execution.");
  }

  const config: RuntimeConfig = {
    dryRun,
    allowLiveWrite: parseBoolean(env.CARDDB_ALLOW_LIVE_WRITE, false),
    dbEnv: dbEnvRaw as RuntimeConfig["dbEnv"],
    sources: parseSources(env.CARDDB_SOURCES),
    maxPages: Math.max(0, parseIntOr(env.CARDDB_MAX_PAGES, 0)),
    maxCards: Math.max(0, parseIntOr(env.CARDDB_MAX_CARDS, 0)),
    startPage: Math.max(1, parseIntOr(env.CARDDB_START_PAGE, 1)),
    requestTimeoutMs: Math.max(1000, parseIntOr(env.CARDDB_REQUEST_TIMEOUT_MS, 20000)),
    retryCount: Math.max(0, parseIntOr(env.CARDDB_RETRY_COUNT, 2)),
    retryDelayMs: Math.max(0, parseIntOr(env.CARDDB_RETRY_DELAY_MS, 1000)),
    pageDelayMs: Math.max(0, parseIntOr(env.CARDDB_PAGE_DELAY_MS, 150)),
    databaseUrl: asNonEmptyString(env.DATABASE_URL),
  };

  if (isRenderUrl(config.databaseUrl) && config.dbEnv === "local") {
    throw new Error("Render DATABASE_URL cannot be used with CARDDB_DB_ENV=local. Set staging or production explicitly.");
  }

  if (!dryRun && config.dbEnv === "production" && !config.allowLiveWrite) {
    throw new Error("Refusing production write: set CARDDB_ALLOW_LIVE_WRITE=true with CARDDB_DB_ENV=production.");
  }

  return config;
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withDbRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /Can't reach database server|P1001|Connection terminated|ECONNRESET|ETIMEDOUT/i.test(message);
      if (!retryable || attempt >= 4) break;
      const delayMs = 1000 * (attempt + 1);
      console.warn(`[carddb-sync] db-retry label=${label} attempt=${attempt + 1}/4 delayMs=${delayMs}`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

async function fetchTextWithPythonRequests(url: string, config: RuntimeConfig): Promise<{ status: number; contentType: string | null; text: string }> {
  const code = `
import json, requests, sys
url = sys.argv[1]
timeout = int(sys.argv[2]) / 1000
r = requests.get(url, headers={"user-agent":"oripa-saas-catalog-sync/1.0", "accept":"application/json,text/html;q=0.9,*/*;q=0.8"}, timeout=timeout)
print(json.dumps({"status": r.status_code, "contentType": r.headers.get("content-type"), "text": r.text}))
`;
  const { stdout } = await execFileAsync("python3", ["-c", code, url, String(config.requestTimeoutMs)], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: config.requestTimeoutMs + 5000,
  });
  return JSON.parse(stdout) as { status: number; contentType: string | null; text: string };
}

async function fetchText(url: string, config: RuntimeConfig): Promise<{ status: number; contentType: string | null; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json,text/html;q=0.9,*/*;q=0.8", "user-agent": "oripa-saas-carddb-sync/1.0" },
    });
    const result = { status: response.status, contentType: response.headers.get("content-type"), text: await response.text() };
    if (result.status === 403 || result.text.includes("Just a moment") || result.text.includes("cloudflare")) {
      return fetchTextWithPythonRequests(url, config);
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithRetry(url: string, config: RuntimeConfig): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.retryCount; attempt += 1) {
    try {
      const response = await fetchText(url, config);
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`request failed status=${response.status} url=${url}`);
      }
      if (!(response.contentType ?? "").toLowerCase().includes("application/json")) {
        throw new Error(`request returned non-json contentType=${response.contentType} url=${url}`);
      }
      return JSON.parse(response.text) as unknown;
    } catch (error) {
      lastError = error;
      if (attempt >= config.retryCount) break;
      const delay = config.retryDelayMs * (attempt + 1);
      console.warn(`[carddb-sync] retry url=${url} attempt=${attempt + 1}/${config.retryCount} delayMs=${delay}`);
      await sleep(delay);
    }
  }
  throw lastError;
}

function stableId(prefix: string, parts: Array<string | null>): string {
  const hash = crypto.createHash("sha1").update(parts.filter(Boolean).join("|")).digest("hex");
  return `${prefix}_${hash}`;
}

async function upsertCatalogSet(row: CatalogSetProjection): Promise<string> {
  const id = stableId("cset", [row.source, row.sourceSetId, row.game]);
  await withDbRetry(`upsertCatalogSet:${row.source}:${row.sourceSetId}`, () => prisma.$executeRaw`
    INSERT INTO "CatalogSet" (
      "id", "source", "sourceSetId", "game", "setCode", "name", "releaseDate", "productCount",
      "symbolImageUrl", "logoImageUrl", "bannerImageUrl", "isSupplemental", "searchText", "isActive", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${row.source}, ${row.sourceSetId}, ${row.game}, ${row.setCode}, ${row.name}, ${row.releaseDate}, ${row.productCount},
      ${row.symbolImageUrl}, ${row.logoImageUrl}, ${row.bannerImageUrl}, ${row.isSupplemental}, ${row.searchText}, ${row.isActive}, NOW(), NOW()
    )
    ON CONFLICT ("source", "sourceSetId", "game") DO UPDATE SET
      "setCode" = EXCLUDED."setCode",
      "name" = EXCLUDED."name",
      "releaseDate" = COALESCE(EXCLUDED."releaseDate", "CatalogSet"."releaseDate"),
      "productCount" = COALESCE(EXCLUDED."productCount", "CatalogSet"."productCount"),
      "symbolImageUrl" = COALESCE(EXCLUDED."symbolImageUrl", "CatalogSet"."symbolImageUrl"),
      "logoImageUrl" = COALESCE(EXCLUDED."logoImageUrl", "CatalogSet"."logoImageUrl"),
      "bannerImageUrl" = COALESCE(EXCLUDED."bannerImageUrl", "CatalogSet"."bannerImageUrl"),
      "isSupplemental" = EXCLUDED."isSupplemental",
      "searchText" = EXCLUDED."searchText",
      "isActive" = TRUE,
      "updatedAt" = NOW()
  `);
  return id;
}

async function updateCatalogSetProductCounts(source: string, game: string, counts: Map<string, number>) {
  for (const [sourceSetId, productCount] of counts.entries()) {
    await withDbRetry(`updateCatalogSetProductCounts:${source}:${sourceSetId}`, () => prisma.$executeRaw`
      UPDATE "CatalogSet"
      SET "productCount" = ${productCount}, "updatedAt" = NOW()
      WHERE "source" = ${source} AND "sourceSetId" = ${sourceSetId} AND "game" = ${game}
    `);
  }
}

async function upsertCatalogItem(row: CatalogItemProjection, catalogSetId: string | null) {
  await withDbRetry(`upsertCatalogItem:${row.source}:${row.sourceItemId}`, () => prisma.catalogItem.upsert({
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
  }));

  if (catalogSetId) {
    await withDbRetry(`linkCatalogSet:${row.source}:${row.sourceItemId}`, () => prisma.$executeRaw`
      UPDATE "CatalogItem"
      SET "catalogSetId" = ${catalogSetId}
      WHERE "source" = ${row.source} AND "sourceItemId" = ${row.sourceItemId} AND "language" = ${row.language}
    `);
  }
}

async function createCatalogItemsBulk(rows: CatalogItemProjection[]): Promise<number> {
  if (!rows.length) return 0;
  const result = await withDbRetry(`createCatalogItemsBulk:${rows[0]?.source ?? "unknown"}:${rows.length}`, () =>
    prisma.catalogItem.createMany({ data: rows, skipDuplicates: true }),
  );
  return result.count;
}

async function runCardSource(source: SourceConfig, config: RuntimeConfig): Promise<SourceStats> {
  const stats: SourceStats = {
    source: source.key,
    pages: 0,
    fetchedCards: 0,
    normalizedCards: 0,
    upsertedCards: 0,
    normalizedSets: 0,
    upsertedSets: 0,
    failures: 0,
  };
  const setCounts = new Map<string, number>();
  const seenSets = new Set<string>();
  let lastPage = config.startPage;

  console.log(
    `[carddb-sync] source-start source=${source.key} label=${source.label} dryRun=${config.dryRun} startPage=${config.startPage} maxPages=${config.maxPages || "all"} maxCards=${config.maxCards || "all"}`,
  );

  for (let page = config.startPage; page <= lastPage; page += 1) {
    if (config.maxPages > 0 && stats.pages >= config.maxPages) break;
    if (config.maxCards > 0 && stats.fetchedCards >= config.maxCards) break;

    const url = `${source.baseUrl}/api/cards/database?sort=name&sortdirection=asc&page=${page}`;
    const payload = (await fetchJsonWithRetry(url, config)) as PagePayload;
    const cards = Array.isArray(payload.data) ? (payload.data as Record<string, unknown>[]) : [];
    lastPage = Number(payload.last_page ?? page) || page;
    stats.pages += 1;
    console.log(`[carddb-sync] page source=${source.key} page=${page}/${lastPage} cards=${cards.length} total=${payload.total ?? "unknown"}`);

    const pageItemRows: CatalogItemProjection[] = [];
    for (const card of cards) {
      if (config.maxCards > 0 && stats.fetchedCards >= config.maxCards) break;
      stats.fetchedCards += 1;

      const setRow = source.normalizeSet(card);
      if (setRow) {
        const setKey = `${setRow.source}|${setRow.sourceSetId}|${setRow.game}`;
        setCounts.set(setRow.sourceSetId, (setCounts.get(setRow.sourceSetId) ?? 0) + 1);
        if (!seenSets.has(setKey)) {
          seenSets.add(setKey);
          stats.normalizedSets += 1;
        }
      }

      const itemRow = source.normalizeCard(card);
      if (!itemRow) continue;
      stats.normalizedCards += 1;
      if (stats.normalizedCards <= 3) {
        console.log(
          `[carddb-sync] sample source=${source.key} sourceItemId=${itemRow.sourceItemId} name=${itemRow.name} set=${itemRow.setId ?? "null"} number=${itemRow.cardNumber ?? "null"}`,
        );
      }
      if (!config.dryRun) {
        pageItemRows.push(itemRow);
      }
    }

    if (!config.dryRun && pageItemRows.length > 0) {
      stats.upsertedCards += await createCatalogItemsBulk(pageItemRows);
    }

    await sleep(config.pageDelayMs);
  }

  console.log(
    `[carddb-sync] source-complete source=${source.key} pages=${stats.pages} fetchedCards=${stats.fetchedCards} normalizedCards=${stats.normalizedCards} upsertedCards=${stats.upsertedCards} normalizedSets=${stats.normalizedSets} upsertedSets=${stats.upsertedSets} failures=${stats.failures}`,
  );
  return stats;
}

function parseBulbapediaDate(text: string): Date | null {
  const match = text.match(new RegExp(`^(${MONTHS})\\s+(\\d{1,2}),\\s+(\\d{4})$`));
  if (!match) return null;
  const month = MONTH_INDEX[match[1] ?? ""];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  return new Date(Date.UTC(year, month, day));
}

function parseTemplateDisplay(templateBody: string): string | null {
  const parts = templateBody.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts[0]?.toUpperCase() !== "TCG") return null;
  return parts[2] ?? parts[1] ?? null;
}

function stripWikiMarkup(text: string): string {
  return text
    .replace(/\{\{tt\|([^|}]+)[^}]*\}\}/g, "$1")
    .replace(/\{\{TCG\|([^}|]+)(?:\|([^}]+))?\}\}/g, (_match, first: string, second: string | undefined) => second ?? first)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/''+/g, "")
    .trim();
}

function parseBulbapediaExpansionWikitext(wikitext: string): CatalogSetProjection[] {
  const rows = wikitext.split(/\n\|-/g);
  const sets: CatalogSetProjection[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!DATE_RE.test(row)) continue;
    const dateMatch = row.match(DATE_RE);
    if (!dateMatch) continue;

    const tcgTemplates = [...row.matchAll(/\{\{([^{}]+)\}\}/g)]
      .map((match) => parseTemplateDisplay(match[1] ?? ""))
      .filter((name): name is string => Boolean(name));
    const wikiLinks = [...row.matchAll(/\[\[(?!File:|Image:|Category:)(?:[^\]|]+\|)?([^\]]+)\]\]/g)].map((match) => match[1]);
    const rawName = (tcgTemplates[0] ?? wikiLinks[0] ?? "").replace(/\s*\([^)]*\)\s*$/g, "").trim();
    if (!rawName || /Pokémon|Trading Card Game|Wizards of the Coast/i.test(rawName)) continue;

    const parsed = normalizeBulbapediaExpansionSet({ name: rawName, releaseDate: parseBulbapediaDate(dateMatch[0]), productCount: null });
    if (!parsed) continue;
    const key = `${parsed.source}|${parsed.sourceSetId}|${parsed.game}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sets.push(parsed);
  }
  return sets;
}

async function runBulbapedia(config: RuntimeConfig): Promise<SourceStats> {
  const stats: SourceStats = {
    source: BULBAPEDIA_SOURCE,
    pages: 1,
    fetchedCards: 0,
    normalizedCards: 0,
    upsertedCards: 0,
    normalizedSets: 0,
    upsertedSets: 0,
    failures: 0,
  };
  const url = "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=List%20of%20Pok%C3%A9mon%20Trading%20Card%20Game%20expansions&prop=wikitext&format=json";
  const payload = (await fetchJsonWithRetry(url, config)) as { parse?: { wikitext?: { "*"?: string } } };
  const wikitext = payload.parse?.wikitext?.["*"] ?? "";
  const sets = parseBulbapediaExpansionWikitext(wikitext);
  stats.normalizedSets = sets.length;
  console.log(`[carddb-sync] bulbapedia parsed sets=${sets.length}`);
  let sampleCount = 0;
  for (const set of sets) {
    if (sampleCount < 3) {
      sampleCount += 1;
      console.log(`[carddb-sync] bulbapedia sample name=${set.name} releaseDate=${set.releaseDate?.toISOString().slice(0, 10) ?? "null"}`);
    }
    if (!config.dryRun) {
      await upsertCatalogSet(set);
      stats.upsertedSets += 1;
    }
  }
  console.log(
    `[carddb-sync] source-complete source=${BULBAPEDIA_SOURCE} normalizedSets=${stats.normalizedSets} upsertedSets=${stats.upsertedSets}`,
  );
  return stats;
}

async function runSync(config: RuntimeConfig) {
  const startedAt = Date.now();
  console.log(
    `[carddb-sync] start dryRun=${config.dryRun} dbEnv=${config.dbEnv} sources=${[...config.sources].join(",")} maxPages=${config.maxPages || "all"} maxCards=${config.maxCards || "all"}`,
  );

  const stats: SourceStats[] = [];
  for (const source of SOURCE_CONFIGS) {
    if (config.sources.has(source.key) || config.sources.has(source.key.replace(/\.io$/, ""))) {
      stats.push(await runCardSource(source, config));
    }
  }
  if (config.sources.has(BULBAPEDIA_SOURCE)) {
    stats.push(await runBulbapedia(config));
  }

  const totals = stats.reduce(
    (acc, item) => ({
      pages: acc.pages + item.pages,
      fetchedCards: acc.fetchedCards + item.fetchedCards,
      normalizedCards: acc.normalizedCards + item.normalizedCards,
      upsertedCards: acc.upsertedCards + item.upsertedCards,
      normalizedSets: acc.normalizedSets + item.normalizedSets,
      upsertedSets: acc.upsertedSets + item.upsertedSets,
      failures: acc.failures + item.failures,
    }),
    { pages: 0, fetchedCards: 0, normalizedCards: 0, upsertedCards: 0, normalizedSets: 0, upsertedSets: 0, failures: 0 },
  );
  const durationSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[carddb-sync] completed dryRun=${config.dryRun} pages=${totals.pages} fetchedCards=${totals.fetchedCards} normalizedCards=${totals.normalizedCards} upsertedCards=${totals.upsertedCards} normalizedSets=${totals.normalizedSets} upsertedSets=${totals.upsertedSets} failures=${totals.failures} duration=${durationSec}s`,
  );
}

async function main() {
  const config = buildRuntimeConfig(process.env);
  try {
    await withDbRetry("connect", () => prisma.$connect());
    await runSync(config);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.env.CARDDB_SYNC_TEST_MODE !== "1") {
  main().catch((error) => {
    console.error("[carddb-sync] failed:", error);
    process.exitCode = 1;
  });
}

export { buildRuntimeConfig, parseBulbapediaExpansionWikitext, runSync };
