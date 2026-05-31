# Oripa Live DB Gap Closure Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after the Oracle loop is closed. Do **not** run production writes except through explicit dry-run/apply gates.

**Goal:** Close the remaining live DB audit gaps without conflating source catalog data, vendor-owned inventory, and pack-prize snapshots.

**Architecture:** Treat the current audit as four separate seams: source-backed catalog provenance, set/sealed media metadata, owned inventory, and immutable PackPrize snapshots. Source catalog backfills are allowed only when deterministic from source data or marked low-trust; vendor inventory and PackPrize rows must not be fabricated from catalog rows. Every write script must default to dry-run, emit artifacts, and support idempotent re-run.

**Tech Stack:** Node/TypeScript scripts under `apps/api/scripts`, Prisma schema in `prisma/schema.prisma`, Postgres live DB on Render, audit artifacts under `docs/plans`, existing catalog/search modules under `apps/api/src/modules/catalog`, pack modules under `apps/api/src/modules/packs`.


---

## Oracle reconciliation patch — 2026-05-31

Live Oracle CLI was checked before this reconciliation and returned: `gpt-5.5-pro: not ready` because `OPENAI_API_KEY` is missing. Per the Oracle skill, the plan was therefore reviewed with bounded independent Oracle-style lanes covering data-model/source-truth, production safety/recovery, and implementation sequencing/test coverage. The reconciliation artifact is `docs/plans/oracle-reviews/live-db-remaining-gap-repair-reconciliation-2026-05-31.md`.

The following revisions are now part of the plan and override any earlier wording that conflicts with them:

1. **Payload trust/provenance contract:** copied or legacy `sourcePayload` values are not native source payloads. They must be wrapped with `__oripaPayloadTrust` and `__oripaPayloadProvenance` metadata (`native_source`, `copied_exact_mapping`, `legacy_metadata_only`, or `sealed_metadata_only`). Public/vendor APIs must not expose raw `sourcePayload`; internal consumers that inspect it must either ignore the wrapper or explicitly branch on trust. Audit output must distinguish native, copied, legacy, and blocked payloads.
2. **Image provenance contract:** because `CatalogSet.symbolImageUrl`, `logoImageUrl`, and `bannerImageUrl` are source-agnostic columns, every remediation that writes one of them must also write image-level provenance into `CatalogSet.sourcePayload.__oripaImageProvenance` with field name, URL, provider source, match rule, trust, and timestamp. Cross-source image writes are forbidden unless this provenance is written in the same guarded update.
3. **No overstated image candidates:** `tcgtracking/POKEMON/ja` set images are `missing_source` unless the dry-run proves actual same-source image URL fields in `sourcePayload`. Same-source is a candidate class only after observed URL evidence, not from source/game identity alone.
4. **Sealed/PackPrize guardrail:** `CatalogItem.itemType='SEALED_PRODUCT'` remains invalid for the current card catalog path. Catalog-backed PackPrize card snapshots must require `CatalogItem.itemType='CARD'`. `CatalogSealedProduct` cannot be used as a catalog-backed PackPrize until a sealed snapshot builder and tests exist.
5. **Apply safety hardening:** every production apply must write and log rollback SQL before the first mutation, validate rollback SQL syntax in dry-run, mutate in bounded batches (default max 500 ids per statement unless dry-run proves a larger safe size), require explicit `DB_REMEDIATION_DB_ENV` even for dry-runs, and prevent concurrent remediation scripts via an advisory lock or documented single-operator lock.
6. **Preflight location:** `scripts/verify-live-db-gap-preflight.js` is a root CommonJS script following the existing root audit-script convention (`new PrismaClient()`), not an `apps/api/scripts` TypeScript remediation script.
7. **Workstream A test gate:** `apps/api/package.json` must add `test:catalog:live-db-audit-classification`, and the verification commands must include it before any remediation dry-run/apply.
8. **Search test gate:** Workstream E must include concrete tests for `entityType`/`catalogClass`, sealed search, set search, and `prizeableNow` being `false` or absent.

## GPT-5.5 Pro Oracle rerun patch — 2026-05-31T03:34Z

A live browser Oracle rerun using GPT-5.5 Pro (`docs/plans/oracle-reviews/live-db-gap-closure-gpt55pro-oracle-rerun-20260531T033407Z.md`) returned **NOT CLEAN** because the plan still under-specified two non-image `CatalogSet` metadata gaps and omitted two verification gates from the command block. These revisions are mandatory and override earlier wording:

9. **CatalogSet non-image metadata taxonomy:** `CatalogSet.sourceCategoryId` and `CatalogSet.productCount` gaps must be explicitly audited and either remediated or classified. They are `remediable_db_gap` only when a deterministic same-source category/count mapping exists; `source_metadata_gap` when the upstream source lacks a category/count concept or only low-trust derived metadata is available; and `licensing_or_policy_gate` when source data exists but cannot be copied. Every such issue must include `writeAllowed`, `safeAction`, and `expectedRemainingAfterPlan`.
10. **Final expected-remaining classes:** final audit may retain only explicitly classified categories: `source_image_gap`, `source_metadata_gap`, `product_lane_absent`, `demo_fixture_gap`, or `licensing_or_policy_gate`. Any remaining `remediable_db_gap` is a blocker unless the apply was intentionally skipped with a written approval note.
11. **Missing verification gates:** `apps/api/package.json` must add and the verification block must run `test:catalog:search-contract` and `test:packs:catalog-snapshots` before final audit.

