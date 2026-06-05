#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = path.join("docs/plans", `setlist-image-url-strict-backfill-${RUN_ID}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const OFFICIAL_ONEPIECE_HOST = "https://en.onepiece-cardgame.com";
const MANUAL_ONEPIECE_SLUGS = {
  "The Azure Sea's Seven": ["op14-eb04"],
  "The Azure Sea's Seven Release Event Cards": ["op14-eb04"],
  "Adventure on Kami's Island Release Event Cards": ["op15-eb04"],
  "Starter Deck 1: Straw Hat Crew": ["st01-04"],
  "Starter Deck 2: Worst Generation": ["st01-04"],
  "Starter Deck 3: The Seven Warlords of The Sea": ["st01-04"],
  "Starter Deck 4: Animal Kingdom Pirates": ["st01-04"],
  "Learn Together Deck Set": ["ld01"],
  "Super Pre-Release Starter Deck 1: Straw Hat Crew": ["st01-04_pre"],
  "Super Pre-Release Starter Deck 2: Worst Generation": ["st01-04_pre"],
  "Super Pre-Release Starter Deck 3: The Seven Warlords of the Sea": ["st01-04_pre"],
  "Super Pre-Release Starter Deck 4: Animal Kingdom Pirates": ["st01-04_pre"],
};

const SPECIAL_POKEMON_URLS = {
  "ME05: Pitch Black": {
    logoImageUrl: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/me_series/me05/me05-logo.png",
    symbolImageUrl: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/me_series/me05/me05-symbol.png",
    bannerImageUrl: "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/me_series/me05/me05-banner.png",
    reason: "manual_official_pokemon_com_me05",
    evidence: "https://www.pokemon.com/us/pokemon-tcg/mega-evolution-pitch-black",
  },
  "ME01: Mega Evolution": {
    logoImageUrl: "https://images.scrydex.com/pokemon/me1-logo/logo",
    symbolImageUrl: null,
    bannerImageUrl: null,
    reason: "manual_scrydex_me01_set_logo",
    evidence: "https://scrydex.com",
  },
  "ME02: Phantasmal Flames": {
    logoImageUrl: "https://images.scrydex.com/pokemon/me2-logo/logo",
    symbolImageUrl: null,
    bannerImageUrl: null,
    reason: "manual_scrydex_me02_set_logo",
    evidence: "https://scrydex.com",
  },
  "SV: Black Bolt": {
    logoImageUrl: "https://images.scrydex.com/pokemon/sv10pt5-logo/logo",
    symbolImageUrl: null,
    bannerImageUrl: null,
    reason: "manual_scrydex_black_bolt_set_logo",
    evidence: "https://scrydex.com",
  },
  "SV: White Flare": {
    logoImageUrl: "https://images.scrydex.com/pokemon/sv10pt5-logo/logo",
    symbolImageUrl: null,
    bannerImageUrl: null,
    reason: "manual_scrydex_white_flare_set_logo",
    evidence: "https://scrydex.com",
  },
  "Trick or Trade BOOster Bundle 2023": {
    logoImageUrl: "https://archives.bulbagarden.net/media/upload/0/00/Trick_or_Trade_2023.png",
    symbolImageUrl: null,
    bannerImageUrl: null,
    reason: "manual_bulbagarden_trick_or_trade_2023_logo_like_set_art",
    evidence: "https://archives.bulbagarden.net/wiki/File:Trick_or_Trade_2023.png",
  },
  "Trick or Trade BOOster Bundle 2024": {
    logoImageUrl: "https://archives.bulbagarden.net/media/upload/e/ed/Trick_or_Trade_2024.png",
    symbolImageUrl: null,
    bannerImageUrl: null,
    reason: "manual_bulbagarden_trick_or_trade_2024_logo_like_set_art",
    evidence: "https://archives.bulbagarden.net/wiki/File:Trick_or_Trade_2024.png",
  },
};

const SPECIAL_JP_URLS = {
  "SVM: Generations Start Decks": {
    logoImageUrl: "https://archives.bulbagarden.net/media/upload/f/ff/SVM_Generations_Start_Decks_logo.png",
    symbolImageUrl: null,
    bannerImageUrl: null,
    reason: "manual_bulbagarden_svm_generations_start_decks_logo",
    evidence: "https://archives.bulbagarden.net/wiki/File:SVM_Generations_Start_Decks_logo.png",
  },
};

