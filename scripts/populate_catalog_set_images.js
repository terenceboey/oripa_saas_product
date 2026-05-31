#!/usr/bin/env node
/*
 * Populate missing CatalogSet image URLs from deterministic, source-backed providers.
 * Dry-run by default. Live writes require:
 *   SET_IMAGE_BACKFILL_DRY_RUN=false
 *   SET_IMAGE_BACKFILL_DB_ENV=production
 *   SET_IMAGE_BACKFILL_ALLOW_LIVE_WRITE=true
 */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY_RUN = String(process.env.SET_IMAGE_BACKFILL_DRY_RUN ?? 'true').toLowerCase() !== 'false';
const DB_ENV = process.env.SET_IMAGE_BACKFILL_DB_ENV ?? 'local';
const ALLOW_LIVE_WRITE = String(process.env.SET_IMAGE_BACKFILL_ALLOW_LIVE_WRITE ?? 'false').toLowerCase() === 'true';
const MAX_UPDATES = Number(process.env.SET_IMAGE_BACKFILL_MAX_UPDATES ?? '0');
const VERIFY_URLS = String(process.env.SET_IMAGE_BACKFILL_VERIFY_URLS ?? 'true').toLowerCase() !== 'false';
const OUT_DIR = process.env.SET_IMAGE_BACKFILL_OUT_DIR ?? path.join('docs', 'plans');
const USER_AGENT = 'oripa-saas-set-image-backfill/1.0';