---

## Evidence packet

### Live audit report

Primary audit artifact: `docs/plans/live-db-missing-audit-2026-05-31T01-58-33-021Z.md` and JSON sibling.

Key live counts from the audit:

- `CatalogItem`: `246,170` active rows; `0` missing images; `0` missing search text; `0` missing `catalogSetId`; `29,634` missing `sourcePayload`.
- `CatalogSet`: `2,827` rows; all rows now have `groupKind`, `reviewStatus`, and `sourcePayload`; remaining gaps are set image/source-category/product-count coverage.
- `CatalogSealedProduct`: `3,588` rows; all rows have images and set links; `323` rows have missing `productKind/sourcePayload` (`45` Pokemon EN, `278` Pokemon Japan EN).
- `VendorInventoryItem`: `0` rows. This is not a catalog bug; owned-stock ingestion is absent.
- `PackPrize`: `6` rows; `0` catalog-linked; all six are manual/demo rows with missing set/card/rarity.
- `CanonicalSearchDoc`: `249,860` docs; `CanonicalCatalogCard`: `245,844`; `CanonicalSealedProduct`: `2,963`; `CanonicalCatalogSet`: `1,053`.

### Current schema seams

From `prisma/schema.prisma`:

- `CatalogItem` has source identity and provenance fields: `source`, `sourceItemId`, `language`, `sourcePayload`, `catalogSetId`, card metadata, images, `searchText`.
- `CatalogSet` has set identity/metadata: `source`, `sourceSetId`, `sourceCategoryId`, `groupKind`, `sourcePayload`, `reviewStatus`, set image fields.
- `CatalogSealedProduct` is separate from `CatalogItem`; sealed rows must not be forced through card-only `CatalogItem` response paths.
- `Canonical*` tables are projection/search layer, not source-of-truth inventory.
- `PackPrize` already has catalog snapshot fields from earlier work; existing demo/manual rows remain unlinked.

### Already fixed in previous remediation slice

The prior structural remediation closed:

- `CatalogItem.catalogSetId` missing links: now `0`.
- `CatalogSet.groupKind`: now `0` missing.
- `CatalogSet.reviewStatus`: now `0` missing.
- `CatalogSet.sourcePayload`: now `0` missing.
- TCGCSV/TCGTracking source categories/groups linked to sets.

Do not redo this work except as regression verification.

---

## Done definition

A future implementation of this plan is complete only when all acceptance criteria below pass:

1. **Audit clarity:** Audit output separates hard data bugs from intentionally absent product lanes (`VendorInventoryItem`, demo `PackPrize`) so future reports do not imply catalog rows are owned stock.
2. **No provenance fabrication:** Missing `CatalogItem.sourcePayload` rows are either deterministically restored from a same-source row/raw fixture, or explicitly marked with a low-trust legacy metadata payload. The plan must not synthesize fake raw source payloads.
3. **Sealed products preserved as sealed:** `CatalogSealedProduct` gaps are remediated in sealed product scripts/DTOs, never by shoehorning sealed rows into `CatalogItem` card endpoints.
4. **Set image coverage policy:** Set image gaps are resolved where source-backed image URLs exist; otherwise the audit records `imageStatus=missing_source` or equivalent and does not block catalog usability.
5. **Inventory lane explicit:** `VendorInventoryItem=0` remains a launch blocker for real owned-stock draws, not a backfill target from catalog. A separate import/seed plan is required before any real paid pack claims.
6. **PackPrize lane explicit:** Existing manual/demo `PackPrize` rows are either left as demo fixtures with audit classification, or recreated through source-backed CSV/import/publish flow. They must not be silently guessed into catalog links.
7. **Search contract:** Source catalog search includes cards, sealed products, and sets through typed adapters/projections; vendor inventory search remains separate until inventory exists.
8. **Production safety:** Every DB write script defaults to dry-run, emits before/after counts and JSON artifacts, requires explicit production flags, and can be re-run safely.
9. **Verification:** `npm run lint`, targeted tests, dry-run, and read-only live audit all pass; any remaining gaps are categorized as `source_image_gap`, `source_metadata_gap`, `product_lane_absent`, `demo_fixture_gap`, or `licensing_or_policy_gate`, not untriaged. Any remaining `remediable_db_gap` is a blocker unless explicitly deferred by written approval.

---

## Mandatory preflight invariants

Run these read-only checks before implementing or applying any workstream. Any non-zero or contradictory result becomes a new audit issue before writes are attempted.

1. **No hidden sealed rows in `CatalogItem`:**

   ```sql
   SELECT COUNT(*) AS sealed_catalog_items
   FROM "CatalogItem"
   WHERE "itemType" = 'SEALED_PRODUCT';
   ```

   - Expected now: `0`.
   - If non-zero: classify as `remediable_db_gap`; decide whether to migrate into `CatalogSealedProduct` or update search adapters before doing sourcePayload/image work.

