# CatalogItem + TCGdex Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make `CatalogItem` the source-backed searchable Pokémon catalog layer, powered by TCGdex imports, while keeping vendor inventory/prize ownership out of the catalog.

**Architecture:** TCGdex data normalizes into global `CatalogItem` rows (`source = "tcgdex"`). Vendor pack/prize creation can reference a `CatalogItem` for metadata/image/search provenance, but stock, odds, prize quantity, ownership, fulfillment, grading certs, cost basis, and valuation remain on `PackPrize` / later inventory tables. Live DB writes are migration-gated and pilot-import gated.

**Tech Stack:** Prisma/Postgres, Express, Zod shared schemas, Next.js vendor UI, TCGdex REST API, `tsx` sync scripts.

---

## Current context checked

- `PROJECTS.md`: CatalogItem / TCGdex is a catalog/source-data slice, not inventory ownership.
- `docs/current-oripa-workflow.md`: maps this slice to `CAR-10`, `CAR-09`, `STORY-12`, `STORY-16`; requires dry-run defaults and explicit approval for live writes.
- `prisma/schema.prisma`: `CatalogItem` already has `localId`, `sourcePayload`, source uniqueness, and search indexes; `PackPrize` currently has no `catalogItemId`.
- `apps/api/src/modules/catalog/tcgdex-normalizer.ts`: TCGdex card-to-CatalogItem projection exists.
- `apps/api/scripts/sync-tcgdex.ts`: dry-run-first importer exists.
- `apps/api/src/modules/catalog/router.ts`: vendor-authenticated catalog search exists.
- `apps/web/app/vendor/page.tsx`: vendor pack form already calls `/v1/catalog/search` for item suggestions but currently submits label/image only.
- `packages/shared/src/index.ts`: pack schemas only accept `label`, `estimatedValue`, `stock`, `imageUrl` for tier items; no catalog reference yet.

## Oracle verification delta — 2026-05-29

See also: `docs/plans/catalogitem-tcgdex-oracle-review.md`.

Verdict: **conditional / block before implementation**. The architecture is sound, but implementation must include these patches before coding starts:

1. UI must persist and submit `catalogItemId`; current vendor form only applies label/image from suggestions.
2. Edit flow currently flattens all existing prizes into one `A Tier`; do not claim full multi-tier round-trip until tier grouping is persisted/restored.
3. Backend must propagate `catalogItemId` through shared schemas, `CreatePrizeRow`, `buildPrizeRows()`, create writes, and update replacement writes.
4. Validate catalog IDs before any pack create/update mutation that would create/delete prizes; invalid IDs must return 400 without mutating existing prizes.
5. Do not use `z.string().cuid()` for `catalogItemId`; use a bounded string and rely on DB validation.
6. Search uses case-insensitive `contains`/`startsWith`; MVP is acceptable at TCGdex scale, but add a `pg_trgm`/GIN or `citext` posture if latency degrades.
7. Runbook/report must include `PackPrize.catalogItemId` reference health, not only catalog source counts.
8. Rollback needs per-set deactivation and post-rollback inactive-reference checks.
9. Import guard must distinguish staging Render DB from production Render DB via explicit env, not only `/render\.com/`.
10. Decide whether public pack endpoints should include nested `catalogItem` metadata or keep it vendor/admin-only.



## Live Oracle verification delta — 2026-05-29T02:54Z

