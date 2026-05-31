import { prisma } from "../src/lib/prisma";
import { normalizeTcgtrackingProductForCatalog } from "../src/modules/catalog/tcgtracking-normalizer";

const SOURCE = "tcgtracking";
const BASE_URL = process.env.TCGCSV_BASE_URL ?? "https://tcgcsv.com/tcgplayer";
const DRY_RUN = (process.env.TCGCSV_DRY_RUN ?? "true").toLowerCase() !== "false";
const DB_ENV = process.env.TCGCSV_DB_ENV ?? "local";
const ALLOW_LIVE_WRITE = (process.env.TCGCSV_ALLOW_LIVE_WRITE ?? "false").toLowerCase() === "true";
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.TCGCSV_REQUEST_TIMEOUT_MS ?? "45000"));
const RETRY_COUNT = Math.max(0, Number(process.env.TCGCSV_RETRY_COUNT ?? "2"));
const RETRY_DELAY_MS = Math.max(0, Number(process.env.TCGCSV_RETRY_DELAY_MS ?? "1000"));
const START_GROUP_INDEX = Math.max(0, Number(process.env.TCGCSV_START_GROUP_INDEX ?? "0"));
const MAX_GROUPS = Math.max(0, Number(process.env.TCGCSV_MAX_GROUPS ?? "0"));
const PRODUCT_CONCURRENCY = Math.max(1, Number(process.env.TCGCSV_PRODUCT_CONCURRENCY ?? "8"));
const CATEGORY_IDS = (process.env.TCGCSV_CATEGORY_IDS ?? "3,85,68")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const CATEGORY_CONFIG: Record<string, { game: string; language: string; label: string }> = {
  "3": { game: "POKEMON", language: "en", label: "Pokémon EN" },
  "85": { game: "POKEMON", language: "ja", label: "Pokémon JP" },
  "68": { game: "ONE_PIECE", language: "en", label: "One Piece" },
};

type TcgCsvGroup = {
  groupId?: number | string;
  name?: string;
  abbreviation?: string | null;
  publishedOn?: string | null;
  modifiedOn?: string | null;
  productCount?: number | null;
  isSupplemental?: boolean | null;
  categoryId?: number | string;
};

type TcgCsvProduct = {
  productId?: number | string;
  name?: string;
  cleanName?: string;
  imageUrl?: string | null;
  extendedData?: unknown;
  [key: string]: unknown;
};

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function entries(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["results", "data", "sets", "groups", "products", "cards"]) {
      const value = obj[key];
      if (Array.isArray(value)) return value.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
    }
  }
  return [];
}

function extMap(product: TcgCsvProduct): Record<string, unknown> {
  const raw = product.extendedData ?? product.extended_data;
  const out: Record<string, unknown> = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const name = asString(entry.name) ?? asString(entry.displayName) ?? asString(entry.key);
      if (name) out[name] = entry.value ?? entry.displayValue ?? entry.text;
    }
  } else if (raw && typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return out;
}

