# PokemonCard.io Quality Bar for Oripa — Oracle-Reviewed Architecture Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Oripa's catalog/search, pack generator, and paid-pack publish path reach the observable quality bar of `pokemoncard.io`, while preserving Oripa's vendor, inventory, and provably-fair paid draw requirements.

**Architecture:** Treat `pokemoncard.io` as the user-facing quality benchmark for searchable card DB, advanced query syntax, filter panels, deck/pack workflows, and pack simulator UX — not as a schema/API to clone. Oripa keeps a source-backed catalog projection, reconciles live DB schema drift first, adds an indexed ranked search/facet/typeahead layer, then builds audited pack templates that publish into immutable `Pack` + `PackPrize` snapshots with HMAC/provably-fair draw proofs.

**Tech Stack:** Express API, Prisma, PostgreSQL/Render Postgres, `pg_trgm`, source-backed `CatalogItem`, Oripa `Pack`/`PackPrize`/fairness models, Next/vendor UI.

---

## 0. Source artifacts and status

### Prior Oripa artifacts reviewed

- `docs/plans/custom-pack-creator-oracle-review-gpt55pro-20260530.md`
  - Oracle review status: conditional approval with blockers.
  - SHA256: `3c96cdcaa182b8000c7696b3c8d8b4690fca1a16e6855df988950be1bca1c40f`
- `docs/plans/custom-pack-creator-reverse-engineering-proposal-v2-oracle-closed-20260530.md`
  - Revised proposal incorporating Oracle feedback.
  - SHA256: `3c375c48dbca321c929aa215b471c774cb90ec21bee9bd48e42eb5cc253baa8f`
- `docs/plans/oripa-custom-pack-creator-reconciled-proposal-20260530.md`
  - User's reconciled 19-section final proposal.
  - SHA256: `354b3c3539622ea0bb6c52483f920a3a4e3559c507e4a566e34ca1d8e12bbfe3`

### Oracle review status for this plan

Live `oracle` browser execution was attempted with the plan plus all three prior proposal/review artifacts attached, but the local Oracle browser profile had no usable ChatGPT cookies and API preflight reported missing `OPENAI_API_KEY`. Per the Oracle skill fallback rule, this plan was then reviewed through three bounded Oracle-style critique lanes:

1. catalog/search/DB performance;
2. paid-pack correctness/template/inventory/fairness;
3. external `pokemoncard.io` benchmark interpretation and UX gaps.

The patch results are incorporated below and summarized in **Section 14 — Oracle review closure addendum**. Verdict after patching: **CLEAN FOR PLANNING / NOT YET CLEAN FOR IMPLEMENTATION UNTIL P0 LIVE-DB RECONCILIATION RUNS**.

### New benchmark evidence collected from `pokemoncard.io`

Observable public surfaces:

- `/` — homepage with top variants, tournament decks, latest decks, search entry.
- `/card-database` — card DB with advanced syntax and large filter panel.
- `/deckbuilder` — in-page DB search + deck list + format modes.
- `/deck/{slug}-{id}` — deck pages with pricing, legality, view toggles, playtest links.
- `/deck/{id}/playtest` — solo playtest state machine.
- `/pack-sim` — official/custom/all pack simulator with region, quantity, draft/auto-open, booster box modes.
- `/pack/{set}` — set/pack detail pages with card grid and database handoff.
- `/custom-pack-creator` and `/custom-pack-creator/pack/{id}` — authenticated/gated custom pack surfaces. Treat rarity tiers and percentage chances as inferred from reachable page fragments / prior evidence, not as fully reverse-engineered private internals.
- `/tier-list`, `/top`, `/tournaments`, `/article-search`, `/cube` — surrounding fan-site ecosystem surfaces.

Important: no public REST API was verified for `pokemoncard.io`; visible behavior appears server-rendered and URL-query driven. Static filter panels are not proof of a live facet-count API. Do not claim hidden internals, private routes, private DB schema, exact latency targets, or exact RNG implementation.

---

## 1. Product interpretation

The boss's quality bar is not only "custom pack creator". It is:

```text
fast searchable TCG database
+ deep filters/facets
+ advanced query syntax
+ source/card identity preservation
+ high-quality card/set imagery
+ deck/pack workflows built on the same catalog
+ pack simulator/custom pack UX
```

For Oripa, the MVP should be redefined as:

```text
PokemonCard.io-grade catalog/search UX
+ Oripa-grade audited paid-pack publish/freeze/draw correctness
```

