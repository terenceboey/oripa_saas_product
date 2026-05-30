According to a document from May 30, 2026, the evidence packet shows a catalog that is already large enough for current search paths to fail user-facing latency expectations, but still early enough in pack/prize volume to fix prize correctness non-destructively. Primary evidence packet:

# 1. Executive recommendation

**Recommendation:** keep `CatalogItem` as the compatibility bridge for the current system, but move Oripa toward a layered architecture:

1. **Canonical catalog core** for global item identity, normalized item type, game, language, set linkage, display fields, lifecycle status, and source provenance.
2. **Type-specific extension tables** for raw cards, slabs, sealed products, sets, vendor custom items, accessories, and future collectibles.
3. **A narrow `CatalogSearchDocument` projection** optimized for autocomplete/search, instead of searching the wide canonical catalog table directly.
4. **Immutable `PackPrize` snapshots** that copy the prize identity/display/value/source metadata at pack creation or publish time, so existing pack odds, value, and display do not silently change when catalog imports change.
5. **A vendor inventory/listing layer** that separates “what the object is” from “what this vendor is offering as a prize.”

**Immediate priority order:**

| Priority | Action                                                                            | Why                                                                                                                                        |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | Reconcile Prisma schema with live DB drift non-destructively                      | Live DB has `CatalogSet` and `catalogSetId`; repo Prisma did not define them at investigation time.                                        |
| P0       | Fix catalog search query shape and add missing search indexes                     | Current autocomplete paths were measured in multi-second execution times.                                                                  |
| P0       | Add nullable catalog identity + immutable snapshot fields to `PackPrize`          | Current prize rows copy label/image/value only and have no catalog reference or source snapshot.                                           |
| P1       | Introduce canonical/provenance/type-specific catalog model beside existing tables | Current `CatalogItem` is card-shaped while product scope includes slabs, sealed, sets, custom items, accessories, and future collectibles. |
| P1       | Introduce vendor inventory/listing layer                                          | Vendors need to prize catalog-backed items, custom items, and eventually individual inventory lots.                                        |

This should be done as an **additive migration path**, not by dropping or rewriting existing catalog/prize data.

# 2. Evidence-backed current-state summary

## Confirmed evidence

The evidence packet states that Oripa is a digital pack-opening platform where vendors search prize-eligible catalog items and add them into packs as prizes. It also states that the catalog scope is broader than raw cards: raw cards, graded/slabbed cards, sealed products, sets, custom/vendor-created items, accessories/future collectibles, and multiple games are in scope. The core invariant is that pack prizes need historical correctness: odds, value, and display should not silently mutate when upstream catalog data changes.

Current repo `CatalogItem` is a single table with common fields such as `source`, `sourceItemId`, `itemType`, `game`, `language`, `name`, set/card fields, image fields, `searchText`, `sourcePayload`, and `isActive`. The repo enum has at least `CARD` and `SEALED_PRODUCT`.

The live DB has schema drift from the repo: live `CatalogItem` has a nullable `catalogSetId` column, a foreign key to `CatalogSet`, and a live `CatalogSet` table, while the repo Prisma schema did not define `CatalogSet` or `catalogSetId` at investigation time.

The current search endpoint can do up to three sequential DB queries: case-insensitive `name startsWith`, then case-insensitive `name contains`, then case-insensitive `searchText contains`. The endpoint returns a narrow field set and excludes `sourcePayload`.

The live DB has **220,905 active `CatalogItem` rows**, all currently `CARD`, all from `tcgtracking`, across 10 games. `CatalogSet` has 662 rows, only for `POKEMON` and `POKEMON_JAPAN`; 58,732 catalog items have `catalogSetId`, while 162,173 do not.

Current prize creation stores copied fields only: `label`, `imageUrl`, `estimatedValue`, `weight`, `stock`, and `remainingStock`. The pack creation schemas do not require a canonical catalog ID, and the vendor UI copies catalog suggestion label/image into local draft state without persisting `catalogItemId`.

Search performance evidence is severe: a Prisma-equivalent prefix name search for `char%` took **5164.624 ms**, a contains search took **2305.560 ms**, `searchText ILIKE '%char%'` took **2141.354 ms**, and `sourceItemId ILIKE '123%'` took **2888.821 ms**. A rewritten `lower(name) LIKE '%char%'` shape used the existing trigram index and ran in **405.730 ms**, proving the index can help but the current Prisma case-insensitive query shape does not use it.

## Design interpretation

The current system has three separate problems that should not be conflated:

1. **Search latency problem:** current query shapes do not use the available trigram index effectively and search directly against a wide canonical table.
2. **Catalog modeling problem:** the current item model is card-shaped and source-shaped, not collectible-shaped.
3. **Pack correctness problem:** prizes need immutable historical snapshots, not live joins to mutable catalog rows.

# 3. Final target architecture

## Recommended target layers

```text
External Sources
  └── CatalogImportRun
      └── CatalogExternalRef / SourcePayload / Provenance
          └── Canonical CatalogItem
              ├── CatalogCard
              ├── CatalogGradedCardTemplate
              ├── CatalogSealedProduct
              ├── CatalogSet
              ├── CatalogAccessory
              └── CatalogCollectibleExtension / future type tables

Canonical Catalog
  └── CatalogSearchDocument
      └── /v1/catalog/search

Vendor Domain
  ├── VendorInventoryItem
  ├── VendorListing / VendorPrizeCandidate
  └── VendorCustomItem

Pack Domain
  ├── Pack
  ├── PackPrize
  │   ├── optional catalogItemId / vendorInventoryItemId
  │   ├── immutable prize snapshot fields
  │   └── source provenance snapshot
  └── PackPrizeDrawLedger / inventory consumption events
```

## Confirmed evidence this addresses

The packet’s explicit current risks are: Prisma schema drift, multi-second autocomplete paths, missing canonical catalog identity/snapshot on `PackPrize`, and a card-shaped `CatalogItem` despite a broader product scope.

## Design recommendation

Do **not** solve this by adding every future collectible field to `CatalogItem`. That will make the canonical table wider, searches slower, and migrations riskier. Instead:

* `CatalogItem` or its successor should store **stable identity and common display fields**.
* Source-specific raw data should live in **provenance/external reference tables**.
* Item-type-specific attributes should live in **extension tables**.
* Search should read from a **narrow denormalized projection**.
* Pack prizes should store **immutable snapshots** and treat live catalog references as optional provenance, not as display/value truth.

# 4. Canonical global catalog model

## Confirmed evidence

Current `CatalogItem` has `source`, `sourceItemId`, `itemType`, `game`, `language`, `name`, set/card fields, image URLs, `searchText`, `sourcePayload`, and lifecycle timestamps. It has a unique constraint on `(source, sourceItemId, language)` and indexes on item type/game/activity, source/activity, game/language/activity, set, and name.

Current source and game values are raw strings, and the evidence packet calls this out as a P1 risk.

## Design recommendation

Use a **canonical global item model** with stable Oripa-owned identity and external-source provenance separated.

### Core canonical tables

#### `CatalogGame`

Purpose: normalize game/category identity instead of relying only on raw strings.

Recommended fields:

```text
id
code                    -- POKEMON, YUGIOH, ONE_PIECE, etc.
displayName
isActive
sortOrder
createdAt
updatedAt
```

Keep current string `game` fields during migration, but introduce `gameId` or normalized `gameCode` as the long-term API/storage contract.

#### `CatalogSource`

Purpose: represent upstream data sources and vendor/custom origins.

```text
id
key                     -- tcgtracking, vendor_custom, future source
displayName
trustTier
isActive
createdAt
updatedAt
```

#### `CatalogImportRun`

Purpose: make source ingestion auditable.

```text
id
sourceId
startedAt
completedAt
status
sourceCursor
recordsSeen
recordsInserted
recordsUpdated
recordsDeactivated
importVersion
notes
```

#### `CatalogItem`

Purpose: stable Oripa canonical identity.

```text
id
itemType                -- CARD, GRADED_CARD, SEALED_PRODUCT, SET, ACCESSORY, CUSTOM, OTHER
gameId / gameCode
language
canonicalName
displayName
subtitle
catalogSetId nullable
primaryImageUrl
thumbnailImageUrl
largeImageUrl
isPrizeEligible
isSearchable
status                  -- ACTIVE, INACTIVE, MERGED, NEEDS_REVIEW
createdAt
updatedAt
```

Keep existing `CatalogItem` during migration. The long-term model can either evolve the current table or introduce a new `CatalogItemV2`; the safer path is additive: add compatible normalized fields first, introduce projections, then migrate reads.

#### `CatalogExternalRef`

Purpose: source provenance and source identity, replacing the assumption that a catalog item has exactly one source identity.

```text
id
catalogItemId
sourceId
sourceItemId
sourceLanguage
sourceUrl nullable
sourcePayload jsonb nullable
sourcePayloadHash
sourceUpdatedAt nullable
importRunId
isPrimary
isActive
createdAt
updatedAt

unique(sourceId, sourceItemId, sourceLanguage)
index(catalogItemId)
index(sourceId, isActive)
```