function inferProductKind(product: TcgCsvProduct): "CARD" | "SEALED_PRODUCT" | "ACCESSORY" {
  const em = extMap(product);
  const normalizedLabelKeys = new Set(Object.keys(em).map((key) => key.toLowerCase().replace(/\s+/g, " ").trim()));
  if (["rarity", "card type", "cardtype", "color", "attribute", "card number", "number"].some((key) => normalizedLabelKeys.has(key))) {
    return "CARD";
  }

  const text = [product.name, product.cleanName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const accessoryTerms = ["sleeves", "playmat", "binder", "portfolio", "deck box", "album"];
  const sealedTerms = [
    "booster box",
    "booster pack",
    "case",
    "display",
    "deck",
    "starter deck",
    "structure deck",
    "bundle",
    "collection",
    "premium collection",
    "elite trainer box",
    "etb",
    "tin",
    "blister",
    "box",
    "starter set",
    "gift box",
    "double pack",
  ];
  if (accessoryTerms.some((term) => text.includes(term))) return "ACCESSORY";
  if (sealedTerms.some((term) => text.includes(term))) return "SEALED_PRODUCT";
  return "CARD";
}

function inferGroupKind(group: TcgCsvGroup): string {
  const name = String(group.name ?? "").toLowerCase();
  const abbr = String(group.abbreviation ?? "").toUpperCase();
  if (/trainer gallery|galarian gallery|shiny vault|classic collection/.test(name)) return "subset_gallery_collection";
  if (name.includes("promo") || ["PR", "SVP", "SWSD", "OP-PR"].includes(abbr)) return "promo";
  if (name.includes("starter deck") || /\bST-?\d+/.test(abbr)) return "starter_deck";
  if (/release event|pre-release|prerelease/.test(name)) return "release_event";
  if (name.includes("mcdonald")) return "mcdonalds_promo";
  if (name.includes("trick or trade")) return "seasonal_collection";
  if (name.includes("world championship")) return "championship_deck";
  if (/\benergy\b|energies/.test(name)) return "energy_collection";
  if (name.includes("battle academy") || name.includes("my first battle")) return "intro_battle_product";
  if (/collection|bundle|deck set/.test(name)) return "collection_or_bundle";
  if (Boolean(group.isSupplemental)) return "supplemental";
  return "main_expansion";
}

function searchText(parts: unknown[]) {
  return parts
    .map(asString)
    .filter((x): x is string => Boolean(x))
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

async function sleep(ms: number) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(workers);
}

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: "application/json,text/plain,*/*",
          referer: "https://tcgcsv.com/",
          "user-agent": "oripa-saas-tcgcsv-vendor-sync/1.0",
        },
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`request failed status=${response.status} url=${url} body=${text.slice(0, 200)}`);
      return text ? JSON.parse(text) : null;
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_COUNT) break;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function fetchGroups(categoryId: string): Promise<TcgCsvGroup[]> {
  return entries(await fetchJson(`${BASE_URL}/${categoryId}/groups`)) as TcgCsvGroup[];
}

async function fetchProducts(categoryId: string, groupId: string): Promise<TcgCsvProduct[]> {
  return entries(await fetchJson(`${BASE_URL}/${categoryId}/${groupId}/products`)) as TcgCsvProduct[];
}

async function bulkUpsertCatalogItems(rows: any[]) {
  if (!rows.length) return;
  await prisma.$executeRawUnsafe(
    `
    WITH data AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
        "source" text,
        "sourceItemId" text,
        "catalogSetId" text,
        "localId" text,
        "sourcePayload" jsonb,
        "itemType" "CatalogItemType",
        "game" text,
        "language" text,
        "name" text,
        "setId" text,
        "setName" text,
        "cardNumber" text,
        "rarity" text,
        "cardType" text,
        "color" text,
        "attribute" text,
        "imageBaseUrl" text,
        "imageThumbUrl" text,
        "imageLargeUrl" text,
        "searchText" text,
        "isActive" boolean
      )
    )
    INSERT INTO "CatalogItem" (
      "id", "source", "sourceItemId", "catalogSetId", "localId", "sourcePayload", "itemType", "game", "language", "name",
      "setId", "setName", "cardNumber", "rarity", "cardType", "color", "attribute", "imageBaseUrl", "imageThumbUrl", "imageLargeUrl",
      "searchText", "isActive", "createdAt", "updatedAt"
    )
    SELECT gen_random_uuid()::text, "source", "sourceItemId", "catalogSetId", "localId", "sourcePayload", "itemType", "game", "language", "name",
      "setId", "setName", "cardNumber", "rarity", "cardType", "color", "attribute", "imageBaseUrl", "imageThumbUrl", "imageLargeUrl",
      "searchText", "isActive", now(), now()
    FROM data
    ON CONFLICT ("source", "sourceItemId", "language") DO UPDATE SET
      "catalogSetId" = EXCLUDED."catalogSetId",
      "localId" = EXCLUDED."localId",
      "sourcePayload" = EXCLUDED."sourcePayload",
      "itemType" = EXCLUDED."itemType",
      "game" = EXCLUDED."game",
      "name" = EXCLUDED."name",
      "setId" = EXCLUDED."setId",
      "setName" = EXCLUDED."setName",
      "cardNumber" = EXCLUDED."cardNumber",
      "rarity" = EXCLUDED."rarity",
      "cardType" = EXCLUDED."cardType",
      "color" = EXCLUDED."color",
      "attribute" = EXCLUDED."attribute",
      "imageBaseUrl" = EXCLUDED."imageBaseUrl",
      "imageThumbUrl" = EXCLUDED."imageThumbUrl",
      "imageLargeUrl" = EXCLUDED."imageLargeUrl",
      "searchText" = EXCLUDED."searchText",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = now()
    `,
    JSON.stringify(rows),
  );
}

