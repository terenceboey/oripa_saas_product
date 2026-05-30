# CatalogItem + TCGTracking Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make `CatalogItem` the source-backed searchable Pokémon catalog layer, powered by TCGTracking Open TCG API imports, while keeping vendor inventory/prize ownership out of the catalog.

**Architecture:** TCGTracking data normalizes into global `CatalogItem` rows (`source = "tcgtracking"`). This MVP stops at DB migration + source-backed import/report scripts; pack/prize API/UI linkage is deferred. Live DB writes are migration-gated and pilot-import gated.

**Tech Stack:** Prisma/Postgres, TCGTracking REST API, `tsx` sync/report scripts, API package build/test harness.

---

## Scope correction — API/UI deferred

User correction: MVP should **not touch pack create/update/read API or vendor UI**. The near-term slice is only:

1. DB/schema/runbook work needed for `CatalogItem` TCGTracking fields.
2. TCGTracking fixture capture.
3. Deterministic normalizer/import script.
4. Dry-run/pilot/live-write guardrails.
5. Catalog import report / SQL inspection.

The previous Phase 4 / Phase 5 pack-reference work is moved to a **deferred later lane**. Do not add `PackPrize.catalogItemId`, shared pack schema fields, pack mutation validation, public DTO leak guards, or vendor selection/edit UI in this MVP unless explicitly re-approved.


## Source correction — 2026-05-29

User correction: Oripa is **not** using TCGdex for this catalog slice. The upstream source is **TCGTracking Open TCG API**: `https://tcgtracking.com/tcgapi/?tab=docs`. Treat all prior TCGdex wording in old review artifacts as superseded by this plan.

TCGTracking source facts checked from docs:

- Base docs: `https://tcgtracking.com/tcgapi/?tab=docs`
- Base API: `https://tcgtracking.com/tcgapi/v1`
- Pokémon category id: `3`; Pokémon Japan category id: `85` if later needed.
- Relevant endpoints:
  - `/tcgapi/v1/meta`
  - `/tcgapi/v1/categories`
  - `/tcgapi/v1/{cat}/sets`
  - `/tcgapi/v1/{cat}/sets/{set}` for static product rows
  - `/tcgapi/v1/{cat}/sets/{set}/pricing` for pricing by subtype
  - `/tcgapi/v1/{cat}/sets/{set}/skus` for SKU condition/finish/language rows
  - `/tcgapi/v1/products/{product_id}` for one product with product/price/SKU/mapping data
  - `/tcgapi/v1/{cat}/search?q={query}` for set search
- Docs mention product fields including `id`, `name`, images/static IDs, set/group id, and `ext_number`/collector number in match logic examples. Verify exact JSON shape from a live response/browser before coding the normalizer because direct API requests may be Cloudflare-blocked from some server environments.

## Current context checked

- `PROJECTS.md`: CatalogItem / TCGTracking is a catalog/source-data slice, not inventory ownership.
- `docs/current-oripa-workflow.md`: maps this slice to `CAR-10`, `CAR-09`, `STORY-12`, `STORY-16`; requires dry-run defaults and explicit approval for live writes.
- `prisma/schema.prisma`: `CatalogItem` already has `localId`, `sourcePayload`, source uniqueness, and search indexes. `PackPrize.catalogItemId` is intentionally out of MVP scope after the API/UI scope correction.
- Current repo still has prior TCGdex-named files (`apps/api/src/modules/catalog/tcgdex-normalizer.ts`, `apps/api/scripts/sync-tcgdex.ts`); implementation must replace/rename these for TCGTracking rather than treating them as final.
- TCGTracking card/product-to-CatalogItem projection and dry-run importer are **not yet implemented**; this plan defines the replacement target.
- `apps/api/src/modules/catalog/router.ts`: vendor-authenticated catalog search exists, but search/API response work is not required for the import-only MVP.
- `apps/web/app/vendor/page.tsx` and `packages/shared/src/index.ts`: no pack form/shared schema work in this MVP.

## Prior Oracle verification delta — source-superseded, safety conclusions retained

Original review artifacts were produced against the now-superseded TCGdex wording. Do **not** treat those artifacts as proof that the TCGTracking API shape is correct. Retain only the source-agnostic architecture/safety conclusions below, then run a fresh source-shape review after TCGTracking normalizer/importer details are implemented.

Verdict to carry forward for the import-only MVP: **conditional / block before implementation** until source fixtures are captured and importer/live-write guardrails exist. Source-agnostic pack-reference blockers from the older broader plan are now deferred.

MVP blockers retained:

1. Search performance is not a blocker for import-only MVP; if later UI search latency degrades, add a reviewed `pg_trgm`/GIN or `citext` posture.
2. Rollback needs global and per-set deactivation for imported `tcgtracking` rows.
3. Import guard must distinguish staging Render DB from production Render DB via explicit env, not only `/render\.com/`.
4. TCGTracking fixtures must be captured before normalizer coding.
5. Live writes require explicit DB env, dry-run smoke, backup/snapshot, and approval.

Deferred pack-reference blockers:

- UI persistence/submission of `catalogItemId`.
- Shared pack schemas / `CreatePrizeRow` / `buildPrizeRows()` propagation.
- Pack create/update validation and destructive mutation safety.
- Public DTO scalar/nested `catalogItem` leak prevention.
- Vendor edit round-trip and draw-history replacement safety.



## Prior live Oracle loop summary — source-superseded

The previous live Oracle convergence loop was run before the upstream-source correction and before the import-only scope correction. Treat it as **valid for importer live-write guardrails and rollback posture**. Nullable provenance FK, transaction-safe pack mutation validation, public DTO leak prevention, and prize/draw-history replacement safety are deferred with the pack-reference lane. It is **not** valid as TCGTracking API-shape validation.

Fresh TCGTracking-specific review must happen after Task 2.5 source fixtures are captured and before Task 3 normalizer coding. Do not encode guessed TCGTracking fields before fixture evidence exists.