That means search/catalog performance and metadata depth are P0, not a nice-to-have. The pack generator becomes credible only when vendors can find/select catalog rows quickly and those selections freeze into immutable paid-pack prize snapshots.

---

## 2. What `pokemoncard.io` visibly does well

### 2.1 Card DB search

Observable syntax from the public card database/help/article surfaces:

```text
name:Pikachu
hp:>=100
types:Lightning
regulation:H
e:Alolan
text:"discard"
supertype:"pokemon"
retreatcost:<=2
subtype:VMAX
(types:Fire OR types:Water)
regulation:G types:Water
```

Observable URL/filter params include:

```text
setname
type
subtype
hp
types
weakness
format
series
pack
artist
regulation
keyword
releasedate
name
```

### 2.2 Facet/filter richness

The public card DB exposes a dense filter panel:

- Card Type: Energy, Pokémon, Trainer.
- Energy/type: Colorless, Darkness, Dragon, Grass, Fairy, Fire, Fighting, Lightning, Metal, Psychic, Water.
- Subtype: ACE SPEC, Ancient, BREAK, Basic, EX, GX, V, VMAX, VSTAR, ex, Tera, Radiant, Prism Star, Ultra Beast, TAG TEAM, etc.
- Format: Standard, Expanded, Unlimited, Pokémon Pocket.
- Regulation mark: None, D, E, F, G, H, I, J.
- Keyword: Ability, Attack, Pokémon Power, Item, Stadium, Supporter, EX/GX/V/VMAX, etc.
- Series and pack/set lists covering the full TCG history.
- Artist list with hundreds of values.

### 2.3 Pack simulator/custom pack behavior

Observable public behavior:

- Official/custom/all pack filters.
- EN/JP/POCKET region filters.
- Quantity and booster-box style modes.
- Draft/open flow and auto-open flow.
- Shareable results.
- Custom packs behind login, with rarity tiers and probability display.
- Pack images and set logos served from `images.pokemoncard.io` style CDN paths.

### 2.4 Deckbuilder ecosystem

`pokemoncard.io` quality also comes from surrounding workflows:

- Search sidebar reused in deckbuilder.
- Deck format modes: TCG, GLC, Pocket.
- Format/card count validation.
- Export/import/share/screenshot actions.
- Test opening hand and playtest.
- TCGPlayer pricing links.
- Tournament/tier/top-card surfaces feeding discovery.

Oripa does not need all of these in the paid-pack MVP, but the architecture should not block them.

---

## 3. Oripa current-state evidence

### 3.0 Live DB/schema drift gate

Oracle-style review flagged a P0 data-loss risk: the live/collaborator DB has catalog search structures that the repo Prisma schema may not fully represent, including `CatalogSet` / `CatalogItem.catalogSetId` style drift observed in prior audit artifacts. Before any Prisma migration or live DB write, reconcile repo schema against the target DB with read-only inspection / `prisma db pull`-style comparison. Do not let Prisma generate a destructive migration that drops live-only catalog columns or indexes.

Current planning assumption:

- existing live `lower(name)` trigram index may already be present on the target DB; verify, do not recreate blindly;
- `lower(searchText)` trigram index is the likely missing bridge index;
- `CatalogSet` / set metadata should be represented explicitly if live DB already has it;
- all migration SQL against managed DB should be concurrent/additive unless a separately-approved maintenance window exists.

### 3.1 Current catalog search route

File: `apps/api/src/modules/catalog/router.ts`

Current endpoint: `GET /v1/catalog/search`

Current waterfall:

1. `name startsWith q`, insensitive.
2. If not enough results, `name contains q`, insensitive, excluding seen IDs.
3. If not enough, `searchText contains q`, insensitive, excluding seen IDs.

Current issues:

- Three sequential Prisma queries can scan/sort three times.
- `mode: "insensitive"` usually maps to `ILIKE`; plain btree indexes do not help substring searches.
- Search response currently selects `sourcePayload: true`, over-fetching cold JSON for autocomplete.
- Only query filters are `q`, `limit`, `type`, and `game`.
- No `language` filter/default.
- No advanced syntax parser.
- No facet endpoint.
- No query-plan evidence proving performance on managed DB.

Good existing pieces:

- `collapseCatalogSearchItems()` exists.
- Search-dedupe prioritizes card-native sources such as `pokemoncard.io` / `onepiecedb.io` above broad feeds like `tcgtracking`.
- Source-backed `CatalogItem` exists.