async function bulkUpsertSealedProducts(rows: any[]) {
  if (!rows.length) return;
  await prisma.$executeRawUnsafe(
    `
    WITH data AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
        "source" text,
        "sourceProductId" text,
        "sourceCategoryId" text,
        "catalogSetId" text,
        "game" text,
        "language" text,
        "name" text,
        "cleanName" text,
        "imageUrl" text,
        "imageCount" integer,
        "isPresale" boolean,
        "presaleReleaseDate" timestamptz,
        "productKind" text,
        "sourcePayload" jsonb,
        "searchText" text,
        "isActive" boolean
      )
    )
    INSERT INTO "CatalogSealedProduct" (
      "id", "source", "sourceProductId", "sourceCategoryId", "catalogSetId", "game", "language", "name", "cleanName", "imageUrl",
      "imageCount", "isPresale", "presaleReleaseDate", "productKind", "sourcePayload", "searchText", "isActive", "createdAt", "updatedAt"
    )
    SELECT gen_random_uuid()::text, "source", "sourceProductId", "sourceCategoryId", "catalogSetId", "game", "language", "name", "cleanName", "imageUrl",
      "imageCount", COALESCE("isPresale", false), "presaleReleaseDate", "productKind", "sourcePayload", "searchText", "isActive", now(), now()
    FROM data
    ON CONFLICT ("source", "sourceProductId", "language", "game") DO UPDATE SET
      "sourceCategoryId" = EXCLUDED."sourceCategoryId",
      "catalogSetId" = EXCLUDED."catalogSetId",
      "name" = EXCLUDED."name",
      "cleanName" = EXCLUDED."cleanName",
      "imageUrl" = EXCLUDED."imageUrl",
      "imageCount" = EXCLUDED."imageCount",
      "isPresale" = EXCLUDED."isPresale",
      "presaleReleaseDate" = EXCLUDED."presaleReleaseDate",
      "productKind" = EXCLUDED."productKind",
      "sourcePayload" = EXCLUDED."sourcePayload",
      "searchText" = EXCLUDED."searchText",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = now()
    `,
    JSON.stringify(rows),
  );
}

