import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CatalogItemType, Prisma } from "@prisma/client";
import { config as loadDotenv } from "dotenv";
import { prisma } from "../src/lib/prisma";

const REPO_ROOT = path.resolve(__dirname, "../../..");
loadDotenv({ path: path.join(REPO_ROOT, ".env") });

type RuntimeConfig = {
  dryRun: boolean;
  dbEnv: "local" | "staging" | "production";
  allowProductionWrite: boolean;
  sources: Set<string>;
  maxCards: number;
  maxSets: number;
  pageDelayMs: number;
  requestTimeoutMs: number;
  retryCount: number;
  jpStartPage: number;
  jpEndPage: number;
  artifactDir: string;
};

type CatalogSetRow = {
  source: string;
  sourceSetId: string;
  sourceCategoryId: string | null;
  language: string;
  groupKind: string | null;
  reviewStatus: string | null;
  sourcePayload: Prisma.InputJsonValue;
  game: string;
  setCode: string | null;
  name: string;
  releaseDate: Date | null;
  productCount: number | null;
  symbolImageUrl: string | null;
  logoImageUrl: string | null;
  bannerImageUrl: string | null;
  isSupplemental: boolean;
  searchText: string;
  isActive: boolean;
};

type CatalogItemRow = {
  source: string;
  sourceItemId: string;
  catalogSetId: string | null;
  localId: string | null;
  sourcePayload: Prisma.InputJsonValue;
  cardType: string | null;
  color: string | null;
  attribute: string | null;
  itemType: CatalogItemType;
  game: string;
  language: string;
  name: string;
  setId: string | null;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageBaseUrl: string | null;
  imageThumbUrl: string | null;
  imageLargeUrl: string | null;
  searchText: string;
  isActive: boolean;
};

type Stats = {
  source: string;
  fetchedSets: number;
  fetchedCards: number;
  normalizedSets: number;
  normalizedCards: number;
  upsertedSets: number;
  upsertedCards: number;
  failed: number;
};

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ["1", "true", "yes", "y"].includes(raw.toLowerCase());
}

function intEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) ? raw : fallback;
}