This preserves the current unique `(source, sourceItemId, language)` semantics while allowing multiple sources per canonical item later.

#### `CatalogAlias`

Purpose: names, alternate numbers, abbreviations, source titles, localized names.

```text
id
catalogItemId
aliasType               -- NAME, NUMBER, SET_CODE, SOURCE_NAME, LOCALIZED_NAME
value
normalizedValue
language nullable
sourceId nullable
isSearchable
createdAt
```

#### `CatalogImage`

Purpose: support multiple images, source images, graded/slab images, sealed front/back images.

```text
id
catalogItemId
imageType               -- THUMB, LARGE, FRONT, BACK, LOGO, SYMBOL, BANNER
url
sourceId nullable
width nullable
height nullable
isPrimary
createdAt
```

### Why this is the right long-term shape

* It supports multiple sources without losing source provenance.
* It avoids stuffing slab/sealed/accessory fields into a card-shaped table.
* It lets search read from a small projection rather than a payload-heavy canonical row.
* It lets pack prizes reference a canonical item while still snapshotting historical truth.

# 5. Type-specific model strategy

## Confirmed evidence

The current normalizer builds `CatalogItemProjection` rows, sets `itemType: CatalogItemType.CARD`, preserves `sourcePayload`, and has a `hasCardShape()` function for card-like products only. Approved game/category mapping includes many games, but live rows are currently all `CARD`.

## Design recommendation

Use a **table-per-mature-type** strategy plus a small extensibility escape hatch.

### A. Raw single cards

Use `CatalogCard` for card-specific fields.

```text
CatalogCard
  catalogItemId primary key / FK
  catalogSetId nullable
  setNameSnapshot nullable
  localId nullable
  cardNumber nullable
  rarity nullable
  printing nullable
  finish nullable
  regulationMark nullable
  artist nullable
  evolvesFrom nullable
```

Notes:

* Keep `setNameSnapshot` only as denormalized display fallback; prefer `catalogSetId` when available.
* Current `cardNumber` and `rarity` null rates mean these fields must remain nullable.
* Do not assume every source row can be fully normalized on day one.

### B. Graded/slabbed cards

Slabs need two distinct concepts:

1. **Generic slab template:** “Charizard, PSA 10” as a searchable prize candidate.
2. **Individual certified slab:** a vendor-owned item with cert number, purchase cost, and condition details.

Recommended split:

```text
CatalogGradedCardTemplate
  catalogItemId primary key / FK
  rawCardCatalogItemId nullable
  grader              -- PSA, CGC, BGS, etc.
  grade
  qualifier nullable
  labelVariant nullable
```

```text
VendorInventoryItem
  id
  vendorId
  catalogItemId nullable
  certNumber nullable
  acquisitionCost nullable
  conditionNotes nullable
  quantity
```

Do **not** put individual slab cert numbers in the global catalog unless Oripa decides certified individual objects are globally tracked assets.

### C. Sealed products

```text
CatalogSealedProduct
  catalogItemId primary key / FK
  productKind          -- BOOSTER_BOX, BOOSTER_PACK, ETB, CASE, TIN, COLLECTION, DECK, OTHER
  catalogSetId nullable
  releaseDate nullable
  msrp nullable
  unitsPerBox nullable
  packsPerBox nullable
  barcode nullable
```

The enum already has at least `SEALED_PRODUCT`, but live data contains no sealed products yet. Treat sealed as a first-class type before importing it at scale.

### D. Sets

The live DB already has `CatalogSet`, but coverage is partial: 662 rows, only two games, and only 58,732 of 220,905 items linked to a set.

Recommended model:

```text
CatalogSet
  id
  sourceId nullable
  sourceSetId nullable
  gameId / gameCode
  setCode nullable
  name
  releaseDate nullable
  productCount nullable
  symbolImageUrl nullable
  logoImageUrl nullable
  bannerImageUrl nullable
  isSupplemental
  searchText
  isActive
  createdAt
  updatedAt
```

For “sets” as **searchable/prizeable products**, create a `CatalogItem` with `itemType = SET` and link it to `CatalogSet`. This avoids confusing a set metadata record with a product/prize record.

### E. Vendor custom items

Vendor custom items should not be forced into global canonical truth immediately.

Use:

```text
VendorCustomItem
  id
  vendorId
  linkedCatalogItemId nullable
  itemType
  gameId / gameCode nullable
  name
  description nullable
  imageUrl nullable
  estimatedValue nullable
  valueCurrency
  valueSource              -- VENDOR_DECLARED, ADMIN_APPROVED, etc.
  moderationStatus
  isSearchableWithinVendor
  createdAt
  updatedAt
```