const MANUAL_POKEMON_IDS = {
  "Pokemon GO": { id: "pgo", reason: "manual_exact_pokemon_go" },
  "Pokémon GO": { id: "pgo", reason: "manual_exact_pokemon_go" },
  "Rumble": { id: "ru1", reason: "manual_exact_pokemon_rumble" },
  "Hidden Fates: Shiny Vault": { id: "sma", reason: "manual_exact_hidden_fates_shiny_vault" },
  "Shining Fates: Shiny Vault": { id: "swsh45sv", reason: "manual_exact_shining_fates_shiny_vault" },
  "Nintendo Promos": { id: "np", reason: "manual_exact_nintendo_promos" },
  "XY Promos": { id: "xyp", reason: "manual_exact_xy_promos" },
  "Black and White Promos": { id: "bwp", reason: "manual_exact_bw_promos" },
  "HGSS Promos": { id: "hsp", reason: "manual_exact_hgss_promos" },
  "SWSH: Sword & Shield Promo Cards": { id: "swshp", reason: "manual_exact_swsh_promos" },
  "SV: Scarlet & Violet Promo Cards": { id: "svp", reason: "manual_exact_sv_promos" },
  "SV: Scarlet & Violet 151": { id: "sv3pt5", reason: "manual_exact_151" },
  "ME: Mega Evolution Promo": { id: "me1", reason: "manual_exact_mega_evolution_promos" },
  "SWSH: Crown Zenith": { id: "swsh12pt5", reason: "manual_exact_crown_zenith" },
  "SWSH: Crown Zenith: Galarian Gallery": { id: "swsh12pt5gg", reason: "manual_exact_crown_zenith_gg" },
  "SM Promos": { id: "smp", reason: "manual_exact_sm_promos" },
  "McDonald's 25th Anniversary Promos": { id: "mcd21", reason: "manual_exact_mcdonalds_25th" },
  "McDonald's Promos 2011": { id: "mcd11", reason: "manual_exact_mcdonalds_2011" },
  "McDonald's Promos 2012": { id: "mcd12", reason: "manual_exact_mcdonalds_2012" },
  "McDonald's Promos 2014": { id: "mcd14", reason: "manual_exact_mcdonalds_2014" },
  "McDonald's Promos 2015": { id: "mcd15", reason: "manual_exact_mcdonalds_2015" },
  "McDonald's Promos 2016": { id: "mcd16", reason: "manual_exact_mcdonalds_2016" },
  "McDonald's Promos 2017": { id: "mcd17", reason: "manual_exact_mcdonalds_2017" },
  "McDonald's Promos 2018": { id: "mcd18", reason: "manual_exact_mcdonalds_2018" },
  "McDonald's Promos 2019": { id: "mcd19", reason: "manual_exact_mcdonalds_2019" },
  "McDonald's Promos 2022": { id: "mcd22", reason: "manual_exact_mcdonalds_2022" },
  "EX Trainer Kit 1: Latias & Latios": { id: "tk1a", reason: "manual_trainer_kit_primary_symbol" },
  "EX Trainer Kit 2: Plusle & Minun": { id: "tk2a", reason: "manual_trainer_kit_primary_symbol" },
  "XY Trainer Kit: Latias & Latios": { id: "tk1a", reason: "manual_trainer_kit_primary_symbol" },
  "Best of Promos": { id: "bp", reason: "manual_best_of_game_promos" },
};

function norm(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/pokémon/g, "pokemon")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function coreName(row) {
  return norm(row.name)
    .replace(/^sv\d+ /, "")
    .replace(/^sv /, "")
    .replace(/^swsh\d+ /, "")
    .replace(/^swsh /, "")
    .replace(/^sm /, "")
    .replace(/^xy /, "")
    .replace(/ base set$/, "")
    .replace(/ promo cards$/, " promos")
    .trim();
}

function nameCompatible(row, official) {
  const local = coreName(row);
  const off = norm(official.name);
  return !!local && !!off && (local === off || local.includes(off) || off.includes(local));
}