### 3.2 Current pack/prize path

File: `apps/api/src/modules/packs/router.ts`

Current `buildPrizeRows()` only persists:

```text
label
imageUrl
weight
stock
remainingStock
estimatedValue
```

Critical gaps:

- Does not populate `catalogItemId`.
- Does not populate `catalogSource` / `catalogSourceItemId`.
- Does not populate `catalogSnapshot`.
- Does not freeze set/card/rarity/source metadata.
- Current update path can delete/recreate prize rows; live immutability is not enforced enough for paid pack audit.

### 3.3 Current Prisma schema helpful facts

Existing helpful models/fields:

- `CatalogItem` already has source-backed fields: `source`, `sourceItemId`, `game`, `language`, `name`, set/card fields, images, `searchText`, `sourcePayload`.
- `PackPrize` schema already includes catalog fields, but code does not populate them.
- `DrawFairnessProof` already has `poolSnapshotHash` and `poolSnapshotJson`.
- `DrawFairnessSelection` already stores HMAC selection details.

Missing required models/fields:

- `Pack.poolSnapshotHash`, template source/version fields, publish metadata.
- `VendorInventoryItem`.
- `PackPrizeInventoryAllocation`.
- `CatalogPackTemplate`, `CatalogPackSlotRule`.
- `VendorPackTemplate`, `VendorPackTemplateVersion`, `VendorPackSlotRule`, `VendorPackSlotItem`.
- `VendorCustomItem`.

---

## 4. Non-goals and guardrails

### Non-goals

- Do not clone or scrape hidden `pokemoncard.io` internals.
- Do not depend on private Cloudflare/authenticated creator routes.
- Do not copy their database schema.
- Do not copy their simulator RNG for paid Oripa draws.
- Do not claim exact pull-rate rules unless source evidence exists.
- Do not make global vendor custom items searchable by default.
- Do not let live paid packs silently refresh from upstream catalog/template rows.

### Hard Oripa guardrails

- Draft/template rows may refresh.
- Live `Pack` + `PackPrize` rows are immutable frozen snapshots.
- Paid draws use Oripa's existing HMAC/provably-fair draw engine.
- JSON slot filters are draft-time/query convenience only; prize-critical publish output uses normalized explicit rows/snapshots.
- Cross-vendor item references are rejected server-side.
- Source priority is configurable policy, not canonical truth.
- Live DB migrations/writes require explicit approval and read-only evidence first.

---

## 5. Target architecture

```text
External card DB sources
  -> Source fetchers/normalizers
  -> CatalogItem projection rows
  -> Search projection/indexes/facets
  -> Catalog browser/search API
  -> Vendor pack studio selection
  -> Draft/vendor pack templates
  -> Publish/freeze service
  -> Pack + immutable PackPrize snapshots
  -> poolSnapshotHash + DrawFairnessProof
  -> HMAC/provably-fair paid draws
```

### 5.1 Catalog projection responsibility

`CatalogItem` answers:

> What external card/product can a vendor/admin search for and select?

It does not own:

- physical vendor stock,
- pack odds,
- entitlement,
- shipped inventory,
- immutable paid-pack display truth,
- pricing truth beyond optional projected estimates.

### 5.2 Search projection responsibility

Search must answer:

> Can a vendor/admin quickly find the right card/product using human terms, structured filters, or source IDs?

Search should be fast, ranked, deduped, and lightweight.

### 5.3 Pack template responsibility

Templates answer:

> What recipe/slot rules should generate a candidate prize pool?

Templates are not paid odds truth. Paid odds truth begins at publish/freeze.

### 5.4 Live pack responsibility

Live `Pack` + `PackPrize` snapshots answer:

> Exactly what frozen prize pool did customers buy/open against?

This is what fairness proofs and support/audit must reference.

---

## 6. Data model plan

### 6.1 Add search-support fields/indexes before over-modeling

Keep `CatalogItem` as projection row, but ensure it supports search/facets:

```prisma
model CatalogItem {
  id             String   @id @default(cuid())
  source         String
  sourceItemId   String
  itemType       CatalogItemType
  game           String
  language       String   @default("en")
  name           String
  setId          String?
  setName        String?
  localId        String?
  cardNumber     String?
  rarity         String?
  imageBaseUrl   String?
  imageThumbUrl  String?
  imageLargeUrl  String?
  searchText     String
  sourcePayload  Json?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([source, sourceItemId, language])
  @@index([itemType, game, isActive])
  @@index([source, isActive])
  @@index([game, language, isActive])
  @@index([setId])
  @@index([name])
}
```