function parseConfig(): RuntimeConfig {
  const dbEnv = (process.env.SOURCE_NATIVE_DB_ENV ?? "local") as RuntimeConfig["dbEnv"];
  if (!["local", "staging", "production"].includes(dbEnv)) throw new Error(`Invalid SOURCE_NATIVE_DB_ENV=${dbEnv}`);
  const dryRun = boolEnv("SOURCE_NATIVE_DRY_RUN", true);
  const sources = new Set((process.env.SOURCE_NATIVE_SOURCES ?? "tcgdex-en,pokemon-card-jp,onepiece-official-en").split(",").map((s) => s.trim()).filter(Boolean));
  const artifactDir = path.resolve(REPO_ROOT, process.env.SOURCE_NATIVE_ARTIFACT_DIR ?? `docs/plans/source-native-full-universe-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  if (!dryRun && dbEnv === "production" && !boolEnv("SOURCE_NATIVE_ALLOW_PRODUCTION_WRITE", false)) {
    throw new Error("Refusing production write without SOURCE_NATIVE_ALLOW_PRODUCTION_WRITE=true");
  }
  if (!dryRun && /render\.com/i.test(process.env.DATABASE_URL ?? "") && dbEnv !== "production" && dbEnv !== "staging") {
    throw new Error("Render DATABASE_URL requires SOURCE_NATIVE_DB_ENV=staging or production");
  }
  return {
    dryRun,
    dbEnv,
    allowProductionWrite: boolEnv("SOURCE_NATIVE_ALLOW_PRODUCTION_WRITE", false),
    sources,
    maxCards: Math.max(0, intEnv("SOURCE_NATIVE_MAX_CARDS", 0)),
    maxSets: Math.max(0, intEnv("SOURCE_NATIVE_MAX_SETS", 0)),
    pageDelayMs: Math.max(0, intEnv("SOURCE_NATIVE_PAGE_DELAY_MS", 100)),
    requestTimeoutMs: Math.max(1000, intEnv("SOURCE_NATIVE_REQUEST_TIMEOUT_MS", 30000)),
    retryCount: Math.max(0, intEnv("SOURCE_NATIVE_RETRY_COUNT", 2)),
    jpStartPage: Math.max(1, intEnv("SOURCE_NATIVE_JP_START_PAGE", 1)),
    jpEndPage: Math.max(0, intEnv("SOURCE_NATIVE_JP_END_PAGE", 0)),
    artifactDir,
  };
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanText(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

function searchText(parts: Array<unknown>): string {
  return parts.map(asString).filter((v): v is string => Boolean(v)).join(" ").replace(/\s+/g, " ").toLowerCase().trim();
}

function stableId(prefix: string, parts: Array<string | null>): string {
  return `${prefix}_${crypto.createHash("sha1").update(parts.filter(Boolean).join("|")).digest("hex")}`;
}

function imageVariant(base: string | null, variant: "low" | "high"): string | null {
  if (!base) return null;
  if (/\.(png|jpe?g|webp)(\?.*)?$/i.test(base)) return base;
  return `${base}/${variant}.webp`;
}

async function sleep(ms: number) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string, config: RuntimeConfig): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt <= config.retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "user-agent": "oripa-source-native-universe/1.0", accept: "application/json,text/html;q=0.9,*/*;q=0.8" },
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`status=${response.status} url=${url}`);
      return text;
    } catch (error) {
      last = error;
      if (attempt >= config.retryCount) break;
      await sleep(1000 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw last;
}

async function fetchJson<T>(url: string, config: RuntimeConfig): Promise<T> {
  return JSON.parse(await fetchText(url, config)) as T;
}

function writeArtifact(config: RuntimeConfig, relPath: string, content: string) {
  const fullPath = path.join(config.artifactDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

async function upsertSet(row: CatalogSetRow, dryRun: boolean): Promise<string> {
  const id = stableId("cset", [row.source, row.sourceSetId, row.game]);
  if (dryRun) return id;
  await prisma.catalogSet.upsert({
    where: { source_sourceSetId_game: { source: row.source, sourceSetId: row.sourceSetId, game: row.game } },
    update: {
      sourceCategoryId: row.sourceCategoryId,
      language: row.language,
      groupKind: row.groupKind,
      reviewStatus: row.reviewStatus,
      sourcePayload: row.sourcePayload,
      setCode: row.setCode,
      name: row.name,
      releaseDate: row.releaseDate,
      productCount: row.productCount,
      symbolImageUrl: row.symbolImageUrl,
      logoImageUrl: row.logoImageUrl,
      bannerImageUrl: row.bannerImageUrl,
      isSupplemental: row.isSupplemental,
      searchText: row.searchText,
      isActive: row.isActive,
    },
    create: { id, ...row },
  });
  return id;
}

async function upsertItem(row: CatalogItemRow, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  await prisma.catalogItem.upsert({
    where: { source_sourceItemId_language: { source: row.source, sourceItemId: row.sourceItemId, language: row.language } },
    update: {
      catalogSetId: row.catalogSetId,
      localId: row.localId,
      sourcePayload: row.sourcePayload,
      cardType: row.cardType,
      color: row.color,
      attribute: row.attribute,
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
      isActive: row.isActive,
    },
    create: row,
  });
}

async function syncTcgdex(language: "en" | "ja", game: "POKEMON" | "POKEMON_JAPAN", config: RuntimeConfig): Promise<Stats> {
  const sourceKey = `tcgdex-${language}`;
  const stats: Stats = { source: sourceKey, fetchedSets: 0, fetchedCards: 0, normalizedSets: 0, normalizedCards: 0, upsertedSets: 0, upsertedCards: 0, failed: 0 };
  const base = `https://api.tcgdex.net/v2/${language}`;
  const setList = await fetchJson<Array<Record<string, unknown>>>(`${base}/sets`, config);
  writeArtifact(config, `snapshots/${sourceKey}/sets.json`, JSON.stringify(setList, null, 2));
  const selectedSets = config.maxSets > 0 ? setList.slice(0, config.maxSets) : setList;
  for (const brief of selectedSets) {
    if (config.maxCards > 0 && stats.fetchedCards >= config.maxCards) break;
    const setId = asString(brief.id);
    if (!setId) continue;
    try {
      const set = await fetchJson<Record<string, unknown>>(`${base}/sets/${encodeURIComponent(setId)}`, config);
      writeArtifact(config, `snapshots/${sourceKey}/sets/${setId}.json`, JSON.stringify(set, null, 2));
      stats.fetchedSets += 1;
      const cards = Array.isArray(set.cards) ? (set.cards as Array<Record<string, unknown>>) : [];
      const cardCount = set.cardCount && typeof set.cardCount === "object" ? (set.cardCount as Record<string, unknown>) : {};
      const setName = asString(set.name) ?? setId;
      const setRow: CatalogSetRow = {
        source: "tcgdex",
        sourceSetId: setId,
        sourceCategoryId: language,
        language,
        groupKind: "official_card_universe",
        reviewStatus: "source_native",
        sourcePayload: { ...set, cards: undefined, provenance: { source: "tcgdex", url: `${base}/sets/${setId}`, fetchedAt: new Date().toISOString() } } as Prisma.InputJsonValue,
        game,
        setCode: asString(setId),
        name: setName,
        releaseDate: parseDate(set.releaseDate),
        productCount: asNumber(cardCount.total) ?? asNumber(cardCount.official) ?? cards.length,
        symbolImageUrl: imageVariant(asString(set.symbol), "high"),
        logoImageUrl: imageVariant(asString(set.logo), "high"),
        bannerImageUrl: null,
        isSupplemental: false,
        searchText: searchText([setName, setId, language, game, "tcgdex", "pokemon", "set"]),
        isActive: true,
      };
      stats.normalizedSets += 1;
      const catalogSetId = await upsertSet(setRow, config.dryRun);
      stats.upsertedSets += config.dryRun ? 0 : 1;
      for (const card of cards) {
        if (config.maxCards > 0 && stats.fetchedCards >= config.maxCards) break;
        const sourceItemId = asString(card.id);
        const name = asString(card.name);
        if (!sourceItemId || !name) continue;
        const localId = asString(card.localId);
        const image = asString(card.image);
        const row: CatalogItemRow = {
          source: "tcgdex",
          sourceItemId,
          catalogSetId,
          localId,
          sourcePayload: { ...card, set: { id: setId, name: setName }, provenance: { source: "tcgdex", url: `${base}/cards/${sourceItemId}`, fetchedAt: new Date().toISOString() } } as Prisma.InputJsonValue,
          cardType: asString(card.category),
          color: Array.isArray(card.types) ? card.types.map(String).join(",") : asString(card.types),
          attribute: null,
          itemType: CatalogItemType.CARD,
          game,
          language,
          name,
          setId,
          setName,
          cardNumber: localId,
          rarity: asString(card.rarity),
          imageBaseUrl: image,
          imageThumbUrl: imageVariant(image, "low"),
          imageLargeUrl: imageVariant(image, "high"),
          searchText: searchText([name, setName, setId, localId, card.rarity, card.category, language, game, "tcgdex"]),
          isActive: true,
        };
        stats.fetchedCards += 1;
        stats.normalizedCards += 1;
        await upsertItem(row, config.dryRun);
        stats.upsertedCards += config.dryRun ? 0 : 1;
      }
      await sleep(config.pageDelayMs);
    } catch (error) {
      stats.failed += 1;
      console.error(`[source-native] tcgdex set failed language=${language} set=${setId}`, error);
    }
  }
  return stats;
}

async function syncPokemonCardJp(config: RuntimeConfig): Promise<Stats> {
  const sourceKey = "pokemon-card-jp";
  const stats: Stats = { source: sourceKey, fetchedSets: 0, fetchedCards: 0, normalizedSets: 0, normalizedCards: 0, upsertedSets: 0, upsertedCards: 0, failed: 0 };
  const firstUrl = "https://www.pokemon-card.com/card-search/resultAPI.php?regulation_sidebar_form=all&page=1";
  const first = await fetchJson<Record<string, unknown>>(firstUrl, config);
  const maxPage = Number(first.maxPage ?? 1);
  const hardEndPage = config.jpEndPage > 0 ? Math.min(maxPage, config.jpEndPage) : maxPage;
  const pages = config.maxSets > 0 ? Math.min(hardEndPage, config.maxSets) : hardEndPage;
  writeArtifact(config, `snapshots/${sourceKey}/page-1.json`, JSON.stringify(first, null, 2));
  const setCodeToCatalogId = new Map<string, string>();
  for (let page = config.jpStartPage; page <= pages; page += 1) {
    if (config.maxCards > 0 && stats.fetchedCards >= config.maxCards) break;
    const payload = page === 1 ? first : await fetchJson<Record<string, unknown>>(`https://www.pokemon-card.com/card-search/resultAPI.php?regulation_sidebar_form=all&page=${page}`, config);
    if (page !== 1) writeArtifact(config, `snapshots/${sourceKey}/page-${page}.json`, JSON.stringify(payload, null, 2));
    const cards = Array.isArray(payload.cardList) ? (payload.cardList as Array<Record<string, unknown>>) : [];
    for (const card of cards) {
      if (config.maxCards > 0 && stats.fetchedCards >= config.maxCards) break;
      const cardId = asString(card.cardID);
      const name = asString(card.cardNameViewText) ?? asString(card.cardNameAltText);
      if (!cardId || !name) continue;
      const imagePath = asString(card.cardThumbFile);
      const imageUrl = imagePath ? new URL(imagePath, "https://www.pokemon-card.com").toString() : null;
      const setCode = imagePath?.match(/\/card_images\/(?:large|legend)\/([^/]+)\//)?.[1] || "UNASSIGNED-JP-OFFICIAL";
      let catalogSetId: string | null = null;
      if (setCode) {
        if (!setCodeToCatalogId.has(setCode)) {
          const setRow: CatalogSetRow = {
            source: "pokemon-card.com",
            sourceSetId: setCode,
            sourceCategoryId: "official-jp-card-search",
            language: "ja",
            groupKind: "official_card_universe",
            reviewStatus: "source_native",
            sourcePayload: { source: "pokemon-card.com", setCode, url: "https://www.pokemon-card.com/card-search/", fetchedAt: new Date().toISOString() } as Prisma.InputJsonValue,
            game: "POKEMON_JAPAN",
            setCode,
            name: setCode,
            releaseDate: null,
            productCount: null,
            symbolImageUrl: `https://www.pokemon-card.com/assets/images/card/regulation_logo_1/${setCode}.gif`,
            logoImageUrl: null,
            bannerImageUrl: null,
            isSupplemental: false,
            searchText: searchText([setCode, "pokemon", "japan", "official", "pokemon-card.com", "set"]),
            isActive: true,
          };
          setCodeToCatalogId.set(setCode, await upsertSet(setRow, config.dryRun));
          stats.fetchedSets += 1;
          stats.normalizedSets += 1;
          stats.upsertedSets += config.dryRun ? 0 : 1;
        }
        catalogSetId = setCodeToCatalogId.get(setCode) ?? null;
      }
      const row: CatalogItemRow = {
        source: "pokemon-card.com",
        sourceItemId: cardId,
        catalogSetId,
        localId: cardId,
        sourcePayload: { ...card, provenance: { source: "pokemon-card.com", url: `https://www.pokemon-card.com/card-search/details.php/card/${cardId}/regu/all`, fetchedAt: new Date().toISOString() } } as Prisma.InputJsonValue,
        cardType: null,
        color: null,
        attribute: null,
        itemType: CatalogItemType.CARD,
        game: "POKEMON_JAPAN",
        language: "ja",
        name,
        setId: setCode,
        setName: setCode,
        cardNumber: cardId,
        rarity: null,
        imageBaseUrl: imageUrl,
        imageThumbUrl: imageUrl,
        imageLargeUrl: imageUrl,
        searchText: searchText([name, cardId, "pokemon", "japan", "official", "pokemon-card.com"]),
        isActive: true,
      };
      stats.fetchedCards += 1;
      stats.normalizedCards += 1;
      await upsertItem(row, config.dryRun);
      stats.upsertedCards += config.dryRun ? 0 : 1;
    }
    await sleep(config.pageDelayMs);
  }
  return stats;
}

function parseOnePieceCards(html: string): Array<Record<string, string | null>> {
  const rows: Array<Record<string, string | null>> = [];
  const dlRe = /<dl class="modalCol" id="([^"]+)">([\s\S]*?)<\/dl>/g;
  let match: RegExpExecArray | null;
  while ((match = dlRe.exec(html))) {
    const [, id, block] = match;
    const info = /<div class="infoCol">\s*<span>(.*?)<\/span>\s*\|\s*<span>(.*?)<\/span>\s*\|\s*<span>(.*?)<\/span>/s.exec(block);
    const name = /<div class="cardName">([\s\S]*?)<\/div>/s.exec(block)?.[1];
    const img = /data-src="([^">]*cardlist\/card\/[^"]+)"/s.exec(block)?.[1];
    const color = /<div class="color">[\s\S]*?<i>([\s\S]*?)<\/i>/s.exec(block)?.[1];
    const attribute = /<div class="attribute">[\s\S]*?<i>([\s\S]*?)<\/i>/s.exec(block)?.[1];
    if (!info || !name) continue;
    rows.push({ id, code: cleanText(info[1]), rarity: cleanText(info[2]), cardType: cleanText(info[3]), name: cleanText(name), image: img ? new URL(img, "https://asia-en.onepiece-cardgame.com/cardlist/").toString() : null, color: color ? cleanText(color) : null, attribute: attribute ? cleanText(attribute) : null });
  }
  return rows;
}

