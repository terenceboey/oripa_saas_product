# CatalogItem + TCGTracking Oracle Review Loop

## Scope

Plan reviewed: `docs/plans/catalogitem-tcgtracking-plan.md`
Evidence bundle: `docs/plans/catalogitem-tcgtracking-oracle-evidence.md`
Source: TCGTracking Open TCG API (`https://tcgtracking.com/tcgapi/`)

This review treats the plan as a claim set, not as implementation approval. Live DB writes remain blocked without explicit approval, backup/snapshot confirmation, and pilot gating.

## Pass 1

- Oracle artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T042414Z_catalogitem-tcgtracking-plan-pass1/oracle_response.md`
- Verdict: **BLOCKED**
- Result: accepted and patched all 10 blockers into the plan.

### Accepted blockers patched

1. FK SQL must fail fast and include lock/statement timeouts; wrong same-named FK blocks rollout.
2. TCGTracking fixtures must be captured before normalizer coding, not after.
3. Category `85`/language fan-out is blocked for MVP; category `3` only unless source-key policy is reviewed.
4. Required-field behavior is deterministic: missing id/name skip; number/image/set metadata degrade with counters.
5. Catalog ID validation restricts source to `tcgtracking`, active `CARD`, game `POKEMON`.
6. Pack update safety must run validation/history counts/delete-recreate/stock resize inside one Prisma transaction client.
7. Vendor UI protected edits must omit `tiers`, `prizes`, and changed `totalStock` when prize replacement is unsafe.
8. Public endpoint policy separates catalog leak prevention from existing odds/value exposure; no new catalog-derived public value/proof fields.
9. Source fetch smoke must be proven from the same execution environment before non-dry-run import.
10. Add automated pack catalog-reference mutation/leak tests, not only manual QA bullets.

## Pass 1 raw Oracle output

## Verdict

**BLOCKED**

## Accepted blockers with exact plan patches needed

### 1. Data model / migrations — FK SQL must fail fast, not silently continue

**Patch Task 2 / `packprize-catalogitem.sql`:** replace the `EXCEPTION WHEN duplicate_object THEN NULL` posture with a preflight that raises if a same-named constraint exists with the wrong target/actions. The plan already requires post-checking `pg_get_constraintdef`, `confdeltype`, and `confupdtype`, but the SQL itself still silently swallows duplicate constraint creation. Make the migration self-blocking before rollout. The plan’s target FK is nullable provenance with `ON DELETE SET NULL` / `ON UPDATE CASCADE`, and the repo slice explicitly says CatalogItem must not become ownership/inventory truth.

Add this exact runbook/migration requirement:

```sql
-- before adding the FK
DO $$
DECLARE
  existing_def text;
  existing_del "char";
  existing_upd "char";
BEGIN
  SELECT pg_get_constraintdef(oid), confdeltype, confupdtype
  INTO existing_def, existing_del, existing_upd
  FROM pg_constraint
  WHERE conname = 'PackPrize_catalogItemId_fkey';

  IF existing_def IS NOT NULL
     AND (
       existing_def NOT ILIKE '%FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"(id)%'
       OR existing_del <> 'n'
       OR existing_upd <> 'c'
     )
  THEN
    RAISE EXCEPTION 'Existing PackPrize_catalogItemId_fkey has wrong definition/actions: %, del %, upd %',
      existing_def, existing_del, existing_upd;
  END IF;
END $$;
```

Also add `SET lock_timeout = '5s'; SET statement_timeout = '60s';` to live SQL runbooks, and prefer `ADD CONSTRAINT ... NOT VALID` followed by explicit validation where supported.

### 2. Importer / source API shape — source-shape discovery must move before normalizer implementation

**Patch Phase 2:** insert a new **Task 2.5 — Capture TCGTracking source fixtures before coding** before Task 3. The plan currently says to verify exact JSON shape before coding, but also says the fresh TCGTracking review happens after Task 3/4 source-shape discovery; that is too late because Task 3 already encodes assumptions like `ext_number`, `number`, image fields, and set/group IDs.

Exact patch:

```md
### Task 2.5: Capture TCGTracking source fixtures before normalizer coding

