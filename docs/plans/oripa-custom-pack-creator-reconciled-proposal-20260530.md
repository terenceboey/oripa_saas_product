# Oripa Custom Pack Creator and Pack Template System

**Reconciled implementation proposal**
**Date:** 2026-05-30
**Scope:** Source-backed catalog, collaborator/vendor pack creation, immutable live draw pools, inventory allocation, and fair-draw integration.

## 1. Executive decision

Build the feature as an **Oripa-native audited pack-template system** inspired by the visible product patterns from pokemoncard.io and onepiecedb.io. Do **not** clone their hidden implementation, private routes, database shape, or simulator RNG.

The two input proposals agree on the right product direction: users should be able to create reusable custom packs, select official and custom packs in a unified surface, import/export pack definitions, preview openings, and publish a pack into Oripa's paid draw flow. The reconciled proposal adds the missing implementation safeguards needed before engineering starts.

The core architecture is:

```text
Source catalog rows
  -> CatalogItem / canonical search catalog
  -> CatalogPackTemplate + CatalogPackSlotRule
  -> VendorPackTemplate + VendorPackTemplateVersion
  -> VendorPackSlotRule + VendorPackSlotItem
  -> VendorCustomItem + VendorInventoryItem
  -> publish/freeze transaction
  -> live Pack + immutable PackPrize snapshots + poolSnapshotHash
  -> HMAC/provably-fair draw ledger
```

The most important rule is:

> Templates are editable. Live paid packs are frozen.

Once a pack is live, upstream catalog edits, image changes, rarity corrections, price changes, template edits, or source adapter changes must not silently change the live pack's odds, display, stock, or prize pool.

## 2. Reconciled findings and confidence level

### Verified enough to use as product inspiration

- onepiecedb.io exposes a custom-pack creator route, but it is authenticated.
- Public simulator behavior supports a unified official/custom pack selection pattern.
- Public pack simulator metadata includes pack-like fields such as pack name, set ID, image code, region, pack type, and packs per box.
- Public pack-open responses include card display data such as source ID, rarity, image URL, set name, edition, and price.
- Frontend state indicates custom packs are persisted server-side rather than only local browser drafts.

### Useful but not proof

Observed One Piece pack openings show repeated rarity mixes, which strongly suggests a slot-rule/recipe model. That observation is useful for seeding templates, but it is not proof of official odds, replacement rules, duplicate rules, chase rates, or product collation.

### Assumptions that must not become hard dependencies

- The exact database tables, write routes, permissions, and publish flow of pokemoncard.io or onepiecedb.io are unknown.
- Source priority such as pokemoncard.io for Pokemon and onepiecedb.io for One Piece is a configurable product policy, not proven canonical truth.
- Any scraped or inferred simulator behavior must be treated as seed metadata only.

## 3. Current Oripa baseline

Oripa already has the foundation for the live paid-draw side:

- `CatalogItem` for catalog/search identity and source provenance.
- `Pack` for the sellable pack/campaign surface.
- `PackPrize` for draw-pool rows, including catalog references and snapshot fields.
- HMAC/provably-fair draw infrastructure with idempotency, stock awareness, and a ledger.

The missing layer is a reusable recipe/template system. Today, `PackPrize` is forced to behave as both a draft recipe row and a live immutable draw row. That is acceptable for an MVP, but it is not enough for a high-quality custom pack creator.

## 4. Product goals

The custom pack creator should let vendors and internal operators:

1. Start from an official/source-backed pack template.
2. Build a custom pack from scratch.
3. Add catalog cards, vendor-owned inventory, slabs, sealed items, accessories, bonuses, and manual/custom prizes.
4. Define slots by rarity bucket, explicit pool, weighted pool, or wildcard filter.
5. Preview resolved candidates, images, source badges, duplicate conflicts, stock needs, rarity distribution, and estimated value distribution.
6. Import/export draft configurations.
7. Publish a validated template into a live sellable pack with immutable `PackPrize` rows.
8. Run paid draws only through Oripa's existing HMAC/provably-fair draw engine.

## 5. Non-goals

Do not build any of the following:

