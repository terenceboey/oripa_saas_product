#!/usr/bin/env node
/* Read-only source discovery for setlist image truth: One Piece + Pokemon JP. */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join("docs", "plans", `setlist-source-discovery-${runId}`);

function csv(v) { return `"${String(v ?? "").replaceAll('"', '""')}"`; }
function norm(v) { return String(v ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/pokemon/g, "").replace(/pokémon/g, "").replace(/[^a-z0-9]/g, ""); }
function absOnePiece(u) { if (!u) return null; return u.startsWith("http") ? u : `https://en.onepiece-cardgame.com${u}`; }
async function getJson(url) { const r = await fetch(url, { headers: { "user-agent": "oripa-setlist-audit/1.0" } }); if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json(); }
async function getText(url) { const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 oripa-setlist-audit/1.0" } }); if (!r.ok) throw new Error(`${url} ${r.status}`); return r.text(); }
async function probeImage(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { method: "GET", headers: { "user-agent": "Mozilla/5.0 oripa-setlist-audit/1.0" } });
    const contentType = r.headers.get("content-type") || "";
    const buf = Buffer.from(await r.arrayBuffer());
    return { url, ok: r.ok && contentType.startsWith("image/") && buf.length > 128, status: r.status, contentType, bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
  } catch (error) { return { url, ok: false, error: error instanceof Error ? error.message : String(error) }; }
}

async function discoverOnePiece(rows) {
  const productByCode = new Map();
  for (let page = 1; page <= 12; page += 1) {
    const html = await getText(`https://en.onepiece-cardgame.com/products/?subcategory=&page=${page}&view=normal`);
    const blocks = html.split('<li class="linkListColBox"').slice(1);
    if (!blocks.length) break;
    for (const block of blocks) {
      const title = block.match(/<h4 class="linkListColTitle">([\s\S]*?)<\/h4>/)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const code = title?.match(/\[([A-Z0-9-]+)\]/)?.[1];
      const href = block.match(/<a href="([^"]+)" class="linkListColItem"/)?.[1];
      const img = block.match(/data-src="([^"]+)"/)?.[1] || block.match(/<img[^>]+src="([^"]+)"/)?.[1];
      if (code && !productByCode.has(code)) productByCode.set(code, { code, title, href, imageUrl: absOnePiece(img), sourcePage: page });
    }
  }
  const candidates = [];
  const rejections = [];
  for (const row of rows) {
    const code = String(row.setCode || "").split(/\s+/)[0];
    const product = productByCode.get(code);
    if (!product) {
      rejections.push({ lane: "onepiece", id: row.id, name: row.name, setCode: row.setCode, reason: "no_official_product_match", evidence: "official products scrape" });
      continue;
    }
    const probe = await probeImage(product.imageUrl);
    rejections.push({ lane: "onepiece", id: row.id, name: row.name, setCode: row.setCode, reason: "official_image_is_product_pack_not_set_artwork", evidence: product.imageUrl, probeOk: probe?.ok ?? false, productTitle: product.title });
  }
  return { productCount: productByCode.size, candidates, rejections };
}