Block Task 3 until committed fixtures exist for:
- `/tcgapi/v1/categories`
- `/tcgapi/v1/3/sets`
- one Pokémon set product endpoint `/tcgapi/v1/3/sets/{set_id}`
- matching `/pricing`
- matching `/skus` if available
- `/products/{product_id}` for one product from that set

Record actual key paths for:
- product id
- product name
- collector/local number
- set id / group id
- set name / abbreviation
- image URL fields
- rarity/category/product type
- SKU language/variant/condition shape
- pricing shape
- whether category 3 alone is sufficient for MVP

Normalizer tests must use these fixtures, not inferred TCGdex-era or guessed TCGTracking fields.
```

The live docs I checked support this blocker: TCGTracking documents endpoints for categories, sets, static products, pricing, SKUs, product lookup, and set search; it shows category `3` as Pokémon and `85` as Pokémon Japan, and the visible product object documents `id`, `name`, `set_name`, `set_abbr`, `number`, `rarity`, and `image_url`, not a guaranteed `ext_number` field. ([tcgtracking.com][1])

### 3. Importer / source API shape — category 85 and language fan-out are ambiguous

**Patch Task 4:** hard-refuse `TCGTRACKING_CATEGORY_ID != 3` for MVP unless a separate category/language uniqueness decision is added. The current plan exposes category `85` “if later enabled,” while `CatalogItem` uniqueness is `[source, sourceItemId, language]`; if category 3 and 85 ever reuse product IDs or if SKU-derived language fan-out is enabled, source-key collisions or duplicate catalog suggestions become ambiguous.

Exact patch:

```md
MVP importer guard:
- If `TCGTRACKING_CATEGORY_ID !== "3"`, exit non-zero with:
  "Only TCGTracking category 3 is approved for MVP. Category 85 requires a reviewed category/language/source-key plan."
- Do not create one CatalogItem per SKU language in MVP.
- Store SKU language/variant data in `sourcePayload` only.
- If category 85 is later enabled, either add `sourceCategoryId` to the model and uniqueness policy, or set `sourceItemId = ${categoryId}:${product.id}` before import.
```

### 4. Importer / source API shape — required-field behavior is still ambiguous

**Patch Task 3:** replace “return null for missing id, name, or set/product number only if required” with a deterministic contract. `CatalogItem.name` and `sourceItemId` are non-null in the Prisma schema, while number/image/set fields are optional.

Exact patch:

```md
Required-field contract:
- Missing `product.id`: skip row, count `missing_id`, never write.
- Missing `product.name`: skip row, count `missing_name`, never write.
- Missing collector/local number: write row with `localId = null` and `cardNumber = null`; do not skip unless fixtures prove this breaks display/search.
- Missing image: write row with image fields null and count `missing_image`.
- Missing set name/abbreviation: write row with available set id, count `missing_set_metadata`.
- Each skipped row must log source set id, source product id if available, and reason.
```

### 5. Backend / API transaction safety — validation must restrict source to TCGTracking

**Patch Task 9:** add `source: "tcgtracking"` to catalog ID validation. The plan says this slice is TCGTracking and warns old TCGdex artifacts are superseded, but the suggested helper accepts any active Pokémon card from any source. That would silently allow old or future non-TCGTracking rows.

Exact patch:

```ts
where: {
  id: { in: uniqueIds },
  source: "tcgtracking",
  isActive: true,
  itemType: "CARD",
  game: "POKEMON",
}
```

Add verification:

```md
- active non-tcgtracking Pokémon CARD catalog ID returns 400
- active tcgtracking SEALED_PRODUCT returns 400
- inactive tcgtracking CARD returns 400
```

### 6. Backend / API transaction safety — update guard must be inside one transaction

**Patch Task 9:** require the update path to re-read the pack, validate catalog IDs, count draw history, resize stock, and delete/recreate prizes inside the same Prisma transaction client. The current repo draw path stores `PackDraw.prizeId`, `DrawResult.packPrizeId`, fairness selections, and pool snapshots using PackPrize IDs, so deleting prize rows after history corrupts traceability.

Exact patch:

```md
Update mutation contract:
- Use `prisma.$transaction(async (tx) => { ... })` for any PATCH that can replace prizes or change totalStock.
- Inside the transaction:
  1. Re-read `existing` by pack id/vendor id.
  2. Build replacement rows.
  3. Validate catalogItemIds using `tx.catalogItem`.
  4. Count `tx.drawOrder`, `tx.drawResult`, and `tx.packDraw`.
  5. Reject replacement unless `existing.status === "DRAFT"` and history count is zero.
  6. Reject totalStock changes unless `existing.status === "DRAFT"` and history count is zero.
  7. Only then delete/recreate prizes or resize stock.
