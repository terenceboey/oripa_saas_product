# CatalogItem + TCGdex Oracle Verification Review

Generated: 2026-05-29

## Method

- Ran live profile-local browser Oracle with `oracle-browser` against `docs/plans/catalogitem-tcgdex-plan.md` plus 12 repo evidence files.
- Oracle command artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T025422Z_catalogitem-tcgdex-plan-proper-review/oracle_response.md`.
- Included evidence: Prisma schema, catalog SQL, catalog router, TCGdex normalizer/importer/test, packs router, shared schemas, vendor UI, API/root package manifests.
- Cross-checked the live Oracle findings against repo files before patching the plan.

## Verdict

**CONDITIONAL / BLOCK BEFORE ROLLOUT.**

Architecture survives review:

- `CatalogItem` remains global source-backed reference data.
- TCGdex is a cleaner Pokémon card source feeding `CatalogItem`.
- `PackPrize.catalogItemId` is nullable metadata/provenance only.
- Stock, odds, ownership, fulfillment, valuation, certs, and inventory truth stay outside `CatalogItem`.

Implementation/rollout is blocked until the precision patches below are included.

## Accepted blockers / plan patches

### 1. `PackPrize.catalogItemId` does not exist yet

Evidence:

- `prisma/schema.prisma:239-255` has `PackPrize` without `catalogItemId`, `catalogItem`, or `@@index([catalogItemId])`.
- `prisma/schema.prisma:585-613` has `CatalogItem` without reverse `packPrizes`.

Patch:

- Add nullable FK with `ON DELETE SET NULL` and index.
- Add post-migration verification SQL for the nullable column and FK.
- Keep explicit language that this FK never proves stock, ownership, fulfillment, grading, or valuation.

### 2. Shared schemas currently reject/drop `catalogItemId`

Evidence:

- `packages/shared/src/index.ts:50-72` allows tier/direct prize fields but no `catalogItemId`.

Patch:

- Add `catalogItemId: z.string().trim().min(1).max(64).optional()` to tier items and direct prizes.
- Do not use `z.string().cuid()`; validate truth with DB lookup.

### 3. Backend create/update does not propagate catalog IDs

Evidence:

- `apps/api/src/modules/packs/router.ts:11-18` `CreatePrizeRow` lacks `catalogItemId`.
- `apps/api/src/modules/packs/router.ts:31-78` `buildPrizeRows()` inputs and outputs omit it.
- `apps/api/src/modules/packs/router.ts:200-229` create writes `prizeRows` directly.
- `apps/api/src/modules/packs/router.ts:268-301` update deletes/recreates prizes and still omits catalog IDs.

Patch:

- Carry `catalogItemId` through shared schemas, `CreatePrizeRow`, `buildPrizeRows()`, create writes, and replacement update writes.
- Validate active Pokémon card catalog IDs server-side.
- Convert invalid IDs to 400 responses.
- On update, validate before `deleteMany` or validate inside the same transaction before deletion using the transaction client.

### 4. Pack read responses do not return catalog metadata

Evidence:

- `apps/api/src/modules/packs/router.ts:133-180` public/vendor reads use `include: { prizes: true }` only.
- `apps/api/src/modules/packs/router.ts:228`, `301`, `320`, `340`, `357` create/update/archive/delete-retire responses include only prizes.

Patch:

- Vendor/admin pack reads and mutation responses should include minimal nested `catalogItem`.
- Public `/v1/packs` and `/v1/packs/:packId` need an explicit minimal-vs-omit decision.

### 5. Vendor UI searches catalog but does not persist selection

Evidence:

- `apps/web/app/vendor/page.tsx:83-98` Pack prize and `ItemDraft` types lack catalog ID metadata.
- `apps/web/app/vendor/page.tsx:138-145` `createItem()` initializes no catalog ID.
- `apps/web/app/vendor/page.tsx:617-629` `applyCatalogSuggestion()` sets label/image only.
- `apps/web/app/vendor/page.tsx:706-733` edit maps prizes into flattened `A Tier` and no catalog ID.
- `apps/web/app/vendor/page.tsx:762-770` submit payload omits catalog ID.

Patch:

- Store selected catalog ID/source metadata in item state.
- Set it from `suggestion.id`.
- Submit `catalogItemId` when present.
- Add selected-source badge and clear-link action.
- Accept only flattened edit preserving IDs until tier metadata exists.

### 6. Importer safety needs explicit DB environment

Evidence:

- `apps/api/scripts/sync-tcgdex.ts:10-16` has dry-run and live-write flags but no `TCGDEX_DB_ENV`.
- `apps/api/scripts/sync-tcgdex.ts:37-38` treats any Render URL as live via regex.
- `apps/api/scripts/sync-tcgdex.ts:127-131` refuses Render writes without allow flag but cannot distinguish staging vs production.
- `apps/api/scripts/sync-tcgdex.ts:143-145` start log omits DB env.

Patch:

- Add/log `TCGDEX_DB_ENV=local|staging|production`.
- Refuse Render URL with `TCGDEX_DB_ENV=local`.
- Require production writes to set `TCGDEX_DB_ENV=production TCGDEX_ALLOW_LIVE_WRITE=true`.
- Require staging writes to set `TCGDEX_DB_ENV=staging`.

### 7. Catalog report/runbook remains missing

Evidence:

- `apps/api/package.json:5-13` has sync/test scripts but no `catalog:report`.

Patch:

- Add `apps/api/scripts/catalog-report.ts` and package script.
- Include source counts, source+itemType counts, recent TCGdex rows, duplicate source key check, missing image count, missing/inactive PackPrize references, and TCGdex counts by `setId`.

### 8. Search posture is acceptable but must not be oversold

Evidence:

- `apps/api/src/modules/catalog/router.ts` already does startsWith -> contains -> searchText with dedupe and limit.
- `prisma/schema.prisma:607-612` has normal indexes but no trigram/GIN.

Patch:

- MVP OK at TCGdex scale and `limit <= 30`.
- Do not claim B-tree optimizes case-insensitive contains search.
- Add `pg_trgm`/GIN only after measured latency justifies it.

## Rejected / corrected findings

- Rejected: “CatalogItem is becoming inventory.” The plan explicitly keeps inventory/ownership/fulfillment/fairness out.
- Rejected: “TCGdex normalization is absent/nondeterministic.” `tcgdex-normalizer.ts` exists and maps source-backed fields.
- Rejected: “Normalizer has no coverage.” `test-tcgdex-normalizer.ts` exists.
- Rejected: “Catalog search is public.” Catalog router requires vendor access.
- Mostly rejected: “Search response lacks selection metadata.” It already returns ID/source/set/card/image fields.
- Rejected: “Dry-run default is absent.” Importer defaults to dry-run.

## Safe implementation order

1. DB/schema nullable FK and manual SQL locally only.
2. Shared schemas accepting bounded optional `catalogItemId`.
3. Backend propagation + validation + transaction-safe update path.
4. Vendor/admin read response includes minimal `catalogItem`; decide public separately.
5. Vendor UI state/payload/badge/clear-link/edit-preservation.
6. Importer `TCGDEX_DB_ENV` guardrail and logs.
7. Catalog report + runbook + rollback/reference-health checks.
8. Local QA, then staging, then production only with backup and explicit approval.

## Confidence

High. Live Oracle executed successfully and findings were cross-checked against current repo files. Remaining uncertainty is only search latency under real deployed DB load.

## Live Oracle loop pass 2 — accepted blockers

Artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T032730Z_catalogitem-tcgdex-plan-loop-pass2/oracle_response.md`.