function pokemonOfficialIdForRow(row, officialByName, officialByPtcgoCode) {
  const manual = MANUAL_POKEMON_IDS[row.name];
  if (manual) return manual;

  const exactName = officialByName.get(norm(row.name));
  if (exactName) return { id: exactName.id, reason: "official_exact_name" };

  const popMatch = row.name.match(/^POP Series (\d+)$/i);
  if (popMatch) return { id: `pop${popMatch[1]}`, reason: "official_pop_series_number" };

  const swshTg = row.name.match(/^SWSH(\d+): .*Trainer Gallery$/i);
  if (swshTg) return { id: `swsh${Number(swshTg[1])}tg`, reason: "official_swsh_trainer_gallery_number" };

  const swsh = row.name.match(/^SWSH(\d+): /i);
  if (swsh) return { id: `swsh${Number(swsh[1])}`, reason: "official_swsh_number" };

  const sv = row.name.match(/^SV0?(\d+): /i);
  if (sv) return { id: `sv${Number(sv[1])}`, reason: "official_sv_number" };

  const sm = row.name.match(/^SM(?: - | Base Set)/i) && row.setCode?.match(/^SM0?(\d+)$/i);
  if (sm) return { id: `sm${Number(sm[1])}`, reason: "official_sm_number" };

  if (/^XY Base Set$/i.test(row.name)) return { id: "xy1", reason: "official_xy_base" };
  if (/^Base Set$/i.test(row.name)) return { id: "base1", reason: "official_base_set" };
  if (/^Base Set \(Shadowless\)$/i.test(row.name)) return { id: "base1", reason: "official_base_set_shadowless_same_art" };
  if (/^Expedition$/i.test(row.name)) return { id: "ecard1", reason: "official_expedition_base_set" };
  if (/^WoTC Promo$/i.test(row.name)) return { id: "basep", reason: "official_wotc_promos" };
  if (/^Diamond and Pearl Promos$/i.test(row.name)) return { id: "dpp", reason: "official_dp_promos" };
  if (/^HeartGold SoulSilver$/i.test(row.name)) return { id: "hgss1", reason: "official_hgss_base" };

  const ptcgo = row.setCode ? officialByPtcgoCode.get(String(row.setCode).toUpperCase()) : null;
  if (ptcgo && nameCompatible(row, ptcgo)) return { id: ptcgo.id, reason: "official_ptcgo_code_plus_name" };

  return null;
}

function pokemonUrls(set) {
  return {
    logoImageUrl: set.images?.logo ?? null,
    symbolImageUrl: set.images?.symbol ?? null,
    bannerImageUrl: null,
  };
}

