import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const DRY_RUN = (process.env.DB_REMEDIATION_DRY_RUN ?? "true").toLowerCase() !== "false";
const DB_ENV = process.env.DB_REMEDIATION_DB_ENV ?? "local";
const ALLOW_LIVE_WRITE = (process.env.DB_REMEDIATION_ALLOW_LIVE_WRITE ?? "false").toLowerCase() === "true";
const SOURCE = "tcgtracking";

export type RemediationPlan = {
  createTcgtrackingSetsFromItems: number;
  linkTcgtrackingItemsToSets: number;
  backfillTcgtrackingSetReviewStatus: number;
  backfillLegacySetReviewStatus: number;
  backfillLegacySetSourcePayload: number;
  backfillPokemonCardIoItemSetLinks: number;
  backfillOnePieceDbItemSetLinks: number;
};

type TcgtrackingSetCandidate = {
  sourceCategoryId: string;
  rawSourceSetId: string;
  sourceSetId: string;
  game: string;
  language: string;
  setCode: string | null;
  name: string;
  releaseDate: Date | null;
  productCount: number | null;
  symbolImageUrl: string | null;
  isSupplemental: boolean;
  groupKind: string;
  sourcePayload: Record<string, unknown>;
  searchText: string;
};

export function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

export function parseDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function inferTcgtrackingSourceSetId(categoryId: string | null, rawSetId: string | null): string | null {
  if (!rawSetId) return null;
  if (!categoryId || categoryId === "3") return rawSetId;
  return `${categoryId}:${rawSetId}`;
}

export function inferGroupKind(input: { name?: unknown; abbreviation?: unknown; isSupplemental?: unknown }): string {
  const name = String(input.name ?? "").toLowerCase();
  const abbr = String(input.abbreviation ?? "").toUpperCase();
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
  if (Boolean(input.isSupplemental)) return "supplemental";
  return "main_expansion";
}

export function classifyReviewStatus(input: { source: string; sourcePayload?: unknown; groupKind?: string | null }): string {
  if (input.source === SOURCE && input.sourcePayload && input.groupKind) return "auto_classified";
  if (input.source === SOURCE && input.sourcePayload) return "source_backed_needs_review";
  return "legacy_metadata_only_needs_review";
}