- A clone of hidden pokemoncard.io or onepiecedb.io internals.
- Cloudflare-protected scraping as the ingestion architecture.
- Display-name-based identity.
- Paid draws using entertainment simulator RNG.
- Live packs that auto-refresh from upstream catalog rows.
- JSON-only prize pools for production paid draws.
- Vendor-created custom items or templates entering the global catalog without review.

## 6. Patched gaps from the two input proposals

### Gap 1: Slot rules were over-trusted

Patch: observed slot rules may seed draft templates only. Paid packs must publish to explicit frozen pool rows with weights, stock, snapshots, and a deterministic pool hash.

### Gap 2: JSON filters were too loose for audit

Patch: keep JSON filters for draft search and flexible UX, but normalize explicit prize-critical selections into `VendorPackSlotItem`. At publish time, every paid candidate must resolve into immutable `PackPrize` rows.

### Gap 3: Vendor inventory reservation was missing

Patch: add `PackPrizeInventoryAllocation` so a slab, sealed product, or other finite vendor-owned item cannot be accidentally sold through multiple live packs.

### Gap 4: Template versioning was missing

Patch: add immutable template versions/snapshots. A live `Pack` must point to the exact template version used to generate its pool.

### Gap 5: Source priority was presented too strongly

Patch: use a configurable source policy per game/language/item type. Do not hard-code any external source as universally canonical.

### Gap 6: Publish/freeze boundary was not explicit enough

Patch: add a dedicated publish/freeze endpoint that validates ownership, resolves slots, reserves inventory, snapshots display/value/source data, computes `poolSnapshotHash`, and creates the live draft candidate in one transaction.

### Gap 7: Security and trust boundaries were underspecified

Patch: the server, not the client, must construct authoritative snapshots from catalog, vendor custom item, and vendor inventory records. Client-supplied snapshot data should be treated as display suggestions only unless explicitly allowed.

### Gap 8: Existing live packs and migration were not addressed

Patch: add a legacy freeze/backfill plan. Existing live packs should receive a `poolSnapshotHash` computed from their current `PackPrize` rows and should be marked with a legacy snapshot version where full catalog provenance is unavailable.

## 7. Target domain model

The exact migrations can be refined during implementation, but the following model boundaries should hold.

### 7.1 Existing model responsibilities

```text
CatalogItem
  Global/source-backed identity for a card, sealed item, accessory, or other catalog item.
  Not a live paid-draw row.

VendorCustomItem
  Vendor-created identity when no catalog identity exists.
  Examples: slab without catalog identity, mystery bonus, accessory, manual prize.

VendorInventoryItem
  Vendor-owned sellable/fulfillable unit or quantity.
  Holds cert, condition, location, quantity, and availability.

Pack
  Sellable paid-draw surface.
  Stores source template/version linkage and poolSnapshotHash.

PackPrize
  Immutable live draw-pool row.
  Stores copied display fields, value, weight, stock, source refs, and snapshots.

PackPrizeInventoryAllocation
  Reservation bridge between PackPrize and VendorInventoryItem.
```

### 7.2 Catalog pack templates

```prisma
model CatalogPackTemplate {
  id             String   @id @default(cuid())
  source         String   // pokemoncard.io, onepiecedb.io, tcgtracking, manual, internal
  sourcePackId   String?
  sourceSlug     String?
  manualKey      String?
  game           String
  language       String   @default("en")
  name           String
  setId          String?
  setName        String?
  imageUrl       String?
  releaseDate    DateTime?
  region         String?
  packKind       String   @default("official") // official, custom, promo, box, manual
  packsPerBox    Int?
  sourcePayload  Json?
  sourcePolicyId String?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  slotRules      CatalogPackSlotRule[]

  @@index([game, language, isActive])
  @@index([source, sourcePackId])
  @@index([source, sourceSlug])
  @@index([setId])
  @@index([name])
}
```

Implementation note: do not rely only on `@@unique([source, sourcePackId, language])` when `sourcePackId` can be null. Enforce one stable key per template: `sourcePackId`, `sourceSlug`, or `manualKey`. Use application validation plus database partial unique indexes where the database supports them.

### 7.3 Catalog slot rules

