#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/pokemon/g, "")
    .replace(/pokémon/g, "")
    .replace(/tcg/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function isJunk(url) {
  const lower = String(url ?? "").toLowerCase();
  return !lower || lower.includes("archives.bulbagarden.net") || lower.includes("tcgtracking.com/scan/set-symbol.php") || lower.includes("scrydex.com") || lower.includes("/boxart") || lower.includes("trainerkit") || lower.includes("logo_old");
}

function needsFill(row) {
  return isJunk(row.logoImageUrl) || isJunk(row.symbolImageUrl);
}

const manual = new Map(Object.entries({
  "POP Series 1": "pop1",
  "POP Series 2": "pop2",
  "POP Series 3": "pop3",
  "POP Series 4": "pop4",
  "POP Series 5": "pop5",
  "POP Series 6": "pop6",
  "POP Series 7": "pop7",
  "POP Series 8": "pop8",
  "POP Series 9": "pop9",
  "Alternate Art Promos": "basep",
  "EX Trainer Kit 1: Latias & Latios": "ex Trainer Kit 1 Latias & Latios",
  "EX Trainer Kit 2: Plusle & Minun": "ex Trainer Kit 2 Plusle & Minun",
  "Nintendo Promos": "np",
  "Wizards Black Star Promos": "basep",
  "Nintendo Black Star Promos": "np",
  "DP Black Star Promos": "dpp",
  "HGSS Black Star Promos": "hsp",
  "BW Black Star Promos": "bwp",
  "XY Black Star Promos": "xyp",
  "SM Black Star Promos": "smp",
  "SWSH Black Star Promos": "swshp",
  "SVP Black Star Promos": "svp",
}));

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "oripa-local-image-fill/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function chooseOfficial(row, officialSets) {
  const manualId = manual.get(row.name);
  if (manualId) {
    const byId = officialSets.find((s) => s.id === manualId || norm(s.name) === norm(manualId));
    if (byId) return { set: byId, reason: `manual:${manualId}` };
  }
  const n = norm(row.name);
  const exact = officialSets.filter((s) => norm(s.name) === n);
  if (exact.length === 1) return { set: exact[0], reason: "exact_name" };
  const code = norm(row.setCode);
  if (code) {
    const byPtcgo = officialSets.filter((s) => norm(s.ptcgoCode) === code || norm(s.id) === code);
    if (byPtcgo.length === 1) return { set: byPtcgo[0], reason: "code" };
  }
  return null;
}

async function main() {
  if (!process.env.DATABASE_URL?.includes("localhost:15433/oripa_sg")) {
    throw new Error("Refusing to write unless DATABASE_URL points at local oripa_sg on localhost:15433");
  }

  const official = await fetchJson("https://api.pokemontcg.io/v2/sets");
  const officialSets = official.data;
  const rows = await prisma.catalogSet.findMany({
    where: { source: "tcgtracking", game: "POKEMON", language: "en", isActive: true },
    orderBy: [{ releaseDate: "desc" }, { name: "asc" }],
    select: { id: true, name: true, setCode: true, logoImageUrl: true, symbolImageUrl: true },
  });

  const updates = [];
  const rejects = [];
  for (const row of rows) {
    const chosen = chooseOfficial(row, officialSets);
    if (!chosen) {
      rejects.push({ name: row.name, setCode: row.setCode, reason: "no_unique_official_match" });
      continue;
    }
    if (!chosen.set.images?.logo || !chosen.set.images?.symbol) {
      rejects.push({ name: row.name, setCode: row.setCode, reason: "official_missing_images", officialId: chosen.set.id });
      continue;
    }
    const change = {
      id: row.id,
      name: row.name,
      setCode: row.setCode,
      officialId: chosen.set.id,
      officialName: chosen.set.name,
      reason: chosen.reason,
      logoImageUrl: chosen.set.images.logo,
      symbolImageUrl: chosen.set.images.symbol,
    };
    if (needsFill(row) || row.logoImageUrl !== change.logoImageUrl || row.symbolImageUrl !== change.symbolImageUrl) updates.push(change);
  }

  for (const u of updates) {
    await prisma.catalogSet.update({
      where: { id: u.id },
      data: { logoImageUrl: u.logoImageUrl, symbolImageUrl: u.symbolImageUrl, bannerImageUrl: null },
    });
  }

  console.log(JSON.stringify({ checked: rows.length, updates: updates.length, rejects: rejects.length, sampleUpdates: updates.slice(0, 30), sampleRejects: rejects.slice(0, 30) }, null, 2));
}

main().finally(async () => prisma.$disconnect());