function parseOnePieceSeries(html: string): Array<{ id: string; name: string }> {
  const options: Array<{ id: string; name: string }> = [];
  const optionRe = /<option\s+value="(\d+)"[^>]*>([\s\S]*?)<\/option>/g;
  let match: RegExpExecArray | null;
  while ((match = optionRe.exec(html))) options.push({ id: match[1], name: cleanText(match[2]) });
  return options;
}

async function syncOnePieceOfficialEn(config: RuntimeConfig): Promise<Stats> {
  const sourceKey = "onepiece-official-en";
  const stats: Stats = { source: sourceKey, fetchedSets: 0, fetchedCards: 0, normalizedSets: 0, normalizedCards: 0, upsertedSets: 0, upsertedCards: 0, failed: 0 };
  const url = "https://asia-en.onepiece-cardgame.com/cardlist/";
  const indexHtml = await fetchText(url, config);
  writeArtifact(config, `snapshots/${sourceKey}/cardlist-index.html`, indexHtml);
  const series = parseOnePieceSeries(indexHtml);
  const selectedSeries = config.maxSets > 0 ? series.slice(0, config.maxSets) : series;
  const seen = new Map<string, Record<string, string | null>>();
  const seriesByPrefix = new Map<string, { id: string; name: string }>();
  for (const product of selectedSeries) {
    const productUrl = `${url}?series=${encodeURIComponent(product.id)}`;
    const html = await fetchText(productUrl, config);
    writeArtifact(config, `snapshots/${sourceKey}/series-${product.id}.html`, html);
    for (const card of parseOnePieceCards(html)) {
      const rowId = asString(card.id) ?? asString(card.code);
      if (!rowId) continue;
      seen.set(rowId, { ...card, sourceSeriesId: product.id, sourceSeriesName: product.name, sourceUrl: productUrl });
      const prefix = asString(card.code)?.split("-")[0];
      if (prefix && !seriesByPrefix.has(prefix)) seriesByPrefix.set(prefix, product);
    }
    await sleep(config.pageDelayMs);
  }
  const cards = Array.from(seen.values());
  const setIds = new Set(cards.map((card) => asString(card.code)?.split("-")[0]).filter((v): v is string => Boolean(v)));
  const setIdToCatalogId = new Map<string, string>();
  for (const setId of setIds) {
    const row: CatalogSetRow = {
      source: "onepiece-cardgame.com",
      sourceSetId: setId,
      sourceCategoryId: "asia-en",
      language: "en",
      groupKind: "official_card_universe",
      reviewStatus: "source_native",
      sourcePayload: { source: "onepiece-cardgame.com", setId, series: seriesByPrefix.get(setId) ?? null, url, fetchedAt: new Date().toISOString() } as Prisma.InputJsonValue,
      game: "ONE_PIECE",
      setCode: setId,
      name: seriesByPrefix.get(setId)?.name ?? setId,
      releaseDate: null,
      productCount: cards.filter((card) => asString(card.code)?.startsWith(`${setId}-`)).length,
      symbolImageUrl: null,
      logoImageUrl: null,
      bannerImageUrl: null,
      isSupplemental: /^P|ST/i.test(setId),
      searchText: searchText([setId, "one piece", "official", "bandai", "set"]),
      isActive: true,
    };
    stats.fetchedSets += 1;
    stats.normalizedSets += 1;
    setIdToCatalogId.set(setId, await upsertSet(row, config.dryRun));
    stats.upsertedSets += config.dryRun ? 0 : 1;
  }
  for (const card of cards) {
    if (config.maxCards > 0 && stats.fetchedCards >= config.maxCards) break;
    const code = asString(card.code);
    const name = asString(card.name);
    if (!code || !name) continue;
    const setId = code.split("-")[0] ?? null;
    const row: CatalogItemRow = {
      source: "onepiece-cardgame.com",
      sourceItemId: asString(card.id) ?? code,
      catalogSetId: setId ? setIdToCatalogId.get(setId) ?? null : null,
      localId: code,
      sourcePayload: { ...card, provenance: { source: "onepiece-cardgame.com", url, fetchedAt: new Date().toISOString() } } as Prisma.InputJsonValue,
      cardType: asString(card.cardType),
      color: asString(card.color),
      attribute: asString(card.attribute),
      itemType: CatalogItemType.CARD,
      game: "ONE_PIECE",
      language: "en",
      name,
      setId,
      setName: setId,
      cardNumber: code,
      rarity: asString(card.rarity),
      imageBaseUrl: asString(card.image),
      imageThumbUrl: asString(card.image),
      imageLargeUrl: asString(card.image),
      searchText: searchText([name, code, setId, card.rarity, card.cardType, card.color, "one piece", "official", "bandai"]),
      isActive: true,
    };
    stats.fetchedCards += 1;
    stats.normalizedCards += 1;
    await upsertItem(row, config.dryRun);
    stats.upsertedCards += config.dryRun ? 0 : 1;
  }
  return stats;
}

async function main() {
  const config = parseConfig();
  fs.mkdirSync(config.artifactDir, { recursive: true });
  const startedAt = new Date().toISOString();
  console.log(`[source-native] start dryRun=${config.dryRun} dbEnv=${config.dbEnv} sources=${Array.from(config.sources).join(",")} artifactDir=${config.artifactDir}`);
  const stats: Stats[] = [];
  if (config.sources.has("tcgdex-en")) stats.push(await syncTcgdex("en", "POKEMON", config));
  if (config.sources.has("tcgdex-ja")) stats.push(await syncTcgdex("ja", "POKEMON_JAPAN", config));
  if (config.sources.has("pokemon-card-jp")) stats.push(await syncPokemonCardJp(config));
  if (config.sources.has("onepiece-official-en")) stats.push(await syncOnePieceOfficialEn(config));
  const summary = { startedAt, finishedAt: new Date().toISOString(), dryRun: config.dryRun, dbEnv: config.dbEnv, sources: Array.from(config.sources), stats };
  writeArtifact(config, "summary.json", JSON.stringify(summary, null, 2));
  console.log(`[source-native] completed ${JSON.stringify(summary)}`);
}

main()
  .catch((error) => {
    console.error("[source-native] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