function isPokemonSafeUrl(url) {
  if (!url) return false;
  if (/^https:\/\/assets\.tcgdex\.net\//i.test(url)) return true;
  if (/^https:\/\/images\.scrydex\.com\/pokemon\//i.test(url)) return true;
  if (/^https:\/\/www\.pokemon\.com\/static-assets\/content-assets\/cms2\/img\/trading-card-game\//i.test(url)) return true;
  if (/^https:\/\/images\.pokemontcg\.io\/[^/]+\/(?:logo|symbol)\.png$/i.test(url)) return true;
  if (isBulbagardenSetLogo(url)) return true;
  return false;
}

function isBulbagardenSetLogo(url) {
  if (!/^https:\/\/archives\.bulbagarden\.net\/media\/upload\//i.test(url)) return false;
  const decoded = decodeURIComponent(url).toLowerCase();
  if (!/(?:logo|symbol|trick_or_trade_2023|trick_or_trade_2024)/i.test(decoded)) return false;
  if (/pokemon_tcg_logo|pokémon_tcg_logo|tcg_logo_old|tcg_logo\.png/.test(decoded)) return false;
  if (/pack|box|booster|constructed|key_visual|poster|anime|none\.png|card\d|temporalforces|masterball/.test(decoded)) return false;
  return /\.(png|jpg|jpeg|webp)(?:$|[/?#])/i.test(decoded);
}

function isOnePieceOfficialProductVisual(url) {
  if (!url) return false;
  if (!/^https:\/\/en\.onepiece-cardgame\.com\//i.test(url)) return false;
  const lower = url.toLowerCase();
  if (!/(?:\/images\/products\/|\/renewal\/images\/products\/|\/onepiececg\/bccard\/|\/products\/boosters\/images\/)/.test(lower)) return false;
  if (/\/cardlist\/card\//.test(lower)) return false;
  if (/batch_[a-z0-9-]+\d|op\d{2}-\d{3}|st\d{2}-\d{3}|p-\d{3}/i.test(lower)) return false;
  return /(?:logo|mv_01|bg_mv|\/mv\.|img_item01|img_thumbnail)/i.test(lower) && /\.(png|jpg|jpeg|webp)(?:$|[?&#])/i.test(lower);
}

function onePieceBaseCodes(setCode) {
  const raw = String(setCode ?? "").toUpperCase();
  const compact = raw.replace(/-/g, "");
  const out = [];
  const compound = raw.match(/(OP\d{2})[-\s_]*(EB\d{2})/i);
  if (compound) out.push(`${compound[1]}-${compound[2]}`.toLowerCase());
  const patterns = [/(PRB\d{2})/, /(EB\d{2})/, /(OP\d{2})/, /(ST\d{2})/, /(DP\d{2})/, /(LT\d{2})/, /(SD\d{2})/];
  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (match) out.push(match[1].toLowerCase());
  }
  const st = compact.match(/ST(1[5-9]|20)$/);
  if (st) out.push("st15-20");
  return [...new Set(out)];
}

function resolveAsset(pageUrl, src) {
  return new URL(src, pageUrl).toString();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "oripa-set-image-backfill/1.0" } });
  if (!res.ok) return null;
  return await res.text();
}

const onePiecePageCache = new Map();
async function discoverOnePieceVisuals(baseCode) {
  if (onePiecePageCache.has(baseCode)) return onePiecePageCache.get(baseCode);
  const candidates = [
    `${OFFICIAL_ONEPIECE_HOST}/products/boosters/${baseCode}.php`,
    `${OFFICIAL_ONEPIECE_HOST}/products/boosters/${baseCode}.html`,
    `${OFFICIAL_ONEPIECE_HOST}/products/${baseCode}.html`,
    `${OFFICIAL_ONEPIECE_HOST}/products/${baseCode}.php`,
    `${OFFICIAL_ONEPIECE_HOST}/products/decks/${baseCode}.php`,
    `${OFFICIAL_ONEPIECE_HOST}/products/decks/${baseCode}.html`,
    `${OFFICIAL_ONEPIECE_HOST}/products/other/${baseCode}.php`,
    `${OFFICIAL_ONEPIECE_HOST}/products/other/${baseCode}.html`,
  ];
  for (const pageUrl of candidates) {
    const html = await fetchText(pageUrl);
    if (!html) continue;
    const srcs = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi)].map((m) => resolveAsset(pageUrl, m[1]));
    const official = srcs.filter(isOnePieceOfficialProductVisual);
    const logo = official.find((u) => /logo/i.test(u)) ?? null;
    const banner = official.find((u) => /mv_01|bg_mv|\/mv\.|img_item01|img_thumbnail/i.test(u)) ?? null;
    if (logo || banner) {
      const result = { logoImageUrl: logo, symbolImageUrl: null, bannerImageUrl: banner, evidenceUrl: pageUrl };
      onePiecePageCache.set(baseCode, result);
      return result;
    }
  }
  onePiecePageCache.set(baseCode, null);
  return null;
}

function urlFields(row) {
  return [row.logoImageUrl, row.symbolImageUrl, row.bannerImageUrl].filter(Boolean);
}


const bulbaCategoryCache = new Map();
const bulbaFileCache = new Map();

function categorySlug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:'’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function jpSetTitle(row) {
  return String(row.name ?? "")
    .replace(/^[A-Za-z]+\d*[A-Za-z]*:\s*/, "")
    .replace(/^SV:\s*/, "")
    .trim();
}

function jpCategoryCandidates(row) {
  const title = jpSetTitle(row);
  const candidates = [];
  if (title) candidates.push(categorySlug(title));
  if (/^M\d/i.test(String(row.setCode ?? ""))) candidates.push("MEGA_Series_logos");
  return [...new Set(candidates.filter(Boolean))];
}

async function bulbaCategoryFiles(category) {
  if (bulbaCategoryCache.has(category)) return bulbaCategoryCache.get(category);
  const url = `https://archives.bulbagarden.net/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(`Category:${category}`)}&cmlimit=100&format=json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "oripa-set-image-backfill/1.0" } });
    if (!res.ok) return [];
    const json = await res.json();
    const files = (json.query?.categorymembers ?? []).map((m) => m.title).filter((title) => title.startsWith("File:"));
    bulbaCategoryCache.set(category, files);
    return files;
  } catch {
    return [];
  }
}

async function bulbaFileUrl(title) {
  if (bulbaFileCache.has(title)) return bulbaFileCache.get(title);
  const url = `https://archives.bulbagarden.net/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "oripa-set-image-backfill/1.0" } });
    if (!res.ok) return null;
    const json = await res.json();
    const pages = Object.values(json.query?.pages ?? {});
    const imageUrl = pages[0]?.imageinfo?.[0]?.url ?? null;
    bulbaFileCache.set(title, imageUrl);
    return imageUrl;
  } catch {
    return null;
  }
}


async function bulbaAllImages(prefix) {
  if (!prefix) return [];
  const key = `allimages:${prefix}`;
  if (bulbaCategoryCache.has(key)) return bulbaCategoryCache.get(key);
  const url = `https://archives.bulbagarden.net/w/api.php?action=query&list=allimages&aiprefix=${encodeURIComponent(prefix)}&ailimit=100&format=json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "oripa-set-image-backfill/1.0" } });
    if (!res.ok) return [];
    const json = await res.json();
    const files = (json.query?.allimages ?? []).map((image) => ({ title: `File:${image.name}`, url: image.url }));
    bulbaCategoryCache.set(key, files);
    return files;
  } catch {
    return [];
  }
}

async function discoverBulbaPrefixLogo(row) {
  const prefixes = [];
  const code = String(row.setCode ?? "").replace(/[^A-Za-z0-9.]/g, "");
  if (code) {
    prefixes.push(code);
    prefixes.push(code.toUpperCase());
    prefixes.push(code.toLowerCase());
  }
  const titleSlug = categorySlug(jpSetTitle(row));
  if (titleSlug) prefixes.push(titleSlug);
  for (const prefix of [...new Set(prefixes.filter(Boolean))]) {
    const files = await bulbaAllImages(prefix);
    const ranked = files
      .map((file) => ({ ...file, lower: decodeURIComponent(file.title).toLowerCase() }))
      .filter(({ lower }) => /(logo|setsymbol|set_symbol)/.test(lower))
      .filter(({ lower }) => !/(pack|box|booster|constructed|key_visual|poster|anime|none\.png|card\d|masterball)/.test(lower))
      .sort((a, b) => {
        const al = /logo/.test(a.lower);
        const bl = /logo/.test(b.lower);
        if (al !== bl) return al ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
    for (const candidate of ranked) {
      if (candidate.url && isBulbagardenSetLogo(candidate.url)) {
        return { logoImageUrl: /logo/i.test(candidate.title) ? candidate.url : null, symbolImageUrl: /logo/i.test(candidate.title) ? null : candidate.url, bannerImageUrl: null, evidenceUrl: `https://archives.bulbagarden.net/wiki/${encodeURIComponent(candidate.title)}`, reason: "bulbagarden_prefix_set_logo" };
      }
    }
  }
  return null;
}