Executed with profile-local `oracle-browser` (`gpt-5.5-pro`) against the plan plus 12 repo files. Artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T025422Z_catalogitem-tcgdex-plan-proper-review/oracle_response.md`.

Verdict: **conditional / block before rollout**. The earlier architecture still holds, and the live Oracle rejected these false alarms: CatalogItem is not inventory, TCGdex normalization exists and is deterministic, normalizer coverage exists, catalog search is vendor-authenticated, search response already contains selection metadata, and dry-run default exists. The accepted precision patches are:

1. `PackPrize.catalogItemId` must stay nullable provenance only. Add post-migration verification SQL for the column and FK before backend/UI work.
2. Shared schemas must accept `catalogItemId: z.string().trim().min(1).max(64).optional()` in both tier items and direct prizes before UI changes.
3. Backend validation must use the same Prisma client/transaction client as the mutation path, convert invalid catalog IDs to 400, reject inactive/non-Pokémon/non-card rows, and validate before update `deleteMany`.
4. Vendor/admin pack reads and create/update/archive responses should include minimal nested `catalogItem`; public `/v1/packs` and `/v1/packs/:packId` require an explicit minimal/omit decision.
5. Vendor UI must store `catalogItemId`, set it from `suggestion.id`, submit it, display a selected-source badge, and provide clear-link behavior that removes only the catalog link.
6. Edit flow acceptance is limited to flattened edit preserving catalog IDs; full tier label/percentage round-trip is out of scope until tier metadata is modeled.
7. Importer implementation must add/log `TCGDEX_DB_ENV=local|staging|production`, refuse Render DB with `TCGDEX_DB_ENV=local`, require production writes to include `TCGDEX_DB_ENV=production TCGDEX_ALLOW_LIVE_WRITE=true`, and require staging writes to state `TCGDEX_DB_ENV=staging`.
8. `catalog:report` is not implemented yet; add it to `apps/api/package.json` with source counts, source+itemType counts, recent TCGdex rows, duplicate source-key check, missing-image count, missing/inactive `PackPrize.catalogItemId` refs, and TCGdex counts by `setId`.
9. Production/staging pilot commands must include explicit `TCGDEX_DB_ENV`. Live DB mutation still requires explicit approval plus backup/snapshot confirmation.


## Live Oracle loop pass 2 — 2026-05-29T03:27Z

Executed pass 2 after rectifying the first live Oracle output. Artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T032730Z_catalogitem-tcgdex-plan-loop-pass2/oracle_response.md`.

Pass 2 found four remaining material gaps, now patched inline:

1. FK verification must inspect `pg_get_constraintdef`, `confdeltype`, and `confupdtype`; a same-named wrong FK must block rollout.
2. Every write-mode importer command must set `TCGDEX_DB_ENV` explicitly; staging/production dry-runs are explicit too.
3. Public pack endpoints are decided for MVP: omit nested `catalogItem`; vendor/admin endpoints include minimal nested metadata through a shared include.
4. Prize replacement via edit is allowed only before draw history exists; after `DrawOrder`/`DrawResult` history, reject prize replacement or disable prize editing to avoid detaching historical prize references.


## Live Oracle loop pass 3 — 2026-05-29T03:38Z

Executed pass 3 after pass-2 rectification. Artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T033803Z_catalogitem-tcgdex-plan-loop-pass3/oracle_response.md`.

Pass 3 found one remaining material gap, now patched inline: update safety must protect allocation counters, not just prize-row identity. Current backend update code resets `remainingStock` from submitted `totalStock` and can delete/recreate prizes; the plan now requires replacement only for `DRAFT` packs with zero history, rejects `totalStock` changes after history, exposes vendor-only `canReplacePrizes`, and requires UI to omit prize/stock fields when edits are protected.


## Live Oracle loop pass 4 — 2026-05-29T03:47Z

Executed pass 4 after pass-3 rectification. Artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T034721Z_catalogitem-tcgdex-plan-loop-pass4-convergence/oracle_response.md`.

Pass 4 found two final material gaps, now patched inline: public routes must avoid leaking the new scalar `catalogItemId` through raw `include: { prizes: true }`, and `totalStock` changes must be DRAFT-only with `remainingStock` updated in lockstep.


## Live Oracle loop pass 5 — final CLEAN — 2026-05-29T03:54Z

