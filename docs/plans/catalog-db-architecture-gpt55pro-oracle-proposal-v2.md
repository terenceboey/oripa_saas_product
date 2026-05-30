According to the May 30, 2026 evidence packet, prior Oracle proposal, and product-decision document, Oripa should move to an additive layered catalog architecture: keep the current `CatalogItem` path as a compatibility bridge, introduce canonical identity/provenance/type-specific tables, serve search from a narrow projection, and make every pack prize a self-contained immutable snapshot. The product-decision file is treated below as hard constraint, not as an open question.

# 1. Executive recommendation

## Confirmed evidence

Oripa is a digital pack-opening platform where vendors search prize-eligible catalog items and add them to packs. The catalog scope is explicitly broader than cards: raw cards, graded/slabbed cards, sealed products, sets, custom/vendor-created items, accessories, future collectibles, and multiple games are in scope. The evidence packet also states the key invariant: pack prize odds, value, and display must not silently mutate when upstream catalog data changes.

The current database is already large enough for search architecture to matter: the live catalog has 220,905 active `CatalogItem` rows, all currently `CARD`, all from `tcgtracking`, spread across 10 games. Search paths measured in the evidence packet are multi-second, including about 5.16 seconds for a prefix name search and about 2.14 seconds for `searchText ILIKE '%char%'`.

The product decisions establish hard constraints: prizes must reference both global catalog items and vendor inventory items where applicable, every prize snapshot is required, graded slabs use global templates plus vendor inventory for cert-specific slabs, `CatalogSet` remains metadata only, vendor custom items are not globally searchable by default, estimated value is out of launch scope, all item types are launch-critical, draft packs may refresh from catalog, live packs must never silently refresh, source conflicts go to human review, and compliance/odds audit is deferred but extension points must remain.

## Final recommendation

Adopt the following target architecture:

```text
External catalog sources
  -> CatalogImportRun
  -> CatalogSource / CatalogExternalRef / CatalogSourceConflict
  -> Canonical CatalogItem
      -> CatalogCard
      -> CatalogGradedCardTemplate
      -> CatalogSealedProduct
      -> CatalogSet metadata
      -> CatalogAccessory
      -> CatalogCollectibleExtension

Canonical + vendor item universe
  -> CatalogSearchDocument
  -> VendorCustomItem
  -> VendorInventoryItem
  -> VendorPrizeCandidate / VendorListing

Pack domain
  -> PackPrize
      -> nullable catalogItemId
      -> nullable vendorInventoryItemId
      -> nullable vendorCustomItemId
      -> required immutable snapshot fields
  -> PackPrizeDrawLedger extension point
```

The launch-critical work is not to replace `CatalogItem` destructively. It is to add the missing layers around it, then move reads and writes behind feature flags. The immediate P0 sequence should be:

1. Reconcile Prisma schema drift with live DB non-destructively.
2. Fix search query shape and indexes.
3. Add nullable identity/provenance fields and required snapshot write behavior to `PackPrize`.
4. Add source conflict and custom-item moderation workflow.
5. Build the search projection and vendor inventory layer.
6. Delay hard enforcement and cleanup until after backfill, shadow reads, and launch gates pass.

# 2. Evidence-backed current-state summary

## Confirmed evidence

### Current `CatalogItem`

The repo `CatalogItem` is a single table with `source`, `sourceItemId`, `itemType`, `game`, `language`, `name`, set/card fields, image URLs, `searchText`, `sourcePayload`, activity flags, and timestamps. It has a uniqueness constraint on `(source, sourceItemId, language)` and indexes around type/game/activity, source/activity, game/language/activity, set, and name. The enum has at least `CARD` and `SEALED_PRODUCT`.

### Live schema drift

The live DB has `CatalogSet` and `CatalogItem.catalogSetId`, including a foreign key to `CatalogSet`, but the repo Prisma schema did not define `CatalogSet` or `catalogSetId` at investigation time.

### Current search

The current search endpoint can run up to three sequential DB queries: case-insensitive name prefix, case-insensitive name contains, and case-insensitive `searchText` contains. The search response returns narrow display fields and excludes `sourcePayload`.

The DB has `pg_trgm` and an existing `CatalogItem_lower_name_trgm_idx`, but current Prisma `mode: insensitive` query shapes do not use it. Missing search-related indexes include `searchText` trigram/full-text support, composite `(game, itemType, isActive, name)`, covering search response indexes, and source item ID prefix/trigram support.

### Current pack prizes

Current pack prize creation copies only `label`, `imageUrl`, `estimatedValue`, `weight`, `stock`, and `remainingStock`; no `catalogItemId` is stored. The vendor UI searches catalog suggestions, then copies label and image into draft state without persisting `catalogItemId`.

The live `PackPrize` table has only nine rows across three packs, and it has no FK/reference to `CatalogItem`. This is early enough to fix prize correctness non-destructively.

## Design interpretation

The current system has four separate problems:

| Problem                  | Why it matters                                                                   | Launch handling                                                              |
| ------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Schema drift             | Repo schema does not fully represent live DB.                                    | Baseline current live schema; do not drop anything.                          |
| Slow search              | Autocomplete is already multi-second at 220k rows.                               | Add bridge indexes and rewrite hot query shape first; build projection next. |
| Weak prize correctness   | Prizes have no canonical identity or immutable snapshot.                         | Add snapshot fields and require snapshot writes for all new prizes.          |
| Overloaded catalog model | Current model is card/source-shaped, but launch-critical item types are broader. | Keep core identity common; move type fields into extension tables.           |

# 3. Final target architecture

## Confirmed evidence

The prior proposal recommended a layered architecture: canonical catalog core, type-specific extension tables, narrow `CatalogSearchDocument`, immutable `PackPrize` snapshots, and vendor inventory/listing separation. It also explicitly recommended an additive migration path rather than dropping or rewriting existing catalog/prize data.

