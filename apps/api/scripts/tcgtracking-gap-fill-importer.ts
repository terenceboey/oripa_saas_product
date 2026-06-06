import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse as parseCsv } from "csv-parse/sync";
import { Prisma } from "@prisma/client";
import { config as loadDotenv } from "dotenv";
import { prisma } from "../src/lib/prisma";

const SOURCE = "tcgtracking";
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_ARTIFACT_DIR = "docs/plans/tcgtracking-direct-export-20260604T122918Z";

loadDotenv({ path: path.join(REPO_ROOT, ".env") });

const CATEGORY_REGISTRY: Record<string, { game: string; language: string; prefixIds: boolean; label: string }> = {
  "3": { game: "POKEMON", language: "en", prefixIds: false, label: "Pokémon EN" },
  "68": { game: "ONE_PIECE", language: "en", prefixIds: true, label: "One Piece EN" },
  "85": { game: "POKEMON", language: "ja", prefixIds: true, label: "Pokémon JP" },
};

type RawProduct = Record<string, unknown>;
type RawSetPayload = Record<string, unknown> & { products?: RawProduct[] };

type MissingCsvRow = {
  category_id: string;
  set_id: string;
  set_name: string;
  game: string;
  language: string;
  live_product_id: string;
  db_source_id_expected: string;
  name: string;
  image_url: string;
};

type Classification = "catalog_item" | "sealed_product" | "review";

type NormalizedPlanRow = {
  categoryId: string;
  setId: string;
  setName: string;
  game: string;
  language: string;
  liveProductId: string;
  sourceId: string;
  name: string;
  cleanName: string | null;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  imageCount: number | null;
  classification: Classification;
  productKind: string | null;
  reason: string;
  catalogSetId: string | null;
  catalogSetFoundBy: string | null;
  existingCatalogItemId: string | null;
  existingSealedProductId: string | null;
  conflict: string | null;
  sourcePayload: Record<string, unknown>;
  searchText: string;
};

type Summary = {
  dryRun: boolean;
  dbEnv: string;
  artifactDir: string;
  outputDir: string;
  scanned: number;
  plannedCatalogItemInserts: number;
  plannedSealedProductInserts: number;
  reviewRows: number;
  skippedExisting: number;
  missingParentSets: number;
  conflicts: number;
  byCategory: Record<string, Record<string, number>>;
  byClassification: Record<string, number>;
  byProductKind: Record<string, number>;
};

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).toLowerCase().trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function expectedSourceId(categoryId: string, liveProductId: string): string {
  const category = CATEGORY_REGISTRY[categoryId];
  if (!category) throw new Error(`Unsupported category ${categoryId}`);
  return category.prefixIds ? `${categoryId}:${liveProductId}` : liveProductId;
}

function expectedSourceSetId(categoryId: string, liveSetId: string): string {
  const category = CATEGORY_REGISTRY[categoryId];
  if (!category) throw new Error(`Unsupported category ${categoryId}`);
  return category.prefixIds ? `${categoryId}:${liveSetId}` : liveSetId;
}

function loadCsvRows(artifactDir: string): MissingCsvRow[] {
  const file = path.join(artifactDir, "exact-missing-live-products-vs-production.csv");
  const content = fs.readFileSync(file, "utf8");
  return parseCsv(content, { columns: true, skip_empty_lines: true }) as MissingCsvRow[];
}