1. Importer implementation must add/log `TCGTRACKING_DB_ENV=local|staging|production`, refuse Render DB with `TCGTRACKING_DB_ENV=local`, require production writes to include `TCGTRACKING_DB_ENV=production TCGTRACKING_ALLOW_LIVE_WRITE=true`, and require staging writes to state `TCGTRACKING_DB_ENV=staging`.
2. `catalog:report` is not implemented yet; add it to `apps/api/package.json` with source counts, source+itemType counts, recent TCGTracking rows, duplicate source-key check, missing-image count, and TCGTracking counts by `setId`.
3. Production/staging pilot commands must include explicit `TCGTRACKING_DB_ENV`. Live DB mutation still requires explicit approval plus backup/snapshot confirmation.


## Carried-forward safety blockers from prior convergence loop

These blockers were found in the prior broader review loop. After the import-only scope correction, only importer/runbook blockers remain mandatory for this MVP:

1. Every write-mode importer command must set `TCGTRACKING_DB_ENV` explicitly; staging/production dry-runs are explicit too.
2. Every non-dry-run import must run a same-environment source smoke first and refuse Cloudflare/HTML/non-JSON/empty/missing-key responses.
3. Rollback must support global and per-set deactivation of imported `tcgtracking` rows.

Deferred to later pack-reference lane:

- `PackPrize.catalogItemId` FK verification.
- Public DTO scalar/nested catalog leak prevention.
- Prize replacement/draw-history/allocation-counter safety.

## Required fresh review before implementation

Run a fresh review after TCGTracking API response samples are captured and before normalizer/importer coding. The new review must focus on source shape: product IDs, set IDs, image fields, collector-number field, pricing/SKU structure, Cloudflare/access constraints, and whether category `3` is enough. Category `85` is not approved for MVP.

## Fresh live Oracle convergence result — 2026-05-29

Live Oracle loop was rerun against the earlier broader TCGTracking plan and reached convergence, but the later user scope correction supersedes API/UI parts of that result.

- Importer-relevant conclusions retained: fixture-before-normalizer gate, category/language guard, deterministic missing-field contract, `source = "tcgtracking"` validation, same-environment source smoke, dry-run/live-write guardrails, and `catalog:report`.
- Deferred conclusions: FK fail-fast SQL for `PackPrize.catalogItemId`, transaction-safe pack update path, protected-edit UI payload, public pack DTO leak tests, and automated `test:packs:catalog-ref`.

Non-blocking notes retained: TCGTracking source shape is still unknown until Task 2.5 fixtures are captured; category `85` remains unapproved for MVP; search performance is a follow-up only if real latency appears.

Oracle artifacts:
- `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T042414Z_catalogitem-tcgtracking-plan-pass1/oracle_response.md`
- `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T043404Z_catalogitem-tcgtracking-plan-pass2/oracle_response.md`
- `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T043928Z_catalogitem-tcgtracking-plan-pass3/oracle_response.md`

## Import-only scope Oracle convergence result — 2026-05-29

After the user scope correction, a fresh live Oracle pass reviewed this plan as an **import-only MVP**. Oracle returned **CLEAN** with no exact patches required.

- Scope confirmed in: `CatalogItem` DB/schema support, TCGTracking fixture capture, fixture-backed normalizer/import script, dry-run/pilot/live-write guardrails, `catalog:report`, import runbook, and rollout SQL checks.
- Scope confirmed out: pack create/update/read API, shared pack schemas, `PackPrize.catalogItemId`, public DTO leak work, and vendor UI selection/edit flow.
- Deferred sections are future-lane context only and do not create a material import-only blocker.
- Non-blocking implementation notes: capture category `3` fixtures before normalizer coding; keep category `85` blocked; do not implement deferred pack/API/UI work in this MVP.

Import-only Oracle artifact:
- `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T051659Z_catalogitem-tcgtracking-import-only-pass1/oracle_response.md`

## Canonical terms

- `CatalogItem`: global, source-backed reference/projection row for cards/sealed products.
- `TCGTracking`: upstream Pokémon card catalog source.
- `sourceItemId`: upstream stable ID, e.g. TCGTracking card id.
- `localId` / `cardNumber`: set-local card number.
- `PackPrize`: vendor pack prize row with pack allocation fields: stock, remainingStock, weight, estimatedValue, label, image. Not touched in import-only MVP.
- `catalogItemId`: deferred optional reference from a `PackPrize` to the global catalog row. This is metadata/provenance, not inventory ownership, but it is not part of this MVP.

## Non-goals / safety boundaries

Do not put these into `CatalogItem` as truth:

- vendor stock or stock movements
- pack allocation quantity
- ownership/customer entitlement
- fulfillment/shipping/redemption state
- PSA/BGS/CGC cert ownership
- cost basis or vendor valuation truth
- authentication/vaulting/insurance claims
- fairness proof or exact live odds proof

Copy must not imply: owned, vaulted, fulfilled, authenticated, insured, priced, prize-eligible, or guaranteed unless the matching slice exists.

---

## Phase 1 — Lock the data model

### Task 1: Confirm current schema state

**Objective:** Verify that the Prisma schema contains the catalog import fields before touching API/UI.

**Files:**
- Inspect: `prisma/schema.prisma`
- Inspect: `prisma/sql/catalogitem-tcgtracking.sql`

**Steps:**
1. Confirm `CatalogItem` has:
   - `localId String?`
   - `sourcePayload Json?`
   - `@@unique([source, sourceItemId, language])`
   - `@@index([game, language, isActive])`
   - `@@index([setId])`
2. Confirm the manual SQL only adds missing columns/indexes and is idempotent.
3. Do not apply SQL to live DB without explicit approval.

**Verification:**

```bash
npm run build -w @oripa/api
```

Expected: TypeScript build passes or only unrelated pre-existing errors are reported.

### Task 2: Deferred — PackPrize catalog reference

**Objective:** Do not touch pack prize/API/UI linkage in the import-only MVP.

**Status:** deferred / later lane. Keep this section as context only so future implementers do not accidentally mix pack-reference work into the importer slice.

**Do not modify for this MVP:**
- `PackPrize`
- shared pack schemas
- pack create/update/read API
- public DTO mappers
- vendor pack form/edit UI