Potential future fields if source payload supports them cleanly:

```text
artist
series
formatLegalities
regulationMark
supertype
subtypes
types
hp
retreatCost
rulesText
weaknesses
releaseDate
```

Do not block MVP on perfect modeling. Store raw source payload cold, expose useful facets via normalized columns when product needs them.

### 6.2 Move heavy source payload off hot path if necessary

If `sourcePayload` dominates table/TOAST size, add:

```prisma
model CatalogItemPayload {
  catalogItemId String @id
  sourcePayload Json
  updatedAt     DateTime @updatedAt

  catalogItem CatalogItem @relation(fields: [catalogItemId], references: [id], onDelete: Cascade)
}
```

Then keep `CatalogItem` hot/searchable and payload cold/admin-only.

### 6.3 Add Pack fields

Add to `Pack`:

```prisma
sourceTemplateType       PackSourceTemplateType @default(MANUAL)
sourceTemplateId         String?
sourceTemplateVersionId  String?
poolSnapshotHash         String?
poolSnapshotVersion      Int @default(1)
publishedFromTemplateAt  DateTime?
publishedByUserId        String?
publishIdempotencyKey    String?
```

Enums:

```prisma
enum PackSourceTemplateType {
  CATALOG_TEMPLATE
  VENDOR_TEMPLATE
  MANUAL
  LEGACY
}
```

### 6.4 Ensure PackPrize stores immutable snapshots

`PackPrize` must be populated from catalog/vendor/custom/inventory source and must never depend on mutable catalog rows for historical display.

Required stored fields:

```text
catalogItemId?
catalogSource?
catalogSourceItemId?
catalogSnapshot?
vendorInventoryItemId?
vendorCustomItemId?
labelSnapshot / existing label
imageUrlSnapshot / existing imageUrl
itemClassSnapshot
gameSnapshot
sourceSnapshot
sourceItemIdSnapshot
setIdSnapshot
setNameSnapshot
localIdSnapshot
cardNumberSnapshot
raritySnapshot
estimatedValue
currency/valueSource/asOf extension points
weight
stock
remainingStock
```

If schema names differ, preserve existing fields and add minimal nullable snapshot columns.

### 6.5 Add vendor inventory and allocation

```prisma
model VendorInventoryItem {
  id             String @id @default(cuid())
  vendorId       String
  catalogItemId  String?
  customItemId   String?
  title          String
  condition      String?
  gradeCompany   String?
  grade          String?
  certNumber     String?
  imageUrl       String?
  quantityTotal  Int
  quantityHeld   Int @default(0)
  quantitySold   Int @default(0)
  status         VendorInventoryStatus @default(ACTIVE)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model PackPrizeInventoryAllocation {
  id                    String @id @default(cuid())
  vendorId              String
  packId                String
  packPrizeId           String
  vendorInventoryItemId String
  quantityAllocated     Int
  createdAt             DateTime @default(now())

  @@unique([packPrizeId, vendorInventoryItemId])
  @@index([vendorId, vendorInventoryItemId])
}
```

### 6.6 Add template layer after P0 freeze is safe

```prisma
model CatalogPackTemplate
model CatalogPackSlotRule
model VendorPackTemplate
model VendorPackTemplateVersion
model VendorPackSlotRule
model VendorPackSlotItem
model VendorCustomItem
```

Template rules can use JSON filters only for draft preview. Publish must resolve them into explicit normalized snapshot/prize rows.

---

## 7. API plan

### 7.1 Search API v1.1

Replace/extend:

```http
GET /v1/catalog/search
```

Query params:

```text
q
limit
cursor/offset
game
language
itemType/type
source
setId
setName
rarity
localId/cardNumber
artist
series
regulationMark
format
```

Simple advanced syntax parser:

```text
name:pikachu
set:base
number:25
rarity:rare
source:pokemoncard.io
game:pokemon
artist:kagemaru
text:"discard"
-regulation:D or e:alolan
```

MVP syntax support:

- `field:value`
- quoted values
- space-separated AND
- `e:value` / `-term` exclusion only against `searchText`
- defer nested OR/parens until grammar is stable

Response must exclude `sourcePayload` by default:

```json
{
  "items": [
    {
      "id": "...",
      "source": "pokemoncard.io",
      "sourceItemId": "sv10-136",
      "itemType": "CARD",
      "game": "POKEMON",
      "language": "en",
      "name": "Marnie's Grimmsnarl ex",
      "setId": "sv10",
      "setName": "...",
      "localId": "136",
      "cardNumber": "136",
      "rarity": "...",
      "imageThumbUrl": "...",
      "imageLargeUrl": "...",
      "mergedSources": ["tcgtracking:..."]
    }
  ],
  "nextCursor": null
}
```

### 7.2 Facet API

```http
GET /v1/catalog/facets?game=POKEMON&language=en&type=card
```

Return counts for:

```text
sources
sets
rarities
itemTypes
languages
artists
series
regulationMarks
formats
```

Start with source/set/rarity/itemType/language; add richer facets when normalized fields exist.

### 7.3 Catalog item detail API

```http
GET /v1/catalog/items/:id
```

This can include `sourcePayload` for admin/vendor detail panels, not autocomplete.

### 7.4 Pack prize creation/update

Update shared schema and pack route so vendor selections persist catalog identity:

```json
{
  "catalogItemId": "...",
  "catalogSource": "pokemoncard.io",
  "catalogSourceItemId": "sv10-136",
  "catalogSnapshot": { "name": "...", "setId": "...", "rarity": "..." },
  "label": "Marnie's Grimmsnarl ex",
  "imageUrl": "...",
  "estimatedValue": 12.34,
  "weight": 100,
  "stock": 1
}
```

Server must rebuild/validate snapshot from `CatalogItem` when `catalogItemId` is present. Client-supplied snapshot is advisory only unless importing legacy/manual rows.

### 7.5 Publish/freeze API

```http
POST /v1/vendor/packs/:packId/publish-freeze
Idempotency-Key: ...
```

Responsibilities:

- verify vendor access;
- reject if pack is already live/frozen unless idempotency matches;
- validate every prize row has either catalog, vendor custom, inventory, or manual snapshot source;
- reserve inventory allocations;
- compute deterministic `poolSnapshotJson` and `poolSnapshotHash`;
- create/update `DrawFairnessProof` seed record as appropriate;
- set `Pack.status = LIVE`;
- persist publish metadata;
- prevent later destructive prize mutation.

### 7.6 Template APIs after freeze foundation

```http
POST /v1/vendor/pack-templates
GET /v1/vendor/pack-templates
GET /v1/vendor/pack-templates/:id
PATCH /v1/vendor/pack-templates/:id
POST /v1/vendor/pack-templates/:id/versions
POST /v1/vendor/pack-templates/:id/preview
POST /v1/vendor/pack-templates/:id/validate
POST /v1/vendor/pack-templates/:id/publish-to-pack
```

---

## 8. Search/index implementation plan

### 8.1 Read-only DB audit first

Before migrations on managed DB, collect:

```sql
SELECT "game", "language", "itemType", "isActive", COUNT(*)
FROM "CatalogItem"
GROUP BY 1,2,3,4
ORDER BY COUNT(*) DESC;

SELECT
  pg_size_pretty(pg_relation_size('"CatalogItem"')) AS heap,
  pg_size_pretty(pg_indexes_size('"CatalogItem"')) AS indexes,
  pg_size_pretty(pg_total_relation_size('"CatalogItem"')) AS total;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'CatalogItem'
ORDER BY indexname;

SELECT extname FROM pg_extension ORDER BY extname;
```

Then run `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for representative terms:

```text
pikachu
charizard
marnie
sv10
136
zzzz-no-result
```

### 8.2 Add trigram indexes for substring search

Use concurrent migrations/manual SQL for live DB:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_name_trgm_active_idx"
ON "CatalogItem" USING gin (lower("name") gin_trgm_ops)
WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_searchText_trgm_active_idx"
ON "CatalogItem" USING gin (lower("searchText") gin_trgm_ops)
WHERE "isActive" = true;
```

Add exact/prefix support:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_game_lang_type_active_idx"
ON "CatalogItem" ("game", "language", "itemType", "isActive");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_source_sourceItem_lang_idx"
ON "CatalogItem" ("source", "sourceItemId", "language");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_setId_active_idx"
ON "CatalogItem" ("setId") WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_localId_active_idx"
ON "CatalogItem" ("localId") WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CatalogItem_cardNumber_active_idx"
ON "CatalogItem" ("cardNumber") WHERE "isActive" = true;
```

### 8.3 Replace waterfall with ranked SQL

One raw query should rank buckets:

```sql
WITH params AS (...)
SELECT ...,
  CASE
    WHEN lower("sourceItemId") = lower($q) THEN 0
    WHEN lower("localId") = lower($q) THEN 1
    WHEN lower("cardNumber") = lower($q) THEN 1
    WHEN lower("name") = lower($q) THEN 2
    WHEN lower("name") LIKE lower($q) || '%' THEN 3
    WHEN lower("name") LIKE '%' || lower($q) || '%' THEN 4
    WHEN lower("searchText") LIKE '%' || lower($q) || '%' THEN 5
    ELSE 99
  END AS rank