2. **SourcePayload copy proof for `POKEMON_JAPAN/en`:** report counts for `matchedHasPayload`, `matchedNullPayload`, `unmatched`, `duplicateSourceMatch`, `duplicateTargetMatch`, and core-field contradictions before enabling apply.
3. **CatalogSet image candidate proof:** report per source/game/language counts for `same_source_candidate`, `cross_source_candidate`, `ambiguous`, `license_blocked`, and `missing_source`.
4. **CatalogSet source metadata proof:** report per source/game/language counts for missing `sourceCategoryId` and `productCount`, with candidate classes `deterministic_source_mapping`, `source_has_no_metadata`, `policy_blocked`, `ambiguous`, and `already_complete`. The preflight must sample rows for `bulbapedia/POKEMON`, `pokemoncard.io/POKEMON`, `onepiecedb.io/ONE_PIECE`, and `tcgtracking/POKEMON_JAPAN` because the audit shows source-category/product-count gaps there.
5. **Vendor inventory referential safety:** if `VendorInventoryItem` rows exist, verify any `catalogItemId` points to an existing `CatalogItem` with `itemType='CARD'`. Sealed inventory needs a sealed-product reference or future polymorphic inventory model.
6. **PackPrize source-backed entity support:** verify catalog-backed PackPrize rows only reference entity types supported by the snapshot builder. Until sealed snapshots are added, sealed products are not allowed as catalog-backed PackPrize rows.

**Deliverable:** create `scripts/verify-live-db-gap-preflight.js` to execute these invariants and emit a JSON/MD artifact under `docs/plans/`. Manual SQL snippets are not enough for implementation; the executable preflight is required before any apply. This root script uses CommonJS and `new PrismaClient()` like `scripts/audit_live_db_missing_gaps.js`; API remediation scripts under `apps/api/scripts/` continue to import `../src/lib/prisma`.

---

## Non-goals

- Do not create owned/vendor inventory from catalog rows.
- Do not represent complete sets by mutating `CatalogSet`; complete-set prizes require separate prizeable item/inventory modeling.
- Do not promise live paid odds, fulfillment, or exact prize availability until PackPrize snapshot + inventory allocation + draw ledger gates pass.
- Do not rewrite canonical catalog/search schema unless a measured search/query failure requires it.
- Do not alter production DB without dry-run artifact and explicit write flags.

---

## Workstreams

### Cross-cutting implementation rules for every write script

- API remediation scripts under `apps/api/scripts/` must import the existing Prisma client from `../src/lib/prisma`; do not instantiate an unconfigured `new PrismaClient()` there. Root `scripts/*.js` audit/preflight utilities may follow the existing CommonJS `new PrismaClient()` convention used by `scripts/audit_live_db_missing_gaps.js`.
- `DB_REMEDIATION_DB_ENV` must be explicitly set for dry-run and apply; scripts must refuse an unset/empty DB env so artifacts always state the target scope.
- Dry-run against production is allowed only for read-only SELECT/planning queries and must never call an apply function.
- Apply requires all three explicit flags: `DB_REMEDIATION_DRY_RUN=false`, `DB_REMEDIATION_DB_ENV=production`, `DB_REMEDIATION_ALLOW_LIVE_WRITE=true`.
- Remediation scripts must not run concurrently. Use a Postgres advisory lock for each script family, or require/document a single-operator lock before apply.
- All UPDATEs must include null/expected-value guards, e.g. `WHERE "sourcePayload" IS NULL`, to avoid overwriting data restored between dry-run and apply.
- Every apply run must write two artifacts before mutation starts: an apply plan JSON containing touched primary keys and before/after values; and a rollback SQL file generated from before-values. The rollback SQL path must be written under `docs/plans/rollback-<script>-<timestamp>.sql` and printed before the first `UPDATE`, `INSERT`, or `DELETE`.
- Dry-run must syntax-validate rollback SQL generation. At minimum, emit the generated rollback SQL and run parser-safe validation for the target SQL shape before apply; if validation is impossible for a specific dynamic statement, the artifact must explain why and block apply until manually reviewed.
- Large remediations must batch by primary key list. Default cap: 500 ids per mutating statement unless dry-run evidence proves a larger batch is safe on Render. Re-runs must resume by predicates, not by hidden cursor state.
- Every script must be idempotent: a partial timeout followed by re-run should only process rows still matching the missing/expected predicates.
- Every dry-run artifact must include representative sample rows per candidate class, not just counts.
- Note: the earlier `remediate-live-db-missing-gaps.ts` production apply predated the rollback-SQL requirement. Do not redo it, but if those prior additive null→non-null updates become disputed, generate a retroactive current-state recovery note before further changes.

### Workstream A — Audit taxonomy and report quality

**Objective:** Make the audit report distinguish remediable defects, metadata limitations, source limitations, and absent product lanes.

**Files:**

- Modify: `scripts/audit_live_db_missing_gaps.js`
- Test/Create: `apps/api/scripts/test-live-db-audit-classification.ts`
- Modify: `apps/api/package.json` — add `test:catalog:live-db-audit-classification`
- Modify: root `package.json` if present — add/verify `verify:live-db-gap-preflight` or document direct `node scripts/verify-live-db-gap-preflight.js` usage
- Create: `scripts/verify-live-db-gap-preflight.js`
- Artifact: `docs/plans/live-db-gap-closure-audit-taxonomy-YYYY-MM-DD.json`

**Implementation:**