Executed pass 5 after pass-4 rectification. Artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T035421Z_catalogitem-tcgdex-plan-loop-pass5-final/oracle_response.md`.

Final verdict: **CLEAN** with high confidence. No remaining material blockers, contradictions, or unsafe rollout snippets found. Minor historical Oracle-section wording is non-blocking because later pass summaries supersede it.

## Canonical terms

- `CatalogItem`: global, source-backed reference/projection row for cards/sealed products.
- `TCGdex`: upstream Pokémon card catalog source.
- `sourceItemId`: upstream stable ID, e.g. TCGdex card id.
- `localId` / `cardNumber`: set-local card number.
- `PackPrize`: vendor pack prize row with pack allocation fields: stock, remainingStock, weight, estimatedValue, label, image.
- `catalogItemId`: optional reference from a `PackPrize` to the global catalog row. This is metadata/provenance, not inventory ownership.

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
- Inspect: `prisma/sql/catalogitem-tcgdex.sql`

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

### Task 2: Add optional PackPrize catalog reference

**Objective:** Let pack prizes remember which catalog item was selected, without making CatalogItem inventory.

**Oracle patch:** Treat the model block below as an additive/illustrative target, not a copy-paste replacement. Preserve all existing `PackPrize` fields/relations, then add only `catalogItemId`, `catalogItem`, `CatalogItem.packPrizes`, and the index/FK. Create `prisma/sql/packprize-catalogitem.sql` before backend/UI work.

**Files:**
- Modify: `prisma/schema.prisma`
- Create/Modify: `prisma/sql/packprize-catalogitem.sql`

**Implementation target:**

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
ALTER TABLE "PackPrize" ADD COLUMN IF NOT EXISTS "catalogItemId" TEXT;

DO $$ BEGIN
  ALTER TABLE "PackPrize"
    ADD CONSTRAINT "PackPrize_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PackPrize_catalogItemId_idx" ON "PackPrize"("catalogItemId");
```

**Verification:**

```bash
npx prisma generate
npm run build -w @oripa/api
```

Post-migration SQL verification:

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

## Phase 2 — Harden TCGdex normalization/import

### Task 3: Keep normalizer deterministic and source-backed

**Objective:** Ensure TCGdex rows map consistently to catalog rows.

**Files:**
- Modify/Test: `apps/api/src/modules/catalog/tcgdex-normalizer.ts`
- Modify/Test: `apps/api/scripts/test-tcgdex-normalizer.ts`

**Required behavior:**
- `source = "tcgdex"`
- `sourceItemId = card.id`
- `localId = card.localId`
- `cardNumber = card.localId`
- `itemType = CARD`
- `game = POKEMON`
- `language = env/default language`
- images derive from TCGdex image base:
  - thumb: `/low.webp`
  - large: `/high.webp`
- `searchText` includes name, set name, set id, local id, rarity, illustrator/category where present, `pokemon`, `card`, `tcgdex`.
- `sourcePayload` keeps raw source JSON.
- Return `null` for missing `id`, `name`, or `localId`.

**Verification:**

```bash
npm run test:catalog:tcgdex -w @oripa/api
```

Expected: `tcgdex normalizer tests passed`.

### Task 4: Make importer operationally safe

**Objective:** Allow dry-run, pilot import, resume windows, and live DB guardrails.

**Files:**
- Modify: `apps/api/scripts/sync-tcgdex.ts`
- Modify: `apps/api/package.json` (add `"catalog:report": "tsx scripts/catalog-report.ts"`)
- Document: `docs/current-oripa-workflow.md` or this plan

**Importer env contract:**

```bash
TCGDEX_DRY_RUN=true                 # default true
TCGDEX_ALLOW_LIVE_WRITE=false       # must be true for production writes
TCGDEX_DB_ENV=local                 # local | staging | production; do not infer prod only from Render URL
TCGDEX_MAX_SETS=1                   # default pilot scope
TCGDEX_MAX_CARDS=0                  # 0 means all selected
TCGDEX_START_SET_INDEX=0            # resume pagination
TCGDEX_FETCH_FULL_CARDS=false       # only set true if brief cards lack needed fields
TCGDEX_CONTINUE_ON_ERROR=false
TCGDEX_RETRY_COUNT=2
TCGDEX_RETRY_DELAY_MS=1000
TCGDEX_REQUEST_TIMEOUT_MS=15000
```