**Deferred implementation target:**

```prisma
model PackPrize {
  id             String       @id @default(cuid())
  packId         String
  catalogItemId  String?
  label          String
  imageUrl       String?
  estimatedValue Int
  weight         Int
  stock          Int
  remainingStock Int
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  pack           Pack         @relation(fields: [packId], references: [id], onDelete: Cascade)
  catalogItem    CatalogItem? @relation(fields: [catalogItemId], references: [id], onDelete: SetNull)
  draws          PackDraw[]
  drawResults    DrawResult[]

  @@index([packId])
  @@index([catalogItemId])
}

model CatalogItem {
  // existing fields...
  packPrizes PackPrize[]
}
```

Manual SQL shape:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "PackPrize" ADD COLUMN IF NOT EXISTS "catalogItemId" TEXT;

DO $$
DECLARE
  existing_def text;
  existing_del "char";
  existing_upd "char";
BEGIN
  SELECT pg_get_constraintdef(c.oid), c.confdeltype, c.confupdtype
  INTO existing_def, existing_del, existing_upd
  FROM pg_constraint c
  WHERE c.conrelid = '"PackPrize"'::regclass
    AND c.conname = 'PackPrize_catalogItemId_fkey';

  IF existing_def IS NOT NULL THEN
    IF existing_def NOT ILIKE '%FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"(id)%'
       OR existing_del <> 'n'
       OR existing_upd <> 'c'
    THEN
      RAISE EXCEPTION 'Existing PackPrize_catalogItemId_fkey has wrong definition/actions: %, del %, upd %',
        existing_def, existing_del, existing_upd;
    END IF;
  ELSE
    ALTER TABLE "PackPrize"
      ADD CONSTRAINT "PackPrize_catalogItemId_fkey"
      FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "PackPrize" VALIDATE CONSTRAINT "PackPrize_catalogItemId_fkey";

CREATE INDEX IF NOT EXISTS "PackPrize_catalogItemId_idx" ON "PackPrize"("catalogItemId");
```

Deferred SQL note: do not swallow `duplicate_object`. If the correct constraint already exists, skip creation with an explicit preflight branch or idempotent SQL; if a same-named wrong constraint exists, fail fast and require DB-operator approval to repair/drop/recreate.

**Deferred verification:**

```bash
npx prisma generate
npm run build -w @oripa/api
```

Deferred post-migration SQL verification:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'PackPrize' AND column_name = 'catalogItemId';

SELECT
  conname,
  pg_get_constraintdef(oid) AS constraint_def,
  confdeltype,
  confupdtype
FROM pg_constraint
WHERE conname = 'PackPrize_catalogItemId_fkey';
```

Expected: Prisma client generates; API build passes; `catalogItemId` is nullable text; FK exists against `CatalogItem(id)` with `ON DELETE SET NULL` and `ON UPDATE CASCADE`. In PostgreSQL check `confdeltype = 'n'` and `confupdtype = 'c'`. If a same-named FK exists but the target/actions do not match, stop rollout; repair/drop/recreate only with explicit DB-operator approval.

---

## Phase 2 — Harden TCGTracking normalization/import

### Task 2.5: Capture TCGTracking source fixtures before normalizer coding

**Objective:** Prevent TCGdex-era or guessed field assumptions from leaking into the TCGTracking normalizer.

**Blocker:** Do not start Task 3 until source fixtures are captured and committed/reviewed. Direct server HTTP may be Cloudflare-blocked; use browser-based inspection or the actual execution environment if needed.

**Required fixtures:**
- `/tcgapi/v1/categories`
- `/tcgapi/v1/3/sets`
- one Pokémon set product endpoint `/tcgapi/v1/3/sets/{set_id}`
- matching `/pricing`
- matching `/skus` if available
- `/products/{product_id}` for one product from that set

**Record actual key paths for:**
- product id
- product name
- collector/local number
- set id / group id
- set name / abbreviation
- image URL fields
- rarity/category/product type
- SKU language/variant/condition shape
- pricing shape
- whether category `3` alone is sufficient for MVP

Normalizer tests must use these fixtures, not inferred TCGdex-era or guessed TCGTracking fields.

**Verification:** fixtures exist under an implementation-owned fixture path, and the Task 3 field mapping cites those fixture keys.

### Task 3: Keep normalizer deterministic and source-backed

**Objective:** Ensure TCGTracking rows map consistently to catalog rows.

**Files:**
- Modify/Test: `apps/api/src/modules/catalog/tcgtracking-normalizer.ts`
- Modify/Test: `apps/api/scripts/test-tcgtracking-normalizer.ts`
- Modify: `apps/api/package.json`

**Package scripts required by this plan:**

```json
{
  "catalog:report": "tsx scripts/catalog-report.ts",
  "test:catalog:tcgtracking": "tsx scripts/test-tcgtracking-normalizer.ts"
}
```

**Required behavior:**
- `source = "tcgtracking"`
- `sourceItemId = String(product.id)`
- `localId` / `cardNumber` use the fixture-proven collector-number field path. Visible docs show `number`; `ext_number` is unapproved unless fixtures prove it exists.
- `itemType = CARD` for Pokémon card products; sealed products stay out of MVP unless TCGTracking product metadata distinguishes them safely.
- `game = POKEMON` for category `3`; keep `POKEMON_JAPAN`/language handling explicit if category `85` is imported later.
- `language = env/default language`, or SKU-derived language only if importing SKU rows.
- images derive from TCGTracking product/static image fields; do **not** assume the old TCGdex `/low.webp` and `/high.webp` suffix convention.
- `setId = String(set.id)` / TCGTracking group id; `setName` and abbreviation come from the set list/product payload where available.
- Optional price/SKU metadata may be copied into `sourcePayload`; do not expose reference value copy until value policy accepts it.
- `searchText` includes name, set name, set id/group id, abbreviation, collector/ext number, rarity/category where present, `pokemon`, `card`, `tcgtracking`.
- `sourcePayload` keeps raw source JSON plus enough set/pricing/SKU context to debug projections.
Required-field contract:
  - Missing `product.id`: skip row, count `missing_id`, never write.
  - Missing `product.name`: skip row, count `missing_name`, never write.
  - Missing collector/local number: write row with `localId = null` and `cardNumber = null`; do not skip unless fixtures prove this breaks display/search.
  - Missing image: write row with image fields null and count `missing_image`.
  - Missing set name/abbreviation: write row with available set id, count `missing_set_metadata`.
  - Each skipped row logs source set id, source product id if available, and reason.