- Refactor audit issues from the current compact `addIssue(severity, model, message, fix, data)` shape into versioned object records containing `severity`, `model`, `message`, `category`, `sourceOfTruth`, `safeAction`, `blockedBy`, `writeAllowed`, `expectedRemainingAfterPlan`, and `data`. Preserve backward compatibility by either retaining legacy top-level fields or emitting a versioned `issuesV2` alongside the old `issues` shape until downstream readers are updated.
- Add severity mapping: `P0` = core catalog/search display broken, broken source linkage, or writes would corrupt provenance; `P1` = provenance/auditability incomplete but catalog display/search works; `P2` = polish/completeness such as optional set images when item/sealed images exist.
- Add issue categories:
  - `remediable_db_gap`
  - `source_metadata_gap`
  - `source_image_gap`
  - `product_lane_absent`
  - `demo_fixture_gap`
  - `licensing_or_policy_gate`
- For each issue, include:
  - `severity`
  - `category`
  - `sourceOfTruth`
  - `safeAction`
  - `blockedBy`
  - `writeAllowed: boolean`
  - `expectedRemainingAfterPlan: boolean`
- Reclassify current live issues:
  - `CatalogItem.sourcePayload`: `remediable_db_gap` for deterministic matches; `source_metadata_gap` for legacy-only low-trust payloads.
  - `CatalogSet` missing images: `source_image_gap` unless matching source-backed URLs exist.
  - `CatalogSet.sourceCategoryId`: `remediable_db_gap` when deterministic same-source category mapping exists; `source_metadata_gap` when the upstream source has no category concept or only legacy/derived metadata is available; `licensing_or_policy_gate` when source data exists but cannot be copied. Each issue must state `writeAllowed`, `safeAction`, and `expectedRemainingAfterPlan`.
  - `CatalogSet.productCount`: `remediable_db_gap` when a deterministic same-source count can be restored from current source/catalog rows; `source_metadata_gap` when the source lacks count semantics or count is intentionally not trusted; `licensing_or_policy_gate` when source count exists but policy blocks copying. Do not fabricate counts from partial local rows unless the field is explicitly redefined as local indexed-count metadata.
  - `VendorInventoryItem=0`: `product_lane_absent`, write not allowed in catalog remediation.
  - Manual/demo `PackPrize`: `demo_fixture_gap`, write allowed only through source-backed import/recreate path.
  - `CatalogItem.itemType='SEALED_PRODUCT'` rows: `remediable_db_gap` if present; expected now is zero. If non-zero, add a migration subtask to move them into `CatalogSealedProduct` or explicitly support them; add `itemType != 'SEALED_PRODUCT'` guards to CatalogItem-only queries; and add DB/app guardrails to prevent future sealed inserts into `CatalogItem` unless the dual model is intentionally reintroduced.

**Acceptance:**

- Audit no longer reports `VendorInventoryItem=0` as if catalog backfill could fix it.
- Audit includes remaining expected gaps as classified, not open-ended failures.
- Test asserts the live issue categories above, including `CatalogSet.sourceCategoryId` and `CatalogSet.productCount` classifications.

---

### Workstream B — CatalogItem sourcePayload remediation policy

**Objective:** Resolve or classify the `29,634` `CatalogItem.sourcePayload` gaps without inventing raw provenance.

**Evidence:**

- Current missing split observed live after remediation:
  - `tcgtracking / POKEMON_JAPAN / en`: `29,557` missing `sourcePayload`.
  - `tcgtracking / POKEMON / en`: `77` missing `sourcePayload`.
- Prior check found most `POKEMON_JAPAN/en` rows match `tcgtracking/POKEMON/ja` rows by `sourceItemId` mapping (`85:` prefix), meaning deterministic payload copying may be possible for many rows.

**Files:**

- Create: `apps/api/scripts/remediate-catalogitem-source-payload.ts`
- Create: `apps/api/scripts/test-catalogitem-source-payload-remediation.ts`
- Modify: `apps/api/package.json` — add `test:catalog:source-payload-remediation` script

**Plan:**

1. Build a dry-run planner that groups missing rows by source/game/language/itemType and reports candidate fix type:
   - `copy_from_same_source_language_twin`
   - `restore_from_raw_fixture`
   - `legacy_metadata_only_payload`
   - `blocked_no_safe_source`
2. For `POKEMON_JAPAN/en`, support deterministic copy from `tcgtracking/POKEMON/ja` only if:
   - Source is `tcgtracking` for both rows.
   - Target `sourcePayload` is null.
   - Source row `sourcePayload` is non-null.
   - Mapping is exact and one-to-one: target `sourceItemId` maps to source `sourceItemId = '85:' || target.sourceItemId` or another explicitly documented rule proved by a dry-run uniqueness check.
   - Core fields are compatible: name, setId, image URL, and set link do not contradict.
   - Copied payload must be a discriminated wrapper, not a bare clone. Required metadata: `__oripaPayloadTrust='copied_exact_mapping'`, `__oripaPayloadProvenance={copiedFromCatalogItemId,copiedFromSourceItemId,copiedAt,copyReason,matchRule}`, plus the original source payload under a stable nested key. Downstream readers must not treat wrapped copied payloads as native source payloads unless they explicitly branch on `__oripaPayloadTrust`.
   - Dry-run proves exact candidate counts: `matchedHasPayload`, `matchedNullPayload`, `unmatched`, `duplicateSourceMatch`, `duplicateTargetMatch`, `contradictoryName`, `contradictorySet`, `contradictoryImage`.