**Required logging:**
- start line with language/game/dryRun/totalSets/window
- per-set progress line
- first 5 dry-run sample rows
- final summary: sets/cards/normalized/upserted/failures/duration
- explicit refusal if `TCGDEX_DB_ENV=production` without `TCGDEX_ALLOW_LIVE_WRITE=true`
- explicit refusal for any Render `DATABASE_URL` with `TCGDEX_DB_ENV=local`; set `staging` or `production` explicitly
- explicit log of `TCGDEX_DB_ENV`; if staging uses Render, require `TCGDEX_DB_ENV=staging` instead of relying on URL regex only
- production write commands must include both `TCGDEX_DB_ENV=production` and `TCGDEX_ALLOW_LIVE_WRITE=true`; staging write commands must include `TCGDEX_DB_ENV=staging`
- for any `TCGDEX_DRY_RUN=false` execution, require `TCGDEX_DB_ENV` to be explicitly set to `local`, `staging`, or `production`; do not rely on the default for write mode

**Verification:**

```bash
TCGDEX_DB_ENV=local TCGDEX_DRY_RUN=true TCGDEX_MAX_SETS=1 TCGDEX_MAX_CARDS=10 npm run catalog:sync:tcgdex -w @oripa/api
```

Expected: no DB writes, sample rows printed, final summary shows `upserted=0`.

### Task 5: Create DB migration/runbook

**Objective:** Make applying the schema safe and repeatable.

**Files:**
- Existing: `prisma/sql/catalogitem-tcgdex.sql`
- New/Modify: `prisma/sql/packprize-catalogitem.sql`
- New: `docs/runbooks/catalogitem-tcgdex-import.md`

**Runbook must include:**
1. Backup/snapshot requirement before live DB changes.
2. Apply catalog migration SQL.
3. Apply PackPrize catalog reference SQL if Phase 5 is included.
4. Run Prisma generate/build.
5. Run dry-run importer.
6. Run tiny write pilot.
7. Inspect rows.
8. Rollback posture: disable imported rows with `isActive=false` rather than destructive deletes unless explicitly approved.

**Pilot write command:**

```bash
TCGDEX_DB_ENV=staging \
TCGDEX_DRY_RUN=false \
TCGDEX_ALLOW_LIVE_WRITE=true \
TCGDEX_MAX_SETS=1 \
TCGDEX_MAX_CARDS=10 \
npm run catalog:sync:tcgdex -w @oripa/api
```

**Inspection SQL:**

```sql
SELECT source, COUNT(*) FROM "CatalogItem" GROUP BY source ORDER BY source;

SELECT id, source, "sourceItemId", name, "setId", "cardNumber", rarity, "imageThumbUrl"
FROM "CatalogItem"
WHERE source = 'tcgdex'
ORDER BY "createdAt" DESC
LIMIT 20;
```

---

## Phase 3 — Make catalog search good enough for vendor/admin selection

### Task 6: Keep catalog search vendor-authenticated

**Objective:** The catalog endpoint can be used by vendor dashboard users, not public scraping.

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

**Objective:** Return enough metadata for UI display and PackPrize reference.

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

**Oracle patch — performance posture:** Prisma `mode: "insensitive"` maps to PostgreSQL `ILIKE`; the existing B-tree `@@index([name])` will not fully optimize contains searches. MVP is acceptable with TCGdex-scale data and `limit <= 30`, but if search latency is poor, add a reviewed SQL migration for `pg_trgm`/GIN on `name` and/or `searchText` rather than pretending the current B-tree covers all cases.

**Verification:**
- Search `charizard` returns name matches before deep metadata matches.
- Search a set id or local number can find rows through `searchText`.

---

## Phase 4 — Wire catalog references into pack creation API

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
- Only allow `game = POKEMON` and `itemType = CARD` in this slice.
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

Suggested draw-history/allocation guard:

```ts
const [drawOrderCount, drawResultCount, legacyPackDrawCount] = await Promise.all([
  prisma.drawOrder.count({ where: { packId: existing.id } }),
  prisma.drawResult.count({ where: { packId: existing.id } }),
  prisma.packDraw.count({ where: { packId: existing.id } }),
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
- pack creation with invalid `catalogItemId` returns 400 and does not create pack
- pack update with invalid replacement ID returns 400 and does not delete existing prizes
- pack update that would replace prizes on a non-DRAFT pack returns 400
- pack update that would replace prizes after draw history returns 400 and does not detach `PackDraw.prizeId` or `DrawResult.packPrizeId` references
- pack update after draw history cannot change `totalStock` or reset `remainingStock`
- pack update on LIVE/no-history pack that changes `totalStock` returns 400
- pack update on DRAFT/no-history pack may change `totalStock` and updates `remainingStock` in lockstep

### Task 10: Include catalog item in pack read responses

**Objective:** Let vendor/admin displays show source-backed metadata when available while public endpoints keep the MVP payload unchanged.

**Public endpoint decision:** For MVP, public `GET /v1/packs` and `GET /v1/packs/:packId` omit nested `catalogItem`; they keep returning prize label/image/value/drop-rate fields only. Vendor/admin pack reads and vendor mutation responses include minimal nested `catalogItem`. If public card metadata is needed later, add a separate reviewed response contract with only safe minimal fields.

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

## Phase 5 — Vendor UI selection flow

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
- Select TCGdex suggestion; submit payload contains `catalogItemId`.
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
- UI must omit `totalStock` from protected metadata-only edits unless unchanged.
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
- recent 20 `tcgdex` rows
- duplicate check by `[source, sourceItemId, language]` should be impossible but report if any
- missing image count for `source=tcgdex`
- `PackPrize.catalogItemId` references pointing to missing or inactive `CatalogItem` rows
- count by `source=tcgdex + setId` for per-set rollback targeting

**Package script:**

```json
"catalog:report": "tsx scripts/catalog-report.ts"
```

**Verification:**

```bash
npm run catalog:report -w @oripa/api
```

Expected: prints source counts and recent sample rows.

### Task 14: Manual QA checklist

**Objective:** Verify the slice end-to-end.

**Steps:**
1. Run TCGdex dry-run:

```bash
TCGDEX_DB_ENV=local TCGDEX_DRY_RUN=true TCGDEX_MAX_SETS=1 TCGDEX_MAX_CARDS=10 npm run catalog:sync:tcgdex -w @oripa/api
```

2. Apply schema SQL to local/staging DB.
3. Run pilot import. Local write command, only with a local `DATABASE_URL`:

```bash
TCGDEX_DB_ENV=local \
TCGDEX_DRY_RUN=false \
TCGDEX_MAX_SETS=1 \
TCGDEX_MAX_CARDS=10 \
npm run catalog:sync:tcgdex -w @oripa/api
```

Staging write command, only against staging:

```bash
TCGDEX_DB_ENV=staging \
TCGDEX_DRY_RUN=false \
TCGDEX_ALLOW_LIVE_WRITE=true \
TCGDEX_MAX_SETS=1 \
TCGDEX_MAX_CARDS=10 \
npm run catalog:sync:tcgdex -w @oripa/api
```

4. Run catalog report.
5. Start API/web locally.
6. Open vendor dashboard.
7. Search card by name.
8. Search card by set/local number.
9. Select catalog suggestion for pack prize.
10. Submit pack as DRAFT.
11. Inspect DB:

```sql
SELECT pp.id, pp.label, pp."catalogItemId", ci.source, ci.name, ci."setName", ci."cardNumber"
FROM "PackPrize" pp
LEFT JOIN "CatalogItem" ci ON ci.id = pp."catalogItemId"
ORDER BY pp."createdAt" DESC
LIMIT 20;
```

Expected: selected prize has `catalogItemId`, and catalog row is source-backed.

---

## Phase 7 — Live rollout plan

### Task 15: Staging rollout

**Objective:** Prove migrations/import/UI on staging before live.

**Steps:**
1. Backup staging DB.
2. Apply SQL migrations.
3. Deploy API/web branch to staging.
4. Run dry-run importer against staging config.
5. Run pilot importer with 10 cards.
6. Use vendor dashboard to create draft pack with selected TCGdex card.
7. Run build/test/report commands.
8. Capture screenshots/SQL evidence.

**Staging importer commands:**

```bash
TCGDEX_DB_ENV=staging \
TCGDEX_DRY_RUN=true \
TCGDEX_MAX_SETS=1 \
TCGDEX_MAX_CARDS=10 \
npm run catalog:sync:tcgdex -w @oripa/api