FROM "CatalogItem"
WHERE "isActive" = true
  AND "game" = $game
  AND "language" = $language
  AND ...structured filters...
ORDER BY rank ASC, "name" ASC, "source" ASC
LIMIT $limitPlusDedupe;
```

Then apply existing collapse/dedupe in TypeScript.

### 8.4 Search performance acceptance

For managed DB target:

- First collect current Oripa and benchmark-page measurements; do not claim `pokemoncard.io` itself has a verified 250ms backend.
- Oripa target after indexing: common autocomplete searches feel instant under normal vendor usage, with measured p95 targets set from the target DB/environment.
- No-result searches must be explicitly measured; they should not trigger multi-second broad scans.
- Search response excludes `sourcePayload`.
- `EXPLAIN` proves trigram/index usage or bounded scans for common/no-result terms.

---

## 9. UI plan

### 9.1 Vendor catalog search component

Required UX:

- URL-backed query/filter state; filters must narrow/refine the current query rather than replace it.
- Search input supporting pokemoncard-style syntax hints.
- Debounced typeahead/suggest endpoint for lightweight `name + thumb + set + source` results.
- Facet side panel: source, set, rarity, item type, language; ship static/simple counts first before expensive live high-cardinality facets.
- Result cards with image, source badge, set, number, rarity, merged-source indicator.
- Detail drawer for payload/source metadata.
- Add-to-pack action preserving `catalogItemId`.

### 9.2 Pack builder MVP

Required UX:

- Draft pack editor with selected prize rows.
- Add catalog item.
- Add manual/custom item.
- Quantity/stock/weight/value editor.
- Validation panel.
- Publish/freeze button with explicit warning.
- Frozen live pack view showing immutable snapshots and hash.

### 9.3 Pokemoncard-like later UX

Defer until P0/P1 foundations pass:

- Full card DB public browsing.
- Pack simulator draft animations.
- Booster-box mode.
- Deckbuilder/playtest.
- Tournament/tier/top-card surfaces.

---

## 10. Phased implementation board

## P0 — Search and paid-pack safety foundation

### Task P0.1: Read-only search/DB audit

**Objective:** Prove current managed DB row counts, indexes, table size, and query plans before touching schema.

**Files:**
- Create: `apps/api/scripts/audit-catalog-search.ts` or `docs/plans/catalog-search-audit-20260530.md`

**Steps:**
1. Add/read-only SQL audit script.
2. Run against local/staging/collaborator DB explicitly.
3. Save row counts, indexes, extension list, and EXPLAIN JSON.
4. Report DB scope clearly.

**Acceptance:** Evidence packet exists and names the exact DB target.

### Task P0.2: Remove heavy payload from search results

**Files:**
- Modify: `apps/api/src/modules/catalog/router.ts`

**Steps:**
1. Remove `sourcePayload: true` from `catalogSearchSelect`.
2. Add item detail endpoint or admin flag for payload if needed.
3. Verify typecheck/build.

**Acceptance:** `/v1/catalog/search` no longer returns `sourcePayload`.

### Task P0.3: Add language and structured filters

**Files:**
- Modify: `apps/api/src/modules/catalog/router.ts`

**Steps:**
1. Add `language` default `en`.
2. Add optional `source`, `setId`, `setName`, `rarity`, `localId`, `cardNumber`.
3. Add validation tests or script smoke coverage.

**Acceptance:** Filters are server-side and reflected in query behavior.

### Task P0.4: Add trigram/search indexes

**Files:**
- Create/modify: Prisma migration SQL or `apps/api/prisma/sql/catalog-search-indexes.sql` depending repo migration convention.

**Steps:**
1. Add `pg_trgm` extension.
2. Add concurrent GIN trigram indexes on `lower(name)` and `lower(searchText)` for active rows.
3. Add btree indexes for exact source/set/number filters.
4. Run EXPLAIN before/after.

**Acceptance:** Query plans improve and migration is safe for managed DB.

### Task P0.5: Replace search waterfall with ranked SQL

**Objective:** Remove the three sequential Prisma `ILIKE` waterfall from `apps/api/src/modules/catalog/router.ts` and use one ranked query whose predicates match the actual Postgres expression indexes.

**Files:**
- Modify: `apps/api/src/modules/catalog/router.ts`
- Create: `apps/api/src/modules/catalog/search-query.ts` if useful

**Acceptance:** Representative terms and no-result terms no longer take multi-second scans; existing search-dedupe still runs after candidate retrieval.

### Task P0.6: Persist catalog identity into PackPrize

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/modules/packs/router.ts`