3. For the remaining rows, only create low-trust legacy payloads if policy accepts them:
   - Payload includes current row columns and `__oripaPayloadTrust='legacy_metadata_only'` plus `__oripaPayloadProvenance` explaining that no raw source payload was recovered.
   - No raw source fields are invented.
   - Audit should still show these as low trust, not source-restored.
   - Rows with a matching twin whose source row also lacks payload are `blocked_no_safe_source` unless complete row metadata permits `legacy_metadata_only` under the same low-trust policy.
   - Rows with no twin are `legacy_metadata_only` only if they have complete display-critical metadata (`name`, `sourceItemId`, image URL, set link when applicable); otherwise `blocked_no_safe_source`.
4. Production apply script must default to dry-run and write artifact with counts:
   - `before.missingSourcePayload`
   - `copyCandidates`
   - `legacyCandidates`
   - `blocked`
   - `after.missingSourcePayload`
5. Apply SQL must guard every row with `WHERE "sourcePayload" IS NULL` and the same source/game/language predicates used by the dry-run planner.

**Acceptance:**

- Test covers exact mapping, contradiction rejection, duplicate mapping rejection, low-trust fallback, and the `__oripaPayloadTrust`/`__oripaPayloadProvenance` wrapper contract.
- Dry-run artifact includes sample rows for each candidate class.
- Production apply reduces missing `CatalogItem.sourcePayload` to `0` only if all rows are safely copied or low-trust-classified; otherwise audit explicitly lists blocked rows by reason.

---

### Workstream C — CatalogSealedProduct sourcePayload/productKind remediation

**Objective:** Fix or classify `CatalogSealedProduct` missing `productKind/sourcePayload` without routing sealed rows through `CatalogItem` card paths.

**Evidence:**

- `tcgtracking / POKEMON / en`: `2,771` sealed; images and set links complete; `45` missing `productKind/sourcePayload`.
- `tcgtracking / POKEMON_JAPAN / en`: `278` sealed; images and set links complete; `278` missing `productKind/sourcePayload`.

**Files:**

- Create: `apps/api/scripts/remediate-sealed-product-source-payload.ts`
- Create: `apps/api/scripts/test-sealed-product-remediation.ts`
- Inspect/modify as needed: `apps/api/scripts/sync-tcgcsv-vendor-catalog.ts`
- Inspect/modify as needed: `apps/api/src/modules/catalog/search-adapters.ts`
- Modify: `apps/api/package.json` — add `test:catalog:sealed-product-remediation` script

**Plan:**

1. Add a sealed-only planner that groups missing sealed rows by source/game/language.
2. Restore `sourcePayload` from TCGCSV product detail/group evidence when available.
3. Infer `productKind` using explicit sealed taxonomy and preview every classification before apply:
   - `/booster\s*box|display/i` → `booster_box`
   - `/booster\s*pack|single\s*pack/i` → `booster_pack`
   - `/elite\s*trainer\s*box|\bETB\b/i` → `elite_trainer_box`
   - `/starter\s*deck|theme\s*deck|start\s*deck|structure\s*deck/i` → `starter_deck`
   - `/bundle|build\s*&\s*battle|battle\s*box/i` → `bundle`
   - `/collection|premium\s*collection|box\s*set/i` → `collection_box`
   - `/\btin\b/i` → `tin`
   - `/\bcase\b/i` → `case`
   - `/deck/i` → `deck`
   - otherwise `blocked_no_kind_rule` unless source payload has an explicit product category.
4. If raw product detail is unavailable, write low-trust sealed payload only if it includes `__oripaPayloadTrust='sealed_metadata_only'`, `__oripaPayloadProvenance`, and current row fields only.
5. Dry-run artifact must include sample rows for each inferred `productKind`, source/game/language group, and blocked class.
6. Add tests for classification of representative sealed names and for no mutation of card `CatalogItem` rows.
7. Apply SQL must guard with `WHERE "productKind" IS NULL OR "sourcePayload" IS NULL` and set only currently-null fields.

**Acceptance:**

- `CatalogSealedProduct` missing `productKind` reaches `0` or remaining rows are explicitly `blocked_no_kind_rule`.
- `CatalogSealedProduct.sourcePayload` reaches `0` missing or remaining rows are explicitly blocked.
- No `CatalogItem` code path is used for sealed remediation.

---

### Workstream D — CatalogSet image remediation policy

**Objective:** Fill set images where source-backed URLs exist and classify unavoidable image gaps.

**Evidence:**

Remaining missing set images by audit:

- `bulbapedia/POKEMON`: `28/144`
- `onepiecedb.io/ONE_PIECE`: `51/51`
- `pokemoncard.io/POKEMON`: `109/196`
- `tcgtracking/CARDFIGHT_VANGUARD`: `263/263`
- `tcgtracking/DRAGON_BALL_SUPER`: `101/101`
- `tcgtracking/FLESH_AND_BLOOD`: `94/94`
- `tcgtracking/LORCANA`: `18/18`
- `tcgtracking/ONE_PIECE`: `76/76`
- `tcgtracking/POKEMON/ja`: `447/447`
- `tcgtracking/POKEMON_JAPAN/en`: `93/446`
- `tcgtracking/RIFTBOUND`: `7/7`
- `tcgtracking/WEISS_SCHWARZ`: `163/163`
- `tcgtracking/YUGIOH`: `605/605`