## Design recommendation

Use five layers.

### Layer 1 — Source/provenance

Tracks external data sources, import runs, raw source identity, payload hashes, source changes, and conflicts.

```text
CatalogSource
CatalogImportRun
CatalogExternalRef
CatalogSourceConflict
CatalogSourcePatch
```

### Layer 2 — Canonical global catalog

Stores Oripa-owned global item identity and common display/lifecycle fields.

```text
CatalogGame
CatalogItem
CatalogAlias
CatalogImage
CatalogSet
```

### Layer 3 — Type-specific details

Stores attributes that only make sense for a type.

```text
CatalogCard
CatalogGradedCardTemplate
CatalogSealedProduct
CatalogAccessory
CatalogCollectibleExtension
```

### Layer 4 — Vendor domain

Stores vendor-owned items, custom items, cert-specific slabs, and pack-builder candidates.

```text
VendorCustomItem
VendorInventoryItem
VendorListing
VendorPrizeCandidate
VendorCustomItemModeration
```

### Layer 5 — Pack/prize historical truth

Stores pack prize snapshots as the source of truth for display and opening behavior.

```text
PackPrize
PackPrizeDrawLedger       -- extension point; not launch blocker unless stock correctness requires it
PackPrizeCorrectionEvent  -- extension point for future audit/compliance
```

The important boundary is this: `CatalogItem` answers “what is this object globally?”; `VendorInventoryItem` answers “what does this vendor actually have or offer?”; `PackPrize` answers “what exactly was promised in this pack at creation/publish time?”

# 4. Canonical global catalog model

## Confirmed evidence

The existing `CatalogItem` contains source identity, game, language, item type, name, set/card fields, images, search text, payload, and active timestamps. The evidence packet also calls out raw `game` and `source` strings as a P1 risk.

## Design recommendation

Do not replace the current `CatalogItem` immediately. Evolve it into a canonical global item table by adding normalized fields and moving source-specific and type-specific data into side tables.

### `CatalogGame`

```text
id
code unique                  -- POKEMON, YUGIOH, ONE_PIECE, etc.
displayName
categoryGroup nullable
isActive
sortOrder
createdAt
updatedAt
```

Use `code` as the stable product/API value. Keep the old string `game` until all reads and writes migrate.

### `CatalogSource`

```text
id
key unique                   -- tcgtracking, vendor_custom, manual_admin, future_source
displayName
trustTier                    -- PRIMARY, SECONDARY, VENDOR_SUBMITTED, MANUAL
isActive
createdAt
updatedAt
```

`trustTier` is not for automatic merge. It is metadata used by the human conflict workflow.

### `CatalogImportRun`

```text
id
sourceId
startedAt
completedAt nullable
status                       -- RUNNING, SUCCEEDED, FAILED, PARTIAL
sourceCursor nullable
recordsSeen
recordsInserted
recordsUpdated
recordsUnchanged
recordsDeactivated
importVersion nullable
notes nullable
createdBy nullable
```

This makes catalog changes auditable without becoming a compliance/odds launch blocker.

### `CatalogItem`

```text
id
itemType                     -- CARD, SEALED_PRODUCT, GRADED_CARD, SET, CUSTOM, ACCESSORY, OTHER
gameId nullable
gameCode                     -- denormalized stable code for fast filtering
language
canonicalName
displayName
subtitle nullable
catalogSetId nullable        -- FK to CatalogSet metadata when applicable
primaryImageUrl nullable
thumbnailImageUrl nullable
largeImageUrl nullable
isPrizeEligible
isSearchable
status                       -- ACTIVE, INACTIVE, NEEDS_REVIEW, MERGED, REJECTED
mergedIntoCatalogItemId nullable
createdAt
updatedAt
```

During migration, keep existing fields such as `source`, `sourceItemId`, `game`, `name`, `setId`, `setName`, `cardNumber`, `rarity`, `image*`, `searchText`, and `sourcePayload` as compatibility fields. Do not drop them in the launch migration.

### `CatalogExternalRef`

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
importRunId nullable
isPrimary
isActive
createdAt
updatedAt

unique(sourceId, sourceItemId, sourceLanguage)
index(catalogItemId)
index(sourceId, isActive)
index(sourcePayloadHash)
```

This preserves the existing uniqueness concept `(source, sourceItemId, language)` while allowing multiple external sources per canonical item later.

### `CatalogAlias`

```text
id
catalogItemId
aliasType                    -- NAME, SOURCE_NAME, LOCALIZED_NAME, CARD_NUMBER, SET_CODE, BARCODE
value
normalizedValue
language nullable
sourceId nullable
isSearchable
createdAt

index(catalogItemId)
index(normalizedValue)
```

### `CatalogImage`

```text
id
catalogItemId
imageType                    -- THUMB, LARGE, FRONT, BACK, LOGO, SYMBOL, BANNER, SLAB_FRONT
url
sourceId nullable
width nullable
height nullable
isPrimary
createdAt

index(catalogItemId, imageType)
```

### `CatalogSet`

`CatalogSet` remains metadata only, per product decision. Prizeable complete sets must be separate `CatalogItem` rows with `itemType = SET`.

```text
id
sourceId nullable
sourceSetId nullable
gameId nullable
gameCode
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

unique(sourceId, sourceSetId, gameCode) nullable-aware by implementation
index(gameCode, isActive, name)
index(gameCode, isActive, releaseDate)
```

# 5. Type-specific model strategy

## Confirmed evidence

The current normalizer builds card-like catalog rows, uses `itemType: CatalogItemType.CARD`, preserves `sourcePayload`, and has `hasCardShape()` for card-like products. Live rows are all `CARD`, despite the broader product scope and launch-critical item types.

The product decision makes all item types launch-critical: `CARD`, `SEALED_PRODUCT`, `GRADED_CARD`, `SET`, `CUSTOM`, `ACCESSORY`, and `OTHER`.

## Design recommendation

Use type-specific tables for item types that are launch-critical and likely to be queried. Use a generic JSON extension only as an escape hatch for low-volume or not-yet-modeled details, not as the primary modeling strategy.

### `CARD`

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
  metadata jsonb nullable
  createdAt
  updatedAt
```