async function discoverJpBulbaSetImages(row) {
  const direct = await discoverBulbaPrefixLogo(row);
  if (direct) return direct;
  const code = String(row.setCode ?? "").toLowerCase();
  const title = jpSetTitle(row).toLowerCase();
  for (const category of jpCategoryCandidates(row)) {
    const files = await bulbaCategoryFiles(category);
    const ranked = files
      .map((file) => ({ file, lower: decodeURIComponent(file).toLowerCase() }))
      .filter(({ lower }) => /(logo|setsymbol)/.test(lower))
      .filter(({ lower }) => !/(pack|box|deck|booster|starter|collection|pokemon_tcg_logo|pokémon_tcg_logo|none\.png|card\d)/.test(lower))
      .sort((a, b) => {
        const ac = code && a.lower.includes(code);
        const bc = code && b.lower.includes(code);
        if (ac !== bc) return ac ? -1 : 1;
        const at = title && a.lower.includes(title.replace(/\s+/g, " "));
        const bt = title && b.lower.includes(title.replace(/\s+/g, " "));
        if (at !== bt) return at ? -1 : 1;
        const al = /logo/.test(a.lower);
        const bl = /logo/.test(b.lower);
        if (al !== bl) return al ? -1 : 1;
        return a.file.localeCompare(b.file);
      });
    for (const candidate of ranked) {
      const imageUrl = await bulbaFileUrl(candidate.file);
      if (imageUrl && isBulbagardenSetLogo(imageUrl)) {
        return { logoImageUrl: /logo/i.test(candidate.file) ? imageUrl : null, symbolImageUrl: /logo/i.test(candidate.file) ? null : imageUrl, bannerImageUrl: null, evidenceUrl: `https://archives.bulbagarden.net/wiki/Category:${category}`, reason: "bulbagarden_jp_category_set_logo" };
      }
    }
  }
  return null;
}