- Do not use the root `prisma` client for validation/counts in this path.
```

### 7. Vendor UI round-trip — protected edits must omit fields, not merely disable UI

**Patch Task 12:** add a payload rule to `submitPack()`: when editing and `canReplacePrizes === false`, omit `tiers`, `prizes`, and `totalStock` unless totalStock is unchanged. The current UI always flattens prizes into one `A Tier` and always submits `tiers` and `totalStock`, which would force a replacement unless the backend rejects it.

Exact patch:

```md
Vendor UI protected-edit payload rule:
- Store `editingPackCanReplacePrizes` and `editingPackOriginalTotalStock`.
- If `editingPackId && editingPackCanReplacePrizes === false`:
  - do not include `tiers`
  - do not include `prizes`
  - do not include `totalStock` unless `Number(totalStock) === editingPackOriginalTotalStock`
- The backend remains authoritative and must still reject unsafe replacement/stock changes.
```

### 8. Public endpoint policy — plan must distinguish catalog leak prevention from existing odds/value exposure

**Patch Task 10:** keep the catalog-specific public decision, but add an explicit note that this slice must not newly bless public exact odds/value claims. Current workflow blocks live/exact odds unless transaction-pool snapshot validation exists and also blocks copy implying catalog item ownership, valuation, proof, authentication, fulfillment, or prize eligibility. The plan currently says public endpoints keep prize value/drop-rate fields; that may be pre-existing behavior, but the catalog plan should not re-approve it as part of this slice.

Exact patch:

```md
Public endpoint policy for this slice:
- This slice only decides catalog metadata exposure.
- Public pack endpoints must omit nested `catalogItem` and scalar `catalogItemId`.
- Do not add any new public catalog-derived value, price, ownership, authentication, fulfillment, or proof fields.
- Existing public `estimatedValue`, `stock`, `remainingStock`, `weight`, and `dropRatePercent` exposure is outside this catalog slice and must be reviewed under the odds/value disclosure gate before launch copy or API documentation treats it as approved.
```

### 9. Rollout / live-DB safety — source fetch must be proven from the execution environment

**Patch Task 15 and Task 16:** add a staging/production-source smoke check from the same environment that will run the importer. The plan warns direct API requests may be Cloudflare-blocked, but the runbook only proves local/staging dry-run behavior after implementation.

Exact patch:

```md
Before any non-dry-run import:
- Run `TCGTRACKING_DRY_RUN=true` from the same Render/service shell that will run the write import.
- Log HTTP status, content-type, endpoint URL, category id, set id, product count, and first normalized sample.
- Refuse writes if any source response is non-JSON, Cloudflare/HTML, empty, or missing expected fixture keys.
```

### 10. Tests / diagnostics — manual bullets are not enough for mutation safety and public leak safety

**Patch Phase 6:** add an automated API test script, not only manual QA. The repo currently lacks `test:catalog:tcgtracking` and `catalog:report` in `apps/api/package.json`; it still has only the old tcgdex normalizer test script.  The plan adds report output, but it should also add mutation/public-leak tests because the risks are destructive.

Exact patch:

```json
"test:packs:catalog-ref": "tsx scripts/test-packs-catalog-ref.ts"
```

Required test cases:

```md
- create pack with valid active tcgtracking CARD id succeeds and persists PackPrize.catalogItemId
- create pack with missing/inactive/non-tcgtracking/non-card id returns 400 and creates no pack
- update pack with invalid replacement id returns 400 and leaves existing PackPrize rows untouched
- update non-DRAFT pack with replacement rows returns 400
- update pack with DrawOrder/DrawResult/PackDraw history returns 400 for prize replacement and leaves all referenced prize IDs intact
- update LIVE/no-history totalStock returns 400
- update DRAFT/no-history totalStock updates totalStock and remainingStock in lockstep
- public `/v1/packs` and `/v1/packs/:packId` responses contain no `catalogItemId` and no nested `catalogItem`
- vendor/admin responses include only the approved minimal nested catalogItem shape
```

## False positives / unknowns

* **CatalogItem-as-reference architecture is not a blocker.** The plan correctly keeps vendor stock, allocation, ownership, fulfillment, grading, valuation, and proof out of `CatalogItem`.
* **Search performance is not a pre-implementation blocker.** The plan’s `ILIKE`/contains posture is acceptable for MVP with `limit <= 30`, provided it keeps the stated pg_trgm/GIN follow-up if latency degrades.
* **Flattened edit is acceptable only as explicitly scoped.** It is not a blocker if the plan continues to say it preserves catalog IDs only in the flattened edit model and does not claim full tier round-trip.
* **Category 85 is unknown, not approved.** Treat Pokémon Japan as blocked for MVP until source fixtures and source-key/category policy are reviewed.
* **TCGTracking `ext_number` is unproven from the visible docs I checked.** The docs visibly show `number` for collector number and `image_url` for image in the product object; fixtures must settle final field paths before coding. ([tcgtracking.com][1])

## Safe next order

1. Patch the plan with the ten blockers above.
2. Capture and commit TCGTracking fixtures for category 3 before normalizer coding.
3. Patch migration SQL/runbook fail-fast behavior.
4. Implement schema + SQL locally only, then run Prisma generate/build.
5. Implement normalizer/importer from fixtures, dry-run default, source-env guard, and report script.
6. Implement shared schema + backend validation/transaction-safe pack update + public/vendor mappers.
7. Implement vendor UI state, selected badge, clear-link, edit protected-payload behavior.
8. Add automated API tests for catalog refs, history protection, stock protection, and public leak checks.
9. Run local dry-run and tiny local write.
10. Run staging from the actual execution environment: source smoke → dry-run → tiny write → report → UI round-trip.
11. Only then request explicit live SQL and live importer approval with backup/snapshot evidence.

[1]: https://tcgtracking.com/tcgapi/ "Open TCG API - TCGTracking.com"



## Pass 2

- Oracle artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T043404Z_catalogitem-tcgtracking-plan-pass2/oracle_response.md`
- Verdict: **BLOCKED**
- Result: accepted and patched 3 remaining copy-paste/idempotency blockers.

