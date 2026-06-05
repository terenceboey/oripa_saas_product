#!/usr/bin/env node
/*
 * Read-only setlist image truth candidate generator.
 *
 * Goal: find authoritative set-level images that could close the setlist image truth gap.
 * Safety: no DB writes, no upstream writes. Produces local artifacts and an unapplied SQL plan.
 */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = process.env.SETLIST_IMAGE_TRUTH_OUT_DIR ?? path.join("docs", "plans", `setlist-image-truth-fill-${RUN_ID}`);
const REQUEST_DELAY_MS = Number(process.env.SETLIST_IMAGE_TRUTH_DELAY_MS ?? "25");
const MAX_VALIDATE = Number(process.env.SETLIST_IMAGE_TRUTH_MAX_VALIDATE ?? "0");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/pokemon|tcg|trading card game/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function tokens(value) {
  return new Set(normalizeName(value).split(" ").filter(Boolean));
}

function tokenJaccard(a, b) {
  const aa = tokens(a);
  const bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  let inter = 0;
  for (const t of aa) if (bb.has(t)) inter += 1;
  return inter / (aa.size + bb.size - inter);
}

function tcgdexImageUrl(value) {
  const raw = asString(value);
  if (!raw) return null;
  if (/\.(png|webp|jpg|jpeg)$/i.test(raw)) return raw;
  return `${raw}.png`;
}

function quoteSql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows, columns) {
  return [columns.join(","), ...rows.map((row) => columns.map((col) => csvEscape(row[col])).join(","))].join("\n") + "\n";
}

function hasAnySetImage(set) {
  return Boolean(asString(set.logoImageUrl) || asString(set.symbolImageUrl) || asString(set.bannerImageUrl));
}

function riskyImageReasons(set) {
  const reasons = [];
  for (const [field, raw] of [["logo", set.logoImageUrl], ["symbol", set.symbolImageUrl], ["banner", set.bannerImageUrl]]) {
    const url = asString(raw);
    if (!url) continue;
    const lower = url.toLowerCase();
    if (lower.includes("tcgtracking.com/scan/set-symbol.php")) reasons.push(`${field}:tcgtracking_set_symbol_endpoint`);
    if (lower.includes("archives.bulbagarden.net")) reasons.push(`${field}:bulbagarden_archive_not_authoritative_for_this_gate`);
    if (lower.includes("images.pokemontcg.io")) {
      const leaf = lower.split("/").pop()?.replace(/\.(png|jpg|jpeg|webp)$/i, "") ?? "";
      // images.pokemontcg.io/<set>/logo.png and /symbol.png are set-level.
      // images.pokemontcg.io/<set>/<card-number>[_hires].png is card-level.
      if (!["logo", "symbol"].includes(leaf) && /\d/.test(leaf)) {
        reasons.push(`${field}:looks_like_card_image`);
      }
    }
  }
  return reasons;
}