```prisma
model CatalogPackSlotRule {
  id                 String @id @default(cuid())
  templateId         String
  slotIndex          Int
  quantity           Int
  ruleType           String // RARITY_BUCKET, EXPLICIT_POOL, WEIGHTED_POOL, WILDCARD
  itemType           CatalogItemType @default(CARD)
  rarity             String?
  filters            Json?
  samplingMode       String @default("WEIGHTED")
  replacementPolicy  String @default("WITHOUT_REPLACEMENT")
  duplicatePolicy    String @default("UNIQUE_WITHIN_PACK")
  emptyPoolBehavior  String @default("ERROR")
  config             Json?

  template           CatalogPackTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId, slotIndex])
}
```

### 7.4 Vendor pack templates

```prisma
model VendorPackTemplate {
  id                         String   @id @default(cuid())
  vendorId                   String
  baseCatalogPackTemplateId  String?
  game                       String
  language                   String   @default("en")
  name                       String
  description                String?
  imageUrl                   String?
  packKind                   String   @default("custom")
  packsPerBox                Int?
  status                     String   @default("DRAFT") // DRAFT, REVIEW, APPROVED, ARCHIVED
  visibility                 String   @default("PRIVATE") // PRIVATE, VENDOR_PUBLIC, GLOBAL_CANDIDATE
  config                     Json?
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  slots                      VendorPackSlotRule[]
  versions                   VendorPackTemplateVersion[]

  @@index([vendorId, status])
  @@index([game, visibility])
}
```

### 7.5 Template versions

```prisma
model VendorPackTemplateVersion {
  id                    String   @id @default(cuid())
  vendorPackTemplateId  String
  version               Int
  status                String   @default("SNAPSHOT") // SNAPSHOT, REVIEW, APPROVED, PUBLISHED_ARCHIVE
  configSnapshot        Json
  slotRulesSnapshot     Json
  slotItemsSnapshot     Json
  sourceRefsSnapshot    Json?
  createdAt             DateTime @default(now())
  createdByUserId       String?

  vendorPackTemplate    VendorPackTemplate @relation(fields: [vendorPackTemplateId], references: [id], onDelete: Cascade)

  @@unique([vendorPackTemplateId, version])
  @@index([vendorPackTemplateId, createdAt])
}
```

### 7.6 Vendor slot rules and normalized slot items

```prisma
model VendorPackSlotRule {
  id                    String @id @default(cuid())
  vendorPackTemplateId  String
  slotIndex             Int
  quantity              Int
  ruleType              String // RARITY_BUCKET, EXPLICIT_POOL, WEIGHTED_POOL, WILDCARD
  itemType              CatalogItemType @default(CARD)
  rarity                String?
  filters               Json?
  samplingMode          String @default("WEIGHTED")
  replacementPolicy     String @default("WITHOUT_REPLACEMENT")
  duplicatePolicy       String @default("UNIQUE_WITHIN_PACK")
  emptyPoolBehavior     String @default("ERROR")
  config                Json?

  vendorPackTemplate    VendorPackTemplate @relation(fields: [vendorPackTemplateId], references: [id], onDelete: Cascade)
  items                 VendorPackSlotItem[]

  @@index([vendorPackTemplateId, slotIndex])
}

model VendorPackSlotItem {
  id                    String @id @default(cuid())
  vendorPackSlotRuleId  String
  refType               String // CATALOG_ITEM, VENDOR_CUSTOM_ITEM, VENDOR_INVENTORY_ITEM
  catalogItemId         String?
  vendorCustomItemId    String?
  vendorInventoryItemId String?
  weight                Int    @default(1)
  quantityLimit         Int?
  estimatedValue        Decimal?
  currency              String?
  notes                 String?
  snapshot              Json?
  createdAt             DateTime @default(now())

  vendorPackSlotRule    VendorPackSlotRule @relation(fields: [vendorPackSlotRuleId], references: [id], onDelete: Cascade)

  @@index([vendorPackSlotRuleId])
  @@index([catalogItemId])
  @@index([vendorCustomItemId])
  @@index([vendorInventoryItemId])
}
```

### 7.7 Vendor custom item