**Verification:**

```bash
npm run test:catalog:tcgtracking -w @oripa/api
```

Expected: `tcgtracking normalizer tests passed`.

### Task 4: Make importer operationally safe

**Objective:** Allow dry-run, pilot import, resume windows, and live DB guardrails.

**Files:**
- Modify: `apps/api/scripts/sync-tcgtracking.ts`
- Modify: `apps/api/package.json` (add `"catalog:report": "tsx scripts/catalog-report.ts"`)
- Document: `docs/current-oripa-workflow.md` or this plan

**Importer env contract:**

```bash
TCGTRACKING_DRY_RUN=true                 # default true
TCGTRACKING_ALLOW_LIVE_WRITE=false       # must be true for production writes
TCGTRACKING_DB_ENV=local                 # local | staging | production; do not infer prod only from Render URL
TCGTRACKING_CATEGORY_ID=3                 # MVP hard guard: only 3 = Pokemon is approved; 85 requires a reviewed source-key/language plan
TCGTRACKING_MAX_SETS=1                   # default pilot scope
TCGTRACKING_MAX_CARDS=0                  # 0 means all selected
TCGTRACKING_START_SET_INDEX=0            # resume pagination
TCGTRACKING_FETCH_FULL_CARDS=false       # only set true if brief cards lack needed fields
TCGTRACKING_CONTINUE_ON_ERROR=false
TCGTRACKING_RETRY_COUNT=2
TCGTRACKING_RETRY_DELAY_MS=1000
TCGTRACKING_REQUEST_TIMEOUT_MS=15000
```

**Required logging:**
- start line with language/game/dryRun/totalSets/window
- per-set progress line
- first 5 dry-run sample rows
- final summary: sets/cards/normalized/upserted/failures/duration
- explicit refusal if `TCGTRACKING_DB_ENV=production` without `TCGTRACKING_ALLOW_LIVE_WRITE=true`
- explicit refusal for any Render `DATABASE_URL` with `TCGTRACKING_DB_ENV=local`; set `staging` or `production` explicitly
- explicit log of `TCGTRACKING_DB_ENV`; if staging uses Render, require `TCGTRACKING_DB_ENV=staging` instead of relying on URL regex only
- production write commands must include both `TCGTRACKING_DB_ENV=production` and `TCGTRACKING_ALLOW_LIVE_WRITE=true`; staging write commands must include `TCGTRACKING_DB_ENV=staging`
- for any `TCGTRACKING_DRY_RUN=false` execution, require `TCGTRACKING_DB_ENV` to be explicitly set to `local`, `staging`, or `production`; do not rely on the default for write mode
- hard-refuse `TCGTRACKING_CATEGORY_ID != "3"` for MVP with: `Only TCGTracking category 3 is approved for MVP. Category 85 requires a reviewed category/language/source-key plan.`
- do not create one `CatalogItem` per SKU language in MVP; store SKU language/variant data in `sourcePayload` only
- if category `85` is later enabled, either add `sourceCategoryId` to the model and uniqueness policy, or set `sourceItemId = ${categoryId}:${product.id}` before import
- before any non-dry-run import, run a dry-run source smoke from the same environment that will run writes and log HTTP status, content-type, endpoint URL, category id, set id, product count, and first normalized sample; refuse writes on Cloudflare/HTML, non-JSON, empty, or missing expected fixture keys

**Verification:**

```bash
TCGTRACKING_DB_ENV=local \
TCGTRACKING_DRY_RUN=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

Expected: no DB writes, sample rows printed, final summary shows `upserted=0`.

### Task 5: Create DB migration/runbook

**Objective:** Make applying the schema safe and repeatable.

**Files:**
- Create/Modify: `prisma/sql/catalogitem-tcgtracking.sql`
- New: `docs/runbooks/catalogitem-tcgtracking-import.md`

**Runbook must include:**
1. Backup/snapshot requirement before live DB changes.
1a. `SET lock_timeout = '5s'; SET statement_timeout = '60s';` in live SQL runbooks and fail-fast FK preflight; prefer `ADD CONSTRAINT ... NOT VALID` plus explicit validation where supported.
2. Apply catalog migration SQL.
3. Do not apply PackPrize catalog reference SQL in this MVP; pack-reference work is deferred.
4. Run Prisma generate/build.
5. Run dry-run importer.
6. Run tiny write pilot.
7. Inspect rows.
8. Rollback posture: disable imported rows with `isActive=false` rather than destructive deletes unless explicitly approved.

**Pilot write command:**

```bash
TCGTRACKING_DB_ENV=staging \
TCGTRACKING_DRY_RUN=false \
TCGTRACKING_ALLOW_LIVE_WRITE=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

**Inspection SQL:**

```sql
SELECT source, COUNT(*) FROM "CatalogItem" GROUP BY source ORDER BY source;

SELECT id, source, "sourceItemId", name, "setId", "cardNumber", rarity, "imageThumbUrl"
FROM "CatalogItem"
WHERE source = 'tcgtracking'
ORDER BY "createdAt" DESC
LIMIT 20;
```

---

## Phase 3 — Deferred — catalog search/API selection support

**Status:** deferred. Do not modify catalog router/search response shape for the import-only MVP. Existing catalog search may remain as-is; this phase resumes only when vendor/admin selection UI is approved.

### Task 6: Keep catalog search vendor-authenticated

**Objective:** Deferred guardrail: if/when catalog search is used by vendor dashboard users, it must not become public scraping.

**Files:**
- Existing: `apps/api/src/modules/catalog/router.ts`