`cardNumber` and `rarity` must remain nullable because the evidence packet reports missing card numbers and rarities in current data.

### `GRADED_CARD`

Hard product constraint: global catalog template for generic graded item; vendor inventory for cert-specific individual slabs.

```text
CatalogGradedCardTemplate
  catalogItemId primary key / FK
  rawCardCatalogItemId nullable
  grader                       -- PSA, CGC, BGS, SGC, OTHER
  grade
  qualifier nullable
  labelVariant nullable
  populationData jsonb nullable
  createdAt
  updatedAt
```

Cert numbers do not belong in the global template. Put them in `VendorInventoryItem`.

### `SEALED_PRODUCT`

```text
CatalogSealedProduct
  catalogItemId primary key / FK
  productKind                  -- BOOSTER_BOX, BOOSTER_PACK, ETB, CASE, TIN, COLLECTION, DECK, OTHER
  catalogSetId nullable
  releaseDate nullable
  msrp nullable                -- extension only; not launch valuation
  unitsPerBox nullable
  packsPerBox nullable
  barcode nullable
  metadata jsonb nullable
  createdAt
  updatedAt
```

### `SET`

Hard product constraint: `CatalogSet` is metadata only; prizeable complete sets are `CatalogItem` rows with `itemType = SET`.

```text
CatalogSetPrizeDetail
  catalogItemId primary key / FK
  catalogSetId FK
  completenessType             -- COMPLETE_SET, MASTER_SET, PARTIAL_SET, SEALED_SET_BUNDLE, OTHER
  itemCount nullable
  conditionSummary nullable
  metadata jsonb nullable
```

This avoids conflating “a set as metadata” with “a complete set as a prizeable object.”

### `CUSTOM`

Custom items are vendor-originated and vendor-scoped by default. They become global only after review/moderation.

```text
VendorCustomItem
  id
  vendorId
  linkedCatalogItemId nullable
  itemType                     -- CUSTOM, ACCESSORY, OTHER, or proposed canonical type
  gameId nullable
  gameCode nullable
  name
  normalizedName
  description nullable
  imageUrl nullable
  estimatedValue nullable       -- extension field only; not valuation engine
  valueCurrency nullable
  valueSource nullable
  moderationStatus              -- DRAFT, SUBMITTED, NEEDS_CHANGES, APPROVED_VENDOR_ONLY, PROMOTED_GLOBAL, REJECTED
  isSearchableWithinVendor
  createdAt
  updatedAt
```

### `ACCESSORY`

Because `ACCESSORY` is launch-critical, model it explicitly instead of burying it in JSON.

```text
CatalogAccessory
  catalogItemId primary key / FK
  accessoryKind                -- SLEEVE, DECK_BOX, BINDER, PLAYMAT, STORAGE, OTHER
  brand nullable
  productLine nullable
  size nullable
  color nullable
  barcode nullable
  metadata jsonb nullable
  createdAt
  updatedAt
```

### `OTHER`

`OTHER` is launch-critical as a safe fallback, but it should be controlled.

```text
CatalogCollectibleExtension
  catalogItemId primary key / FK
  attributes jsonb
  schemaVersion
  reviewStatus                 -- ACTIVE, NEEDS_REVIEW, DEPRECATED
  createdAt
  updatedAt
```

Rule: `OTHER` can launch only if it maps to search projection, snapshot creation, and moderation fields. It should not become a dumping ground for unreviewed global catalog data.

# 6. Vendor inventory/listing layer strategy

## Confirmed evidence

Current vendor UI selects catalog suggestions but only copies label and image into draft state; it does not persist `catalogItemId`.

The prior proposal correctly distinguished catalog identity from vendor offering/inventory: the catalog tells Oripa what an object is; vendor inventory tells Oripa what a vendor can actually place into a pack.

## Design recommendation

### `VendorInventoryItem`

```text
id
vendorId
catalogItemId nullable
vendorCustomItemId nullable
inventoryType                 -- CATALOG_ITEM, CUSTOM_ITEM, CERTIFIED_SLAB, BUNDLE, LOT, OTHER
condition nullable
certNumber nullable            -- for cert-specific slabs
quantityOnHand
quantityReserved
quantityAvailable generated/application
acquisitionCost nullable       -- internal/vendor accounting, not launch valuation
estimatedValue nullable        -- extension only
valueCurrency nullable
valueSource nullable
status                         -- ACTIVE, RESERVED, DEPLETED, ARCHIVED, NEEDS_REVIEW
metadata jsonb nullable
createdAt
updatedAt

check exactly one or valid combination:
  catalogItemId OR vendorCustomItemId OR bundle metadata
index(vendorId, status)
index(catalogItemId)
index(vendorCustomItemId)
```

### `VendorListing`

```text
id
vendorId
vendorInventoryItemId
title
imageUrl nullable
displayValue nullable          -- extension only; not valuation engine
listingStatus                  -- DRAFT, ACTIVE, PAUSED, ARCHIVED
searchable
createdAt
updatedAt

index(vendorId, listingStatus, searchable)
```

### `VendorPrizeCandidate`

This can be a view or materialized table. It should unify global catalog items, vendor inventory items, and approved vendor custom items for pack builder search.

```text
id
vendorId
candidateType                  -- GLOBAL_CATALOG, VENDOR_INVENTORY, VENDOR_CUSTOM
catalogItemId nullable
vendorInventoryItemId nullable
vendorCustomItemId nullable
itemType
gameCode nullable
name
subtitle nullable
imageUrl nullable
quantityAvailable nullable
moderationStatus nullable
isPrizeEligible
searchDocumentId nullable
updatedAt
```