### Accepted blockers patched

1. FK SQL now conditionally adds the constraint only when no correct same-named FK exists; wrong FK still raises.
2. Suggested update guard now explicitly uses transaction client `tx.*` inside the transaction callback.
3. Plan now requires `test:catalog:tcgtracking`, `test:packs:catalog-ref`, and `catalog:report` package scripts.

## Pass 2 raw Oracle output

## Verdict: BLOCKED

## Remaining material blockers with exact patches

### 1. FK SQL is still internally inconsistent/idempotency unsafe

The plan says the correct existing FK must be skipped, but the concrete SQL still unconditionally runs `ALTER TABLE ... ADD CONSTRAINT`, so a correct pre-existing FK will raise `duplicate_object` instead of being repeatable. This conflicts with the plan’s own idempotency requirement.

Patch `prisma/sql/packprize-catalogitem.sql` SQL shape to:

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

CREATE INDEX IF NOT EXISTS "PackPrize_catalogItemId_idx"
  ON "PackPrize"("catalogItemId");
```

### 2. Backend transaction-safety prose is correct, but the suggested code violates it

The plan correctly requires pack update validation/counts to use the transaction client and not the root Prisma client, but the suggested guard immediately below still uses `prisma.drawOrder`, `prisma.drawResult`, and `prisma.packDraw`. That is a copy-paste hazard in the exact risk area Pass 1 blocked.

Patch the suggested guard to:

```ts
const [drawOrderCount, drawResultCount, legacyPackDrawCount] = await Promise.all([
  tx.drawOrder.count({ where: { packId: existing.id } }),
  tx.drawResult.count({ where: { packId: existing.id } }),
  tx.packDraw.count({ where: { packId: existing.id } }),
]);
```

Also change the surrounding sample text to:

```md
Suggested draw-history/allocation guard, inside the `prisma.$transaction(async (tx) => { ... })` callback:
```

### 3. Automated normalizer test command is specified but not backed by a package script

The plan’s verification and command checklist call `npm run test:catalog:tcgtracking -w @oripa/api`, but the current `apps/api/package.json` evidence only has the old `test:catalog:tcgdex` script, and Phase 6 adds only `test:packs:catalog-ref`.

Patch Task 3 or Task 13.5 package-script block to require:

```json
{
  "catalog:report": "tsx scripts/catalog-report.ts",
  "test:catalog:tcgtracking": "tsx scripts/test-tcgtracking-normalizer.ts",
  "test:packs:catalog-ref": "tsx scripts/test-packs-catalog-ref.ts"
}
```

## False positives / unknowns

Pass 1’s main blockers are otherwise materially patched in the plan: fixture-before-normalizer ordering is explicit; required-field behavior is deterministic; category `85` is hard-blocked for MVP; importer env/source-smoke guards are present; catalog ID validation is restricted to active `tcgtracking` Pokémon cards; vendor UI must persist/clear/round-trip `catalogItemId`; public endpoints omit nested and scalar catalog references; staging/production rollout requires source smoke, explicit env, backup, and approval; and pack reference/leak tests are specified.

Source shape remains unknown until Task 2.5 fixtures are captured. That blocks normalizer/importer coding, not the fixture-capture task itself. Category `85` remains unapproved for MVP. Search performance remains a non-blocking follow-up unless real latency appears.

## Safe next order

1. Apply the three patches above.
2. Capture and commit TCGTracking category `3` fixtures, then run the required source-shape review before normalizer coding.
3. Implement schema + SQL locally only; run Prisma generate and API build.
4. Implement normalizer/importer from fixtures, dry-run guardrails, report script, and both test scripts.
5. Implement shared schemas, backend validation, transaction-safe update path, and public/vendor response mappers.
6. Implement vendor UI selected-source state, clear-link, flattened edit preservation, and protected edit payload omission.
7. Run local builds/tests/dry-run, then tiny local write.
8. Run staging from the actual execution environment: source smoke → dry-run → tiny write → report → UI round-trip.
9. Request live SQL/import approval only after backup/snapshot evidence and clean staging.



## Pass 3

- Oracle artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T043928Z_catalogitem-tcgtracking-plan-pass3/oracle_response.md`
- Verdict: **CLEAN**
- Result: Oracle confirmed Pass 1 and Pass 2 blockers are materially closed. No remaining implementation-blocking gaps in the broader plan at that time.