**Current behavior to preserve:**
- `GET /v1/catalog/search`
- requires vendor read access
- query:
  - `q`: min 2 max 120
  - `limit`: max 30
  - `type`: `card | sealed | all`
  - `game`: default `POKEMON`

**Verification:**
- unauthenticated request returns 401/403 path
- vendor-authenticated request returns `{ items: [...] }`

### Task 7: Improve response shape for selection UI

**Objective:** Deferred: return enough metadata for UI display and PackPrize reference once API/UI work is re-approved.

**Files:**
- Modify: `apps/api/src/modules/catalog/router.ts`

**Response item shape:**

```ts
type CatalogSearchItem = {
  id: string;
  source: string;
  sourceItemId: string;
  itemType: "CARD" | "SEALED_PRODUCT";
  game: string;
  language: string;
  name: string;
  setId: string | null;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageThumbUrl: string | null;
  imageLargeUrl: string | null;
  imageBaseUrl: string | null;
};
```

**Search priority:**
1. `name startsWith q`
2. `name contains q`
3. `searchText contains q`
4. dedupe by id

**Oracle patch — performance posture:** Prisma `mode: "insensitive"` maps to PostgreSQL `ILIKE`; the existing B-tree `@@index([name])` will not fully optimize contains searches. MVP is acceptable with TCGTracking-scale data and `limit <= 30`, but if search latency is poor, add a reviewed SQL migration for `pg_trgm`/GIN on `name` and/or `searchText` rather than pretending the current B-tree covers all cases.

**Verification:**
- Search `charizard` returns name matches before deep metadata matches.
- Search a set id or local number can find rows through `searchText`.

---

## Phase 4 — Deferred — Wire catalog references into pack creation API

**Status:** deferred. Per scope correction, do not touch pack create/update/read API in the import-only MVP.

### Task 8: Extend shared pack schemas with optional catalog item ID

**Objective:** Let the vendor UI submit selected catalog item metadata. This is a hard prerequisite before UI work; otherwise selection IDs are dropped or rejected.

**Files:**
- Modify: `packages/shared/src/index.ts`

**Implementation target:**

```ts
items: z.array(
  z.object({
    catalogItemId: z.string().trim().min(1).max(64).optional(),
    label: z.string().min(1).max(60),
    estimatedValue: z.number().int().nonnegative(),
    stock: z.number().int().positive(),
    imageUrl: z.string().url().optional(),
  })
).min(1).max(5000)
```

And for direct `prizes`:

```ts
catalogItemId: z.string().trim().min(1).max(64).optional(),
```

**Verification:**

```bash
npm run build -w @oripa/shared
npm run build -w @oripa/api
```

Expected: shared and API builds pass.

### Task 9: Validate selected catalog items server-side

**Objective:** Prevent arbitrary cross-source/deleted IDs from being saved silently.

**Files:**
- Modify: `apps/api/src/modules/packs/router.ts`

**Implementation target:**
- Add `catalogItemId?: string` to `CreatePrizeRow`.
- Add `catalogItemId?: string` to the `buildPrizeRows()` input type for both `tiers[].items[]` and direct `prizes[]`.
- `buildPrizeRows()` should carry `catalogItemId` through from tier items/prizes.
- Before creating/updating pack prizes, collect unique `catalogItemId`s.
- Fetch active `CatalogItem` rows by those IDs.
- If any requested ID is missing/inactive, return 400, not an uncaught 500.
- Only allow `source = "tcgtracking"`, `game = POKEMON`, and `itemType = CARD` in this slice.
- Use the same Prisma client as the mutation path; on update prefer the transaction client and validate before `deleteMany`.
- **Oracle patch:** validate replacement rows before any update-path `deleteMany`, or validate inside the same Prisma transaction with the transaction client before delete/recreate. Invalid IDs must not delete existing prizes.

**Suggested helper:**

```ts
async function validateCatalogItemIds(
  db: Pick<typeof prisma, "catalogItem">,
  catalogItemIds: string[],
): Promise<{ ok: true; validIds: Set<string> } | { ok: false; missing: string[] }> {
  const uniqueIds = [...new Set(catalogItemIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { ok: true, validIds: new Set<string>() };

  const rows = await db.catalogItem.findMany({
    where: {
      id: { in: uniqueIds },
      source: "tcgtracking",
      isActive: true,
      itemType: "CARD",
      game: "POKEMON",
    },
    select: { id: true },
  });

  const validIds = new Set(rows.map((row) => row.id));
  const missing = uniqueIds.filter((id) => !validIds.has(id));
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, validIds };
}

// Call-site shape:
// const validation = await validateCatalogItemIds(prismaOrTx, catalogItemIds);
// if (!validation.ok) return res.status(400).json({ error: "Invalid catalog item selection", catalogItemIds: validation.missing });
```

**Create path changes:**
- call validation after `const prizeRows = buildPrizeRows(parsed.data);`
- include `catalogItemId` in `createMany.data`

**Update path changes:**
- validate replacement rows before delete/recreate
- include `catalogItemId` in replacement prize creates
- treat `Pack.totalStock`, `Pack.remainingStock`, `PackPrize.stock`, and `PackPrize.remainingStock` as allocation state, not safe descriptive metadata
- before any update that replaces prizes, check draw history; if `replacementPrizeRows` is non-null and the pack has any `DrawOrder`, `DrawResult`, or legacy `PackDraw`, return 400 and do not delete/recreate prizes
- prize replacement is allowed only when `existing.status === "DRAFT"` and the pack has no draw history; a DRAFT pack with no history may replace prizes and set `status: "LIVE"` in the same transaction after validation
- if `replacementPrizeRows` is non-null and `existing.status !== "DRAFT"`, return 400 and do not delete/recreate prizes
- `totalStock` changes are allowed only while `existing.status === "DRAFT"`; reject them for LIVE/ARCHIVED packs even if there is zero draw history
- if draw history exists, reject any request that changes `totalStock`; do not reset `remainingStock`
- do not set `remainingStock: parsed.data.totalStock` unconditionally on update; only set `remainingStock` from `totalStock` on create, or on a no-history DRAFT stock resize, and update `totalStock`/`remainingStock` in lockstep
- metadata-only pack updates may proceed after draw history only if they do not replace prizes and do not mutate allocation counters

