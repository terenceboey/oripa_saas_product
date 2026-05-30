import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "../src/lib/prisma";
import {
  BULBAPEDIA_SOURCE,
  CatalogItemProjection,
  CatalogSetProjection,
  normalizeBulbapediaExpansionSet,
  normalizeOnePieceDbCardForCatalog,
  normalizePokemonCardIoCardForCatalog,
  ONEPIECEDB_IO_SOURCE,
  POKEMONCARD_IO_SOURCE,
} from "../src/modules/catalog/card-db-sources-normalizer";

type Source = {
  key: string;
  baseUrl: string;
  normalize: (card: Record<string, unknown>) => CatalogItemProjection | null;
};

type PagePayload = { data?: unknown[]; last_page?: number; total?: number };

const SOURCES: Source[] = [
  { key: POKEMONCARD_IO_SOURCE, baseUrl: "https://pokemoncard.io", normalize: normalizePokemonCardIoCardForCatalog },
  { key: ONEPIECEDB_IO_SOURCE, baseUrl: "https://onepiecedb.io", normalize: normalizeOnePieceDbCardForCatalog },
];

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_RE = new RegExp(`(?:${MONTHS})\\s+\\d{1,2},\\s+\\d{4}`);
const MONTH_INDEX = Object.fromEntries(MONTHS.split("|").map((month, index) => [month, index]));
const execFileAsync = promisify(execFile);

function stableId(prefix: string, parts: Array<string | null>): string {
  return `${prefix}_${crypto.createHash("sha1").update(parts.filter(Boolean).join("|")).digest("hex")}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(label: string, fn: () => Promise<T>, max = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < max; i += 1) {
    try { return await fn(); } catch (e) {
      last = e;
      const delay = 750 * (i + 1);
      console.warn(`[fast-carddb] retry label=${label} attempt=${i + 1}/${max - 1} delayMs=${delay} err=${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      if (i === max - 1) break;
      await sleep(delay);
    }
  }
  throw last;
}

async function fetchJson(url: string): Promise<any> {
  return retry(`fetch:${url}`, async () => {
    const res = await fetch(url, { headers: { accept: "application/json,text/html;q=0.9,*/*;q=0.8", "user-agent": "oripa-saas-carddb-fast-sync/1.0" } });
    if (!res.ok) return fetchJsonWithPython(url);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return fetchJsonWithPython(url);
    return res.json();
  }, 8);
}

async function fetchJsonWithPython(url: string): Promise<any> {
  const code = `
import json, requests, sys
url = sys.argv[1]
r = requests.get(url, headers={"user-agent":"oripa-saas-carddb-fast-sync/1.0", "accept":"application/json,text/html;q=0.9,*/*;q=0.8"}, timeout=30)
r.raise_for_status()
print(r.text)
`;
  const { stdout } = await execFileAsync("python3", ["-c", code, url], { maxBuffer: 16 * 1024 * 1024, timeout: 45000 });
  return JSON.parse(stdout);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

async function insertItems(rows: CatalogItemProjection[], source: string): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const result = await retry(`createMany:${source}:${i}`, () => prisma.catalogItem.createMany({ data: chunk, skipDuplicates: true }), 6);
    inserted += result.count;
    console.log(`[fast-carddb] inserted source=${source} offset=${i} chunk=${chunk.length} inserted=${result.count}`);
  }
  return inserted;
}

async function syncCardSource(source: Source): Promise<{ source: string; pages: number; normalized: number; inserted: number }> {
  const first = await fetchJson(`${source.baseUrl}/api/cards/database?sort=name&sortdirection=asc&page=1`) as PagePayload;
  const lastPage = Number(first.last_page ?? 1);
  const pages = Array.from({ length: lastPage }, (_, i) => i + 1);
  const rows: CatalogItemProjection[] = [];
  await mapLimit(pages, 4, async (page) => {
    const payload = page === 1 ? first : await fetchJson(`${source.baseUrl}/api/cards/database?sort=name&sortdirection=asc&page=${page}`) as PagePayload;
    const cards = Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : [];
    const normalized = cards.map((card) => source.normalize(card)).filter((row): row is CatalogItemProjection => Boolean(row));
    rows.push(...normalized);
    if (page === 1 || page % 50 === 0 || page === lastPage) console.log(`[fast-carddb] fetched source=${source.key} page=${page}/${lastPage} rows=${normalized.length}`);
  });
  const inserted = await insertItems(rows, source.key);
  console.log(`[fast-carddb] source-complete source=${source.key} pages=${lastPage} normalized=${rows.length} inserted=${inserted}`);
  return { source: source.key, pages: lastPage, normalized: rows.length, inserted };
}

