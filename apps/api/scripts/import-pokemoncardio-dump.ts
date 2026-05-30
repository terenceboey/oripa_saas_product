import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";

type PokemonCard = {
  id?: string;
  card_number?: string;
  name?: string;
  setCode?: string;
  setName?: string;
  number?: string;
  rarity?: string | null;
  language?: string;
  releaseDate?: string | null;
  image_url?: string | null;
  high_res_image_url?: string | null;
};

type ExportShape = {
  cards?: PokemonCard[];
  data?: PokemonCard[];
};

const SOURCE = "pokemoncardio";
const GAME = "POKEMON";
const DEFAULT_LANGUAGE = "en";
const CHUNK_SIZE = Math.max(200, Number(process.env.POKEMONCARDIO_IMPORT_CHUNK ?? "1000"));
const REPLACE_SOURCE = String(process.env.POKEMONCARDIO_REPLACE_SOURCE ?? "true").toLowerCase() !== "false";

function clean(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseDate(value: string | null | undefined) {
  const text = clean(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSearch(parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .map((x) => String(x).toLowerCase().trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCards(payload: unknown): PokemonCard[] {
  if (Array.isArray(payload)) return payload as PokemonCard[];
  if (payload && typeof payload === "object") {
    const obj = payload as ExportShape;
    if (Array.isArray(obj.cards)) return obj.cards;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

function chunks<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const inputPath = process.env.POKEMONCARDIO_IMPORT_FILE ?? "./pokemoncardio-cards.json";
  const raw = await readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const cards = normalizeCards(parsed);

  if (!cards.length) throw new Error(`No cards found in file: ${inputPath}`);

  const setMap = new Map<string, { setCode: string; name: string; releaseDate: Date | null; cardCount: number }>();
  const normalizedRows: Array<{
    sourceItemId: string;
    language: string;
    setCode: string;
    setName: string;
    name: string;
    cardNumber: string | null;
    rarity: string | null;
    imageThumbUrl: string | null;
    imageLargeUrl: string | null;
  }> = [];

  for (const row of cards) {
    const sourceItemId = clean(row.card_number) ?? clean(row.id);
    const setCode = clean(row.setCode);
    const setName = clean(row.setName);
    const name = clean(row.name);
    if (!sourceItemId || !setCode || !setName || !name) continue;

    const language = clean(row.language)?.toLowerCase() ?? DEFAULT_LANGUAGE;
    const releaseDate = parseDate(row.releaseDate);

    const setExisting = setMap.get(setCode);
    if (setExisting) {
      setExisting.cardCount += 1;
      if (!setExisting.releaseDate && releaseDate) setExisting.releaseDate = releaseDate;
    } else {
      setMap.set(setCode, { setCode, name: setName, releaseDate, cardCount: 1 });
    }

    normalizedRows.push({
      sourceItemId,
      language,
      setCode,
      setName,
      name,
      cardNumber: clean(row.number) ?? clean(row.card_number),
      rarity: clean(row.rarity),
      imageThumbUrl: clean(row.image_url),
      imageLargeUrl: clean(row.high_res_image_url) ?? clean(row.image_url),
    });
  }

  if (REPLACE_SOURCE) {
    console.log("[pokemoncardio-import] replacing existing source rows...");
    await prisma.catalogItem.deleteMany({ where: { source: SOURCE } });
    await prisma.catalogSealedProduct.deleteMany({ where: { source: SOURCE } });
    await prisma.catalogSet.deleteMany({ where: { source: SOURCE, game: GAME } });
  }

  const setsData = Array.from(setMap.values()).map((s) => ({
    source: SOURCE,
    sourceSetId: s.setCode,
    game: GAME,
    setCode: s.setCode,
    name: s.name,
    releaseDate: s.releaseDate,
    productCount: s.cardCount,
    searchText: normalizeSearch([s.name, s.setCode, GAME]),
    isActive: true,
  }));

  for (const batch of chunks(setsData, CHUNK_SIZE)) {
    await prisma.catalogSet.createMany({ data: batch, skipDuplicates: true });
  }

  const setsInDb = await prisma.catalogSet.findMany({
    where: { source: SOURCE, game: GAME },
    select: { id: true, sourceSetId: true },
  });
  const setIdBySource = new Map(setsInDb.map((s) => [s.sourceSetId, s.id]));

  const itemData = normalizedRows
    .map((r) => {
      const catalogSetId = setIdBySource.get(r.setCode);
      if (!catalogSetId) return null;
      return {
        source: SOURCE,
        sourceItemId: r.sourceItemId,
        catalogSetId,
        itemType: "CARD" as const,
        game: GAME,
        language: r.language,
        name: r.name,
        setId: r.setCode,
        setName: r.setName,
        cardNumber: r.cardNumber,
        rarity: r.rarity,
        imageBaseUrl: r.imageLargeUrl,
        imageThumbUrl: r.imageThumbUrl,
        imageLargeUrl: r.imageLargeUrl,
        searchText: normalizeSearch([r.name, r.setName, r.setCode, r.rarity, GAME]),
        isActive: true,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  let inserted = 0;
  for (const batch of chunks(itemData, CHUNK_SIZE)) {
    const res = await prisma.catalogItem.createMany({ data: batch, skipDuplicates: true });
    inserted += res.count;
    if (inserted % 5000 < CHUNK_SIZE) {
      console.log(`[pokemoncardio-import] inserted=${inserted}/${itemData.length}`);
    }
  }

  console.log(
    `[pokemoncardio-import] done file=${inputPath} parsed=${cards.length} normalized=${itemData.length} inserted=${inserted} sets=${setsData.length}`,
  );
}

main()
  .catch((error) => {
    console.error("[pokemoncardio-import] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