For launch, pack builder can still allow direct catalog-backed prize creation. But the target should route vendor pack creation through `VendorPrizeCandidate` so that cert-specific slabs, custom items, lots, and inventory quantities can be represented.

# 7. Vendor custom-item moderation and promotion

## Confirmed evidence

Hard product constraint: vendor custom items are not globally searchable by default; vendors may submit/push a patch; global visibility requires manual review/moderation before promotion.

## Design recommendation

### `VendorCustomItemModeration`

```text
id
vendorCustomItemId
submittedByUserId
reviewedByUserId nullable
status                         -- SUBMITTED, NEEDS_CHANGES, APPROVED_VENDOR_ONLY, PROMOTED_GLOBAL, REJECTED
reviewReason nullable
proposedCatalogItemId nullable
resultCatalogItemId nullable
createdAt
reviewedAt nullable
```

### Moderation states

```text
DRAFT
  -> vendor can edit; not searchable globally.

SUBMITTED
  -> appears in moderation queue.

NEEDS_CHANGES
  -> reviewer requests edits.

APPROVED_VENDOR_ONLY
  -> usable by that vendor in packs; still not global.

PROMOTED_GLOBAL
  -> creates or links to a canonical CatalogItem; global search document can be created.

REJECTED
  -> cannot be used globally; pack use depends on policy.
```

### Promotion workflow

1. Vendor creates custom item.
2. Vendor submits it for review.
3. Reviewer compares it against existing `CatalogItem`/`CatalogAlias`.
4. Reviewer either links it to an existing catalog item, creates a new `CatalogItem`, approves vendor-only use, requests changes, or rejects it.
5. If promoted globally, create:

   * `CatalogItem`
   * type-specific row if applicable
   * `CatalogExternalRef` with source `vendor_custom` or `manual_admin`
   * `CatalogSearchDocument` with `scope = GLOBAL`
6. Keep a permanent link from `VendorCustomItem` to `linkedCatalogItemId` or moderation result.

No automatic global promotion at launch.

# 8. PackPrize immutable snapshot strategy

## Confirmed evidence

Current `PackPrize` lacks a catalog FK and has only copied display/value/stock fields. The product invariant requires pack prizes to preserve historical correctness.

Hard product constraint: pack prizes reference both global catalog items and vendor inventory items where applicable, and a snapshot is always required. Draft packs may refresh from catalog; live packs must never silently refresh.

## Design recommendation

`PackPrize` must be the authoritative display/opening record after creation, especially after pack publish. Live catalog joins are for admin provenance only, not for user-facing prize truth.

### Additive `PackPrize` fields

Keep all current fields. Add nullable identity/provenance fields first, then enforce snapshot presence in application code for new writes.

```text
PackPrize
  id
  packId

  -- Existing compatibility fields
  label
  imageUrl
  estimatedValue              -- keep for compatibility; no valuation engine required
  weight
  stock
  remainingStock
  createdAt
  updatedAt

  -- Identity/provenance
  catalogItemId nullable
  vendorInventoryItemId nullable
  vendorCustomItemId nullable
  catalogExternalRefId nullable
  catalogSource nullable
  catalogSourceItemId nullable
  catalogPayloadHash nullable
  createdFromSearchDocumentId nullable
  createdFromCatalogUpdatedAt nullable

  -- Required snapshot for new rows
  snapshotVersion
  snapshotItemType
  snapshotGame nullable
  snapshotLanguage nullable
  snapshotName
  snapshotSubtitle nullable
  snapshotSetName nullable
  snapshotSetId nullable
  snapshotCardNumber nullable
  snapshotRarity nullable
  snapshotCondition nullable
  snapshotGrader nullable
  snapshotGrade nullable
  snapshotCertNumber nullable
  snapshotImageUrl nullable
  snapshotThumbUrl nullable
  snapshotLargeImageUrl nullable

  -- Deferred value/compliance extension fields
  snapshotEstimatedValue nullable
  snapshotValueCurrency nullable
  snapshotValueSource nullable
  snapshotValueAsOf nullable

  -- Full immutable evidence payload
  snapshotJson jsonb
  snapshotCreatedAt
  snapshotCreatedBy nullable
  isLegacySnapshot default false
```

### Required rules

1. New `PackPrize` writes must create `snapshotJson`.
2. New catalog-backed prizes must include `catalogItemId`.
3. New vendor-inventory-backed prizes must include `vendorInventoryItemId`.
4. New vendor-custom-backed prizes must include `vendorCustomItemId`.
5. Pack display reads from `PackPrize.snapshot*` or existing compatibility fields, not from live `CatalogItem`.
6. Pack opening logic reads `weight`, `stock`, and `remainingStock` from `PackPrize`, not from catalog.
7. Draft packs may run explicit “refresh from catalog,” which creates a new snapshot or updates draft-only snapshot fields.
8. Live packs never silently refresh from catalog.
9. Existing nine `PackPrize` rows should be marked legacy and backfilled from existing fields, without forced catalog matching.

The prior proposal’s rule that pack display should not join live catalog for prize display remains correct.

### Legacy backfill

For existing rows:

```text
catalogItemId = null
vendorInventoryItemId = null
vendorCustomItemId = null
snapshotName = label
snapshotImageUrl = imageUrl
snapshotEstimatedValue = estimatedValue
snapshotJson = {
  "legacy": true,
  "label": "...",
  "imageUrl": "...",
  "estimatedValue": ...
}
isLegacySnapshot = true
snapshotCreatedAt = createdAt
```

Do not auto-match legacy prizes to catalog items unless a human/admin workflow is created later. The prior proposal explicitly warns not to force-match existing rows with no FK/reference.

### Draw ledger extension point

Compliance/odds audit is deferred, but stock correctness benefits from an event trail. Keep this as an extension point; do not make it a valuation/compliance launch blocker.