async function discoverPokemonJp(rows) {
  const sets = await getJson("https://api.tcgdex.net/v2/ja/sets");
  const byId = new Map(sets.map((s) => [norm(s.id), s]));
  const byName = new Map(sets.map((s) => [norm(s.name), s]));
  const candidates = [];
  const rejections = [];
  for (const row of rows) {
    const codeKey = norm(row.setCode);
    const match = (codeKey && byId.get(codeKey)) || byName.get(norm(row.name));
    if (!match) {
      rejections.push({ lane: "pokemon_jp", id: row.id, name: row.name, setCode: row.setCode, sourceSetId: row.sourceSetId, reason: "no_unique_tcgdex_ja_code_or_name_match" });
      continue;
    }
    const logo = match.logo ? `${match.logo}.png` : null;
    const symbol = match.symbol ? `${match.symbol}.png` : null;
    const logoProbe = await probeImage(logo);
    const symbolProbe = await probeImage(symbol);
    if (!(logoProbe?.ok || symbolProbe?.ok)) {
      rejections.push({ lane: "pokemon_jp", id: row.id, name: row.name, setCode: row.setCode, providerSetId: match.id, providerName: match.name, reason: "tcgdex_ja_match_has_no_valid_image" });
      continue;
    }
    candidates.push({ lane: "pokemon_jp", id: row.id, name: row.name, setCode: row.setCode, sourceSetId: row.sourceSetId, provider: "tcgdex:ja", providerSetId: match.id, providerName: match.name, matchRule: codeKey && norm(match.id) === codeKey ? "setCode_equals_tcgdex_id" : "normalized_name", confidence: codeKey && norm(match.id) === codeKey ? "medium" : "low", logoImageUrl: logoProbe?.ok ? logo : "", symbolImageUrl: symbolProbe?.ok ? symbol : "", logoProbe, symbolProbe });
  }
  return { providerSetCount: sets.length, candidates, rejections };
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const before = { catalogSet: await prisma.catalogSet.count(), catalogItem: await prisma.catalogItem.count(), catalogSealedProduct: await prisma.catalogSealedProduct.count() };
  const onePieceRows = await prisma.catalogSet.findMany({ where: { isActive: true, game: "ONE_PIECE", language: "en" }, orderBy: { name: "asc" }, select: { id: true, name: true, setCode: true, sourceSetId: true, logoImageUrl: true, symbolImageUrl: true } });
  const jpRows = await prisma.catalogSet.findMany({ where: { isActive: true, OR: [{ game: "POKEMON_JAPAN" }, { game: "POKEMON", language: "ja" }] }, orderBy: [{ game: "asc" }, { name: "asc" }], select: { id: true, name: true, setCode: true, sourceSetId: true, game: true, language: true, logoImageUrl: true, symbolImageUrl: true } });
  const onepiece = await discoverOnePiece(onePieceRows);
  const pokemonJp = await discoverPokemonJp(jpRows);
  const after = { catalogSet: await prisma.catalogSet.count(), catalogItem: await prisma.catalogItem.count(), catalogSealedProduct: await prisma.catalogSealedProduct.count() };
  const payload = { runId, generatedAt: new Date().toISOString(), safety: { readOnly: true, before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) }, onepiece: { productCount: onepiece.productCount, targetRows: onePieceRows.length, candidates: onepiece.candidates.length, rejections: onepiece.rejections.length }, pokemonJp: { providerSetCount: pokemonJp.providerSetCount, targetRows: jpRows.length, candidates: pokemonJp.candidates.length, rejections: pokemonJp.rejections.length }, candidates: [...onepiece.candidates, ...pokemonJp.candidates], rejections: [...onepiece.rejections, ...pokemonJp.rejections] };
  await fs.writeFile(path.join(outDir, "source-discovery.json"), JSON.stringify(payload, null, 2));
  await fs.writeFile(path.join(outDir, "candidates.csv"), ["lane,id,name,setCode,sourceSetId,provider,providerSetId,providerName,matchRule,confidence,logoImageUrl,symbolImageUrl", ...payload.candidates.map((r) => [r.lane,r.id,r.name,r.setCode,r.sourceSetId,r.provider,r.providerSetId,r.providerName,r.matchRule,r.confidence,r.logoImageUrl,r.symbolImageUrl].map(csv).join(","))].join("\n") + "\n");
  await fs.writeFile(path.join(outDir, "rejections.csv"), ["lane,id,name,setCode,sourceSetId,reason,evidence,productTitle", ...payload.rejections.map((r) => [r.lane,r.id,r.name,r.setCode,r.sourceSetId,r.reason,r.evidence,r.productTitle].map(csv).join(","))].join("\n") + "\n");
  await fs.writeFile(path.join(outDir, "REPORT.md"), `# Setlist Official Source Discovery\n\nGenerated: ${payload.generatedAt}\n\n## Safety\n- Read-only: ${payload.safety.readOnly}\n- DB counts unchanged: ${payload.safety.unchanged}\n\n## One Piece\n- Target rows: ${payload.onepiece.targetRows}\n- Official products discovered: ${payload.onepiece.productCount}\n- Safe set-art candidates: ${payload.onepiece.candidates}\n- Rejections: ${payload.onepiece.rejections}\n- Verdict: official site exposes product/pack imagery; rejected as set artwork until a true set-logo/symbol source is found.\n\n## Pokemon JP\n- Target rows: ${payload.pokemonJp.targetRows}\n- TCGdex JA sets: ${payload.pokemonJp.providerSetCount}\n- Candidate rows: ${payload.pokemonJp.candidates}\n- Rejections: ${payload.pokemonJp.rejections}\n- Verdict: candidates are generated only for code/name matches and require review before apply because current DB mixes POKEMON/ja and POKEMON_JAPAN/en lanes.\n`);
  const files = await fs.readdir(outDir);
  const entries = [];
  for (const file of files.sort()) { const b = await fs.readFile(path.join(outDir, file)); entries.push({ file, bytes: b.length, sha256: crypto.createHash("sha256").update(b).digest("hex") }); }
  await fs.writeFile(path.join(outDir, "MANIFEST.json"), JSON.stringify({ runId, entries }, null, 2));
  console.log(JSON.stringify({ outDir, onepiece: payload.onepiece, pokemonJp: payload.pokemonJp, safety: payload.safety }, null, 2));
}
main().finally(() => prisma.$disconnect());