function targetNeedsImageTruth(set) {
  return !hasAnySetImage(set) || riskyImageReasons(set).length > 0;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "oripa-setlist-image-truth-audit/1.0" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function fetchTcgdex(locale) {
  const rows = await fetchJson(`https://api.tcgdex.net/v2/${locale}/sets`);
  return rows.map((row) => ({
    provider: `tcgdex:${locale}`,
    providerSetId: row.id,
    providerName: row.name,
    normName: normalizeName(row.name),
    normCode: normalizeCode(row.id),
    logoImageUrl: tcgdexImageUrl(row.logo),
    symbolImageUrl: tcgdexImageUrl(row.symbol),
    cardTotal: row.cardCount?.total ?? null,
    cardOfficial: row.cardCount?.official ?? null,
  }));
}

function indexProviderRows(rows) {
  const byName = new Map();
  const byCode = new Map();
  for (const row of rows) {
    if (row.normName) {
      const bucket = byName.get(row.normName) ?? [];
      bucket.push(row);
      byName.set(row.normName, bucket);
    }
    if (row.normCode) {
      const bucket = byCode.get(row.normCode) ?? [];
      bucket.push(row);
      byCode.set(row.normCode, bucket);
    }
  }
  return { byName, byCode };
}

function pickTcgdexCandidate(set, providers) {
  if (set.game !== "POKEMON" || set.language !== "en") {
    return {
      status: "rejected",
      reason: set.game === "POKEMON" && set.language === "ja" ? "pokemon_jp_name_language_mismatch" : "no_authoritative_set_image_provider_for_lane",
    };
  }

  const normName = normalizeName(set.name);
  const normCode = normalizeCode(set.setCode);
  const exactName = providers.en.byName.get(normName) ?? [];
  const exactCode = normCode ? providers.en.byCode.get(normCode) ?? [] : [];

  const exactNameWithImage = exactName.filter((c) => c.logoImageUrl || c.symbolImageUrl);
  if (exactNameWithImage.length === 1) {
    return { status: "candidate", confidence: "high", matchRule: "exact_normalized_name", candidate: exactNameWithImage[0], score: 1 };
  }

  const exactCodeWithImage = exactCode.filter((c) => c.logoImageUrl || c.symbolImageUrl);
  if (exactCodeWithImage.length === 1) {
    const score = tokenJaccard(set.name, exactCodeWithImage[0].providerName);
    if (score >= 0.72) {
      return { status: "candidate", confidence: "high", matchRule: "exact_provider_id_or_code_plus_name_score", candidate: exactCodeWithImage[0], score };
    }
    return { status: "rejected", reason: "code_match_name_score_too_low", bestProviderName: exactCodeWithImage[0].providerName, score };
  }

  const fuzzy = providers.en.rows
    .filter((c) => c.logoImageUrl || c.symbolImageUrl)
    .map((c) => ({ c, score: tokenJaccard(set.name, c.providerName) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (fuzzy[0]?.score >= 0.92 && fuzzy[0].score - (fuzzy[1]?.score ?? 0) >= 0.2) {
    return { status: "candidate", confidence: "medium", matchRule: "unique_high_token_similarity", candidate: fuzzy[0].c, score: fuzzy[0].score };
  }

  return {
    status: "rejected",
    reason: fuzzy[0] ? "no_exact_or_safe_unique_match" : "provider_has_no_match",
    bestProviderName: fuzzy[0]?.c.providerName ?? null,
    score: fuzzy[0]?.score ?? null,
  };
}

async function validateImage(url, field) {
  const raw = asString(url);
  if (!raw) return null;
  try {
    const res = await fetch(raw, { headers: { "user-agent": "oripa-setlist-image-truth-audit/1.0" } });
    const contentType = res.headers.get("content-type") ?? "";
    const arrayBuffer = await res.arrayBuffer();
    const bytes = arrayBuffer.byteLength;
    const signature = Buffer.from(arrayBuffer.slice(0, 16)).toString("hex");
    const ok = res.ok && /^image\//i.test(contentType) && bytes >= (field === "symbolImageUrl" ? 300 : 1_000);
    return { url: raw, ok, status: res.status, contentType, bytes, signature };
  } catch (error) {
    return { url: raw, ok: false, error: String(error) };
  }
}

async function counts() {
  const [catalogSet, catalogItem, catalogSealedProduct] = await Promise.all([
    prisma.catalogSet.count(),
    prisma.catalogItem.count(),
    prisma.catalogSealedProduct.count(),
  ]);
  return { catalogSet, catalogItem, catalogSealedProduct };
}

async function sha256(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

async function writeArtifacts(payload) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = [];
  async function put(name, content) {
    const file = path.join(OUT_DIR, name);
    await fs.writeFile(file, content);
    const stat = await fs.stat(file);
    files.push({ file: name, bytes: stat.size, sha256: await sha256(file) });
  }

  const candidateRows = payload.candidates.map((c) => ({
    id: c.id,
    source: c.source,
    game: c.game,
    language: c.language,
    sourceSetId: c.sourceSetId,
    setCode: c.setCode,
    name: c.name,
    matchRule: c.matchRule,
    confidence: c.confidence,
    provider: c.provider,
    providerSetId: c.providerSetId,
    providerName: c.providerName,
    score: c.score,
    logoImageUrl: c.next.logoImageUrl,
    symbolImageUrl: c.next.symbolImageUrl,
    currentLogoImageUrl: c.current.logoImageUrl,
    currentSymbolImageUrl: c.current.symbolImageUrl,
    currentBannerImageUrl: c.current.bannerImageUrl,
  }));
  const rejectedRows = payload.rejections.map((r) => ({
    id: r.id,
    source: r.source,
    game: r.game,
    language: r.language,
    sourceSetId: r.sourceSetId,
    setCode: r.setCode,
    name: r.name,
    reason: r.reason,
    bestProviderName: r.bestProviderName,
    score: r.score,
    currentRiskReasons: r.currentRiskReasons.join(";"),
  }));

  const sql = [
    "-- DRY-RUN ONLY: generated candidate updates. Do not apply to production without explicit approval.",
    "-- Intended fields: CatalogSet.logoImageUrl/symbolImageUrl plus sourcePayload provenance.",
    "-- This file was NOT executed by the campaign.",
    "BEGIN;",
    ...payload.candidates.map((c) => {
      const provenance = JSON.stringify({
        provider: c.provider,
        providerSetId: c.providerSetId,
        providerName: c.providerName,
        matchRule: c.matchRule,
        confidence: c.confidence,
        score: c.score,
        generatedAt: payload.run.generatedAt,
        validation: c.validation,
      });
      return `UPDATE "CatalogSet" SET "logoImageUrl" = ${quoteSql(c.next.logoImageUrl)}, "symbolImageUrl" = ${quoteSql(c.next.symbolImageUrl)}, "sourcePayload" = COALESCE("sourcePayload", '{}'::jsonb) || jsonb_build_object('__oripaSetImageTruthCandidate', ${quoteSql(provenance)}::jsonb) WHERE "id" = ${quoteSql(c.id)};`;
    }),
    "ROLLBACK;",
    "-- Replace ROLLBACK with COMMIT only after local/staging approval + post-apply audit.",
    "",
  ].join("\n");

  const report = [
    "# Setlist Image Truth Gap Fill Candidates",
    "",
    `Generated: ${payload.run.generatedAt}`,
    "",
    "## Safety",
    "",
    "- Mode: read-only candidate generation",
    "- DB writes: none",
    "- Upstream push: none",
    "- SQL plan: generated with `ROLLBACK`; not executed",
    "",
    "## Coverage",
    "",
    `- Target active sets needing image truth repair: ${payload.summary.targetsNeedingRepair}`,
    `- Safe candidates: ${payload.summary.candidates}`,
    `- Rejected/no safe candidate: ${payload.summary.rejections}`,
    `- Existing active sets with no set image: ${payload.summary.noSetImage}`,
    `- Existing active sets with risky image: ${payload.summary.riskySetImage}`,
    "",
    "## Candidate breakdown",
    "",
    ...Object.entries(payload.summary.candidatesByProvider).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Rejection breakdown",
    "",
    ...Object.entries(payload.summary.rejectionsByReason).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Interpretation",
    "",
    "This pass only accepts authoritative TCGdex Pokémon EN set-level logo/symbol matches. It deliberately refuses One Piece and Japanese Pokémon rows where the available source is a product/card image, language-mismatched, or lacks an exact/safe match.",
    "",
    "Remaining rejected rows should become separate repair lanes: One Piece official set-art source discovery, Pokémon JP language/source mapping, and UI/API fallback removal.",
    "",
  ].join("\n");

  await put("REPORT.md", report);
  await put("candidate-updates.csv", toCsv(candidateRows, ["id", "source", "game", "language", "sourceSetId", "setCode", "name", "matchRule", "confidence", "provider", "providerSetId", "providerName", "score", "logoImageUrl", "symbolImageUrl", "currentLogoImageUrl", "currentSymbolImageUrl", "currentBannerImageUrl"]));
  await put("rejections.csv", toCsv(rejectedRows, ["id", "source", "game", "language", "sourceSetId", "setCode", "name", "reason", "bestProviderName", "score", "currentRiskReasons"]));
  await put("candidate-updates.sql", sql);
  await put("setlist-image-truth-fill.json", JSON.stringify(payload, null, 2));
  await put("MANIFEST.json", JSON.stringify({ generatedAt: payload.run.generatedAt, outDir: OUT_DIR, entries: files }, null, 2));
  return files;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const beforeCounts = await counts();
  const sets = await prisma.catalogSet.findMany({
    where: { isActive: true },
    orderBy: [{ game: "asc" }, { language: "asc" }, { releaseDate: "desc" }, { name: "asc" }],
    select: {
      id: true,
      source: true,
      game: true,
      language: true,
      sourceSetId: true,
      sourceCategoryId: true,
      setCode: true,
      name: true,
      releaseDate: true,
      logoImageUrl: true,
      symbolImageUrl: true,
      bannerImageUrl: true,
    },
  });

  const [tcgdexEnRows, tcgdexJaRows] = await Promise.all([fetchTcgdex("en"), fetchTcgdex("ja")]);
  const providers = {
    en: { rows: tcgdexEnRows, ...indexProviderRows(tcgdexEnRows) },
    ja: { rows: tcgdexJaRows, ...indexProviderRows(tcgdexJaRows) },
  };

  const targets = sets.filter(targetNeedsImageTruth);
  const candidates = [];
  const rejections = [];
  let validations = 0;

  for (const set of targets) {
    const picked = pickTcgdexCandidate(set, providers);
    const currentRiskReasons = riskyImageReasons(set);
    if (picked.status !== "candidate") {
      rejections.push({ ...set, reason: picked.reason, bestProviderName: picked.bestProviderName ?? null, score: picked.score ?? null, currentRiskReasons });
      continue;
    }

    const next = {
      logoImageUrl: picked.candidate.logoImageUrl,
      symbolImageUrl: picked.candidate.symbolImageUrl,
    };
    const validation = {};
    if (!MAX_VALIDATE || validations < MAX_VALIDATE) {
      validation.logoImageUrl = await validateImage(next.logoImageUrl, "logoImageUrl");
      await sleep(REQUEST_DELAY_MS);
      validation.symbolImageUrl = await validateImage(next.symbolImageUrl, "symbolImageUrl");
      await sleep(REQUEST_DELAY_MS);
      validations += 1;
    }
    if ((next.logoImageUrl && validation.logoImageUrl && !validation.logoImageUrl.ok) || (next.symbolImageUrl && validation.symbolImageUrl && !validation.symbolImageUrl.ok)) {
      rejections.push({ ...set, reason: "candidate_image_validation_failed", bestProviderName: picked.candidate.providerName, score: picked.score, currentRiskReasons });
      continue;
    }

    candidates.push({
      id: set.id,
      source: set.source,
      game: set.game,
      language: set.language,
      sourceSetId: set.sourceSetId,
      sourceCategoryId: set.sourceCategoryId,
      setCode: set.setCode,
      name: set.name,
      matchRule: picked.matchRule,
      confidence: picked.confidence,
      provider: picked.candidate.provider,
      providerSetId: picked.candidate.providerSetId,
      providerName: picked.candidate.providerName,
      score: picked.score,
      current: {
        logoImageUrl: set.logoImageUrl,
        symbolImageUrl: set.symbolImageUrl,
        bannerImageUrl: set.bannerImageUrl,
        riskReasons: currentRiskReasons,
      },
      next,
      validation,
    });
  }

  const afterCounts = await counts();
  const rejectionsByReason = Object.fromEntries(Object.entries(rejections.reduce((acc, r) => {
    acc[r.reason] = (acc[r.reason] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]));
  const candidatesByProvider = Object.fromEntries(Object.entries(candidates.reduce((acc, c) => {
    acc[c.provider] = (acc[c.provider] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]));

  const payload = {
    run: { generatedAt, outDir: OUT_DIR, mode: "read_only_candidate_generation", dbCountsUnchanged: JSON.stringify(beforeCounts) === JSON.stringify(afterCounts), beforeCounts, afterCounts },
    summary: {
      totalActiveSets: sets.length,
      noSetImage: sets.filter((s) => !hasAnySetImage(s)).length,
      riskySetImage: sets.filter((s) => riskyImageReasons(s).length > 0).length,
      targetsNeedingRepair: targets.length,
      candidates: candidates.length,
      rejections: rejections.length,
      candidatesByProvider,
      rejectionsByReason,
    },
    providers: {
      tcgdexEnSets: tcgdexEnRows.length,
      tcgdexJaSets: tcgdexJaRows.length,
    },
    candidates,
    rejections,
  };
  const files = await writeArtifacts(payload);
  console.log(JSON.stringify({ outDir: OUT_DIR, summary: payload.summary, dbCountsUnchanged: payload.run.dbCountsUnchanged, files }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