```text
PackPrizeDrawLedger
  id
  packId
  packPrizeId
  userId nullable
  openingId nullable
  quantity
  eventType                    -- RESERVED, WON, RELEASED, CORRECTED
  remainingStockBefore
  remainingStockAfter
  createdAt
```

# 9. Pack-prize snapshot correctness for pack contents

## Confirmed evidence

The current pack creation model stores prize label/image/value/weight/stock only and lacks canonical identity.

## Design recommendation

Use a deterministic snapshot builder.

### Snapshot builder inputs

For a global catalog prize:

```text
CatalogItem
CatalogExternalRef primary source
CatalogCard / CatalogSealedProduct / CatalogGradedCardTemplate / etc.
CatalogImage primary image
CatalogSet metadata if linked
Vendor-entered pack fields: weight, stock, optional display override if allowed
```

For a vendor inventory prize:

```text
VendorInventoryItem
CatalogItem or VendorCustomItem
certNumber / condition / quantity
Vendor-entered pack fields: weight, stock
```

For a custom item:

```text
VendorCustomItem
moderation status
Vendor-entered pack fields: weight, stock
```

### Snapshot builder output

Always produce:

```text
identityRef: catalogItemId/vendorInventoryItemId/vendorCustomItemId
displaySnapshot: name, subtitle, images, item type, game, set/card/sealed/slab fields
sourceSnapshot: source, sourceItemId, externalRefId, payloadHash
valueExtension: estimatedValue/valueCurrency/valueSource/valueAsOf nullable
packMechanics: weight, stock, remainingStock
snapshotJson: complete immutable object
```

### Correctness tests

Before launch, require tests for:

1. Create draft pack with catalog-backed card.
2. Update the catalog item’s name/image.
3. Confirm draft pack changes only if explicit refresh is called.
4. Publish pack.
5. Update catalog item again.
6. Confirm live pack display, value fields, weight, and initial stock do not change.
7. Open pack and confirm only `remainingStock` changes.
8. Confirm snapshot provenance still points back to source/catalog for admin inspection.

# 10. Source conflict workflow

## Confirmed evidence

Hard product constraint: source conflicts go to human review; the proposal must include a conflict queue/moderation workflow rather than automatic overwrite/merge.

## Design recommendation

### `CatalogSourceConflict`

```text
id
catalogItemId nullable
incomingSourceId
incomingSourceItemId
incomingExternalRefId nullable
existingExternalRefId nullable
conflictType                  -- IDENTITY, NAME, IMAGE, SET_LINK, ITEM_TYPE, RARITY, CARD_NUMBER, LANGUAGE, PAYLOAD
severity                      -- LOW, MEDIUM, HIGH, BLOCKING
status                        -- OPEN, ASSIGNED, RESOLVED, REJECTED, IGNORED
detectedAt
assignedToUserId nullable
resolvedByUserId nullable
resolvedAt nullable
resolutionAction nullable      -- ACCEPT_INCOMING, KEEP_EXISTING, MERGE, SPLIT, CREATE_NEW, MAP_ALIAS
detailsJson jsonb
```

### `CatalogSourcePatch`

```text
id
sourceConflictId nullable
vendorCustomItemId nullable
catalogItemId nullable
submittedByUserId nullable
reviewedByUserId nullable
patchType                     -- FIELD_UPDATE, NEW_ALIAS, NEW_IMAGE, TYPE_CHANGE, SET_LINK, PROMOTION
patchJson jsonb
status                        -- SUBMITTED, APPROVED, REJECTED, APPLIED
createdAt
reviewedAt nullable
appliedAt nullable
```

### Conflict creation rules

Create a conflict when an incoming source row:

| Condition                                                               | Conflict type                              | Launch behavior                                      |
| ----------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| Matches source ID but changes key identity fields unexpectedly          | `IDENTITY`                                 | Keep current canonical display, queue review.        |
| Matches likely same card but different name/image/set/card number       | `NAME`, `IMAGE`, `SET_LINK`, `CARD_NUMBER` | Queue review; optionally update aliases if low risk. |
| Appears duplicate of an existing item by normalized name + set + number | `IDENTITY`                                 | Do not auto-merge; queue.                            |
| Changes item type, such as card to sealed                               | `ITEM_TYPE`                                | Blocking review.                                     |
| Vendor custom item requests global promotion                            | `PROMOTION`                                | Manual review required.                              |

### Conflict resolution rules

Human reviewer can:

1. Accept incoming source fields.
2. Keep existing canonical fields.
3. Add incoming name as alias.
4. Add image as secondary image.
5. Link external ref to existing item.
6. Split into a new `CatalogItem`.
7. Merge into existing `CatalogItem` with `mergedIntoCatalogItemId`.
8. Reject vendor patch or custom promotion.

No conflict resolution should mutate live pack prize snapshots.

# 11. Catalog search projection and Postgres search/index strategy

## Confirmed evidence

The current search reads from `CatalogItem`, while the response excludes `sourcePayload` and returns a narrow field set. The evidence packet calls out that search reads from a wide canonical table rather than a narrow projection. It also shows that `lower(name) LIKE '%char%'` used the existing trigram index and ran much faster than the current Prisma-equivalent search shapes, proving query shape matters.

The product decision requires fast search with appropriate quality and a pragmatic launch search/index design.

## Design recommendation

### Launch strategy

Use PostgreSQL search with `pg_trgm`, expression indexes, and a narrow `CatalogSearchDocument` projection. Do not add OpenSearch/Typesense/Meilisearch for launch unless Postgres cannot meet P95 targets on a production-sized clone. The prior proposal states Postgres with trigram and full-text should be sufficient at current 220,905-row scale if projection and indexes are implemented.

### `CatalogSearchDocument`