TCGDEX_DB_ENV=staging \
TCGDEX_DRY_RUN=false \
TCGDEX_ALLOW_LIVE_WRITE=true \
TCGDEX_MAX_SETS=1 \
TCGDEX_MAX_CARDS=10 \
npm run catalog:sync:tcgdex -w @oripa/api
```

**Go/no-go:**
- Go only if API build passes, web build passes, pilot import creates valid rows, and pack form can round-trip `catalogItemId`.

### Task 16: Production/live rollout gate

**Objective:** Avoid accidental live mutation.

**Required approval before live:**
- explicit approval to apply SQL to live DB
- explicit approval to run non-dry-run importer against live DB
- backup/snapshot confirmation

Production dry-run command shape:

```bash
TCGDEX_DB_ENV=production \
TCGDEX_DRY_RUN=true \
TCGDEX_MAX_SETS=1 \
TCGDEX_MAX_CARDS=10 \
npm run catalog:sync:tcgdex -w @oripa/api
```

Production pilot command shape:

```bash
TCGDEX_DB_ENV=production \
TCGDEX_DRY_RUN=false \
TCGDEX_ALLOW_LIVE_WRITE=true \
TCGDEX_MAX_SETS=1 \
TCGDEX_MAX_CARDS=10 \
npm run catalog:sync:tcgdex -w @oripa/api
```

**Production sequence:**
1. Backup/snapshot live DB.
2. Apply SQL migrations.
3. Deploy API/web.
4. Run dry-run importer with explicit `TCGDEX_DB_ENV=production`.
5. Run 10-card pilot importer with explicit `TCGDEX_DB_ENV=production`.
6. Run catalog report.
7. If clean, optionally import broader set window.
8. Keep rollback option: set imported rows inactive if needed.

**Rollback posture:**

Global rollback:

```sql
UPDATE "CatalogItem"
SET "isActive" = false
WHERE source = 'tcgdex';
```

Per-set rollback when only one import window/set is bad:

```sql
UPDATE "CatalogItem"
SET "isActive" = false
WHERE source = 'tcgdex' AND "setId" = '<set-id>';
```

Post-rollback reference-health check:

```sql
SELECT COUNT(*) AS inactive_catalog_refs
FROM "PackPrize" pp
JOIN "CatalogItem" ci ON ci.id = pp."catalogItemId"
WHERE pp."catalogItemId" IS NOT NULL
  AND ci."isActive" = false;
```

Do not delete unless explicitly approved.

---

## Definition of done

This slice is done when:

- TCGdex cards normalize into `CatalogItem` rows with source-backed metadata.
- TCGdex importer is dry-run by default and refuses unsafe live writes.
- `CatalogItem` remains global reference data, not inventory.
- `PackPrize` can optionally reference a `CatalogItem` without requiring it.
- Vendor pack UI can search/select catalog cards and submit the selected ID.
- Pack read/edit flows round-trip selected catalog references.
- Search supports name, set, card number, and source-backed metadata.
- Build/test commands pass for touched packages.
- Live DB changes are separated into explicit SQL/runbook steps and not applied without approval.
- UI copy does not overclaim ownership, fulfillment, authentication, vaulting, insurance, or exact odds.

## Command checklist

```bash
npm run test:catalog:tcgdex -w @oripa/api
npm run build -w @oripa/shared
npm run build -w @oripa/api
npm run build -w @oripa/web
TCGDEX_DB_ENV=local TCGDEX_DRY_RUN=true TCGDEX_MAX_SETS=1 TCGDEX_MAX_CARDS=10 npm run catalog:sync:tcgdex -w @oripa/api
npm run catalog:report -w @oripa/api
```

## Recommended commit breakdown

1. `docs: add catalogitem tcgdex implementation plan`
2. `feat(db): link pack prizes to catalog items`
3. `feat(catalog): harden tcgdex importer and report script`
4. `feat(api): persist catalog references on pack prizes`
5. `feat(web): select catalog items in vendor pack form`
6. `docs: add catalog tcgdex import runbook`