```prisma
model VendorCustomItem {
  id                  String   @id @default(cuid())
  vendorId            String
  game                String?
  itemType            CatalogItemType
  name                String
  setName             String?
  localId             String?
  rarity              String?
  condition           String?
  gradingCompany      String?
  certNumber          String?
  declaredValue       Decimal?
  currency            String?
  imageUrl            String?
  imageLargeUrl       String?
  imageReviewStatus   String   @default("PENDING")
  moderationStatus    String   @default("PENDING")
  attributes          Json?
  status              String   @default("ACTIVE")
  visibility          String   @default("PRIVATE")
  createdByUserId     String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([vendorId, status])
  @@index([itemType])
  @@index([moderationStatus])
}
```

### 7.8 Inventory allocation

```prisma
model PackPrizeInventoryAllocation {
  id                    String   @id @default(cuid())
  packPrizeId           String
  vendorInventoryItemId String
  quantityReserved      Int
  quantityConsumed      Int      @default(0)
  status                String   @default("RESERVED") // RESERVED, RELEASED, CONSUMED
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([packPrizeId])
  @@index([vendorInventoryItemId, status])
}
```

Reservation rules:

- Publishing a pack reserves the inventory needed to back the frozen `PackPrize` rows.
- Draw settlement consumes the allocation.
- Unpublishing or archiving a pack releases unused allocation.
- The same inventory unit cannot back multiple live packs unless the item is explicitly configured as multi-quantity inventory and enough unreserved quantity exists.

### 7.9 Live Pack additions

Add or formalize these fields on `Pack`:

```text
sourceTemplateType          // CATALOG_TEMPLATE, VENDOR_TEMPLATE, MANUAL, LEGACY
sourceTemplateId
sourceTemplateVersionId
poolSnapshotHash
poolSnapshotVersion
publishedFromTemplateAt
publishedByUserId
publishIdempotencyKey
```

### 7.10 PackPrize snapshot requirements

For live packs:

```text
catalogSnapshot required when catalog-backed
vendorCustomSnapshot required when vendor-custom-backed
inventorySnapshot required when inventory-backed
ruleSnapshot required when created from a slot rule
display fields copied onto PackPrize
value/weight/stock copied onto PackPrize
source refs copied onto PackPrize
no automatic upstream refresh after LIVE
```

For catalog-backed prizes, the server should construct `catalogSnapshot` from the current `CatalogItem`. For vendor custom and inventory-backed prizes, the server should construct snapshots from vendor-owned rows after authorization checks.

## 8. Rule semantics

Every slot rule must define enough behavior to resolve predictably:

```text
ruleType: RARITY_BUCKET | EXPLICIT_POOL | WEIGHTED_POOL | WILDCARD
samplingMode: WEIGHTED | UNIFORM | ORDERED
replacementPolicy: WITH_REPLACEMENT | WITHOUT_REPLACEMENT
duplicatePolicy: ALLOW_DUPLICATES | UNIQUE_WITHIN_SLOT | UNIQUE_WITHIN_PACK
emptyPoolBehavior: ERROR | SKIP | FALLBACK
priceSourcePolicy
imageSourcePolicy
rarityNormalizationPolicy
languagePolicy
conditionPolicy
sourcePriorityPolicy
```

Default for paid packs should be conservative:

```text
samplingMode = WEIGHTED
replacementPolicy = WITHOUT_REPLACEMENT
duplicatePolicy = UNIQUE_WITHIN_PACK
emptyPoolBehavior = ERROR
```

The preview API may show warnings. The publish endpoint must enforce errors.

## 9. Publish/freeze transaction

Add a dedicated endpoint:

```http
POST /v1/vendor-pack-templates/{id}/publish-to-pack
```

Required behavior:

1. Validate authenticated user and vendor ownership.
2. Validate template status and slot rule schema.
3. Create an immutable `VendorPackTemplateVersion` snapshot, or reuse an approved version.
4. Resolve each slot rule into candidate catalog/custom/inventory refs.
5. Apply source, rarity, language, duplicate, replacement, and empty-pool policies.
6. Validate that every explicit item belongs to the vendor or is globally selectable.
7. Server-build authoritative snapshots from catalog/vendor/inventory rows.
8. Reserve required inventory in a transaction.
9. Generate immutable `PackPrize` rows with copied display fields, value, weight, stock, and snapshots.
10. Create or update the target `Pack` as draft/live candidate.
11. Compute deterministic `poolSnapshotHash` from canonicalized pool content.
12. Store template version linkage and publish metadata on `Pack`.
13. Commit transaction.
14. Return the pack plus validation report.

The endpoint must be idempotent for retries. Use an idempotency key so a network retry cannot duplicate live packs, prize rows, or inventory reservations.

## 10. Deterministic pool hash

The `poolSnapshotHash` should be computed from a canonical JSON representation of the frozen pool. Include at minimum:

```text
packId or stable publish ID
template type and version ID
slot rule snapshots
prize labels and display fields
source refs
catalog/vendor/inventory snapshots or snapshot hashes
weights
stock
estimated values and currency
inventory allocation refs and reserved quantities
poolSnapshotVersion
```

Use a deterministic serializer with stable key ordering. Draw ledger entries should store the `poolSnapshotHash` used at draw time so any future audit can prove which frozen pool was used.

## 11. API surface

### P0 APIs

```http
POST /v1/packs
PATCH /v1/packs/{id}
POST /v1/packs/{id}/publish-freeze
POST /v1/vendor-pack-templates/{id}/publish-to-pack
GET  /v1/packs/{id}/pool-snapshot
```

P0 hardening for create/update:

- Accept catalog-backed prize refs.
- Accept vendor custom and vendor inventory refs.
- Persist `catalogItemId`, `catalogSource`, `catalogSourceItemId`, `catalogSnapshot`, set/card fields, rarity, image URLs, value, weight, and stock.
- Ensure `buildPrizeRows()` persists these fields rather than only label/image/value.
- Reject cross-vendor refs.
- Reject live-pack mutation that would alter frozen odds or display without a new publish/freeze cycle.

### P1 template APIs

```http
GET    /v1/catalog-pack-templates
POST   /v1/catalog-pack-templates
GET    /v1/catalog-pack-templates/{id}
POST   /v1/vendor-pack-templates
PATCH  /v1/vendor-pack-templates/{id}
POST   /v1/vendor-pack-templates/{id}/slots
PATCH  /v1/vendor-pack-slot-rules/{id}
POST   /v1/vendor-pack-slot-rules/{id}/items
DELETE /v1/vendor-pack-slot-items/{id}
POST   /v1/vendor-pack-templates/{id}/preview
POST   /v1/vendor-pack-templates/{id}/validate
POST   /v1/vendor-pack-templates/{id}/simulate
POST   /v1/vendor-pack-templates/{id}/import
GET    /v1/vendor-pack-templates/{id}/export
```

### P2 governance APIs

```http
POST /v1/admin/source-conflicts/{id}/resolve
POST /v1/admin/vendor-pack-templates/{id}/promote
GET  /v1/admin/packs/{id}/template-diff
GET  /v1/admin/inventory-allocations
```

## 12. Creator UX

### Step 1: Choose build mode

- Build from official/source-backed template.
- Build custom pack from scratch.
- Import list, CSV, or mass-entry style input.

### Step 2: Choose game/source policy

Examples:

- Pokemon: prefer pokemoncard.io when allowed and available; fallback to tcgtracking or internal catalog policy.
- One Piece: prefer onepiecedb.io when allowed and available; fallback to tcgtracking or internal catalog policy.
- Future games: use configured adapters and review workflow.

The UI should show source badges and source confidence. It should not imply that inferred external simulator behavior is official pack math.

### Step 3: Define slots

Supported slot types:

- Rarity bucket: example, `6 Common`.
- Explicit pool: example, `1 chase from these 20 cards`.
- Weighted pool: example, tier A/B/C with explicit weights.
- Wildcard/filter: example, any English rare from a set.
- Vendor custom or vendor inventory slot.

### Step 4: Preview and validate

Preview should show:

```text
candidate counts
resolved card/prize images
rarity distribution
source badges
missing images
duplicate/canonical conflicts
source conflicts
estimated stock need
estimated value distribution
inventory availability
cross-vendor permission errors
empty pools
policy warnings
```