```text
id
catalogItemId nullable
vendorId nullable               -- null = global
vendorInventoryItemId nullable
vendorCustomItemId nullable
scope                           -- GLOBAL, VENDOR
itemType                        -- CARD, SEALED_PRODUCT, GRADED_CARD, SET, CUSTOM, ACCESSORY, OTHER
gameCode nullable
language
name
normalizedName
subtitle nullable
setName nullable
setCode nullable
cardNumber nullable
rarity nullable
grader nullable
grade nullable
certNumber nullable             -- vendor scope only
productKind nullable
accessoryKind nullable
source nullable
sourceItemId nullable
imageThumbUrl nullable
imageLargeUrl nullable
imageBaseUrl nullable
searchText
normalizedSearchText
searchVector
isActive
isPrizeEligible
moderationStatus nullable
qualityScore
popularityScore
createdAt
updatedAt

index rules:
  global docs have vendorId null
  vendor docs have vendorId non-null
  custom global docs require moderationStatus = PROMOTED_GLOBAL
```

### Ranking

Use one ranked query or bounded `UNION ALL`, not three sequential ORM round trips.

Recommended ranking order:

1. Exact normalized name.
2. Prefix normalized name.
3. Exact/prefix card number.
4. Exact/prefix source item ID or barcode.
5. Graded qualifier match, such as `PSA 10`.
6. Trigram name match.
7. Full-text `searchVector` match.
8. Quality/popularity tie-breaker.
9. Stable alphabetical tie-breaker.

### Search API behavior

At launch, support:

```text
q
limit
game
type = card | sealed | graded | set | custom | accessory | other | all
scope = global | vendor | all
vendorId inferred from auth for vendor scope
```

For public/global search, exclude vendor custom items unless promoted. For vendor pack-builder search, include that vendor’s approved/custom inventory and global catalog.

### Index examples

These are architecture examples, not a production migration file.

```sql
-- Fast active global/vendor filtering.
CREATE INDEX CONCURRENTLY catalog_search_scope_game_type_active_idx
ON "CatalogSearchDocument" ("scope", "vendorId", "gameCode", "itemType", "isActive", "isPrizeEligible");

-- Prefix autocomplete.
CREATE INDEX CONCURRENTLY catalog_search_name_prefix_idx
ON "CatalogSearchDocument" ("gameCode", "itemType", "normalizedName" text_pattern_ops)
WHERE "isActive" = true AND "isPrizeEligible" = true;

-- Fuzzy/contains name search.
CREATE INDEX CONCURRENTLY catalog_search_name_trgm_idx
ON "CatalogSearchDocument"
USING gin ("normalizedName" gin_trgm_ops);

-- Fallback search text.
CREATE INDEX CONCURRENTLY catalog_search_text_trgm_idx
ON "CatalogSearchDocument"
USING gin ("normalizedSearchText" gin_trgm_ops);

-- Full text.
CREATE INDEX CONCURRENTLY catalog_search_vector_idx
ON "CatalogSearchDocument"
USING gin ("searchVector");

-- Card/source/barcode prefix.
CREATE INDEX CONCURRENTLY catalog_search_card_number_prefix_idx
ON "CatalogSearchDocument" (lower("cardNumber") text_pattern_ops)
WHERE "cardNumber" IS NOT NULL;

CREATE INDEX CONCURRENTLY catalog_search_source_item_prefix_idx
ON "CatalogSearchDocument" (lower("sourceItemId") text_pattern_ops)
WHERE "sourceItemId" IS NOT NULL;
```

### Bridge indexes before projection is live

The prior proposal recommended bridge indexes on current `CatalogItem` while the projection is built. This is the correct immediate stabilization path.

```sql
CREATE INDEX CONCURRENTLY catalog_item_search_text_trgm_idx
ON "CatalogItem"
USING gin (lower("searchText") gin_trgm_ops);

CREATE INDEX CONCURRENTLY catalog_item_game_type_active_name_prefix_idx
ON "CatalogItem" ("game", "itemType", "isActive", lower("name") text_pattern_ops);

CREATE INDEX CONCURRENTLY catalog_item_source_item_id_prefix_idx
ON "CatalogItem" (lower("sourceItemId") text_pattern_ops);
```

### Query-shape rule

Stop relying on Prisma `mode: insensitive` for the hot path. Use explicit normalized/lowercase expressions that match the indexes. The evidence packet shows the trigram-compatible lowercase query shape used the trigram index while current Prisma-equivalent shapes did not.

# 12. Query examples

These are intended query shapes, not production-ready migration code.

## Current-table bridge search

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
  AND ($type = 'all' OR "itemType" = ANY($itemTypes))
  AND (
    lower(name) LIKE lower($q) || '%'
    OR lower(name) LIKE '%' || lower($q) || '%'
    OR lower("searchText") LIKE '%' || lower($q) || '%'
    OR lower("sourceItemId") LIKE lower($q) || '%'
  )
ORDER BY
  CASE
    WHEN lower(name) = lower($q) THEN 100
    WHEN lower(name) LIKE lower($q) || '%' THEN 90
    WHEN lower("sourceItemId") LIKE lower($q) || '%' THEN 75
    WHEN lower(name) LIKE '%' || lower($q) || '%' THEN 60
    ELSE 40
  END DESC,
  name ASC
LIMIT $limit;
```

## Search projection read

```sql
SELECT
  "catalogItemId",
  "vendorInventoryItemId",
  "vendorCustomItemId",
  scope,
  source,
  "sourceItemId",
  "itemType",
  "gameCode",
  language,
  name,
  subtitle,
  "setName",
  "cardNumber",
  rarity,
  grader,
  grade,
  "imageThumbUrl",
  "imageLargeUrl",
  "imageBaseUrl"