**Files:**

- Reuse/extend existing: `scripts/replace_bulbapedia_set_images_from_tcgtracking.js`
- Create: `apps/api/scripts/remediate-catalogset-images.ts`
- Create: `apps/api/scripts/test-catalogset-image-remediation.ts`
- Modify: `apps/api/package.json` — add `test:catalog:set-image-remediation` script
- Modify: `scripts/audit_live_db_missing_gaps.js`

**Plan:**

1. Build source-backed image candidate resolver:
   - Same-source `sourcePayload.set_symbol_url`, `logo_url`, `banner_url`, or equivalent observed URL fields. Presence must be proven in dry-run per source/game; do not classify a group as same-source candidate by source name alone.
   - TCGTracking set-symbol endpoint only if URL pattern was observed in source scout and is license/terms approved.
   - Cross-source overlap only if game + normalized set code/name + release date + language match and source priority allows it. Language-independent symbol/logo images may cross language only when source policy says they are locale-independent.
   - Initial source priority table: `POKEMON/en`: `bulbapedia` > `pokemoncard.io` > `tcgtracking/POKEMON`; `POKEMON/ja`: same-source only if dry-run proves image URL fields in tcgtracking `sourcePayload`, otherwise classify as `missing_source`; `POKEMON_JAPAN/en`: same-source only unless a documented one-to-one twin exists; `ONE_PIECE/en`: `onepiecedb.io` > `tcgtracking/ONE_PIECE`; other games: same-source only until policy is documented. Before any cross-source apply, encode this policy in `apps/api/src/modules/catalog/source-priority.ts` (or its successor) as explicit per-game `SET_IMAGERY` rules.
2. Add per-row `imageStatus` policy in audit/remediation artifacts:
   - `has_image`
   - `candidate_same_source`
   - `candidate_cross_source`
   - `missing_source`
   - `blocked_license`
   - `blocked_ambiguous_match`
3. Apply only `candidate_same_source` and deterministic `candidate_cross_source` rows; leave the rest classified.
   - Apply sets only currently-null image columns and never replaces an existing `symbolImageUrl`, `logoImageUrl`, or `bannerImageUrl`. The same update must write `CatalogSet.sourcePayload.__oripaImageProvenance[field]` with URL, provider source, match rule, trust, and timestamp so source-agnostic image columns remain auditable.
4. Do not block source catalog usability on missing set images when item/sealed images exist.

**Acceptance:**

- Set image apply script outputs before/after counts by source/game/language and status.
- Audit distinguishes missing image source limitations from unresolved engineering gaps.
- No guessed image URLs are inserted.
- Every inserted image URL has `__oripaImageProvenance` recorded in `CatalogSet.sourcePayload`.

---

### Workstream D2 — CatalogSet sourceCategoryId/productCount metadata classification

**Objective:** Explicitly close or classify non-image `CatalogSet` metadata gaps so final audit does not leave `sourceCategoryId` or `productCount` untriaged.

**Evidence from GPT-5.5 Pro Oracle rerun:** the audit shows missing `sourceCategoryId` for `bulbapedia/POKEMON` (`144/144`), `onepiecedb.io/ONE_PIECE` (`51/51`), `pokemoncard.io/POKEMON` (`196/196`), and `tcgtracking/POKEMON_JAPAN` (`446/446`), plus missing `productCount` for `bulbapedia/POKEMON` (`144/144`).

**Files:**

- Modify: `scripts/audit_live_db_missing_gaps.js`
- Extend/Create: `apps/api/scripts/test-live-db-audit-classification.ts`
- Optional only if deterministic writes exist: `apps/api/scripts/remediate-catalogset-source-metadata.ts` and `apps/api/scripts/test-catalogset-source-metadata-remediation.ts`

**Plan:**

1. Add audit classification for `CatalogSet.sourceCategoryId` and `CatalogSet.productCount` independent of image status.
2. For each source/game/language group, classify missing metadata as:
   - `remediable_db_gap`: deterministic same-source category/count mapping exists and can be restored with null/expected-value guards.
   - `source_metadata_gap`: upstream source has no category/count concept, the field is not meaningful for that provider, or only legacy/derived metadata exists.
   - `licensing_or_policy_gate`: source data exists but copying is blocked by policy/licensing.
   - `blocked_ambiguous_match`: more than one candidate category/count exists or count semantics conflict.
3. If a write is allowed, use the same write-script rules as B/C/D: dry-run by default, apply-plan JSON, rollback SQL before mutation, 500-id batch cap, and `WHERE` guards on null/expected current values.
4. If no deterministic write is allowed, do not fabricate `sourceCategoryId` or `productCount`; leave the rows classified with `expectedRemainingAfterPlan=true` and a `safeAction` explaining the source limitation.
5. Tests must assert that the audit emits non-image set metadata issues for the groups above and that final audit acceptance treats classified `source_metadata_gap` as expected rather than cleanly disappearing.

**Acceptance:**

- No `CatalogSet.sourceCategoryId` or `CatalogSet.productCount` issue remains unclassified.
- Any remaining source-category/count gaps are either `source_metadata_gap`/`licensing_or_policy_gate` with `expectedRemainingAfterPlan=true`, or are reduced to zero by deterministic guarded remediation.
- Audit tests cover the exact source/game groups called out by the GPT-5.5 Pro rerun.