function parseDate(text: string): Date | null {
  const m = text.match(new RegExp(`^(${MONTHS})\\s+(\\d{1,2}),\\s+(\\d{4})$`));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), MONTH_INDEX[m[1] ?? ""] ?? 0, Number(m[2])));
}

function parseTemplateDisplay(templateBody: string): string | null {
  const parts = templateBody.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts[0]?.toUpperCase() !== "TCG") return null;
  return parts[2] ?? parts[1] ?? null;
}

function parseBulbapediaExpansionWikitext(wikitext: string): CatalogSetProjection[] {
  const sets: CatalogSetProjection[] = [];
  const seen = new Set<string>();
  for (const row of wikitext.split(/\n\|-/g)) {
    const dateMatch = row.match(DATE_RE);
    if (!dateMatch) continue;
    const tcgTemplates = [...row.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => parseTemplateDisplay(m[1] ?? "")).filter((x): x is string => Boolean(x));
    const wikiLinks = [...row.matchAll(/\[\[(?!File:|Image:|Category:)(?:[^\]|]+\|)?([^\]]+)\]\]/g)].map((m) => m[1]);
    const rawName = (tcgTemplates[0] ?? wikiLinks[0] ?? "").replace(/\s*\([^)]*\)\s*$/g, "").trim();
    if (!rawName || /Pokémon|Trading Card Game|Wizards of the Coast/i.test(rawName)) continue;
    const parsed = normalizeBulbapediaExpansionSet({ name: rawName, releaseDate: parseDate(dateMatch[0]), productCount: null });
    if (!parsed) continue;
    const key = `${parsed.source}|${parsed.sourceSetId}|${parsed.game}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sets.push(parsed);
  }
  return sets;
}

async function upsertCatalogSet(row: CatalogSetProjection): Promise<void> {
  const id = stableId("cset", [row.source, row.sourceSetId, row.game]);
  await retry(`upsertSet:${row.sourceSetId}`, () => prisma.$executeRaw`
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
      "isSupplemental" = EXCLUDED."isSupplemental",
      "searchText" = EXCLUDED."searchText",
      "isActive" = TRUE,
      "updatedAt" = NOW()
  `, 6);
}

async function syncBulbapedia(): Promise<{ source: string; normalizedSets: number; upsertedSets: number }> {
  const payload = await fetchJson("https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=List%20of%20Pok%C3%A9mon%20Trading%20Card%20Game%20expansions&prop=wikitext&format=json");
  const wikitext = payload?.parse?.wikitext?.["*"] ?? "";
  const sets = parseBulbapediaExpansionWikitext(wikitext);
  for (const set of sets) await upsertCatalogSet(set);
  console.log(`[fast-carddb] bulbapedia-complete normalizedSets=${sets.length} upsertedSets=${sets.length}`);
  return { source: BULBAPEDIA_SOURCE, normalizedSets: sets.length, upsertedSets: sets.length };
}

async function main() {
  if (process.env.CARDDB_DB_ENV !== "staging" || process.env.CARDDB_DRY_RUN !== "false") {
    throw new Error("Set CARDDB_DB_ENV=staging CARDDB_DRY_RUN=false for collaborator write");
  }
  await retry("connect", () => prisma.$connect(), 6);
  const before = await prisma.$queryRawUnsafe(`SELECT source, COUNT(*)::int AS count FROM "CatalogItem" WHERE source IN ('pokemoncard.io','onepiecedb.io','bulbapedia') GROUP BY source ORDER BY source`);
  console.log(`[fast-carddb] before=${JSON.stringify(before)}`);
  const results = [];
  for (const source of SOURCES) results.push(await syncCardSource(source));
  const bulbapedia = await syncBulbapedia();
  const afterItems = await prisma.$queryRawUnsafe(`SELECT source, COUNT(*)::int AS count FROM "CatalogItem" WHERE source IN ('pokemoncard.io','onepiecedb.io','bulbapedia') GROUP BY source ORDER BY source`);
  const afterSets = await prisma.$queryRawUnsafe(`SELECT source, COUNT(*)::int AS count FROM "CatalogSet" WHERE source IN ('pokemoncard.io','onepiecedb.io','bulbapedia') GROUP BY source ORDER BY source`);
  console.log(`[fast-carddb] results=${JSON.stringify({ results, bulbapedia })}`);
  console.log(`[fast-carddb] afterItems=${JSON.stringify(afterItems)}`);
  console.log(`[fast-carddb] afterSets=${JSON.stringify(afterSets)}`);
}

main().catch((err) => { console.error("[fast-carddb] failed", err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