FROM "CatalogSearchDocument"
WHERE "isActive" = true
  AND "isPrizeEligible" = true
  AND ("gameCode" = $game OR $game IS NULL)
  AND ($type = 'all' OR "itemType" = ANY($itemTypes))
  AND (
    scope = 'GLOBAL'
    OR (scope = 'VENDOR' AND "vendorId" = $vendorId)
  )
  AND (
    "normalizedName" LIKE $qPrefix
    OR "normalizedName" LIKE $qContains
    OR "normalizedSearchText" LIKE $qContains
    OR lower("cardNumber") LIKE $qPrefix
    OR lower("sourceItemId") LIKE $qPrefix
    OR "searchVector" @@ websearch_to_tsquery('simple', $q)
  )
ORDER BY
  "qualityScore" DESC,
  "popularityScore" DESC,
  name ASC
LIMIT $limit;
```

## Pack prize creation from a search document

```sql
INSERT INTO "PackPrize" (
  "packId",
  "catalogItemId",
  "vendorInventoryItemId",
  "vendorCustomItemId",
  "label",
  "imageUrl",
  "estimatedValue",
  "weight",
  "stock",
  "remainingStock",
  "snapshotVersion",
  "snapshotItemType",
  "snapshotGame",
  "snapshotLanguage",
  "snapshotName",
  "snapshotSubtitle",
  "snapshotSetName",
  "snapshotCardNumber",
  "snapshotRarity",
  "snapshotImageUrl",
  "catalogSource",
  "catalogSourceItemId",
  "createdFromSearchDocumentId",
  "snapshotJson",
  "snapshotCreatedAt"
)
SELECT
  $packId,
  d."catalogItemId",
  d."vendorInventoryItemId",
  d."vendorCustomItemId",
  d.name,
  coalesce(d."imageLargeUrl", d."imageThumbUrl", d."imageBaseUrl"),
  $estimatedValue,
  $weight,
  $stock,
  $stock,
  1,
  d."itemType",
  d."gameCode",
  d.language,
  d.name,
  d.subtitle,
  d."setName",
  d."cardNumber",
  d.rarity,
  coalesce(d."imageLargeUrl", d."imageThumbUrl", d."imageBaseUrl"),
  d.source,
  d."sourceItemId",
  d.id,
  jsonb_build_object(
    'catalogItemId', d."catalogItemId",
    'vendorInventoryItemId', d."vendorInventoryItemId",
    'vendorCustomItemId', d."vendorCustomItemId",
    'itemType', d."itemType",
    'game', d."gameCode",
    'language', d.language,
    'name', d.name,
    'subtitle', d.subtitle,
    'setName', d."setName",
    'cardNumber', d."cardNumber",
    'rarity', d.rarity,
    'source', d.source,
    'sourceItemId', d."sourceItemId"
  ),
  now()
FROM "CatalogSearchDocument" d
WHERE d.id = $searchDocumentId
  AND d."isActive" = true
  AND d."isPrizeEligible" = true;
```

## Pack display read

```sql
SELECT
  id,
  "packId",
  coalesce("snapshotName", label) AS name,
  coalesce("snapshotImageUrl", "imageUrl") AS imageUrl,
  "estimatedValue",
  "weight",
  "stock",
  "remainingStock",
  "snapshotJson"