**Update mutation contract:**
- Wrap any PATCH that can replace prizes or change `totalStock` in `prisma.$transaction(async (tx) => { ... })`.
- Inside that transaction: re-read existing pack by pack/vendor id; build replacement rows; validate catalog IDs using `tx.catalogItem`; count `tx.drawOrder`, `tx.drawResult`, and `tx.packDraw`; reject unsafe replacement/stock changes; only then delete/recreate prizes or resize stock.
- Do not use the root `prisma` client for validation/counts inside this update path.

Suggested draw-history/allocation guard, inside the `prisma.$transaction(async (tx) => { ... })` callback:

```ts
const [drawOrderCount, drawResultCount, legacyPackDrawCount] = await Promise.all([
  tx.drawOrder.count({ where: { packId: existing.id } }),
  tx.drawResult.count({ where: { packId: existing.id } }),
  tx.packDraw.count({ where: { packId: existing.id } }),
]);
const hasDrawHistory = drawOrderCount + drawResultCount + legacyPackDrawCount > 0;

if (replacementPrizeRows && existing.status !== "DRAFT") {
  return res.status(400).json({
    error: "Prize replacement is only allowed while the pack is DRAFT",
  });
}

if (hasDrawHistory && replacementPrizeRows) {
  return res.status(400).json({
    error: "Prize replacement is not allowed after draw history exists",
  });
}

const totalStockChanging =
  parsed.data.totalStock !== undefined && parsed.data.totalStock !== existing.totalStock;

if (totalStockChanging && existing.status !== "DRAFT") {
  return res.status(400).json({
    error: "Total stock can only be changed while the pack is DRAFT",
  });
}

if (hasDrawHistory && totalStockChanging) {
  return res.status(400).json({
    error: "Total stock cannot be changed after draw history exists",
  });
}

const packUpdateData: Prisma.PackUpdateInput = {
  title: parsed.data.title,
  pricePoints: parsed.data.pricePoints,
  startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
  endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
  isNew: parsed.data.isNew,
  limitedLabel: parsed.data.limitedLabel,
  status: parsed.data.status,
  importantNotes: parsed.data.importantNotes,
  drawLimitMode: parsed.data.drawLimitMode,
  drawLimitValue: parsed.data.drawLimitValue,
  drawLimitResetTimezone: parsed.data.drawLimitResetTimezone,
};

if (totalStockChanging) {
  packUpdateData.totalStock = parsed.data.totalStock;
  packUpdateData.remainingStock = parsed.data.totalStock;
}
```

**Verification:**
- pack creation with valid `catalogItemId` succeeds
- pack creation with missing/inactive/non-tcgtracking/non-card `catalogItemId` returns 400 and does not create pack
- pack update with invalid replacement ID returns 400 and does not delete existing prizes
- pack update that would replace prizes on a non-DRAFT pack returns 400
- pack update that would replace prizes after draw history returns 400 and does not detach `PackDraw.prizeId` or `DrawResult.packPrizeId` references
- pack update after draw history cannot change `totalStock` or reset `remainingStock`
- pack update on LIVE/no-history pack that changes `totalStock` returns 400
- pack update on DRAFT/no-history pack may change `totalStock` and updates `remainingStock` in lockstep

### Task 10: Include catalog item in pack read responses

**Objective:** Let vendor/admin displays show source-backed metadata when available while public endpoints keep the MVP payload unchanged.

**Public endpoint decision:** For MVP, public `GET /v1/packs` and `GET /v1/packs/:packId` omit nested `catalogItem` and scalar `catalogItemId`. Vendor/admin pack reads and vendor mutation responses include minimal nested `catalogItem`. If public card metadata is needed later, add a separate reviewed response contract with only safe minimal fields.

**Odds/value disclosure boundary:** This slice only decides catalog metadata exposure. Do not add any new public catalog-derived value, price, ownership, authentication, fulfillment, proof, or eligibility fields. Existing public `estimatedValue`, `stock`, `remainingStock`, `weight`, and `dropRatePercent` exposure is outside this catalog slice and must be reviewed under the odds/value disclosure gate before launch copy or API documentation treats it as approved.

**Files:**
- Modify: `apps/api/src/modules/packs/router.ts`
- Modify: frontend types in `apps/web/app/vendor/page.tsx`
- Do not modify public `apps/web/app/page.tsx` types for nested `catalogItem` in this MVP slice

**Implementation target:**
- For vendor/admin pack reads and vendor create/update/archive/retired-delete fallback responses, use one shared include instead of ad-hoc `include: { prizes: true }`:

```ts
const vendorPackInclude = {
  prizes: {
    include: {
      catalogItem: {
        select: {
          id: true,
          source: true,
          sourceItemId: true,
          name: true,
          setId: true,
          setName: true,
          cardNumber: true,
          rarity: true,
          imageThumbUrl: true,
          imageLargeUrl: true,
        },
      },
    },
  },
  _count: {
    select: {
      drawOrders: true,
      drawResults: true,
      draws: true,
    },
  },
} satisfies Prisma.PackInclude;
```

Map vendor/admin responses to expose edit safety only on those paths:

```ts
const hasDrawHistory = pack._count.drawOrders + pack._count.drawResults + pack._count.draws > 0;
return {
  ...decoratePackWithRates(pack),
  hasDrawHistory,
  canReplacePrizes: pack.status === "DRAFT" && !hasDrawHistory,
};
```

**Public endpoint contract:**
- `GET /v1/packs`: omit nested `catalogItem` for MVP
- `GET /v1/packs/:packId`: omit nested `catalogItem` for MVP
- No public frontend type change is required in this slice

**Public scalar-leak guard:**
Public pack routes must not use raw `include: { prizes: true }` after `PackPrize.catalogItemId` is added. Prisma returns all scalar columns for `prizes: true`, so public responses would otherwise expose `catalogItemId` even while omitting nested `catalogItem`. Use an explicit public include/mapper:

```ts
const publicPackInclude = {
  prizes: {
    select: {
      id: true,
      packId: true,
      label: true,
      imageUrl: true,
      estimatedValue: true,
      weight: true,
      stock: true,
      remainingStock: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.PackInclude;
```

Use `publicPackInclude` only on public `GET /v1/packs` and `GET /v1/packs/:packId`. Vendor/admin paths use `vendorPackInclude`.

**Verification:**
- Existing packs without `catalogItemId` still serialize.
- Packs with `catalogItemId` include catalog metadata on vendor/admin paths.
- Vendor create/update/archive/retired-delete fallback responses return the same minimal nested `catalogItem` shape.
- Public pack responses do not include nested `catalogItem` in this MVP.
- Public pack responses do not include scalar `catalogItemId`.
- `decoratePackWithRates()` still works because it only needs `weight`.

---

## Phase 5 — Deferred — Vendor UI selection flow

**Status:** deferred. Per scope correction, do not touch vendor pack form/edit UI in the import-only MVP.

### Task 11: Preserve selected catalog item in vendor form state

**Objective:** The vendor form should store both human label/image and optional catalog reference.

**Files:**
- Modify: `apps/web/app/vendor/page.tsx`

**Live Oracle patch:** Add selected-source badge UI and clear-link behavior. Clearing a link removes `catalogItemId` only; do not forcibly erase label/image unless the user edits those fields.

**State model target:**

```ts
type TierItemDraft = {
  catalogItemId?: string;
  label: string;
  estimatedValue: string;
  stock: string;
  imageUrl: string;
  selectedCatalog?: Pick<CatalogSuggestion, "id" | "source" | "setId" | "cardNumber" | "rarity">;
};
```

**Oracle patch:** Current `apps/web/app/vendor/page.tsx` only stores label/image from a suggestion. Implementation must update `ItemDraft`, `createItem()`, `applyCatalogSuggestion()`, `submitPack()`, and clear-link UI so the selected ID survives to the API payload.

**Selection behavior:**
- User types a card search query.
- Suggestions show: card name, set name, card number, rarity, source badge.
- Selecting a suggestion fills:
  - `catalogItemId = item.id`
  - `label = item.name` or display label including set/number if desired
  - `imageUrl = item.imageThumbUrl ?? item.imageLargeUrl ?? existing/default`
- If user manually edits label/image afterwards, keep `catalogItemId` unless they explicitly clear selection.
- Add a small “clear catalog link” action if selected row is wrong.
- Show a visible selected-source badge using `source`, `setId`, `cardNumber`, and `rarity`.

**Verification:**
- Select TCGTracking suggestion; submit payload contains `catalogItemId`.
- Manual item with no catalog selection still works.

### Task 12: Make edit flow round-trip catalog references

**Objective:** Editing an existing pack should not lose catalog links.

**Files:**
- Modify: `apps/web/app/vendor/page.tsx`
- Depends on Task 10 API response shape.

**Oracle patch:** Current edit behavior flattens all prizes into one hardcoded `A Tier`. Until tier grouping/percentage metadata is persisted and restored, only claim catalog reference round-trip for the flattened edit model; do not claim full multi-tier round-trip.

**Behavior:**
- `editPack(pack)` maps each prize back into draft state with:
  - `catalogItemId: prize.catalogItem?.id ?? prize.catalogItemId ?? undefined`
  - label/image from prize row
- Saving a pack preserves references if no edits clear them.


**Edit-safety behavior:**
- Vendor/admin pack responses should expose `hasDrawHistory` and `canReplacePrizes`; preferred derivation is `canReplacePrizes = pack.status === "DRAFT" && drawOrderCount + drawResultCount + legacyPackDrawCount === 0`.
- UI must disable the prize editor and omit `tiers` / `prizes` from PATCH payload when `canReplacePrizes === false`.
- Store `editingPackCanReplacePrizes` and `editingPackOriginalTotalStock`; if `editingPackId && editingPackCanReplacePrizes === false`, do not include `tiers`, do not include `prizes`, and do not include `totalStock` unless `Number(totalStock) === editingPackOriginalTotalStock`.
- Backend remains authoritative; UI disablement is for clarity, not security.

**Verification:**
- Create pack with selected catalog item.
- Reload vendor page.
- Edit pack.
- Save without changing prize.
- Confirm `PackPrize.catalogItemId` remains set.
- Acceptance is limited to flattened edit preserving catalog IDs; tier labels/percentages are not restored until tier metadata is modeled.
- Flattened edit preservation is accepted only for packs with no draw history. For packs with draw history, this slice must not replace prize rows; disable prize editing in the UI or submit metadata-only updates.

---

## Phase 6 — Admin/import visibility and QA

### Task 13: Add lightweight catalog diagnostics endpoint or script

**Objective:** Quickly verify source counts and import health without Prisma Studio.

**Preferred low-risk option:** script only.

**Files:**
- Create: `apps/api/scripts/catalog-report.ts`
- Modify: `apps/api/package.json` (add `"catalog:report": "tsx scripts/catalog-report.ts"`)

**Script output:**
- count by `source`
- count by `source + itemType`
- recent 20 `tcgtracking` rows
- duplicate check by `[source, sourceItemId, language]` should be impossible but report if any
- missing image count for `source=tcgtracking`
- count by `source=tcgtracking + setId` for per-set rollback targeting

**Package script:**

```json
"catalog:report": "tsx scripts/catalog-report.ts"
```

**Verification:**

```bash
npm run catalog:report -w @oripa/api
```

Expected: prints source counts and recent sample rows.

### Task 13.5: Deferred — automated catalog-reference mutation/leak tests

**Status:** deferred with pack API/UI work. Do not add this test script for the import-only MVP.

**Objective:** Prove destructive mutation and public leak safety with repeatable checks, not only manual QA.

**Files:**
- Create: `apps/api/scripts/test-packs-catalog-ref.ts`
- Modify: `apps/api/package.json`

**Package script:**