---

### Workstream E — Source-backed search contract for cards/sealed/sets

**Objective:** Ensure search/autocomplete/query DTOs expose cards, sealed products, and sets correctly without mixing inventory or prizeability.

**Files:**

- Inspect/modify: `apps/api/src/modules/catalog/search-adapters.ts`
- Inspect/modify: `apps/api/src/modules/catalog/search-query.ts`
- Inspect/modify: `apps/api/src/modules/catalog/search-dedupe.ts`
- Create/extend tests under `apps/api/scripts/test-catalog-search-*` with concrete assertions for `entityType`/`catalogClass`, sealed results, set results, and prizeability separation.
- Modify: `apps/api/package.json` — add `test:catalog:search-contract`.

**Plan:**

1. Define typed adapter contracts:
   - `CatalogCardSearchResult` from `CatalogItem` where `itemType=CARD`.
   - `CatalogSealedSearchResult` from `CatalogSealedProduct`.
   - `CatalogSetSearchResult` from `CatalogSet` or `CanonicalCatalogSet` as metadata/filter result only.
   - Future `VendorInventorySearchResult` separate from source catalog.
   - If the implementation keeps the existing `CatalogSearchResponseItem` shape, add/verify explicit `entityType`/`catalogClass` and source/provenance fields instead of over-promising new DTO names. Do not rely solely on overloaded `itemType`, because `SET` is not a `CatalogItemType`.
2. Search response fields must include provenance (`source`, source item/product/set id, language), type, image, set link, and whether result is `prizeableNow`.
3. For now, `prizeableNow=false` unless there is vendor inventory or explicit source-backed pack import flow creating immutable PackPrize snapshots. If `prizeableNow` is not implemented in this slice, the API must avoid exposing any field that implies source catalog rows are owned/prizeable.
4. Regression tests must prove: (a) response items include explicit `entityType` or `catalogClass`; (b) sealed search returns `CatalogSealedProduct` results when querying sealed classes; (c) set search returns `CatalogSet`/`CanonicalCatalogSet` metadata rows when querying set classes; (d) `prizeableNow` is either absent or explicitly `false` for source catalog rows until owned inventory/PackPrize snapshot support exists; and (e) sealed search does not disappear if `CatalogItem` filters are card-only.
5. Document or implement facets/suggest behavior: if those endpoints remain card-only, say so explicitly in API docs/tests; do not imply sealed/set suggestions exist there.
6. `prizeableNow` is excluded unless this slice implements it explicitly as `false` for all source catalog results.

**Acceptance:**

- Cards, sealed products, and sets are discoverable in source catalog search.
- Search DTO cannot be mistaken for owned inventory.
- Performance stays bounded by existing `CanonicalSearchDoc`/indexes or a measured follow-up is created.

---

### Workstream F — Vendor inventory lane plan, not catalog backfill

**Objective:** Convert `VendorInventoryItem=0` from an audit surprise into an explicit product-lane blocker with its own seed/import workflow.

**Files:**

- Create: `docs/plans/vendor-inventory-import-lane-plan-YYYY-MM-DD.md`
- Modify audit classification only: `scripts/audit_live_db_missing_gaps.js`
- Implementation later: vendor inventory import endpoints/scripts after approval.

**Plan:**

1. Keep live DB unchanged for inventory until product inputs exist.
2. Define import sources:
   - CSV/manual stock import.
   - Catalog-backed item reference.
   - Vendor custom item.
   - Slab/certified instance fields.
3. Define mandatory inventory fields before paid pack use:
   - vendorId, item class/type, catalog/vendorCustom ref, quantity, held/sold, image snapshot, condition, value/cost/listing price, currency, source/receipt optional, cert number for slab.
4. Define guardrails:
   - Cross-vendor refs rejected.
   - Negative/oversold quantity rejected.
   - Inventory allocations reserve stock before PackPrize publish.
   - `catalogItemId` may reference only `CatalogItem.itemType='CARD'`; sealed product inventory needs a separate sealed-product reference or future polymorphic inventory reference. Add this as an audit check even while current inventory count is zero.

**Acceptance:**

- Audit says inventory lane absent, not remediable from catalog.
- Future implementation has a separate explicit plan and approval gate.

---

### Workstream G — PackPrize demo rows and source-backed snapshot lane

**Objective:** Treat current unlinked manual/demo PackPrize rows honestly and define the safe path to production source-backed prize rows.

**Files:**

- Inspect/extend: `apps/api/src/modules/packs/router.ts`
- Inspect/extend: `apps/api/src/modules/packs/prize-snapshots.ts`
- Tests: `apps/api/scripts/test-pack-prize-catalog-snapshots.ts`
- Modify: `apps/api/package.json` — add/verify `test:packs:catalog-snapshots`
- Audit: `scripts/audit_live_db_missing_gaps.js`

**Plan:**

1. Audit current six manual/demo PackPrize rows as `demo_fixture_gap` if they belong to demo packs.
2. Do not auto-link demo rows by fuzzy name. Only deterministic ref match is allowed:
   - existing `catalogItemId`, or
   - `(catalogSource, catalogSourceItemId, language)`, or
   - source-backed CSV/import recreated row.