**Steps:**
1. Extend prize schema with catalog refs and snapshot-capable fields.
2. In `buildPrizeRows()`, when `catalogItemId` is provided, fetch the catalog row server-side.
3. Write immutable snapshot fields into `PackPrize`.
4. Preserve manual prize support.

**Acceptance:** Catalog-backed pack prize rows preserve source identity and snapshot.

### Task P0.7: Publish/freeze and pool hash

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `apps/api/src/modules/packs/router.ts` or new `publish.ts`

**Steps:**
1. Add Pack publish/freeze fields.
2. Implement deterministic pool snapshot canonicalization.
3. Compute SHA256 `poolSnapshotHash`.
4. Link to/align with `DrawFairnessProof`.
5. Reject prize mutations for frozen/live packs.

**Acceptance:** A live pack has a deterministic pool hash and immutable prize pool.

## P1 — Pokemoncard-style search UX and pack template MVP

### Task P1.1: Advanced query parser MVP

**Files:**
- Create: `apps/api/src/modules/catalog/query-parser.ts`
- Test: script or unit tests for parser.

**Syntax:**
- `field:value`
- quoted string values
- whitespace AND
- `e:value` / `-term` exclusion

**Acceptance:** Parser produces structured filters for search SQL.

### Task P1.2: Single ranked SQL search

**Files:**
- Modify: `apps/api/src/modules/catalog/router.ts`
- Create: `apps/api/src/modules/catalog/search-query.ts`

**Acceptance:** One DB query returns ranked candidates; dedupe still applies.

### Task P1.3: Facets endpoint

**Files:**
- Modify/create: catalog router/service.

**Acceptance:** UI can render source/set/rarity/language/itemType filters with counts.

### Task P1.4: VendorCustomItem and inventory models

**Acceptance:** Vendor can add slabs/manual prizes without polluting global catalog.

### Task P1.5: Template table MVP

**Acceptance:** Vendors can save draft pack templates and create immutable versions.

### Task P1.6: Template publish-to-pack

**Acceptance:** Template rules resolve into frozen `PackPrize` rows and `poolSnapshotHash`.

## P2 — Ecosystem polish

- Public catalog browsing pages.
- Pack simulator UX/animations.
- Booster-box mode.
- Official source-backed pack templates.
- Deckbuilder/opening-hand features.
- Tournament/meta/top-card surfaces.
- Admin source-governance/diff tools.

---

## 11. Verification plan

### Code verification

Run focused checks after each slice:

```bash
pnpm --filter @oripa/shared build
pnpm --filter @oripa/api build
pnpm --filter @oripa/web build
```

If repo uses different package names, inspect `package.json` first and adapt commands.

### DB verification