async function main() {
  if (!DRY_RUN && !["staging", "production"].includes(DB_ENV)) {
    throw new Error("TCGCSV_DB_ENV must be staging or production for non-dry-run writes");
  }
  if (!DRY_RUN && DB_ENV === "production" && !ALLOW_LIVE_WRITE) {
    throw new Error("Refusing production write: set TCGCSV_ALLOW_LIVE_WRITE=true");
  }

  const startedAt = Date.now();
  let groupsFetched = 0;
  let groupsSynced = 0;
  let productsFetched = 0;
  let cardsUpserted = 0;
  let sealedUpserted = 0;
  let accessoriesUpserted = 0;
  let skipped = 0;
  let failures = 0;

  console.log(`[tcgcsv-vendor-sync] start dryRun=${DRY_RUN} dbEnv=${DB_ENV} categories=${CATEGORY_IDS.join(",")} startGroupIndex=${START_GROUP_INDEX} maxGroups=${MAX_GROUPS || "all"} productConcurrency=${PRODUCT_CONCURRENCY}`);

  for (const categoryId of CATEGORY_IDS) {
    const config = CATEGORY_CONFIG[categoryId];
    if (!config) throw new Error(`Unsupported category ${categoryId}`);
    const allGroups = await fetchGroups(categoryId);
    groupsFetched += allGroups.length;
    const groups = allGroups.slice(START_GROUP_INDEX, MAX_GROUPS ? START_GROUP_INDEX + MAX_GROUPS : undefined);
    console.log(`[tcgcsv-vendor-sync] category=${categoryId} label=${config.label} groups=${allGroups.length} syncing=${groups.length}`);

    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      const groupId = asString(group.groupId);
      const groupName = asString(group.name);
      if (!groupId || !groupName) {
        skipped += 1;
        continue;
      }
      const sourceSetId = categoryId === "3" ? groupId : `${categoryId}:${groupId}`;
      try {
        const products = await fetchProducts(categoryId, groupId);
        productsFetched += products.length;
        const groupKind = inferGroupKind(group);
        const setPayload = {
          source: SOURCE,
          sourceCategoryId: categoryId,
          rawSourceSetId: groupId,
          raw: group,
          importer: "sync-tcgcsv-vendor-catalog",
        };
        let catalogSet: { id: string; name: string } | null = null;
        if (!DRY_RUN) {
          catalogSet = await (prisma as any).catalogSet.upsert({
            where: { source_sourceSetId_game: { source: SOURCE, sourceSetId, game: config.game } },
            update: {
              sourceCategoryId: categoryId,
              language: config.language,
              setCode: asString(group.abbreviation),
              name: groupName,
              releaseDate: parseDate(group.publishedOn),
              productCount: typeof group.productCount === "number" ? group.productCount : products.length,
              isSupplemental: Boolean(group.isSupplemental),
              groupKind,
              sourcePayload: setPayload,
              searchText: searchText([groupName, group.abbreviation, config.game, config.language, SOURCE]),
              isActive: true,
            },
            create: {
              source: SOURCE,
              sourceSetId,
              sourceCategoryId: categoryId,
              game: config.game,
              language: config.language,
              setCode: asString(group.abbreviation),
              name: groupName,
              releaseDate: parseDate(group.publishedOn),
              productCount: typeof group.productCount === "number" ? group.productCount : products.length,
              isSupplemental: Boolean(group.isSupplemental),
              groupKind,
              sourcePayload: setPayload,
              searchText: searchText([groupName, group.abbreviation, config.game, config.language, SOURCE]),
              isActive: true,
            },
            select: { id: true, name: true },
          });
        }

        const cardRows: any[] = [];
        const sealedRows: any[] = [];
        for (const product of products) {
          const sourceProductId = asString(product.productId);
          const name = asString(product.name) ?? asString(product.cleanName);
          if (!sourceProductId || !name) {
            skipped += 1;
            continue;
          }
          const kind = inferProductKind(product);
          if (kind === "CARD") {
            const normalized = normalizeTcgtrackingProductForCatalog(product, {
              language: config.language,
              game: config.game,
              categoryId,
              set: { id: groupId, name: groupName, abbreviation: asString(group.abbreviation) },
              sourceContext: { importer: "sync-tcgcsv-vendor-catalog", dbEnv: DB_ENV },
            });
            if (!normalized.row) {
              skipped += 1;
              continue;
            }
            cardRows.push({ ...normalized.row, catalogSetId: catalogSet?.id ?? null });
            cardsUpserted += 1;
            continue;
          }

          const sourceSealedId = categoryId === "3" ? sourceProductId : `${categoryId}:${sourceProductId}`;
          const payload = {
            source: SOURCE,
            sourceCategoryId: categoryId,
            rawSourceProductId: sourceProductId,
            productKind: kind,
            raw: product,
            set: group,
            importer: "sync-tcgcsv-vendor-catalog",
          };
          sealedRows.push({
            source: SOURCE,
            sourceProductId: sourceSealedId,
            sourceCategoryId: categoryId,
            catalogSetId: catalogSet?.id ?? null,
            game: config.game,
            language: config.language,
            name,
            cleanName: asString(product.cleanName),
            imageUrl: asString(product.imageUrl),
            imageCount: null,
            isPresale: false,
            presaleReleaseDate: null,
            productKind: kind,
            sourcePayload: payload,
            searchText: searchText([name, product.cleanName, groupName, group.abbreviation, config.game, config.language, kind, SOURCE]),
            isActive: true,
          });
          if (kind === "ACCESSORY") accessoriesUpserted += 1;
          else sealedUpserted += 1;
        }
        if (!DRY_RUN) {
          await bulkUpsertCatalogItems(cardRows);
          await bulkUpsertSealedProducts(sealedRows);
        }
        groupsSynced += 1;
        console.log(`[tcgcsv-vendor-sync] group category=${categoryId} index=${START_GROUP_INDEX + index} group=${groupId} products=${products.length}`);
      } catch (error) {
        failures += 1;
        console.error(`[tcgcsv-vendor-sync] group failed category=${categoryId} group=${groupId}`, error);
      }
    }
  }

  const durationSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[tcgcsv-vendor-sync] completed groupsFetched=${groupsFetched} groupsSynced=${groupsSynced} productsFetched=${productsFetched} cardsUpserted=${DRY_RUN ? 0 : cardsUpserted} sealedUpserted=${DRY_RUN ? 0 : sealedUpserted} accessoriesUpserted=${DRY_RUN ? 0 : accessoriesUpserted} dryRunCards=${DRY_RUN ? cardsUpserted : 0} dryRunSealed=${DRY_RUN ? sealedUpserted : 0} dryRunAccessories=${DRY_RUN ? accessoriesUpserted : 0} skipped=${skipped} failures=${failures} duration=${durationSec}s`);
}

main()
  .catch((error) => {
    console.error("[tcgcsv-vendor-sync] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