3. For production packs, enforce freeze/snapshot requirements:
   - catalogItemId/catalogSource/catalogSourceItemId when catalog-backed.
   - catalogSnapshot with copied display/image/set/card/rarity/value fields.
   - immutable after publish except through new version/freeze cycle.
   - Card snapshots use `CatalogItem` and existing card fields, and must enforce `CatalogItem.itemType = 'CARD'` before snapshot creation.
   - Sealed snapshots require a new `CatalogSealedProductSnapshotSource`, sealed lookup, and sealed snapshot builder. Until implemented, sealed products cannot be catalog-backed PackPrize rows. Add both an app-level validator and an audit/preflight check for PackPrize rows whose source refs match `CatalogSealedProduct` or whose `catalogItemId` points to any non-card item type; expected current count is zero. Also add a guard preventing new `CatalogItem.itemType='SEALED_PRODUCT'` rows unless a future migration intentionally reintroduces that model.
4. Add audit checks that separate:
   - manual demo rows,
   - manual vendor custom rows,
   - catalog-backed rows missing snapshot,
   - inventory-backed rows missing allocation/snapshot.

**Acceptance:**

- Existing demo rows do not block catalog gap closure but remain flagged as non-production.
- Any newly created catalog-backed PackPrize rows must have immutable snapshots.

---

## Execution sequence

1. **Plan review gate:** Run Oracle on this plan + live audit + schema snippets. Patch plan until Oracle returns CLEAN/no material blockers.
2. **Audit taxonomy first:** Implement Workstream A so future runs stop mixing product absence with DB defects.
3. **Dry-run all remediations:** Implement B/C/D planners; run dry-run only; review candidate samples.
4. **Apply only safe source-backed changes:** Apply B/C/D rows that pass deterministic gates. Leave blocked rows classified.
5. **Search contract:** Implement E after B/C/D if search DTOs need changes to reflect sealed/set results.
6. **Inventory/PackPrize lanes:** Create Workstream F/G artifacts and audit classifications; do not write fake inventory or fuzzy PackPrize links.
7. **Final audit:** Re-run `node scripts/audit_live_db_missing_gaps.js`; expected remaining issues should be only classified `source_image_gap`, `source_metadata_gap`, `product_lane_absent`, `demo_fixture_gap`, or `licensing_or_policy_gate`. Any remaining `remediable_db_gap` is a blocker unless intentionally deferred with written approval.

---

## Verification commands

Run root monorepo lint from `/home/yeqiuqiu/oripa_saas` unless the change is proven API-only; run targeted API scripts from `apps/api`. Some package scripts below are deliverables of this plan and must be added to `apps/api/package.json` before they are used in CI.

```bash
cd /home/yeqiuqiu/oripa_saas
npm run lint
cd /home/yeqiuqiu/oripa_saas/apps/api
npm run test:catalog:live-db-remediation
npm run test:catalog:live-db-audit-classification
npm run test:catalog:source-payload-remediation
npm run test:catalog:sealed-product-remediation
npm run test:catalog:set-image-remediation
npm run test:catalog:search-contract
npm run test:packs:catalog-snapshots
```

Dry-run examples:

```bash
cd /home/yeqiuqiu/oripa_saas
DB_REMEDIATION_DB_ENV=production node scripts/verify-live-db-gap-preflight.js
cd /home/yeqiuqiu/oripa_saas/apps/api
DB_REMEDIATION_DRY_RUN=true DB_REMEDIATION_DB_ENV=production npx tsx scripts/remediate-catalogitem-source-payload.ts
DB_REMEDIATION_DRY_RUN=true DB_REMEDIATION_DB_ENV=production npx tsx scripts/remediate-sealed-product-source-payload.ts
DB_REMEDIATION_DRY_RUN=true DB_REMEDIATION_DB_ENV=production npx tsx scripts/remediate-catalogset-images.ts
```

Production apply requires explicit approval and flags:

```bash
DB_REMEDIATION_DRY_RUN=false DB_REMEDIATION_DB_ENV=production DB_REMEDIATION_ALLOW_LIVE_WRITE=true npm exec -- tsx <script>
```

Final read-only audit:

```bash
cd /home/yeqiuqiu/oripa_saas
node scripts/audit_live_db_missing_gaps.js
```

---

## Rollback / recovery

- Every apply artifact must include primary keys and before/after values for changed rows.
- For JSON metadata/payload backfills, generate a rollback SQL artifact that restores previous null/value state for touched ids.
- For image backfills, rollback sets only fields changed by the script back to prior values.
- For accidental over-broad writes: stop immediately; identify the apply artifact and rollback SQL path printed before mutation; inspect the touched id list; validate rollback SQL target predicates against the apply artifact; execute rollback; re-run `node scripts/verify-live-db-gap-preflight.js`; re-run the read-only audit; report the incident before any retry.

---

## Open questions for Oracle review

1. Is low-trust `CatalogItem.sourcePayload` classification acceptable for legacy rows, or should missing raw payload remain explicitly missing?
2. Should `POKEMON_JAPAN/en` copy from `POKEMON/ja` be treated as source-restored or derivative copy, given the source-item-id mapping?
3. Should set images be a hard launch blocker or classified as source-image polish when item/sealed images are complete?
4. Does the search contract sufficiently prevent source catalog rows from being mistaken for owned inventory/prizeability?
5. Are the PackPrize demo/manual rows correctly treated as non-production fixtures rather than remediated by fuzzy matching?