Before/after each DB performance change:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT ... representative search ...;
```

### API smoke verification

Use authenticated vendor request if available:

```bash
curl '/v1/catalog/search?q=pikachu&game=POKEMON&language=en&type=card&limit=10'
curl '/v1/catalog/facets?game=POKEMON&language=en&type=card'
```

### Pack publish verification

- Create manual prize pack.
- Create catalog-backed prize pack.
- Publish/freeze pack.
- Verify `poolSnapshotHash` stable across repeated reads.
- Attempt live prize mutation and confirm rejection.
- Run draw and verify fairness proof references frozen pool.

---

## 12. Open questions for implementation, not for architecture

1. Which DB target is the first performance target: local, staging/collaborator, or production?
2. Is `pokemoncard.io` the display-priority source only for Pokémon, while `onepiecedb.io` is display-priority for One Piece? Current answer should be yes, as configurable policy.
3. Do we have legal approval to cache/proxy card images, or only hotlink/source URLs for MVP?
4. Are public catalog pages part of first MVP, or only vendor/admin catalog search?
5. Should pack templates launch before inventory allocation, or is physical inventory allocation required for all paid packs? Current recommendation: inventory allocation before serious paid physical packs.

---

## 13. Architecture conclusion

To reach `pokemoncard.io` quality, Oripa should not start by building a pretty custom-pack screen. It should first make the catalog DB feel like a real card database:

```text
indexed search
+ advanced query syntax
+ facets
+ source-backed dedupe
+ fast image-rich results
```

Then Oripa adds what `pokemoncard.io` does not need to guarantee for paid marketplace draws:

```text
vendor ownership
+ inventory allocation
+ immutable PackPrize snapshots
+ poolSnapshotHash
+ HMAC/provably-fair draw ledger
```

That combination is the correct MVP: `pokemoncard.io`-grade discovery and builder UX, with Oripa-grade auditability and paid-pack correctness.

---

## 14. Oracle review closure addendum

### 14.1 Live Oracle execution note

Command attempted:

```bash
CHROME_PATH=/usr/bin/brave-browser oracle-shadow-run oracle --engine browser --model "gpt-5.5-pro" ...
```

Result: failed before model submission because no ChatGPT cookies were available in the selected Oracle browser profile. API preflight also reported missing `OPENAI_API_KEY`. This is a tooling/session blocker, not an architecture result. A bounded Oracle-style fallback review was run instead using three independent critique lanes.

### 14.2 P0 blockers accepted into the plan

1. **Live schema drift gate:** reconcile Prisma with live DB before migrations; specifically watch `CatalogSet` / `CatalogItem.catalogSetId` and already-existing indexes.
2. **Search waterfall is P0, not P1:** current multi-query Prisma `ILIKE` path can be multi-second; replace with ranked SQL matching expression/trigram indexes.
3. **`sourcePayload` must leave search responses:** autocomplete/search should be lightweight; payload belongs in detail/admin path or cold payload table.
4. **Language and structured filters are P0:** `language`, `source`, `setId`, `setName`, `rarity`, `localId`, `cardNumber` are required for pokemoncard-style search quality.
5. **`PackPrize` catalog identity persistence is P0:** shared schemas and `buildPrizeRows()` must carry/fetch `catalogItemId`, source refs, and immutable snapshots.
6. **Live pack immutability is P0:** PATCH must reject prize mutation for `LIVE`/`ARCHIVED` packs.
7. **Publish/freeze endpoint is P0:** create deterministic `poolSnapshotHash`, idempotent publish metadata, and freeze boundary before any paid pack launch.
8. **Draw-time pool integrity check is P0:** draw handler should verify current prize rows hash to `Pack.poolSnapshotHash` before HMAC selection.
9. **Inventory allocation is P0 for physical paid packs:** add vendor inventory and allocation/reservation before physical stock packs go live.

### 14.3 Benchmark overclaim corrections

- Do not claim `pokemoncard.io` has verified 250ms backend latency; Oripa must measure its own target DB and set p95 from evidence.
- Do not claim private custom-pack internals are fully observed; authenticated creator behavior is gated/inferred.
- Do not confuse static server-rendered filter lists with a live facet-count API; Oripa can ship simpler facets first.
- Do not let the full deckbuilder/tournament/tier ecosystem block paid-pack MVP; those are P2 ecosystem surfaces.

### 14.4 Final implementation order after Oracle-style review

```text
0. Reconcile live DB schema/index reality with Prisma; no destructive migrations.
1. Fix catalog search hot path: no sourcePayload, language/structured filters, ranked SQL, missing searchText trigram index.
2. Preserve catalog identity into PackPrize from vendor pack create/update.
3. Add live pack immutability guards.
4. Add publish/freeze + Pack.poolSnapshotHash + deterministic canonical pool JSON.
5. Make draw handler verify Pack.poolSnapshotHash before HMAC selection.
6. Add inventory allocation for physical packs.
7. Add facets/typeahead/vendor search UI.
8. Add template/version/slot models and publish-to-pack.
9. Add pokemoncard-like public browse/pack simulator/deckbuilder ecosystem surfaces.
```

### 14.5 Final verdict

**CLEAN FOR PLANNING:** the architecture direction is now correct and incorporates the two previous proposals plus the new `pokemoncard.io` quality-bar findings.

**NOT CLEAN FOR IMPLEMENTATION WITHOUT GATE 0:** the first engineering step must be read-only live DB/Prisma reconciliation. Skipping that can cause data loss or misleading migration plans.