A vendor custom item can later be promoted or matched to a canonical `CatalogItem`, but promotion should be explicit and audited.

### F. Accessories and future collectibles

Use a two-stage strategy:

1. For low-volume/experimental types, use a generic extension:

```text
CatalogCollectibleExtension
  catalogItemId primary key / FK
  attributes jsonb
  schemaVersion
```

2. When a type becomes high-volume or query-critical, graduate it into a typed table:

```text
CatalogAccessory
CatalogComic
CatalogFigure
CatalogVideoGame
...
```

This preserves extensibility without polluting the core item table or prematurely hard-coding unknown collectible types.

# 6. Vendor inventory/listing layer strategy

## Confirmed evidence

The current vendor UI calls `/v1/catalog/search?q=<query>&limit=8&type=card`; selecting a suggestion copies label and image into local pack draft state and does not persist `catalogItemId` into the pack payload.

## Design recommendation

Introduce a vendor layer because pack prizes are not always pure catalog rows. A vendor may prize:

* A catalog-backed raw card.
* A catalog-backed sealed product.
* A specific graded slab.
* A custom item.
* A bundle or lot.
* An accessory or future collectible.

Recommended model:

```text
VendorInventoryItem
  id
  vendorId
  catalogItemId nullable
  vendorCustomItemId nullable
  inventoryType          -- CATALOG_ITEM, CUSTOM_ITEM, BUNDLE, LOT
  condition
  quantityOnHand
  quantityReserved
  acquisitionCost nullable
  estimatedValue nullable
  valueCurrency
  valueSource
  status                 -- ACTIVE, RESERVED, DEPLETED, ARCHIVED
  metadata jsonb
  createdAt
  updatedAt
```

```text
VendorListing
  id
  vendorId
  vendorInventoryItemId
  title
  imageUrl
  displayValue
  listingStatus
  searchable
  createdAt
  updatedAt
```

Pack creation should eventually select from a **vendor prize candidate**, not only a global catalog suggestion. The catalog tells Oripa what the object is; vendor inventory tells Oripa what the vendor can actually place into a pack.

# 7. PackPrize immutable snapshot strategy

## Confirmed evidence

Current live `PackPrize` columns are `id`, `packId`, `label`, `imageUrl`, `estimatedValue`, `weight`, `stock`, `remainingStock`, `createdAt`, and `updatedAt`; there is no FK/reference from `PackPrize` to `CatalogItem`.

The product invariant says pack prizes need historical correctness: odds, value, and display should not silently mutate when upstream catalog data changes.

## Design recommendation

`PackPrize` must become a **self-contained historical prize definition**.

### Additive fields to `PackPrize`

Keep existing fields. Add nullable fields first:

```text
catalogItemId nullable
vendorInventoryItemId nullable
vendorCustomItemId nullable

catalogSnapshotVersion nullable
catalogSource nullable
catalogSourceItemId nullable
catalogExternalRefId nullable
catalogPayloadHash nullable

snapshotItemType
snapshotGame
snapshotLanguage
snapshotName
snapshotSubtitle nullable
snapshotSetName nullable
snapshotSetId nullable
snapshotCardNumber nullable
snapshotRarity nullable
snapshotImageUrl
snapshotThumbUrl nullable
snapshotLargeImageUrl nullable
snapshotEstimatedValue
snapshotValueCurrency
snapshotValueSource nullable
snapshotValueAsOf nullable
snapshotJson jsonb

createdFromSearchDocumentId nullable
createdFromCatalogUpdatedAt nullable
snapshotCreatedAt
```

### Rules

1. **Pack display reads from `PackPrize` snapshot fields**, not from live `CatalogItem`.
2. **Pack value/odds read from `PackPrize` fields**, not from current catalog values.
3. **Live catalog references are provenance only** for existing prizes.
4. **Draft packs may be refreshed intentionally** by a vendor/admin action.
5. **Published/live packs should not silently re-snapshot.**
6. `remainingStock` may change through openings; identity/display/value/weight/initial stock should be treated as immutable after publish except through explicit audited admin correction.

### Draw ledger

For long-term correctness, add a ledger:

```text
PackPrizeDrawLedger
  id
  packId
  packPrizeId
  userId nullable
  openingId nullable
  quantity
  eventType              -- RESERVED, WON, RELEASED, CORRECTED
  remainingStockBefore
  remainingStockAfter
  createdAt
```

This separates mutable stock consumption from immutable prize definition.

### Backward compatibility

For existing rows, do not attempt risky automatic matching. There are only 9 current `PackPrize` rows in the observed DB, across 3 packs.  Backfill them with:

* `catalogItemId = null`
* snapshot fields copied from existing `label`, `imageUrl`, and `estimatedValue`
* `snapshotJson` containing a `"legacy": true` marker

# 8. Catalog search projection and Postgres search/index strategy

## Confirmed evidence

Current search reads from `CatalogItem`, but the search response excludes `sourcePayload` and returns a narrow field set. The evidence packet also calls out that search currently reads from a wide canonical table, not a narrow projection.

The DB already has `pg_trgm` enabled and a `CatalogItem_lower_name_trgm_idx` index, but current Prisma `mode: insensitive` queries do not use the trigram-compatible shape. Missing indexes include `searchText` trigram/full-text, composite `(game, itemType, isActive, name)`, covering search response indexes, and source ID prefix/trigram indexes.

## Design recommendation

Create a narrow search table:

```text
CatalogSearchDocument
  id
  catalogItemId
  vendorId nullable             -- null = global search document
  scope                         -- GLOBAL, VENDOR
  itemType
  gameCode
  language
  name
  normalizedName
  subtitle nullable
  setName nullable
  setCode nullable
  cardNumber nullable
  rarity nullable
  source
  sourceItemId
  imageThumbUrl nullable
  imageLargeUrl nullable
  imageBaseUrl nullable
  searchText
  normalizedSearchText
  searchVector
  isActive
  isPrizeEligible
  qualityScore
  popularityScore
  createdAt
  updatedAt
```

### Search behavior

Use one ranked search path instead of three sequential ORM queries.

Ranking should prefer:

1. Exact normalized name match.
2. Prefix normalized name match.
3. Prefix card number/source ID match.
4. Trigram name match.
5. Full-text/search-text match.
6. Popularity/quality tie-breakers.
7. Alphabetical stable tie-breaker.

### Illustrative query shape

Not production migration code; this is the intended query shape.

```sql
WITH params AS (
  SELECT
    lower($1) AS q,
    lower($1) || '%' AS q_prefix,
    '%' || lower($1) || '%' AS q_contains
),
candidates AS (
  SELECT
    d.*,
    CASE
      WHEN d.normalizedName = params.q THEN 100
      WHEN d.normalizedName LIKE params.q_prefix THEN 90
      WHEN lower(d.cardNumber) LIKE params.q_prefix THEN 80
      WHEN lower(d.sourceItemId) LIKE params.q_prefix THEN 75
      WHEN d.normalizedName LIKE params.q_contains THEN 60
      WHEN d.normalizedSearchText LIKE params.q_contains THEN 40
      ELSE 10
    END AS matchRank
  FROM CatalogSearchDocument d, params
  WHERE d.isActive = true
    AND d.isPrizeEligible = true
    AND d.gameCode = $2
    AND ($3 = 'all' OR d.itemType = ANY($4))
    AND (
      d.normalizedName LIKE params.q_prefix
      OR d.normalizedName LIKE params.q_contains
      OR d.normalizedSearchText LIKE params.q_contains
      OR lower(d.cardNumber) LIKE params.q_prefix
      OR lower(d.sourceItemId) LIKE params.q_prefix
      OR d.searchVector @@ websearch_to_tsquery('simple', $1)
    )
)
SELECT
  catalogItemId,
  source,
  sourceItemId,
  itemType,
  gameCode,
  language,
  name,
  setName,
  cardNumber,
  rarity,
  imageThumbUrl,
  imageLargeUrl,
  imageBaseUrl
FROM candidates
ORDER BY matchRank DESC, qualityScore DESC, popularityScore DESC, name ASC
LIMIT $5;
```

### Illustrative index strategy

Use `CONCURRENTLY` in real migrations where supported; examples below are architecture examples, not a production migration file.

```sql
-- Fast active global filtering.
CREATE INDEX CONCURRENTLY catalog_search_active_game_type_idx
ON "CatalogSearchDocument" ("gameCode", "itemType", "isActive", "isPrizeEligible");

-- Prefix autocomplete on normalized name.
CREATE INDEX CONCURRENTLY catalog_search_name_prefix_idx
ON "CatalogSearchDocument" ("gameCode", "itemType", "normalizedName" text_pattern_ops)
WHERE "isActive" = true AND "isPrizeEligible" = true;

-- Contains/fuzzy name search.
CREATE INDEX CONCURRENTLY catalog_search_name_trgm_idx
ON "CatalogSearchDocument"
USING gin ("normalizedName" gin_trgm_ops);

-- Contains/fallback search text.
CREATE INDEX CONCURRENTLY catalog_search_text_trgm_idx
ON "CatalogSearchDocument"
USING gin ("normalizedSearchText" gin_trgm_ops);

-- Full-text multi-term search.
CREATE INDEX CONCURRENTLY catalog_search_vector_idx
ON "CatalogSearchDocument"
USING gin ("searchVector");

-- Card number/source ID prefix search.
CREATE INDEX CONCURRENTLY catalog_search_card_number_prefix_idx
ON "CatalogSearchDocument" (lower("cardNumber") text_pattern_ops)
WHERE "cardNumber" IS NOT NULL;

CREATE INDEX CONCURRENTLY catalog_search_source_item_prefix_idx
ON "CatalogSearchDocument" (lower("sourceItemId") text_pattern_ops)
WHERE "sourceItemId" IS NOT NULL;
```