function loadRawSet(artifactDir: string, categoryId: string, setId: string): RawSetPayload {
  const file = path.join(artifactDir, "raw", `category-${categoryId}-set-${setId}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing raw set payload ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as RawSetPayload;
}

function findRawProduct(setPayload: RawSetPayload, liveProductId: string): RawProduct {
  const products = Array.isArray(setPayload.products) ? setPayload.products : [];
  const found = products.find((product) => asString(product.id) === liveProductId || asString(product.product_id) === liveProductId || asString(product.productId) === liveProductId);
  if (!found) throw new Error(`Raw product id=${liveProductId} not found in set payload`);
  return found;
}

function classifyProduct(input: { name: string; number: string | null; rarity: string | null; raw: RawProduct }): { classification: Classification; productKind: string | null; reason: string } {
  const lower = input.name.toLowerCase();
  const hasCardShape = Boolean(input.number || input.rarity);

  if (lower.includes("code card")) {
    return { classification: "sealed_product", productKind: "CODE_CARD", reason: "name contains code card" };
  }

  if (input.name.match(/\((cosmos holo|holo|reverse holo|foil)\)/i)) {
    return { classification: "catalog_item", productKind: null, reason: "card finish marker in name" };
  }

  if (hasCardShape) {
    return { classification: "catalog_item", productKind: null, reason: "has card number or rarity" };
  }

  const sealedRules: Array<[RegExp, string, string]> = [
    [/\b(pre-release|release event|tournament|anniversary tournament).*\b(pack|cards?)\b/i, "EVENT_PACK", "event/tournament pack naming"],
    [/\bdash pack\b/i, "PROMO_PACK", "dash pack naming"],
    [/\bspecial don!! (card )?pack\b/i, "PROMO_PACK", "special DON card pack naming"],
    [/\b(special don!! set|battle kit|treasure booster set|card file set|special card set|klara and avery set|set of 3)\b/i, "COLLECTION", "collection/set naming"],
    [/\b(pack|booster pack|box|booster box|bundle|blister|tin|case)\b/i, "SEALED_PRODUCT", "sealed packaging keyword"],
    [/\b(starter deck|structure deck|theme deck|deck)\b/i, "DECK", "deck keyword"],
    [/\b(battle academy|classic|collection|special set|premium)\b/i, "COLLECTION", "collection/special product keyword"],
  ];

  for (const [regex, kind, reason] of sealedRules) {
    if (regex.test(input.name)) return { classification: "sealed_product", productKind: kind, reason };
  }

  // No number/rarity and no sealed keyword: safer to review than pollute CatalogItem.
  return { classification: "review", productKind: null, reason: "no card shape and no deterministic sealed keyword" };
}

async function resolveCatalogSet(input: { categoryId: string; setId: string; game: string; language: string }) {
  const sourceSetId = expectedSourceSetId(input.categoryId, input.setId);
  const exact = await prisma.catalogSet.findFirst({
    where: {
      source: SOURCE,
      sourceSetId,
      sourceCategoryId: input.categoryId,
      game: input.game,
      language: input.language,
      isActive: true,
    },
    select: { id: true },
  });
  if (exact) return { id: exact.id, foundBy: "source+category+set+game+language" };

  const compatible = await prisma.catalogSet.findFirst({
    where: {
      source: SOURCE,
      sourceSetId,
      game: input.game,
      isActive: true,
    },
    select: { id: true, language: true, sourceCategoryId: true },
  });
  if (compatible) return { id: compatible.id, foundBy: `source+set+game fallback language=${compatible.language} category=${compatible.sourceCategoryId ?? "null"}` };

  return { id: null, foundBy: null };
}

async function existingIds(input: { sourceId: string; language: string; game: string }) {
  const [item, sealed] = await Promise.all([
    prisma.catalogItem.findUnique({
      where: { source_sourceItemId_language: { source: SOURCE, sourceItemId: input.sourceId, language: input.language } },
      select: { id: true, game: true },
    }),
    prisma.catalogSealedProduct.findUnique({
      where: { source_sourceProductId_language_game: { source: SOURCE, sourceProductId: input.sourceId, language: input.language, game: input.game } },
      select: { id: true },
    }),
  ]);
  return {
    existingCatalogItemId: item?.id ?? null,
    existingCatalogItemGame: item?.game ?? null,
    existingSealedProductId: sealed?.id ?? null,
  };
}

function increment(map: Record<string, number>, key: string, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
}

async function buildPlan(artifactDir: string): Promise<NormalizedPlanRow[]> {
  const rows = loadCsvRows(artifactDir);
  const plan: NormalizedPlanRow[] = [];
  const rawSetCache = new Map<string, RawSetPayload>();

  for (const row of rows) {
    const category = CATEGORY_REGISTRY[row.category_id];
    if (!category) throw new Error(`Unsupported category ${row.category_id}`);
    const sourceId = expectedSourceId(row.category_id, row.live_product_id);
    if (sourceId !== row.db_source_id_expected) {
      throw new Error(`CSV source id mismatch category=${row.category_id} product=${row.live_product_id} expected=${sourceId} csv=${row.db_source_id_expected}`);
    }

    const cacheKey = `${row.category_id}:${row.set_id}`;
    if (!rawSetCache.has(cacheKey)) rawSetCache.set(cacheKey, loadRawSet(artifactDir, row.category_id, row.set_id));
    const rawSet = rawSetCache.get(cacheKey)!;
    const rawProduct = findRawProduct(rawSet, row.live_product_id);

    const name = asString(rawProduct.name) ?? asString(rawProduct.clean_name) ?? row.name;
    const cleanName = asString(rawProduct.clean_name);
    const number = asString(rawProduct.number);
    const rarity = asString(rawProduct.rarity);
    const imageUrl = asString(rawProduct.image_url) ?? asString(rawProduct.imageUrl) ?? asString(row.image_url);
    const classification = classifyProduct({ name, number, rarity, raw: rawProduct });
    const catalogSet = await resolveCatalogSet({ categoryId: row.category_id, setId: row.set_id, game: category.game, language: category.language });
    const existing = await existingIds({ sourceId, language: category.language, game: category.game });

    let conflict: string | null = null;
    if (existing.existingCatalogItemId && classification.classification === "sealed_product") {
      conflict = "source id already exists in CatalogItem but plan classifies as sealed_product";
    } else if (existing.existingSealedProductId && classification.classification === "catalog_item") {
      conflict = "source id already exists in CatalogSealedProduct but plan classifies as catalog_item";
    } else if (existing.existingCatalogItemGame && existing.existingCatalogItemGame !== category.game) {
      conflict = `CatalogItem source id exists with game=${existing.existingCatalogItemGame}, expected=${category.game}`;
    }

    const setRelease = parseDate(rawSet.set_released ?? rawSet.published_on);
    const sourcePayload = {
      provenance: {
        importedBy: "tcgtracking-gap-fill-importer",
        source: SOURCE,
        categoryId: row.category_id,
        setId: row.set_id,
        liveProductId: row.live_product_id,
        sourceId,
        artifactDir,
      },
      set: {
        id: rawSet.set_id ?? rawSet.id ?? row.set_id,
        name: rawSet.set_name ?? rawSet.name ?? row.set_name,
        abbr: rawSet.set_abbr ?? rawSet.abbreviation ?? null,
        released: rawSet.set_released ?? rawSet.published_on ?? null,
        releaseDateIso: setRelease?.toISOString() ?? null,
        productCount: rawSet.product_count ?? null,
      },
      product: rawProduct,
    };

    const searchText = normalizeSearchText([name, cleanName, row.set_name, row.set_id, number, rarity, category.game, category.language, SOURCE]);

    plan.push({
      categoryId: row.category_id,
      setId: row.set_id,
      setName: row.set_name,
      game: category.game,
      language: category.language,
      liveProductId: row.live_product_id,
      sourceId,
      name,
      cleanName,
      number,
      rarity,
      imageUrl,
      imageCount: asNumber(rawProduct.image_count),
      classification: classification.classification,
      productKind: classification.productKind,
      reason: classification.reason,
      catalogSetId: catalogSet.id,
      catalogSetFoundBy: catalogSet.foundBy,
      existingCatalogItemId: existing.existingCatalogItemId,
      existingSealedProductId: existing.existingSealedProductId,
      conflict,
      sourcePayload,
      searchText,
    });
  }

  return plan;
}

async function applyPlan(plan: NormalizedPlanRow[]) {
  let insertedItems = 0;
  let insertedSealed = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of plan) {
      if (row.conflict || !row.catalogSetId || row.classification === "review") continue;
      if (row.existingCatalogItemId || row.existingSealedProductId) continue;

      if (row.classification === "catalog_item") {
        await tx.catalogItem.create({
          data: {
            source: SOURCE,
            sourceItemId: row.sourceId,
            catalogSetId: row.catalogSetId,
            localId: row.number,
            sourcePayload: row.sourcePayload as Prisma.InputJsonValue,
            itemType: "CARD",
            game: row.game,
            language: row.language,
            name: row.name,
            setId: row.setId,
            setName: row.setName,
            cardNumber: row.number,
            rarity: row.rarity,
            imageBaseUrl: row.imageUrl,
            imageThumbUrl: row.imageUrl,
            imageLargeUrl: row.imageUrl,
            searchText: row.searchText,
            isActive: true,
          },
        });
        insertedItems += 1;
      } else if (row.classification === "sealed_product") {
        await tx.catalogSealedProduct.create({
          data: {
            source: SOURCE,
            sourceProductId: row.sourceId,
            sourceCategoryId: row.categoryId,
            productKind: row.productKind,
            sourcePayload: row.sourcePayload as Prisma.InputJsonValue,
            catalogSetId: row.catalogSetId,
            game: row.game,
            language: row.language,
            name: row.name,
            cleanName: row.cleanName,
            imageUrl: row.imageUrl,
            imageCount: row.imageCount,
            searchText: row.searchText,
            isActive: true,
          },
        });
        insertedSealed += 1;
      }
    }
  }, { timeout: 120_000 });

  return { insertedItems, insertedSealed };
}

function writeOutputs(plan: NormalizedPlanRow[], outputDir: string, summary: Summary) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "gap-fill-plan.json"), JSON.stringify({ summary, plan }, null, 2));

  const header = [
    "classification",
    "productKind",
    "categoryId",
    "setId",
    "setName",
    "game",
    "language",
    "liveProductId",
    "sourceId",
    "name",
    "number",
    "rarity",
    "imageUrl",
    "catalogSetId",
    "catalogSetFoundBy",
    "existingCatalogItemId",
    "existingSealedProductId",
    "conflict",
    "reason",
  ];

  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [header.join(",")];
  for (const row of plan) {
    lines.push(header.map((key) => escape(row[key as keyof NormalizedPlanRow])).join(","));
  }
  fs.writeFileSync(path.join(outputDir, "gap-fill-plan.csv"), `${lines.join("\n")}\n`);

  fs.writeFileSync(path.join(outputDir, "REPORT.md"), [
    "# TCGtracking gap-fill importer dry-run",
    "",
    "## Summary",
    "",
    "```json",
    JSON.stringify(summary, null, 2),
    "```",
    "",
    "## Output files",
    "",
    "```text",
    "gap-fill-plan.json",
    "gap-fill-plan.csv",
    "REPORT.md",
    "```",
    "",
    "## Notes",
    "",
    "- `review` rows are not inserted automatically.",
    "- Rows with missing parent `CatalogSet` are not inserted automatically.",
    "- Rows with identity conflicts are not inserted automatically.",
  ].join("\n"));
}