function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}
function asText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}
function nonEmptyImage(value) {
  const text = asText(value);
  if (!text || !/^https?:\/\//i.test(text)) return null;
  return text;
}
function stableImageKey(candidate) {
  return [candidate.symbolImageUrl ?? '', candidate.logoImageUrl ?? '', candidate.bannerImageUrl ?? ''].join('|');
}
async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * attempt);
    }
  }
  throw lastError;
}
async function fetchJson(url) {
  const response = await fetchWithRetry(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT } });
  const text = await response.text();
  if (!response.ok) throw new Error(`GET ${url} failed status=${response.status} body=${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
async function urlLooksRealImage(url) {
  if (!VERIFY_URLS) return true;
  try {
    const response = await fetchWithRetry(url, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow' }, 3);
    const contentType = response.headers.get('content-type') || '';
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (!response.ok || !contentType.startsWith('image/')) return false;
    const bytes = Buffer.from(await response.arrayBuffer());
    // TCGTracking returns a 1x1 transparent placeholder as a 68-byte PNG for absent set symbols.
    if (bytes.length <= 100 || contentLength === 68) return false;
    return true;
  } catch {
    return false;
  }
}
function hasAnyImage(row) {
  return Boolean(row.symbolImageUrl || row.logoImageUrl || row.bannerImageUrl);
}
async function loadPokemonTcgImages() {
  const data = await fetchJson('https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=releaseDate');
  const out = new Map();
  for (const set of data.data || []) {
    const name = asText(set.name);
    if (!name) continue;
    const key = normalizeName(name);
    const candidate = {
      provider: 'pokemontcg.io/v2/sets',
      sourceSetId: set.id,
      sourceName: name,
      symbolImageUrl: nonEmptyImage(set.images?.symbol),
      logoImageUrl: nonEmptyImage(set.images?.logo),
      bannerImageUrl: null,
      confidence: 'exact_normalized_name',
      raw: { id: set.id, name: set.name, series: set.series, releaseDate: set.releaseDate, images: set.images },
    };
    if (!hasAnyImage(candidate)) continue;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(candidate);
  }
  return out;
}
function buildExistingImageIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    if (!hasAnyImage(row)) continue;
    const key = `${row.game}|${normalizeName(row.name)}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({
      provider: 'existing_catalogset_exact_name',
      sourceRowId: row.id,
      source: row.source,
      sourceSetId: row.sourceSetId,
      sourceName: row.name,
      symbolImageUrl: nonEmptyImage(row.symbolImageUrl),
      logoImageUrl: nonEmptyImage(row.logoImageUrl),
      bannerImageUrl: nonEmptyImage(row.bannerImageUrl),
      confidence: 'same_game_exact_normalized_name',
    });
  }
  return index;
}
function chooseUnique(candidates) {
  if (!candidates || !candidates.length) return null;
  const byKey = new Map();
  for (const candidate of candidates) byKey.set(stableImageKey(candidate), candidate);
  return byKey.size === 1 ? [...byKey.values()][0] : null;
}
function tcgtrackingSymbolCandidate(row) {
  const sourceCategoryId = asText(row.sourceCategoryId);
  const setCode = asText(row.setCode);
  // The scan endpoint returns real set symbols for Pokémon EN category 3; tested categories
  // like 68/85 and most other TCGCSV games currently return 1x1 placeholder PNGs.
  if (row.source !== 'tcgtracking' || sourceCategoryId !== '3' || row.game !== 'POKEMON' || row.language !== 'en' || !setCode) return null;
  return {
    provider: 'tcgtracking_set_symbol_endpoint',
    sourceCategoryId,
    sourceName: row.name,
    symbolImageUrl: `https://tcgtracking.com/scan/set-symbol.php?game=${encodeURIComponent(sourceCategoryId)}&set=${encodeURIComponent(setCode)}`,
    logoImageUrl: null,
    bannerImageUrl: null,
    confidence: 'source_category_and_set_code_validated_image',
  };
}
async function buildPlan() {
  const rows = await prisma.$queryRawUnsafe(`
    select id, source, game, language, name, "setCode", "sourceSetId", "sourceCategoryId",
      "symbolImageUrl", "logoImageUrl", "bannerImageUrl", "sourcePayload"
    from "CatalogSet"
    order by game, source, name
  `);
  const missing = rows.filter((row) => !hasAnyImage(row));
  const existingIndex = buildExistingImageIndex(rows);
  const pokemonIndex = await loadPokemonTcgImages();
  const plan = [];
  const skipped = [];

  for (const row of missing) {
    let candidate = null;
    const reasons = [];

    if (row.game === 'POKEMON' && row.language === 'en') {
      candidate = chooseUnique(pokemonIndex.get(normalizeName(row.name)));
      if (candidate) reasons.push('matched PokemonTCG API exact normalized name');
    }

    if (!candidate) {
      candidate = chooseUnique(existingIndex.get(`${row.game}|${normalizeName(row.name)}`));
      if (candidate) reasons.push('matched existing CatalogSet exact normalized name with unique image tuple');
    }

    if (!candidate) {
      const tcgCandidate = tcgtrackingSymbolCandidate(row);
      if (tcgCandidate && await urlLooksRealImage(tcgCandidate.symbolImageUrl)) {
        candidate = tcgCandidate;
        reasons.push('validated TCGTracking set-symbol endpoint returned non-placeholder image');
      }
    }

    if (!candidate) {
      skipped.push({ id: row.id, source: row.source, game: row.game, language: row.language, name: row.name, setCode: row.setCode, reason: 'no deterministic source-backed image candidate' });
      continue;
    }

    // PokemonTCG API and already-stored CatalogSet URLs are trusted provenance; validate only synthesized TCGTracking scan URLs.
    if (candidate.provider === 'tcgtracking_set_symbol_endpoint') {
      if (candidate.symbolImageUrl && !(await urlLooksRealImage(candidate.symbolImageUrl))) {
        skipped.push({ id: row.id, source: row.source, game: row.game, language: row.language, name: row.name, setCode: row.setCode, reason: 'candidate symbol URL failed image validation', candidate });
        continue;
      }
      if (candidate.logoImageUrl && !(await urlLooksRealImage(candidate.logoImageUrl))) {
        skipped.push({ id: row.id, source: row.source, game: row.game, language: row.language, name: row.name, setCode: row.setCode, reason: 'candidate logo URL failed image validation', candidate });
        continue;
      }
    }

    plan.push({
      id: row.id,
      source: row.source,
      game: row.game,
      language: row.language,
      name: row.name,
      setCode: row.setCode,
      symbolImageUrl: candidate.symbolImageUrl,
      logoImageUrl: candidate.logoImageUrl,
      bannerImageUrl: candidate.bannerImageUrl,
      provenance: {
        importer: 'populate_catalog_set_images',
        provider: candidate.provider,
        confidence: candidate.confidence,
        reasons,
        sourceName: candidate.sourceName,
        sourceSetId: candidate.sourceSetId ?? null,
        sourceRowId: candidate.sourceRowId ?? null,
        source: candidate.source ?? null,
        sourceCategoryId: candidate.sourceCategoryId ?? null,
        updatedAt: new Date().toISOString(),
      },
      raw: candidate.raw ?? null,
    });
  }

  return { plan, skipped, totalSets: rows.length, missingBefore: missing.length };
}
async function applyPlan(plan) {
  if (!plan.length) return 0;
  const updates = MAX_UPDATES > 0 ? plan.slice(0, MAX_UPDATES) : plan;
  if (DRY_RUN) return 0;
  if (DB_ENV === 'production' && !ALLOW_LIVE_WRITE) {
    throw new Error('Refusing production write without SET_IMAGE_BACKFILL_ALLOW_LIVE_WRITE=true');
  }
  const result = await prisma.$executeRawUnsafe(`
    WITH data AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
        id text,
        "symbolImageUrl" text,
        "logoImageUrl" text,
        "bannerImageUrl" text,
        provenance jsonb,
        raw jsonb
      )
    )
    UPDATE "CatalogSet" cs SET
      "symbolImageUrl" = COALESCE(cs."symbolImageUrl", data."symbolImageUrl"),
      "logoImageUrl" = COALESCE(cs."logoImageUrl", data."logoImageUrl"),
      "bannerImageUrl" = COALESCE(cs."bannerImageUrl", data."bannerImageUrl"),
      "sourcePayload" = COALESCE(cs."sourcePayload", '{}'::jsonb) || jsonb_build_object(
        '__oripaSetImageBackfill', data.provenance,
        '__oripaSetImageBackfillRaw', data.raw
      ),
      "updatedAt" = now()
    FROM data
    WHERE cs.id = data.id
      AND COALESCE(cs."symbolImageUrl", cs."logoImageUrl", cs."bannerImageUrl") IS NULL
  `, JSON.stringify(updates));
  return Number(result);
}
async function coverage() {
  const rows = await prisma.$queryRawUnsafe(`
    select source, game, language, count(*)::int as total,
      count(*) filter (where coalesce("symbolImageUrl","logoImageUrl","bannerImageUrl") is not null)::int as with_image,
      count(*) filter (where coalesce("symbolImageUrl","logoImageUrl","bannerImageUrl") is null)::int as missing
    from "CatalogSet"
    group by source, game, language
    order by missing desc, total desc
  `);
  return rows;
}
async function main() {
  const before = await coverage();
  const { plan, skipped, totalSets, missingBefore } = await buildPlan();
  const limitedPlan = MAX_UPDATES > 0 ? plan.slice(0, MAX_UPDATES) : plan;
  const changed = await applyPlan(plan);
  const after = await coverage();
  const out = {
    dryRun: DRY_RUN,
    dbEnv: DB_ENV,
    allowLiveWrite: ALLOW_LIVE_WRITE,
    maxUpdates: MAX_UPDATES,
    totalSets,
    missingBefore,
    plannedUpdates: plan.length,
    attemptedUpdates: limitedPlan.length,
    changed,
    skipped: skipped.length,
    before,
    after,
    updatesByProvider: plan.reduce((acc, row) => { const k = row.provenance.provider; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
    sampleUpdates: plan.slice(0, 25),
    sampleSkipped: skipped.slice(0, 50),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(OUT_DIR, `catalog-set-image-backfill-${DRY_RUN ? 'dry-run' : 'apply'}-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ jsonPath, dryRun: DRY_RUN, plannedUpdates: plan.length, attemptedUpdates: limitedPlan.length, changed, skipped: skipped.length, updatesByProvider: out.updatesByProvider }, null, 2));
}
main().catch(async (error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