### Remaining non-blocking notes

- TCGTracking source shape is unknown until Task 2.5 fixtures are captured; this blocks normalizer/importer coding but not fixture capture.
- Category `85` remains unapproved for MVP.
- Search performance remains a follow-up only if real latency appears.

## Import-only scope pass — after user scope correction

- Oracle artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T051659Z_catalogitem-tcgtracking-import-only-pass1/oracle_response.md`
- Verdict: **CLEAN**
- Result: Oracle reviewed the patched plan strictly as an import-only MVP and found no material blockers / no exact patches required.

### Import-only scope confirmed

In scope:
- `CatalogItem` DB/schema support for TCGTracking fields.
- TCGTracking category `3` fixture capture before normalizer coding.
- Fixture-backed deterministic normalizer/import script.
- Dry-run default, pilot limits, explicit `TCGTRACKING_DB_ENV`, Render/live-write guardrails, same-environment source smoke.
- `catalog:report`, SQL inspection, non-destructive rollback/runbook.

Out of scope for MVP:
- pack create/update/read API.
- shared pack schemas.
- `PackPrize.catalogItemId`.
- public DTO leak work.
- vendor UI selection/edit flow.
- `test:packs:catalog-ref` until pack-reference lane resumes.

### Remaining non-blocking notes

- Capture TCGTracking category `3` fixtures before normalizer coding.
- Keep category `85` blocked until reviewed category/language/source-key policy exists.
- Do not implement deferred pack/API/UI work in this MVP.

## Pass 3 raw Oracle output

According to a document from 2026-05-29: **CLEAN**.

The three Pass 2 residual blockers are materially closed in the patched plan.

The FK SQL is now idempotent and fail-fast: it adds `catalogItemId`, checks the existing FK definition/actions with `pg_get_constraintdef`, `confdeltype`, and `confupdtype`, only creates the FK in the `ELSE` branch, validates it, and requires failure on a same-named wrong FK.

The transaction-safety copy-paste hazard is fixed: the update contract requires the transaction client, and the suggested guard now uses `tx.drawOrder`, `tx.drawResult`, and `tx.packDraw`, not root `prisma.*`.  It also preserves the allocation protections: replacement only for safe DRAFT/no-history cases, no post-history prize replacement, no unsafe `totalStock` reset, and DRAFT stock resize keeps `totalStock`/`remainingStock` in lockstep.

The package-script blocker is fixed: Task 3 now requires `catalog:report`, `test:catalog:tcgtracking`, and `test:packs:catalog-ref`.  Phase 6 also requires the report script and the pack catalog-reference mutation/leak test script with destructive mutation and public leak cases.

The Pass 1 safety blockers also appear materially patched: fixture capture is explicitly before normalizer coding, with required endpoints/key paths and fixture-backed tests.  Category 85 and SKU language fan-out are hard-blocked for MVP; write-mode imports require explicit DB env; non-dry-run imports require same-environment source smoke and refusal on Cloudflare/HTML/non-JSON/missing keys.  Catalog ID validation is constrained to active `tcgtracking` Pokémon `CARD` rows.  Public endpoints explicitly omit nested `catalogItem` and scalar `catalogItemId`, with a public include/mapper to avoid scalar leaks.  Vendor UI selection and protected edit payload behavior are specified, including selected-source badge, clear-link behavior, flattened-only edit round-trip, and omission of prize/stock fields when replacement is unsafe.

**Non-blocking notes**

Source shape is still unknown until Task 2.5 fixtures are captured, but the plan now correctly treats that as a gate before normalizer/importer coding, not as a guessed implementation path. Category 85 remains unapproved for MVP. Search performance remains a follow-up only if real latency appears.

**Safe next order**

1. Capture and commit TCGTracking category 3 fixtures, then run the required source-shape review before normalizer coding.
2. Implement schema + SQL locally only; run Prisma generate and API build.
3. Implement normalizer/importer from fixtures, dry-run guardrails, report script, and both test scripts.
4. Implement shared schemas, backend validation, transaction-safe update path, and public/vendor response mappers.
5. Implement vendor UI selected-source state, clear-link, flattened edit preservation, and protected edit payload omission.
6. Run local builds/tests/dry-run, then tiny local write.
7. Run staging from the actual execution environment: source smoke → dry-run → tiny write → report → UI round-trip.
8. Request live SQL/import approval only after backup/snapshot evidence and clean staging.

## Import-only raw Oracle output

**Verdict: CLEAN**

No material import-only MVP blockers remain.

The plan now has a clear import-only boundary: `CatalogItem` TCGTracking DB/schema/runbook work, fixture capture, deterministic normalizer/import script, dry-run/pilot/live-write guardrails, and catalog report/SQL inspection are in scope; pack create/update/read API, vendor UI, shared pack schemas, `PackPrize.catalogItemId`, public DTO leak work, and vendor selection/edit UI are explicitly out of scope unless re-approved.

Repo evidence supports that boundary. `CatalogItem` already contains the needed import projection fields and uniqueness/index posture: `source`, `sourceItemId`, `localId`, `cardNumber`, image fields, `searchText`, `sourcePayload`, `isActive`, and `@@unique([source, sourceItemId, language])`. The repo package evidence also shows the current API scripts still need the planned import/report/test replacement work: `catalog:sync:tcgtracking` exists, but the old TCGdex sync/test scripts are still present and `catalog:report` / `test:catalog:tcgtracking` are not yet in the current package evidence.

The source-shape risk is handled correctly for an import-only plan. Task 2.5 blocks normalizer coding until committed TCGTracking fixtures exist, requires the category-3 endpoints and product/pricing/SKU/product lookup samples, and requires recording actual key paths before mapping fields. Task 3 then requires fixture-backed mapping, `source = "tcgtracking"`, `sourceItemId = String(product.id)`, fixture-proven collector-number fields, no old TCGdex image suffix assumptions, raw source context in `sourcePayload`, and deterministic missing-field behavior.

The live-write/import guardrails are materially complete: dry-run defaults, explicit `TCGTRACKING_DB_ENV`, production live-write refusal without `TCGTRACKING_ALLOW_LIVE_WRITE=true`, Render DB protection, category `3` hard guard, no SKU-language row fanout, and same-environment source smoke before non-dry-run writes. The runbook requirements cover backup/snapshot, SQL timeouts, no PackPrize catalog reference SQL in this MVP, dry-run, tiny write pilot, SQL inspection, and non-destructive rollback via `isActive=false`.

The catalog diagnostics requirement is sufficient for the MVP: script-only `catalog:report` with source counts, source+itemType counts, recent TCGTracking rows, duplicate source-key check, missing-image count, and per-set counts for rollback targeting. The pack-reference mutation/leak test is correctly deferred and explicitly marked “do not add this test script for the import-only MVP,” so it is not an import-only blocker.

The deferred sections do not create dangerous ambiguity. The plan repeatedly states that API/UI and pack-reference work are future-lane only, and the staging/production gates both require no pack API/UI behavior changes for this MVP. The production gate also keeps live SQL/import approval, backup/snapshot confirmation, same-environment smoke, explicit production env, pilot import, report, and rollback posture intact.

**Exact patches needed:** none.

Only non-blocking implementation notes remain: capture TCGTracking category-3 fixtures before normalizer coding, keep category `85` blocked, and do not implement any deferred pack/API/UI work in this MVP. The plan’s definition of done matches that: source-backed `CatalogItem` rows, dry-run-default importer, no pack API/UI behavior changes, build/test pass, explicit SQL/runbook separation, and no overclaiming ownership/fulfillment/authentication/vaulting/insurance/exact odds.