async function main() {
  const artifactDir = path.resolve(REPO_ROOT, process.env.TCGTRACKING_GAP_ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR);
  const dryRun = envBool("TCGTRACKING_GAP_DRY_RUN", true);
  const allowWrite = envBool("TCGTRACKING_GAP_ALLOW_WRITE", false);
  const allowProductionWrite = envBool("TCGTRACKING_GAP_ALLOW_PRODUCTION_WRITE", false);
  const dbEnv = process.env.DB_ENV ?? "production";
  const outputDir = path.resolve(
    process.cwd(),
    process.env.TCGTRACKING_GAP_OUTPUT_DIR
      ? path.resolve(REPO_ROOT, process.env.TCGTRACKING_GAP_OUTPUT_DIR)
      : path.join(artifactDir, dryRun ? "gap-fill-dry-run" : "gap-fill-apply"),
  );

  if (!dryRun && !allowWrite) {
    throw new Error("Refusing DB writes: set TCGTRACKING_GAP_ALLOW_WRITE=true and TCGTRACKING_GAP_DRY_RUN=false after staging approval.");
  }
  if (!dryRun && dbEnv === "production" && !allowProductionWrite) {
    throw new Error("Refusing production DB write: set TCGTRACKING_GAP_ALLOW_PRODUCTION_WRITE=true after explicit production approval.");
  }

  const plan = await buildPlan(artifactDir);

  const byCategory: Summary["byCategory"] = {};
  const byClassification: Record<string, number> = {};
  const byProductKind: Record<string, number> = {};
  let plannedCatalogItemInserts = 0;
  let plannedSealedProductInserts = 0;
  let reviewRows = 0;
  let skippedExisting = 0;
  let missingParentSets = 0;
  let conflicts = 0;

  for (const row of plan) {
    byCategory[row.categoryId] ??= {};
    increment(byCategory[row.categoryId], row.classification);
    increment(byClassification, row.classification);
    if (row.productKind) increment(byProductKind, row.productKind);
    if (row.conflict) conflicts += 1;
    if (!row.catalogSetId) missingParentSets += 1;
    if (row.existingCatalogItemId || row.existingSealedProductId) skippedExisting += 1;
    if (!row.conflict && row.catalogSetId && !row.existingCatalogItemId && !row.existingSealedProductId) {
      if (row.classification === "catalog_item") plannedCatalogItemInserts += 1;
      if (row.classification === "sealed_product") plannedSealedProductInserts += 1;
      if (row.classification === "review") reviewRows += 1;
    } else if (row.classification === "review") {
      reviewRows += 1;
    }
  }

  const summary: Summary = {
    dryRun,
    dbEnv,
    artifactDir,
    outputDir,
    scanned: plan.length,
    plannedCatalogItemInserts,
    plannedSealedProductInserts,
    reviewRows,
    skippedExisting,
    missingParentSets,
    conflicts,
    byCategory,
    byClassification,
    byProductKind,
  };

  writeOutputs(plan, outputDir, summary);

  if (!dryRun) {
    const applyResult = await applyPlan(plan);
    fs.writeFileSync(path.join(outputDir, "apply-result.json"), JSON.stringify(applyResult, null, 2));
    console.log(JSON.stringify({ ...summary, applyResult }, null, 2));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

main()
  .catch((error) => {
    console.error("[tcgtracking-gap-fill-importer] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