Pass 2 was run after the first rectification and found four additional material gaps. All four were accepted after repo cross-check and patched into the plan:

1. **FK verification was under-specified.** The plan now verifies `pg_get_constraintdef`, `confdeltype='n'`, and `confupdtype='c'`, and blocks rollout if a same-named FK exists with wrong target/actions.
2. **Importer command snippets still relied on defaults.** The plan now requires explicit `TCGDEX_DB_ENV` for every write-mode import and includes concrete local/staging/production dry-run and pilot commands.
3. **Public pack endpoint policy was still undecided.** MVP decision: public pack endpoints omit nested `catalogItem`; vendor/admin endpoints include minimal nested metadata via a shared include.
4. **Prize replacement after draw history was unsafe.** Schema confirms `PackDraw.prizeId` and `DrawResult.packPrizeId` use `onDelete: SetNull`; update/delete-recreate can detach historical prize references. The plan now requires a draw-history guard before prize replacement and UI disable/metadata-only behavior after history exists.

False positives rejected in pass 2: already-patched propagation/search/report/import-normalizer issues remain implementation tasks, not remaining plan gaps.

## Live Oracle loop pass 3 — accepted blocker

Artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T033803Z_catalogitem-tcgdex-plan-loop-pass3/oracle_response.md`.

Pass 3 found one remaining material blocker after pass-2 rectification: post-history/live edit safety needed to protect allocation counters, not just prize rows. Repo evidence shows the current update path resets `remainingStock` from submitted `totalStock` and delete/recreates prize rows. The plan now requires:

- prize replacement only on `DRAFT` packs with zero draw history;
- rejection of prize replacement on non-DRAFT or history-bearing packs;
- rejection of `totalStock` changes after draw history;
- no unconditional `remainingStock` reset on update;
- vendor-only `hasDrawHistory` / `canReplacePrizes` response fields;
- UI disabling prize edits and omitting `tiers`/`prizes`/protected stock fields when replacement is unsafe.

## Live Oracle loop pass 4 — accepted blockers

Artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T034721Z_catalogitem-tcgdex-plan-loop-pass4-convergence/oracle_response.md`.

Pass 4 found two final material blockers and both were accepted/patched:

1. **Public scalar leak:** after adding `PackPrize.catalogItemId`, raw public `include: { prizes: true }` would expose the scalar even if nested `catalogItem` is omitted. The plan now requires `publicPackInclude`/mapper with explicit prize fields and verifies no public `catalogItemId`.
2. **DRAFT-only stock resize:** total-stock changes are now DRAFT-only; DRAFT/no-history changes update `remainingStock` in lockstep, while LIVE/no-history and any-history stock changes return 400.

## Live Oracle loop pass 5 — final convergence

Artifact: `/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T035421Z_catalogitem-tcgdex-plan-loop-pass5-final/oracle_response.md`.

Verdict: **CLEAN**. Confidence: high.

No remaining material blockers, contradictions, or unsafe rollout snippets were found after pass-4 rectification. Minor non-blocking nit from Oracle: older dated Oracle sections still contain historical “conditional/block” wording, but they are clearly superseded by later pass summaries and inline patches.