FROM "PackPrize"
WHERE "packId" = $packId
ORDER BY "createdAt" ASC;
```

Pack display intentionally does not join live `CatalogItem`.

# 13. Non-destructive migration phases

The prior proposal’s non-destructive phased plan is directionally correct: reconcile schema drift, fix search, add snapshots, add provenance, add type-specific tables, build search projection, add vendor inventory/custom layers, and only then strengthen constraints.

## Phase 0 — Baseline and schema drift reconciliation

### Confirmed evidence

Live DB has `CatalogSet`, `catalogSetId`, and indexes not represented in repo Prisma at investigation time.

### Actions

* Add Prisma model for live `CatalogSet`.
* Add nullable `CatalogItem.catalogSetId`.
* Add known live constraints/indexes to schema baseline.
* Add CI drift check.
* No drops, no rewrites, no destructive migrations.

### Gate

Application boots against staging clone; schema introspection matches expected live-compatible schema.

## Phase 1 — Search stabilization on current table

### Actions

* Add bridge indexes concurrently.
* Rewrite `/v1/catalog/search` hot path to use normalized/lowercase query shape.
* Replace three sequential ORM queries with one ranked query or bounded union.
* Preserve existing API response shape.

### Gate

`EXPLAIN ANALYZE` on production-sized clone shows index usage and acceptable P95.

## Phase 2 — PackPrize identity and snapshot fields

### Actions

* Add nullable identity fields and snapshot fields to `PackPrize`.
* Update vendor UI to carry `catalogItemId`, `source`, `sourceItemId`, item type, game, set/card/slab/sealed fields, and image data.
* Update API to require snapshot creation for new pack prizes.
* Backfill current rows as legacy snapshots.
* Do not force-match legacy prizes.

### Gate

Automated test proves catalog mutation does not alter pack display/value/odds after publish.

## Phase 3 — Source/provenance and import audit

### Actions

* Add `CatalogSource`, `CatalogImportRun`, `CatalogExternalRef`, `CatalogAlias`, `CatalogImage`.
* Backfill from current `CatalogItem.source`, `sourceItemId`, `language`, images, and `sourcePayload`.
* Dual-write provenance during sync.

### Gate

Every active current catalog item has a provenance row or an explicit exception record.

## Phase 4 — Type-specific tables for all launch-critical item types

### Actions

* Add `CatalogCard`.
* Add `CatalogGradedCardTemplate`.
* Add `CatalogSealedProduct`.
* Add `CatalogAccessory`.
* Add `CatalogSetPrizeDetail`.
* Add `CatalogCollectibleExtension`.
* Backfill card rows first.
* Keep fields nullable where evidence shows incomplete source data.
* Do not remove old `setId`, `setName`, `cardNumber`, `rarity`, or image fields yet.

### Gate

Shadow reads from typed tables match current API outputs for existing card data.

## Phase 5 — Search projection

### Actions

* Create `CatalogSearchDocument`.
* Populate global docs from canonical + typed + source data.
* Populate vendor docs from inventory/custom data.
* Add indexes.
* Shadow compare search quality and latency against current endpoint.
* Flip endpoint behind feature flag.

### Gate

Search returns acceptable quality for all launch-critical item types and meets latency target.

## Phase 6 — Vendor inventory and custom moderation

### Actions

* Add `VendorInventoryItem`, `VendorListing`, `VendorPrizeCandidate`.
* Add `VendorCustomItem` moderation workflow.
* Enable vendor pack builder to choose from global catalog, vendor inventory, and approved vendor custom items.
* Ensure all paths snapshot into `PackPrize`.

### Gate

Vendor can create draft pack with catalog card, sealed product, graded template + cert inventory, custom item, accessory, and `OTHER` item; all create valid snapshots.

## Phase 7 — Source conflict queue

### Actions

* Add `CatalogSourceConflict` and `CatalogSourcePatch`.
* Route conflicts to human review.
* Prevent automatic overwrite/merge for identity-sensitive changes.
* Add admin UI queue and resolution actions.

### Gate

Simulated source conflict creates queue item; resolving it updates catalog/provenance without mutating pack snapshots.

## Phase 8 — Strengthen constraints after adoption

### Actions

* Add stricter FKs and check constraints only after backfill and null-handling are proven.
* Add publish-time immutability guards.
* Deprecate old fields only after all reads/writes have moved.
* Do not drop old fields until a separate cleanup project with rollback/export plan.

### Gate

No production code path depends on old fields; historical pack displays are verified.

# 14. Launch sequencing

## Launch-critical path

1. **Schema drift baseline** — required before any meaningful DB work.
2. **Search bridge fix** — required because current autocomplete is multi-second.
3. **PackPrize snapshot creation** — required before new packs are created at scale.
4. **Search projection v1** — required for fast, broad item-type search.
5. **Type-specific tables for all launch item types** — required because product says all item types are launch-critical.
6. **Vendor inventory/custom item path** — required for slabs, custom items, and vendor-owned prize candidates.
7. **Custom item moderation and source conflict queue** — required because global visibility and source conflicts require human review.
8. **Launch gates and shadow verification** — required before replacing current reads.

## Not launch blockers

* Automated market valuation.
* Estimated value infrastructure beyond nullable snapshot extension fields.
* Full compliance/odds audit system.
* External search infrastructure, unless Postgres fails measured P95 on production-sized clone.
* Destructive cleanup of old catalog fields.

Estimated value and compliance/odds audit are explicitly deferred by product decision, so they should remain extension points only: keep value, currency, source, `asOf`, weight, initial stock, remaining stock, and ledger-ready fields, but do not build a valuation engine or compliance reporting system for launch.

# 15. Remaining decisions required from product

Most prior “open questions” are now answered. Remaining decisions should be operational, not architectural blockers.

| Area                  | Required decision                                                     | Blocking?                                        |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| Search latency        | Define P50/P95 target for autocomplete.                               | Blocks search gate, not schema work.             |
| Custom moderation SLA | Who reviews vendor submissions and how fast?                          | Blocks global promotion, not vendor-scoped use.  |
| `OTHER` policy        | What can launch under `OTHER` without abuse?                          | Blocks broad custom/global search.               |
| Published pack edits  | Who can perform audited corrections after publish?                    | Blocks admin tooling, not snapshot schema.       |
| Source trust tiers    | Initial trust labels for `tcgtracking`, vendor patches, manual admin. | Blocks conflict UI defaults, not conflict table. |
| Inventory enforcement | Whether quantity checks are hard at draft time or publish time.       | Blocks vendor inventory launch details.          |

# 16. Risks and rollout gates

## Risk: schema drift continues

Evidence already shows live DB drift from repo Prisma. Gate: CI drift check and staging introspection before deploy.

## Risk: search rewrite still misses indexes

Evidence shows query shape determines whether trigram is used. Gate: checked-in `EXPLAIN ANALYZE` snapshots for prefix, contains, `searchText`, and source/card-number searches.

## Risk: search projection diverges from canonical catalog

Mitigation: rebuildable projection, checksums/counts by game/type/source, shadow search. Gate: parity and latency before feature flag flip.

## Risk: snapshots are incomplete

Mitigation: application-level requirement that every new `PackPrize` has `snapshotJson` and snapshot display fields. Gate: test catalog mutation after pack publish.

## Risk: legacy prize matching is wrong

Mitigation: do not force-match. Preserve current nine prize rows as legacy snapshots.

## Risk: all item types are “launch-critical” but data is uneven

Mitigation: support all item types structurally, but allow nullable detail fields and moderation/status states. Gate: each type must map to search projection and snapshot builder.

## Risk: custom items pollute global catalog

Mitigation: vendor-scoped by default; manual promotion only. Gate: no global search document for custom item unless `PROMOTED_GLOBAL`.

## Risk: source conflicts overwrite good data

Mitigation: queue conflicts; no automatic overwrite/merge for identity-sensitive changes. Gate: conflict simulation creates review item and preserves current canonical display until resolved.

## Risk: index builds impact production

Mitigation: `CREATE INDEX CONCURRENTLY`, production-sized clone, low-traffic rollout, rollback/abort procedure. The prior proposal also flags index build planning as a rollout gate.

# Final position

The final Oripa database architecture should be an additive transition, not a destructive replacement. Keep `CatalogItem` as the bridge, add canonical provenance and type-specific tables, serve search from `CatalogSearchDocument`, route vendor-owned and custom items through vendor inventory/moderation, and make `PackPrize` snapshots the historical source of truth. This directly addresses the evidence-backed P0 issues: schema drift, slow search, missing prize identity/snapshot correctness, and insufficient modeling for non-card products.