### Step 5: Freeze to live pack

Publishing should:

- Generate `PackPrize` rows.
- Copy image/name/set/rarity/value/stock/weight.
- Store source refs.
- Store catalog/vendor/custom/inventory snapshots.
- Reserve inventory.
- Compute `poolSnapshotHash`.
- Link the `Pack` to the exact template version.

### Step 6: Paid draw

Paid draws continue through Oripa's HMAC/provably-fair draw ledger. The template system produces and validates the pool; the draw engine selects from the frozen pool.

## 13. Source policy and ingestion

Create a configurable source policy layer instead of hard-coded source priority.

A source policy should define:

```text
game
language
itemType
preferred source order
fallback source order
allowed ingestion method
terms/licensing status
rarity normalization map
image selection policy
price/value source policy
conflict resolution behavior
review requirements
```

Important rules:

- Do not use Cloudflare-protected scraping as a production ingestion strategy.
- Do not import private custom packs from third-party sites.
- Keep source refs and source payload hashes for audit.
- When sources disagree, preserve both refs, choose a canonical display candidate by policy, and queue conflict review.
- Source terms/licensing approval is a pre-launch gate for any automated ingestion or image usage.

## 14. Security and authorization

P0 security requirements:

- Every vendor template, slot, custom item, and inventory reference must be scoped by `vendorId`.
- Server-side authorization must verify ownership for every referenced `vendorCustomItemId` and `vendorInventoryItemId`.
- A vendor cannot publish another vendor's custom item or inventory item by guessing IDs.
- Client-provided snapshots are not authoritative.
- Publish operations must be transactional and idempotent.
- Live pack mutation must be restricted. Any change to prize pool, weights, stock, snapshots, or template version requires a new publish/freeze cycle.
- Admin promotion of vendor templates to global templates must require review.

## 15. Migration and rollout plan

### Phase 0: Legacy stabilization

- Add nullable template/pool metadata fields to `Pack`.
- Ensure current `PackPrize` fields can preserve catalog refs and snapshots.
- Compute `poolSnapshotHash` for existing live packs from current `PackPrize` rows.
- Mark existing packs as `sourceTemplateType = LEGACY` where no template exists.
- Do not attempt to retroactively infer missing catalog provenance unless an admin migration explicitly reviews it.

### Phase 1: P0 publish safety

- Harden `createPackSchema` and `updatePackSchema`.
- Update `buildPrizeRows()` to persist catalog refs, source refs, snapshots, images, set/card fields, value, weight, stock, and rarity.
- Add publish/freeze endpoint.
- Add inventory allocation/reservation.
- Add idempotency and authorization tests.

### Phase 2: Template creator MVP

- Add `VendorPackTemplate`, `VendorPackTemplateVersion`, `VendorPackSlotRule`, and `VendorPackSlotItem`.
- Add `VendorCustomItem`.
- Build creator UI around catalog search, explicit items, slot rules, import/export, preview, and validation.
- Publish templates into frozen `PackPrize` rows.

### Phase 3: Official template library

- Add `CatalogPackTemplate` and `CatalogPackSlotRule`.
- Seed official templates from allowed source metadata and manual rules.
- Use observed simulator metadata only as seed data, not odds proof.
- Add review for official pack slot assumptions.

### Phase 4: Governance and scale

- Add source conflict review.
- Add global template promotion.
- Add admin diff view between template version and frozen live pack.
- Add inventory allocation audit.
- Add source policy management.

## 16. Implementation priority

### P0: Required before any paid/custom-pack launch

1. Pack create/update API preserves catalog-backed prize data.
2. `buildPrizeRows()` persists catalog refs, source refs, snapshots, display fields, value, weight, and stock.
3. Dedicated publish/freeze endpoint exists.
4. Live `Pack` stores `poolSnapshotHash` and template snapshot metadata.
5. `PackPrize` snapshots are immutable after live publish.
6. Inventory allocation/reservation prevents oversell.
7. Vendor authorization checks are enforced on every referenced custom/inventory item.
8. HMAC/provably-fair draw engine remains separate from preview simulator.
9. Test suite covers catalog, manual, vendor custom, inventory, immutability, idempotency, and cross-vendor rejection.
10. Source usage and image ingestion have terms/licensing approval before automated production ingestion.