### Current-table bridge indexes

Before the projection is complete, add bridge indexes to current `CatalogItem` to stop the bleeding:

```sql
-- Current table bridge only.
CREATE INDEX CONCURRENTLY catalog_item_search_text_trgm_idx
ON "CatalogItem"
USING gin (lower("searchText") gin_trgm_ops);

CREATE INDEX CONCURRENTLY catalog_item_game_type_active_name_prefix_idx
ON "CatalogItem" ("game", "itemType", "isActive", lower("name") text_pattern_ops);

CREATE INDEX CONCURRENTLY catalog_item_source_item_id_prefix_idx
ON "CatalogItem" (lower("sourceItemId") text_pattern_ops);
```

The key query-shape change is to stop relying on Prisma `mode: insensitive` for these hot paths and use explicit normalized/lowercase expressions that match the indexes.

### When to add external search

Postgres with `pg_trgm` and full-text search should be enough for the current 220,905-row scale if the projection and indexes are implemented. Add a product/engineering gate for OpenSearch/Typesense/Meilisearch only when one of these becomes true:

* Search docs grow into multi-million scale and Postgres P95 cannot meet target.
* Typo tolerance, advanced facets, synonyms, or cross-vendor marketplace search become core product requirements.
* Search traffic becomes high enough to justify independent search infrastructure.

# 9. Migration phases from current state, explicitly non-destructive

## Phase 0 — Stabilize and reconcile schema drift

**Confirmed evidence:** live DB has `CatalogSet`, `catalogSetId`, and indexes not represented in repo Prisma at investigation time.

**Actions:**

* Add Prisma representation for live `CatalogSet`.
* Add Prisma representation for nullable `CatalogItem.catalogSetId`.
* Add existing live indexes/constraints to schema baseline.
* Do not drop columns, constraints, indexes, or data.
* Add drift checks to CI so repo schema cannot silently diverge from production again.

**Gate:** Prisma schema introspection and application boot both succeed against staging clone.

## Phase 1 — Fix current search latency without changing catalog semantics

**Actions:**

* Add missing bridge indexes to current `CatalogItem`.
* Rewrite `/v1/catalog/search` hot path using raw SQL or a query builder shape that uses `lower(name)`, `lower(searchText)`, and normalized query text.
* Avoid three sequential DB round trips; use one ranked query or bounded union.
* Continue returning the same API response shape.

**Gate:** explain plans show trigram/prefix indexes used; P95 autocomplete latency meets product threshold on a production-sized clone.

## Phase 2 — Add immutable prize identity/snapshot fields

**Actions:**

* Add nullable `catalogItemId` and snapshot/provenance fields to `PackPrize`.
* Update vendor UI search selection to carry `catalogItemId`, `source`, `sourceItemId`, `itemType`, game, set/card metadata, and image fields.
* Update pack creation API to accept optional catalog-backed prize identity.
* On prize creation, copy a full immutable snapshot into `PackPrize`.
* Backfill existing rows as legacy snapshots without forced catalog matching.

**Gate:** new pack prizes preserve display/value after simulated catalog import changes.

## Phase 3 — Add canonical provenance model beside existing catalog

**Actions:**

* Add `CatalogSource`, `CatalogExternalRef`, `CatalogImportRun`, `CatalogAlias`, and optional `CatalogImage`.
* Backfill from existing `CatalogItem.source`, `sourceItemId`, `language`, and `sourcePayload`.
* Preserve current `CatalogItem` fields for compatibility.
* Start dual-writing provenance on catalog sync.

**Gate:** every active current catalog item has a provenance row or an explicit audit exception.

## Phase 4 — Add type-specific tables

**Actions:**

* Add `CatalogCard` and backfill from current card-shaped fields.
* Add `CatalogSealedProduct` before importing sealed data.
* Add `CatalogGradedCardTemplate` before supporting slabs at catalog level.
* Keep all fields nullable where current evidence shows incomplete data.
* Do not remove old `setId`, `setName`, `cardNumber`, or `rarity` fields yet.