export function buildSetSearchText(parts: unknown[]): string {
  return parts
    .map(asString)
    .filter((x): x is string => Boolean(x))
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function rawObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function buildTcgtrackingSetCandidate(row: {
  game: string;
  language: string;
  setId: string | null;
  setName: string | null;
  sourcePayload: unknown;
}): TcgtrackingSetCandidate | null {
  const payload = rawObject(row.sourcePayload);
  const setPayload = rawObject(payload.set);
  const raw = rawObject(setPayload.raw ?? setPayload);
  const rawSourceSetId = asString(setPayload.id) ?? asString(setPayload.groupId) ?? asString(raw.id) ?? asString(row.setId);
  const sourceCategoryId = asString(payload.sourceCategoryId) ?? asString(payload.categoryId);
  const sourceSetId = inferTcgtrackingSourceSetId(sourceCategoryId, rawSourceSetId);
  const name = asString(setPayload.name) ?? asString(setPayload.set_name) ?? asString(row.setName);
  if (!sourceCategoryId || !rawSourceSetId || !sourceSetId || !name) return null;

  const setCode = asString(setPayload.abbreviation) ?? asString(setPayload.set_abbr);
  const isSupplemental = Boolean(setPayload.is_supplemental ?? setPayload.isSupplemental ?? raw.is_supplemental ?? raw.isSupplemental);
  const groupKind = inferGroupKind({ name, abbreviation: setCode, isSupplemental });
  const productCountRaw = setPayload.product_count ?? setPayload.productCount ?? raw.product_count ?? raw.productCount;
  const productCount = typeof productCountRaw === "number" ? productCountRaw : (asString(productCountRaw) ? Number(asString(productCountRaw)) : null);
  const safeProductCount = productCount !== null && Number.isFinite(productCount) ? productCount : null;
  const sourcePayload = {
    __oripaPayloadTrust: "source_backed",
    __oripaPayloadProvenance: {
      importer: "remediate-live-db-missing-gaps",
      derivedFrom: "CatalogItem.sourcePayload.set",
      source: SOURCE,
    },
    source: SOURCE,
    sourceCategoryId,
    rawSourceSetId,
    raw: Object.keys(setPayload).length ? setPayload : { id: rawSourceSetId, name, abbreviation: setCode },
    importer: "remediate-live-db-missing-gaps",
    derivedFrom: "CatalogItem.sourcePayload.set",
  };

  return {
    sourceCategoryId,
    rawSourceSetId,
    sourceSetId,
    game: row.game,
    language: row.language,
    setCode,
    name,
    releaseDate: parseDate(setPayload.published_on ?? setPayload.publishedOn ?? raw.published_on ?? raw.publishedOn),
    productCount: safeProductCount,
    symbolImageUrl: asString(setPayload.set_symbol_url) ?? asString(setPayload.symbolImageUrl),
    isSupplemental,
    groupKind,
    sourcePayload,
    searchText: buildSetSearchText([name, setCode, row.game, row.language, SOURCE]),
  };
}

async function count(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(sql);
  return Number(rows[0]?.total ?? 0);
}

async function buildPlan(): Promise<RemediationPlan> {
  return {
    createTcgtrackingSetsFromItems: await count(`
      with candidates as (
        select distinct ci.game,
          case when ci."sourcePayload"->>'sourceCategoryId' is not null then ci."sourcePayload"->>'sourceCategoryId'
               when ci."sourcePayload"->>'categoryId' is not null then ci."sourcePayload"->>'categoryId'
               when ci."sourceItemId" like '%:%' then split_part(ci."sourceItemId", ':', 1)
               when ci.game='POKEMON' and ci.language='en' then '3'
               else null end as cat,
          ci."setId" as raw_set_id
        from "CatalogItem" ci
        where ci.source='tcgtracking' and ci."catalogSetId" is null and ci."setId" is not null
      )
      select count(*)::bigint as total
      from candidates c
      where c.cat is not null
        and not exists (
          select 1 from "CatalogSet" cs
          where cs.source='tcgtracking' and cs.game=c.game
            and cs."sourceSetId" = case when c.cat='3' then c.raw_set_id else c.cat || ':' || c.raw_set_id end
        )
    `),
    linkTcgtrackingItemsToSets: await count(`
      select count(*)::bigint as total
      from "CatalogItem" ci
      join "CatalogSet" cs on cs.source='tcgtracking' and cs.game=ci.game
        and cs."sourceSetId" = case
          when coalesce(ci."sourcePayload"->>'sourceCategoryId', ci."sourcePayload"->>'categoryId', case when ci."sourceItemId" like '%:%' then split_part(ci."sourceItemId", ':', 1) end, case when ci.game='POKEMON' and ci.language='en' then '3' end) = '3' then ci."setId"
          else coalesce(ci."sourcePayload"->>'sourceCategoryId', ci."sourcePayload"->>'categoryId', case when ci."sourceItemId" like '%:%' then split_part(ci."sourceItemId", ':', 1) end, case when ci.game='POKEMON' and ci.language='en' then '3' end) || ':' || ci."setId"
        end
      where ci.source='tcgtracking' and ci."catalogSetId" is null and ci."setId" is not null
    `),
    backfillTcgtrackingSetReviewStatus: await count(`select count(*)::bigint as total from "CatalogSet" where source='tcgtracking' and "reviewStatus" is null`),
    backfillLegacySetReviewStatus: await count(`select count(*)::bigint as total from "CatalogSet" where source<>'tcgtracking' and "reviewStatus" is null`),
    backfillLegacySetSourcePayload: await count(`select count(*)::bigint as total from "CatalogSet" where source<>'tcgtracking' and "sourcePayload" is null`),
    backfillPokemonCardIoItemSetLinks: await count(`
      select count(*)::bigint as total
      from "CatalogItem" ci join "CatalogSet" cs on cs.source=ci.source and cs.game=ci.game and cs."sourceSetId"=ci."setId"
      where ci.source='pokemoncard.io' and ci."catalogSetId" is null and ci."setId" is not null
    `),
    backfillOnePieceDbItemSetLinks: await count(`
      select count(*)::bigint as total
      from "CatalogItem" ci join "CatalogSet" cs on cs.source=ci.source and cs.game=ci.game and cs."sourceSetId"=ci."setId"
      where ci.source='onepiecedb.io' and ci."catalogSetId" is null and ci."setId" is not null
    `),
  };
}

async function createMissingTcgtrackingSetsFromItems(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ game: string; language: string; setId: string | null; setName: string | null; sourcePayload: unknown }>>(`
    with ranked as (
      select ci.game, ci.language, ci."setId", ci."setName", ci."sourcePayload",
        row_number() over (partition by ci.game, ci.language, coalesce(ci."sourcePayload"->>'sourceCategoryId', ci."sourcePayload"->>'categoryId', case when ci."sourceItemId" like '%:%' then split_part(ci."sourceItemId", ':', 1) end), ci."setId" order by ci."updatedAt" desc) as rn
      from "CatalogItem" ci
      where ci.source='tcgtracking' and ci."catalogSetId" is null and ci."setId" is not null and ci."sourcePayload" is not null
    )
    select game, language, "setId", "setName", "sourcePayload" from ranked where rn=1
  `);
  const candidates = rows.map(buildTcgtrackingSetCandidate).filter((x): x is TcgtrackingSetCandidate => Boolean(x));
  if (!candidates.length) return 0;
  return Number(await prisma.$executeRawUnsafe(
    `
    WITH data AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
        "sourceCategoryId" text,
        "sourceSetId" text,
        "game" text,
        "language" text,
        "setCode" text,
        "name" text,
        "releaseDate" timestamptz,
        "productCount" integer,
        "symbolImageUrl" text,
        "isSupplemental" boolean,
        "groupKind" text,
        "reviewStatus" text,
        "sourcePayload" jsonb,
        "searchText" text
      )
    )
    INSERT INTO "CatalogSet" (
      "id", "source", "sourceSetId", "sourceCategoryId", "game", "language", "setCode", "name", "releaseDate", "productCount",
      "symbolImageUrl", "isSupplemental", "groupKind", "reviewStatus", "sourcePayload", "searchText", "isActive", "createdAt", "updatedAt"
    )
    SELECT gen_random_uuid()::text, 'tcgtracking', "sourceSetId", "sourceCategoryId", "game", "language", "setCode", "name", "releaseDate", "productCount",
      "symbolImageUrl", "isSupplemental", "groupKind", "reviewStatus", "sourcePayload", "searchText", true, now(), now()
    FROM data
    ON CONFLICT ("source", "sourceSetId", "game") DO UPDATE SET
      "sourceCategoryId" = COALESCE(EXCLUDED."sourceCategoryId", "CatalogSet"."sourceCategoryId"),
      "language" = EXCLUDED."language",
      "setCode" = COALESCE(EXCLUDED."setCode", "CatalogSet"."setCode"),
      "name" = EXCLUDED."name",
      "releaseDate" = COALESCE(EXCLUDED."releaseDate", "CatalogSet"."releaseDate"),
      "productCount" = COALESCE(EXCLUDED."productCount", "CatalogSet"."productCount"),
      "symbolImageUrl" = COALESCE(EXCLUDED."symbolImageUrl", "CatalogSet"."symbolImageUrl"),
      "isSupplemental" = EXCLUDED."isSupplemental",
      "groupKind" = COALESCE(EXCLUDED."groupKind", "CatalogSet"."groupKind"),
      "reviewStatus" = COALESCE("CatalogSet"."reviewStatus", EXCLUDED."reviewStatus"),
      "sourcePayload" = COALESCE("CatalogSet"."sourcePayload", EXCLUDED."sourcePayload"),
      "searchText" = EXCLUDED."searchText",
      "isActive" = true,
      "updatedAt" = now()
    `,
    JSON.stringify(candidates.map((c) => ({ ...c, releaseDate: c.releaseDate?.toISOString() ?? null, reviewStatus: classifyReviewStatus({ source: SOURCE, sourcePayload: c.sourcePayload, groupKind: c.groupKind }) }))),
  ));
}