### P1: Needed for full custom-pack creator UX

1. `CatalogPackTemplate` and `CatalogPackSlotRule`.
2. `VendorPackTemplate` and `VendorPackTemplateVersion`.
3. `VendorPackSlotRule` and normalized `VendorPackSlotItem`.
4. `VendorCustomItem`.
5. Preview, validate, simulate, import, and export APIs.
6. Creator UI for slots, images, source badges, stock needs, and publish validation.

### P2: Governance and scale

1. Source conflict review.
2. Global template promotion review.
3. Admin diff: template version versus frozen live pack.
4. Inventory allocation/reservation audit.
5. Source policy management.
6. Value/price source monitoring.
7. Operational reports for missing images, empty pools, and stale source data.

## 17. Test plan

### Unit tests

- Slot rule validation.
- Rule resolution for rarity bucket, explicit pool, weighted pool, and wildcard.
- Duplicate policy enforcement.
- Replacement policy enforcement.
- Empty-pool behavior.
- Canonical pool hash stability.
- Source policy selection and fallback.

### Integration tests

- Catalog-backed prize creation preserves `catalogItemId`, source refs, snapshot, image, set/card fields, rarity, value, weight, and stock.
- Manual prize creation works without catalog refs but still snapshots display/value fields.
- Vendor custom prize creation snapshots vendor custom data.
- Vendor inventory-backed prize creation reserves inventory.
- Cross-vendor custom item and inventory refs are rejected.
- Template publish is idempotent.
- Catalog update after publish does not mutate live `PackPrize` rows.
- Template edit after publish does not mutate live `PackPrize` rows.
- Live pack cannot silently mutate from template.
- Inventory draw settlement consumes reserved allocation.
- Unpublish/archive releases unused allocation.

### End-to-end tests

- Vendor builds a custom pack from catalog search, previews it, publishes it, and runs a paid draw through the fair draw ledger.
- Vendor builds a pack from a template, changes slot weights, publishes it, and verifies frozen odds remain unchanged after later template edits.
- Admin promotes a vendor template to global candidate after review.
- Admin compares a template version to the live frozen pack and sees changed catalog metadata since publish.

## 18. Acceptance criteria

Engineering should not treat the proposal as complete until these are true:

- A live paid pack can be reconstructed from frozen `PackPrize` rows and snapshots without querying external catalog sources.
- The same live paid pack has a deterministic `poolSnapshotHash` stored on `Pack` and in draw ledger entries.
- Editing a source catalog row does not change a live pack's display, odds, stock, or draw behavior.
- Editing a template does not change an already live pack.
- Vendor inventory cannot be oversold across live packs.
- Cross-vendor item references are rejected server-side.
- JSON filters are never the only production representation of a paid draw pool.
- Paid draws continue to use Oripa's HMAC/provably-fair engine.
- External source behavior is used as product inspiration or seed metadata only, not as unverifiable paid odds truth.

## 19. Recommended final proposal

Approve the architecture direction and begin P0 implementation, but do not start the full template-builder P1 until the freeze/snapshot/inventory foundations are in place.

The correct implementation sequence is:

```text
P0
  Harden existing Pack/PackPrize creation.
  Persist catalog refs and snapshots.
  Add publish/freeze behavior.
  Add poolSnapshotHash.
  Add inventory allocation.
  Keep HMAC/provably-fair draw flow.

P1
  Add template/version/slot/item tables.
  Add vendor custom item support.
  Add preview/validate/simulate/import/export APIs.
  Build the creator UX.

P2
  Add source governance.
  Add global template promotion.
  Add admin diffing.
  Add inventory and source-policy audits.
```

This captures the useful pokemoncard.io/onepiecedb.io pattern - fast visual pack creation, official/custom templates, import/export, and opening preview - while preserving Oripa's stronger requirements: vendor ownership, source provenance, immutable prize snapshots, inventory safety, and paid-draw fairness.