**Gate:** reads can be served from typed tables in shadow mode and match existing API output.

## Phase 5 — Build `CatalogSearchDocument`

**Actions:**

* Create projection table.
* Populate from canonical catalog + typed tables + source refs.
* Add search indexes.
* Shadow compare search results against current endpoint.
* Flip endpoint behind feature flag.

**Gate:** result quality approved by product; latency meets target; no missing major games/item types.

## Phase 6 — Add vendor inventory/custom item layer

**Actions:**

* Add `VendorCustomItem`, `VendorInventoryItem`, and `VendorListing`.
* Let pack builder choose from catalog-backed and vendor-owned prize candidates.
* Snapshot either catalog-backed item, vendor custom item, or vendor inventory item into `PackPrize`.

**Gate:** vendors can add catalog items and custom items to draft packs without losing historical snapshot correctness.

## Phase 7 — Strengthen constraints after adoption

**Actions:**

* Add stricter foreign keys only after backfill and null-handling are complete.
* Add application-level and possibly DB-level guards preventing published pack prize identity/value/display mutation.
* Deprecate old fields only after reads and writes have moved.
* Do not drop old fields until there is a separate cleanup migration with rollback and data export plans.

**Gate:** no production code path depends on old fields; historical pack displays are verified.

# 10. Query examples and index examples

## A. Current endpoint bridge search

Use explicit lowercased search to hit expression/trigram indexes.

```sql
SELECT
  id,
  source,
  "sourceItemId",
  "itemType",
  game,
  language,
  name,
  "setId",
  "setName",
  "cardNumber",
  rarity,
  "imageThumbUrl",
  "imageLargeUrl",
  "imageBaseUrl"
FROM "CatalogItem"
WHERE "isActive" = true
  AND game = $game
  AND "itemType" = $itemType
  AND (
    lower(name) LIKE lower($q) || '%'
    OR lower(name) LIKE '%' || lower($q) || '%'
    OR lower("searchText") LIKE '%' || lower($q) || '%'
  )
ORDER BY
  CASE
    WHEN lower(name) = lower($q) THEN 1
    WHEN lower(name) LIKE lower($q) || '%' THEN 2
    WHEN lower(name) LIKE '%' || lower($q) || '%' THEN 3
    ELSE 4
  END,
  name ASC
LIMIT $limit;
```

## B. Search projection read

```sql
SELECT
  "catalogItemId",
  source,
  "sourceItemId",
  "itemType",
  "gameCode",
  language,
  name,
  "setName",
  "cardNumber",
  rarity,
  "imageThumbUrl",
  "imageLargeUrl",
  "imageBaseUrl"
FROM "CatalogSearchDocument"
WHERE "isActive" = true
  AND "isPrizeEligible" = true
  AND "gameCode" = $game
  AND "itemType" = ANY($itemTypes)
  AND (
    "normalizedName" LIKE $qPrefix
    OR "normalizedName" LIKE $qContains
    OR "normalizedSearchText" LIKE $qContains
    OR "searchVector" @@ websearch_to_tsquery('simple', $q)
  )
ORDER BY "qualityScore" DESC, name ASC
LIMIT $limit;
```

## C. Pack prize creation from search selection

```sql
INSERT INTO "PackPrize" (
  "packId",
  "catalogItemId",
  "label",
  "imageUrl",
  "estimatedValue",
  "weight",
  "stock",
  "remainingStock",
  "snapshotItemType",
  "snapshotGame",
  "snapshotName",
  "snapshotSetName",
  "snapshotCardNumber",
  "snapshotRarity",
  "snapshotImageUrl",
  "catalogSource",
  "catalogSourceItemId",
  "snapshotJson",
  "snapshotCreatedAt"
)
SELECT
  $packId,
  d."catalogItemId",
  d.name,
  coalesce(d."imageLargeUrl", d."imageThumbUrl", d."imageBaseUrl"),
  $vendorEstimatedValue,
  $weight,
  $stock,
  $stock,
  d."itemType",
  d."gameCode",
  d.name,
  d."setName",
  d."cardNumber",
  d.rarity,
  coalesce(d."imageLargeUrl", d."imageThumbUrl", d."imageBaseUrl"),
  d.source,
  d."sourceItemId",
  jsonb_build_object(
    'catalogItemId', d."catalogItemId",
    'itemType', d."itemType",
    'game', d."gameCode",
    'name', d.name,
    'setName', d."setName",
    'cardNumber', d."cardNumber",
    'rarity', d.rarity,
    'source', d.source,
    'sourceItemId', d."sourceItemId"
  ),
  now()
FROM "CatalogSearchDocument" d
WHERE d."catalogItemId" = $catalogItemId;
```