async function applySql(sql: string): Promise<number> {
  return Number(await prisma.$executeRawUnsafe(sql));
}

async function applyRemediation() {
  const createSets = await createMissingTcgtrackingSetsFromItems();
  const linkTcgtracking = await applySql(`
    update "CatalogItem" ci
    set "catalogSetId" = cs.id, "updatedAt" = now()
    from "CatalogSet" cs
    where ci.source='tcgtracking' and ci."catalogSetId" is null and ci."setId" is not null
      and cs.source='tcgtracking' and cs.game=ci.game
      and cs."sourceSetId" = case
        when coalesce(ci."sourcePayload"->>'sourceCategoryId', ci."sourcePayload"->>'categoryId', case when ci."sourceItemId" like '%:%' then split_part(ci."sourceItemId", ':', 1) end, case when ci.game='POKEMON' and ci.language='en' then '3' end) = '3' then ci."setId"
        else coalesce(ci."sourcePayload"->>'sourceCategoryId', ci."sourcePayload"->>'categoryId', case when ci."sourceItemId" like '%:%' then split_part(ci."sourceItemId", ':', 1) end, case when ci.game='POKEMON' and ci.language='en' then '3' end) || ':' || ci."setId"
      end
  `);
  const tcgtrackingReview = await applySql(`update "CatalogSet" set "reviewStatus"='auto_classified', "updatedAt"=now() where source='tcgtracking' and "reviewStatus" is null and "groupKind" is not null and "sourcePayload" is not null`);
  const legacyReview = await applySql(`update "CatalogSet" set "reviewStatus"='legacy_metadata_only_needs_review', "updatedAt"=now() where source<>'tcgtracking' and "reviewStatus" is null`);
  const legacyPayload = await applySql(`
    update "CatalogSet"
    set "sourcePayload" = jsonb_build_object(
      'source', source,
      '__oripaPayloadTrust', 'legacy_metadata_only',
      '__oripaPayloadProvenance', jsonb_build_object(
        'importer', 'remediate-live-db-missing-gaps',
        'derivedFrom', 'CatalogSet columns; raw source payload unavailable',
        'source', source
      ),
      'sourceSetId', "sourceSetId",
      'sourceCategoryId', "sourceCategoryId",
      'name', name,
      'setCode', "setCode",
      'importer', 'remediate-live-db-missing-gaps',
      'trust', 'legacy_metadata_only',
      'derivedFrom', 'CatalogSet columns; raw source payload unavailable'
    ), "updatedAt"=now()
    where source<>'tcgtracking' and "sourcePayload" is null
  `);
  const pokemonLinks = await applySql(`
    update "CatalogItem" ci
    set "catalogSetId"=cs.id, "updatedAt"=now()
    from "CatalogSet" cs
    where ci.source='pokemoncard.io' and ci."catalogSetId" is null and ci."setId" is not null
      and cs.source=ci.source and cs.game=ci.game and cs."sourceSetId"=ci."setId"
  `);
  const onePieceLinks = await applySql(`
    update "CatalogItem" ci
    set "catalogSetId"=cs.id, "updatedAt"=now()
    from "CatalogSet" cs
    where ci.source='onepiecedb.io' and ci."catalogSetId" is null and ci."setId" is not null
      and cs.source=ci.source and cs.game=ci.game and cs."sourceSetId"=ci."setId"
  `);
  return { createSets, linkTcgtracking, tcgtrackingReview, legacyReview, legacyPayload, pokemonLinks, onePieceLinks };
}

function assertWriteAllowed() {
  if (!DRY_RUN && !["staging", "production"].includes(DB_ENV)) throw new Error("DB_REMEDIATION_DB_ENV must be staging or production for non-dry-run writes");
  if (!DRY_RUN && DB_ENV === "production" && !ALLOW_LIVE_WRITE) throw new Error("Refusing production write: set DB_REMEDIATION_ALLOW_LIVE_WRITE=true");
}

async function main() {
  assertWriteAllowed();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const before = await buildPlan();
  const applied = DRY_RUN ? null : await applyRemediation();
  const after = await buildPlan();
  const out = { stamp, dryRun: DRY_RUN, dbEnv: DB_ENV, before, applied, after };
  const outDir = path.resolve(process.cwd(), "../../docs/plans");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `live-db-remediation-${DRY_RUN ? "dry-run" : "apply"}-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 2));
  console.log(JSON.stringify({ ...out, outPath }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[live-db-remediation] failed", error);
    process.exitCode = 1;
  }).finally(async () => prisma.$disconnect());
}