async function fetchPokemonTcgSets() {
  const res = await fetch("https://api.pokemontcg.io/v2/sets?pageSize=250", { headers: { "User-Agent": "oripa-set-image-backfill/1.0" } });
  if (!res.ok) throw new Error(`PokemonTCG sets fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

function csvLine(values) {
  return values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
}

async function updateRow(row, next, reason, evidence, updates) {
  const current = { logoImageUrl: row.logoImageUrl, symbolImageUrl: row.symbolImageUrl, bannerImageUrl: row.bannerImageUrl };
  if (current.logoImageUrl === next.logoImageUrl && current.symbolImageUrl === next.symbolImageUrl && current.bannerImageUrl === next.bannerImageUrl) {
    return false;
  }
  await prisma.catalogSet.update({ where: { id: row.id }, data: next });
  updates.push({ id: row.id, game: row.game, language: row.language, name: row.name, setCode: row.setCode, reason, evidence, before: current, after: next });
  return true;
}

async function main() {
  const updates = [];
  const keeps = [];
  const gaps = [];
  const cleared = [];
  const errors = [];

  const officialSets = await fetchPokemonTcgSets();
  const officialById = new Map(officialSets.map((set) => [set.id, set]));
  const officialByName = new Map(officialSets.map((set) => [norm(set.name), set]));
  const officialByPtcgoCode = new Map(officialSets.filter((set) => set.ptcgoCode).map((set) => [String(set.ptcgoCode).toUpperCase(), set]));

  const pokemonEnRows = await prisma.catalogSet.findMany({
    where: { source: "tcgtracking", game: "POKEMON", language: "en", isActive: true },
    select: { id: true, game: true, language: true, name: true, setCode: true, logoImageUrl: true, symbolImageUrl: true, bannerImageUrl: true },
    orderBy: [{ releaseDate: "desc" }, { name: "asc" }],
  });

  for (const row of pokemonEnRows) {
    const special = SPECIAL_POKEMON_URLS[row.name];
    if (special) {
      await updateRow(row, { logoImageUrl: special.logoImageUrl, symbolImageUrl: special.symbolImageUrl, bannerImageUrl: special.bannerImageUrl }, special.reason, special.evidence, updates);
      continue;
    }
    const match = pokemonOfficialIdForRow(row, officialByName, officialByPtcgoCode);
    if (match) {
      const official = officialById.get(match.id);
      if (!official) {
        errors.push({ ...row, reason: "mapped_official_id_missing", mappedId: match.id });
        continue;
      }
      await updateRow(row, pokemonUrls(official), match.reason, `https://api.pokemontcg.io/v2/sets/${official.id}`, updates);
      continue;
    }
    if (urlFields(row).length) {
      const next = { logoImageUrl: null, symbolImageUrl: null, bannerImageUrl: null };
      await updateRow(row, next, "clear_unmapped_pokemon_url_no_evidence", null, updates);
      cleared.push({ ...row, reason: "clear_unmapped_pokemon_url_no_evidence" });
      gaps.push({ game: row.game, language: row.language, name: row.name, setCode: row.setCode, reason: "no_official_set_art_mapping_after_clearing_existing_url" });
      continue;
    }
    gaps.push({ game: row.game, language: row.language, name: row.name, setCode: row.setCode, reason: "no_official_set_art_mapping" });
  }

  const pokemonJpRows = await prisma.catalogSet.findMany({
    where: { source: "tcgtracking", isActive: true, OR: [{ game: "POKEMON_JAPAN" }, { game: "POKEMON", language: "ja" }] },
    select: { id: true, game: true, language: true, name: true, setCode: true, logoImageUrl: true, symbolImageUrl: true, bannerImageUrl: true },
    orderBy: [{ releaseDate: "desc" }, { name: "asc" }],
  });

  for (const row of pokemonJpRows) {
    const jpSpecial = SPECIAL_JP_URLS[row.name];
    if (jpSpecial) {
      await updateRow(row, { logoImageUrl: jpSpecial.logoImageUrl, symbolImageUrl: jpSpecial.symbolImageUrl, bannerImageUrl: jpSpecial.bannerImageUrl }, jpSpecial.reason, jpSpecial.evidence, updates);
      continue;
    }
    const discovered = await discoverJpBulbaSetImages(row);
    if (discovered) {
      await updateRow(row, { logoImageUrl: discovered.logoImageUrl, symbolImageUrl: discovered.symbolImageUrl, bannerImageUrl: discovered.bannerImageUrl }, discovered.reason, discovered.evidenceUrl, updates);
      continue;
    }

    const safeLogo = isPokemonSafeUrl(row.logoImageUrl) ? row.logoImageUrl : null;
    const safeSymbol = isPokemonSafeUrl(row.symbolImageUrl) ? row.symbolImageUrl : null;
    const safeBanner = isPokemonSafeUrl(row.bannerImageUrl) ? row.bannerImageUrl : null;
    const hadUnsafe = urlFields(row).some((u) => !isPokemonSafeUrl(u));
    const next = { logoImageUrl: safeLogo, symbolImageUrl: safeSymbol, bannerImageUrl: safeBanner };
    if (safeLogo || safeSymbol || safeBanner) {
      await updateRow(row, next, hadUnsafe ? "keep_safe_jp_set_logo_clear_untrusted" : "keep_safe_jp_set_logo", null, updates);
      keeps.push({ ...row, reason: "safe_jp_set_logo" });
    } else {
      if (hadUnsafe) {
        await updateRow(row, next, "clear_untrusted_jp_url", null, updates);
        cleared.push({ ...row, reason: "clear_untrusted_jp_url" });
      }
      gaps.push({ game: row.game, language: row.language, name: row.name, setCode: row.setCode, reason: hadUnsafe ? "no_jp_set_logo_after_clearing_untrusted_url" : "no_jp_set_logo_mapping" });
    }
  }

  const onePieceRows = await prisma.catalogSet.findMany({
    where: { source: "tcgtracking", game: "ONE_PIECE", language: "en", isActive: true },
    select: { id: true, game: true, language: true, name: true, setCode: true, logoImageUrl: true, symbolImageUrl: true, bannerImageUrl: true },
    orderBy: [{ releaseDate: "desc" }, { name: "asc" }],
  });

  for (const row of onePieceRows) {
    const bases = [...new Set([...(MANUAL_ONEPIECE_SLUGS[row.name] ?? []), ...onePieceBaseCodes(row.setCode)])];
    let found = null;
    for (const base of bases) {
      found = await discoverOnePieceVisuals(base);
      if (found) break;
    }
    if (found) {
      const next = { logoImageUrl: found.logoImageUrl, symbolImageUrl: null, bannerImageUrl: found.bannerImageUrl };
      await updateRow(row, next, "official_onepiece_product_visual_by_set_code", found.evidenceUrl, updates);
    } else {
      const hadUnsafe = urlFields(row).some((u) => !isOnePieceOfficialProductVisual(u));
      if (hadUnsafe) {
        await updateRow(row, { logoImageUrl: null, symbolImageUrl: null, bannerImageUrl: null }, "clear_untrusted_onepiece_url", null, updates);
        cleared.push({ ...row, reason: "clear_untrusted_onepiece_url" });
      }
      gaps.push({ game: row.game, language: row.language, name: row.name, setCode: row.setCode, reason: bases.length ? "official_onepiece_product_page_not_found_or_no_visual" : "no_onepiece_base_set_code" });
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, "updates.json"), JSON.stringify(updates, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "cleared.json"), JSON.stringify(cleared, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "errors.json"), JSON.stringify(errors, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "gaps.csv"), [csvLine(["game", "language", "name", "setCode", "reason"]), ...gaps.map((g) => csvLine([g.game, g.language, g.name, g.setCode, g.reason]))].join("\n") + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), `# Setlist image URL strict backfill\n\n- Run: ${RUN_ID}\n- Updates: ${updates.length}\n- Cleared unsafe rows: ${cleared.length}\n- Existing safe kept rows: ${keeps.length}\n- Remaining gaps: ${gaps.length}\n- Errors: ${errors.length}\n\nRules:\n- Pokémon EN: PokémonTCG official set logo/symbol by exact/manual/series mapping only.\n- Pokémon JP: keep only set logo/symbol-looking source URLs; clear product/deck/card/generic TCG logos.\n- One Piece: official Bandai product page visuals by set code; no cardlist card images.\n`);

  console.log(JSON.stringify({ outDir: OUT_DIR, updates: updates.length, cleared: cleared.length, kept: keeps.length, gaps: gaps.length, errors: errors.length }, null, 2));
}

main().finally(async () => prisma.$disconnect());