## D. Pack display read

Pack display should not join live catalog for prize display.

```sql
SELECT
  id,
  "packId",
  "label",
  "imageUrl",
  "estimatedValue",
  "weight",
  "stock",
  "remainingStock",
  "snapshotJson"
FROM "PackPrize"
WHERE "packId" = $packId
ORDER BY "createdAt" ASC;
```

# 11. Decisions required from product

1. **What is prize identity?**
   Should pack prizes reference global catalog items, vendor inventory items, or both? Recommendation: both, with snapshot always required.

2. **Are graded slabs global catalog templates or individual inventory assets?**
   Recommendation: global template for “PSA 10 card,” vendor inventory for cert-specific slab.

3. **Are sets prizeable products or only metadata?**
   Recommendation: `CatalogSet` remains metadata; prizeable complete sets become `CatalogItem` rows with `itemType = SET`.

4. **Can vendor custom items appear in global search?**
   Recommendation: no by default. Keep them vendor-scoped until moderated/promoted.

5. **Who owns estimated value?**
   Product must define whether value comes from vendor declaration, source data, admin override, market pricing, or a blended valuation system. Snapshot should include value source and `asOf`.

6. **What item types are launch-critical?**
   Decide which of `CARD`, `SEALED_PRODUCT`, `GRADED_CARD`, `SET`, `CUSTOM`, `ACCESSORY`, `OTHER` must be supported first.

7. **What search quality is acceptable?**
   Define target P50/P95 latency, typo tolerance, ranking rules, and whether card number/source ID search is required.

8. **What happens when catalog source data changes?**
   Recommendation: draft packs may offer a “refresh from catalog” action; live packs never silently refresh.

9. **How should source conflicts be resolved?**
   As more sources are added, product/ops must define source trust tiers, manual merge rules, and conflict visibility.

10. **What compliance/audit trail is required for prize value and odds?**
    Recommendation: snapshot value, currency, value source, timestamp, weight, initial stock, and remaining stock ledger.

# 12. Risks and rollout gates

## Risk: schema drift continues

**Evidence:** live DB had `CatalogSet`/`catalogSetId` not represented in repo Prisma at investigation time.

**Gate:** schema drift check in CI; staging introspection must match expected schema before deploy.

## Risk: search fix is implemented but query shape still misses indexes

**Evidence:** `lower(name) LIKE '%char%'` used trigram and ran much faster than current Prisma-equivalent shapes, but current `mode: insensitive` shape did not use that index.

**Gate:** require `EXPLAIN ANALYZE` snapshots for hot search queries before rollout.

## Risk: search projection diverges from canonical catalog

**Mitigation:** projection should be rebuilt from canonical data and verified by checksums/counts per game/type/source.

**Gate:** shadow search returns acceptable parity and better latency before endpoint flip.

## Risk: prize snapshots are incomplete

**Mitigation:** API must reject new catalog-backed prizes that do not produce a snapshot. Legacy rows can remain nullable and marked legacy.

**Gate:** automated test: create pack prize, mutate catalog item, verify pack display/value stays unchanged.

## Risk: existing prize rows cannot be matched safely

**Evidence:** current prize rows have no catalog FK/reference.

**Mitigation:** do not force-match. Preserve legacy snapshots from existing fields.

## Risk: type model becomes too abstract or too rigid

**Mitigation:** use typed tables for high-value/high-query types and JSON extension only for experimental future types.

**Gate:** no new item type goes live without search projection mapping, pack snapshot mapping, and product display mapping.

## Risk: set coverage remains partial

**Evidence:** only two games currently have `CatalogSet` rows linked, while catalog items span 10 games.

**Mitigation:** nullable set links remain valid; import/backfill sets per game incrementally.

## Risk: index builds affect production

**Mitigation:** use concurrent index creation, stage on a production-sized clone, monitor locks, and deploy during low-traffic windows.

**Gate:** index build plan reviewed with rollback/abort procedure.

## Final position

The safest architecture is **not** a destructive replacement of `CatalogItem`. It is an additive transition from today’s card-shaped/source-shaped table into a layered catalog system:

* canonical identity,
* source provenance,
* type-specific detail,
* vendor inventory/custom layers,
* search projection,
* immutable pack-prize snapshots.

That directly addresses the evidence packet’s four P0 issues: schema drift, slow search, missing prize identity/snapshot correctness, and insufficient modeling for non-card products.