```json
"test:packs:catalog-ref": "tsx scripts/test-packs-catalog-ref.ts"
```

**Required cases:**
- create pack with valid active `tcgtracking` CARD id succeeds and persists `PackPrize.catalogItemId`
- create pack with missing/inactive/non-tcgtracking/non-card id returns 400 and creates no pack
- update pack with invalid replacement id returns 400 and leaves existing `PackPrize` rows untouched
- update non-DRAFT pack with replacement rows returns 400
- update pack with `DrawOrder`/`DrawResult`/`PackDraw` history returns 400 for prize replacement and leaves all referenced prize IDs intact
- update LIVE/no-history `totalStock` returns 400
- update DRAFT/no-history `totalStock` updates `totalStock` and `remainingStock` in lockstep
- public `/v1/packs` and `/v1/packs/:packId` responses contain no `catalogItemId` and no nested `catalogItem`
- vendor/admin responses include only the approved minimal nested `catalogItem` shape

**Verification:**

```bash
npm run test:packs:catalog-ref -w @oripa/api
```

### Task 14: Manual QA checklist

**Objective:** Verify the slice end-to-end.

**Steps:**
1. Run TCGTracking dry-run:

```bash
TCGTRACKING_DB_ENV=local \
TCGTRACKING_DRY_RUN=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

2. Apply schema SQL to local/staging DB.
3. Run pilot import. Local write command, only with a local `DATABASE_URL`:

```bash
TCGTRACKING_DB_ENV=local \
TCGTRACKING_DRY_RUN=false \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

Staging write command, only against staging:

```bash
TCGTRACKING_DB_ENV=staging \
TCGTRACKING_DRY_RUN=false \
TCGTRACKING_ALLOW_LIVE_WRITE=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

4. Run catalog report.
5. Inspect imported rows directly:

```sql
SELECT id, source, "sourceItemId", name, "setName", "cardNumber", rarity, "imageThumbUrl"
FROM "CatalogItem"
WHERE source = 'tcgtracking'
ORDER BY "createdAt" DESC
LIMIT 20;
```

Expected: imported catalog rows are source-backed and image/card metadata matches captured fixtures where available.

---

## Phase 7 — Live rollout plan

### Task 15: Staging rollout

**Objective:** Prove migrations/import/UI on staging before live.

**Steps:**
1. Backup staging DB.
2. Apply SQL migrations.
3. Deploy only if needed for running the importer from staging; no pack API/UI behavior should change in this MVP.
4. Run source smoke/dry-run importer from the same staging/Render service shell that will run writes; log HTTP status/content-type/category/set/product-count/sample and refuse if non-JSON/Cloudflare/HTML/empty/missing fixture keys.
5. Run pilot importer with 10 cards.
6. Run catalog report and direct SQL inspection.
7. Run build/test/report commands.
8. Capture importer logs and SQL evidence.

**Staging importer commands:**

```bash
TCGTRACKING_DB_ENV=staging \
TCGTRACKING_DRY_RUN=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api

TCGTRACKING_DB_ENV=staging \
TCGTRACKING_DRY_RUN=false \
TCGTRACKING_ALLOW_LIVE_WRITE=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

**Go/no-go:**
- Go only if API build/importer test passes, pilot import creates valid `CatalogItem` rows, `catalog:report` is clean, and no pack API/UI files changed.

### Task 16: Production/live rollout gate

**Objective:** Avoid accidental live mutation.

**Required approval before live:**
- explicit approval to apply SQL to live DB
- explicit approval to run non-dry-run importer against live DB
- backup/snapshot confirmation

Production dry-run command shape:

```bash
TCGTRACKING_DB_ENV=production \
TCGTRACKING_DRY_RUN=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

Production pilot command shape:

```bash
TCGTRACKING_DB_ENV=production \
TCGTRACKING_DRY_RUN=false \
TCGTRACKING_ALLOW_LIVE_WRITE=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

**Production sequence:**
1. Backup/snapshot live DB.
2. Apply SQL migrations.
3. Deploy only the importer/schema changes needed for the catalog import; no pack API/UI behavior should change in this MVP.
4. Run source smoke/dry-run importer from the same production/Render service shell that will run writes; log HTTP status/content-type/category/set/product-count/sample and refuse if non-JSON/Cloudflare/HTML/empty/missing fixture keys.
5. Run 10-card pilot importer with explicit `TCGTRACKING_DB_ENV=production`.
6. Run catalog report.
7. If clean, optionally import broader set window.
8. Keep rollback option: set imported rows inactive if needed.

**Rollback posture:**

Global rollback:

```sql
UPDATE "CatalogItem"
SET "isActive" = false
WHERE source = 'tcgtracking';
```

Per-set rollback when only one import window/set is bad:

```sql
UPDATE "CatalogItem"
SET "isActive" = false
WHERE source = 'tcgtracking' AND "setId" = '<set-id>';
```

Do not delete unless explicitly approved.

---

## Definition of done

This slice is done when:

- TCGTracking cards normalize into `CatalogItem` rows with source-backed metadata.
- TCGTracking importer is dry-run by default and refuses unsafe live writes.
- `CatalogItem` remains global reference data, not inventory.
- No pack API/UI behavior is changed in this MVP.
- Existing catalog search is not expanded unless separately approved.
- Build/test commands pass for touched packages.
- Live DB changes are separated into explicit SQL/runbook steps and not applied without approval.
- UI copy does not overclaim ownership, fulfillment, authentication, vaulting, insurance, or exact odds.

## Command checklist

```bash
npm run test:catalog:tcgtracking -w @oripa/api
npm run build -w @oripa/api
TCGTRACKING_DB_ENV=local \
TCGTRACKING_DRY_RUN=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
npm run catalog:report -w @oripa/api
```

## Recommended commit breakdown

1. `docs: add catalogitem tcgtracking implementation plan`
2. `feat(catalog): add tcgtracking catalog migration/importer`
3. `feat(catalog): add tcgtracking fixture-backed normalizer tests`
4. `feat(catalog): add import report and live-write guardrails`
5. `docs: add catalog tcgtracking import runbook`
