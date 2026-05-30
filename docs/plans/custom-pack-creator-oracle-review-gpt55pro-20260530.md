## 1. Verdict

**Conditional approve the architectural direction; do not approve the proposal as implementation-ready.**

The proposal is right on the core architecture: **do not clone pokemoncard.io / onepiecedb.io internals**; use their visible pattern as product inspiration, then build Oripa’s own additive template layer on top of the existing catalog, pack, prize, and fair-draw model. The attached evidence supports three useful patterns: authenticated custom-pack creation, unified official/custom pack selection, and persisted pack metadata such as `pack_id`, `pack_type`, `img_code`, and `packs_per_box`.

The proposal is **not** strong enough where it infers hidden internals. The creator routes are gated; unauthenticated probes found redirects, `401`, `404`, and `405`, not the real custom-pack write model. Treat anything about their exact DB/API implementation as **assumption**, not evidence.

My verdict: **build the Oripa version as an additive PackTemplate / SlotRule / VendorCustomItem system, but freeze every sellable pack into immutable `PackPrize` snapshots and keep Oripa’s existing HMAC/provably-fair draw engine.** That part is well aligned with the artifact and with paid-draw requirements.

---

## 2. Blocking issues or unsafe assumptions

### Blocking issue 1: the proposal over-trusts inferred slot rules

The observed pack results show five One Piece examples with rarity mixes such as `6 Common, 3 Uncommon, 2 Rare, 1 Secret Rare` or `6 Common, 3 Uncommon, 2 Rare, 1 Leader`, and the proposal says this “looks like a slot-rule engine.” That is a reasonable inference, but it is **not proof of official odds, replacement behavior, duplicate rules, chase rates, or per-product collation logic**.

**Required correction:** use observed slot rules only as seed metadata for templates, never as paid odds truth. For sellable Oripa packs, the rule engine must resolve into an explicit frozen pool with visible weights, stock, and snapshot hash before publishing.

### Blocking issue 2: custom-pack persistence is evidence-supported, but still not fully proven

The JS state includes `pack_id`, `packPackType`, `pack_type/type: "custom"`, `img_code`, and `packs_per_box`, and the artifact concludes custom packs are persisted server-side. That is a strong inference, but the write routes were not observed.

**Label:** **Assumption.**
**Safe use:** copy the product pattern: official/custom pack records appear together in the simulator.
**Unsafe use:** assuming their table structure, permissions, publish flow, or API contracts.

### Blocking issue 3: `CatalogPackSlotRule.filters Json` is too loose for audit-grade publishing

The proposed `CatalogPackSlotRule` uses `filters Json?` and rule types such as `rarity_bucket`, `explicit_pool`, `weighted_pool`, and `wildcard`. That is acceptable for draft UX, but not sufficient for a paid draw system unless publishing resolves those rules into deterministic, auditable prize rows.

**Required correction:** at publish time, store:

* resolved candidate item IDs;
* source refs;
* copied display fields;
* copied value/weight/stock;
* rule version;
* duplicate policy;
* replacement policy;
* candidate count;
* pool snapshot hash;
* template version used.

The proposal already says to freeze into `PackPrize.catalogSnapshot`; that must be treated as mandatory P0 behavior, not a later polish item.

### Blocking issue 4: vendor inventory is under-specified

The artifact correctly says vendors need slabs, sealed items, accessories, bonus prizes, and manual/custom items, and proposes `VendorCustomItem`. It also says vendor inventory should be the cert/condition/quantity layer.

That is directionally right, but the proposal does not fully define how a live `PackPrize` reserves or consumes vendor inventory. For a marketplace, this is a real blocker.

**Required correction:** distinguish these concepts:

```text
CatalogItem = global identity
VendorCustomItem = vendor-created identity when no catalog identity exists
VendorInventoryItem = vendor-owned sellable/fulfillable unit
PackPrize = immutable draw-pool snapshot
PackPrizeInventoryAllocation = reserved stock backing the prize
```

Without allocation/reservation, the same slab or sealed item can be listed in multiple packs and oversold.

### Blocking issue 5: template versioning is missing

The proposal separates templates from live packs, which is correct. But templates are mutable drafts by nature. A live pack needs to know **which exact template version** produced its pool.

**Required correction:** add template versioning or immutable publish snapshots. Do not let `Pack` point only to a mutable `VendorPackTemplate` or `CatalogPackTemplate`.

At minimum:

```text
VendorPackTemplate
VendorPackTemplateVersion
Pack.templateVersionId?
Pack.poolSnapshotHash
PackPrize.catalogSnapshot
```

The artifact’s own final architecture ends with immutable `PackPrize` snapshots and a provably fair draw ledger, so versioning is the missing bridge between those layers.

### Blocking issue 6: source priority claims are partly assumptions

The proposal recommends Pokémon from `pokemoncard.io`, One Piece from `onepiecedb.io`, and `tcgtracking` as fallback. That may be sensible, but the attached evidence only proves route behavior and observed simulator shapes; it does not prove coverage completeness, data quality, licensing, or canonical superiority for every game/source.

**Label:** **Assumption.**
Use source priority as configurable policy, not hard-coded truth.

---

## 3. Architecture deltas to apply

### Delta A — Add template layer, but make publish/freeze the hard boundary

The proposed architecture should become:

```text
CatalogItem / source catalog
    ↓
CatalogPackTemplate + CatalogPackSlotRule
    ↓
VendorPackTemplate + VendorPackSlotRule + VendorCustomItem
    ↓ publish/freeze transaction
Live Pack + immutable PackPrize snapshots
    ↓
HMAC/provably-fair draw ledger
```

This matches the artifact’s additive architecture and avoids destructive pruning.

The key rule: **templates are editable; live packs are frozen.**
No live pack should silently refresh because upstream catalog data, rarity, image URL, price, or source metadata changed.

### Delta B — Replace JSON-only explicit pools with a normalized slot-item table

Keep JSON for flexible draft filters, but do not rely on JSON blobs for prize-critical explicit pools.

Add something like:

```prisma
model VendorPackSlotItem {
  id                    String @id @default(cuid())
  vendorPackSlotRuleId  String
  refType               String // CATALOG_ITEM, VENDOR_CUSTOM_ITEM, VENDOR_INVENTORY_ITEM
  catalogItemId         String?
  vendorCustomItemId    String?
  vendorInventoryItemId String?
  weight                Int
  quantityLimit         Int?
  notes                 String?
  snapshot              Json?

  @@index([vendorPackSlotRuleId])
  @@index([catalogItemId])
  @@index([vendorCustomItemId])
  @@index([vendorInventoryItemId])
}
```

The proposal’s `explicitItems Json?` is fine for a rough prototype, but it is too weak for permission checks, inventory reservation, auditing, and diffing.

### Delta C — Add template versioning

Use mutable templates for editing and immutable versions for publish.

```prisma
model VendorPackTemplateVersion {
  id                    String   @id @default(cuid())
  vendorPackTemplateId  String
  version               Int
  status                String   // DRAFT, REVIEW, APPROVED, PUBLISHED_ARCHIVE
  configSnapshot        Json
  slotRulesSnapshot     Json
  sourceRefsSnapshot    Json?
  createdAt             DateTime @default(now())
  createdByUserId       String?

  @@unique([vendorPackTemplateId, version])
}
```

Then `Pack` can store:

```text
sourceTemplateType
sourceTemplateId
sourceTemplateVersionId
poolSnapshotHash
publishedFromTemplateAt
```

### Delta D — Make rule semantics explicit

The proposed `ruleType` names are useful, but underspecified. Add fields or config keys for:

```text
samplingMode: WEIGHTED | UNIFORM | ORDERED
replacementPolicy: WITH_REPLACEMENT | WITHOUT_REPLACEMENT
duplicatePolicy: ALLOW_DUPLICATES | UNIQUE_WITHIN_SLOT | UNIQUE_WITHIN_PACK
emptyPoolBehavior: ERROR | SKIP | FALLBACK
priceSourcePolicy
imageSourcePolicy
rarityNormalizationPolicy
languagePolicy
conditionPolicy
```

This matters because “6 Common” is not enough to produce a legally/auditably stable draw pool.

### Delta E — Keep Oripa’s draw engine separate from simulator UX

The artifact is explicit: onepiecedb pack-sim is entertainment/simulation and does not expose fairness proof in the open response; Oripa already has HMAC server seed/client seed/nonce, pool snapshot hash, idempotency, ledger, and stock decrement infrastructure.

So the pack creator may have a preview/opening simulator, but paid draws must continue through Oripa’s draw ledger.

### Delta F — Treat global reuse as review-gated

The proposal correctly defaults vendor templates/custom items to private and suggests review before global reuse. Keep that.

Do not let vendor-created names, images, odds, or manual prizes leak into the global catalog without review.

---

## 4. DB schema/API changes ranked P0/P1/P2

### P0 — Required before any paid/custom-pack launch

1. **Pack create/update API must preserve catalog-backed prize data**

The artifact already calls this out: `createPackSchema` / `updatePackSchema` need to accept `catalogItemId`, `catalogSource`, `catalogSourceItemId`, `catalogSnapshot`, set/card fields, rarity, and images; `buildPrizeRows()` must persist them.

2. **Publish/freeze endpoint**

Add a dedicated API operation:

```http
POST /v1/vendor-pack-templates/{id}/publish-to-pack
```

It should:

```text
validate template ownership
validate slot rules
resolve catalog/vendor/custom refs
reserve inventory if applicable
generate immutable PackPrize rows
copy catalog/vendor/custom snapshots
compute poolSnapshotHash
link template version to Pack
return Pack draft/live candidate
```

3. **Immutable `PackPrize` snapshot enforcement**

For live packs:

```text
catalogSnapshot required when catalog-backed
vendorCustomSnapshot required when vendor-custom-backed
inventorySnapshot required when inventory-backed
display fields copied onto PackPrize
no automatic upstream refresh after LIVE
```

This is already aligned with the proposal’s “freeze to live pack” recommendation.

4. **Inventory allocation / reservation**

Add or formalize:

```prisma
model PackPrizeInventoryAllocation {
  id                    String @id @default(cuid())
  packPrizeId           String
  vendorInventoryItemId String
  quantityReserved      Int
  quantityConsumed      Int @default(0)
  status                String // RESERVED, RELEASED, CONSUMED
}
```

This is missing from the proposal but necessary for real vendor prizes.

5. **Authorization checks**

Every vendor template/custom item/inventory reference must be scoped by `vendorId`. A vendor should not be able to publish another vendor’s custom item or inventory item by ID.

6. **Tests**

The proposal’s test requirement should be P0, not optional: prove catalog refs and snapshots survive create/update.

Add tests for:

```text
catalog-backed prize creation
manual prize creation
vendor custom prize creation
template publish idempotency
snapshot immutability after catalog update
inventory reservation
LIVE pack cannot silently mutate from template
```

---

### P1 — Needed for boss-level custom-pack creator UX

1. **Add `CatalogPackTemplate` and `CatalogPackSlotRule`**

The proposal’s model is directionally correct and maps to observed pack metadata like `pack_name`, `set_id`, `region`, `type`, and `packs_per_box`.

But adjust the uniqueness rule. `sourcePackId` is optional in the proposal; optional unique keys are risky because manual/custom records may not have a stable external ID.

Use:

```text
source
sourcePackId?
sourceSlug?
language
game
```

And enforce one of:

```text
sourcePackId is present
OR sourceSlug/manualKey is present
```

2. **Add `VendorPackTemplate`, `VendorPackSlotRule`, and normalized `VendorPackSlotItem`**

The proposal’s `VendorPackTemplate` / `VendorPackSlotRule` is the right shape, but `explicitItems Json` should become a real child table for anything that affects prize selection.

3. **Add `VendorCustomItem`**

The proposed `VendorCustomItem` is necessary for slabs, sealed items, accessories, bonus prizes, and manual prizes.

I would add:

```text
condition
certNumber / gradingCompany for slabs
declaredValue
currency
imageReviewStatus
moderationStatus
createdByUserId
```

4. **Template preview API**

Add:

```http
POST /v1/pack-templates/preview
POST /v1/vendor-pack-templates/{id}/validate
POST /v1/vendor-pack-templates/{id}/simulate
```

Preview should show:

```text
candidate counts
missing images
source conflicts
duplicate candidates
estimated stock need
resolved rarity distribution
estimated value distribution
```

The artifact’s proposed UX already calls for previewing images, rarity distribution, source badges, stock needs, dedupe collapse, source conflicts, and missing images.

5. **Import/export format**

Support the artifact’s proposed text import format:

```text
source|sourceItemId|language|stock|weight|estimatedValue
name|stock|weight|estimatedValue
```

This should be a creator/import convenience, not the canonical storage model.

---

### P2 — Longer-term governance and scale

1. **Source conflict review workflow**

The artifact’s P2 recommendation is correct: when sources disagree on rarity, image, set, or TCGPlayer ID, keep both external refs, choose a canonical best source, create a review queue, and preserve the vendor’s publish-time snapshot.

2. **Global template promotion workflow**

Vendor templates should start private. Promotion to reusable/global should require review. This is already in the proposal and should stay.

3. **Admin compare view**

The proposal suggests an admin compare view between draft template and frozen live pack. Good. Make it diff:

```text
template slot rule
resolved candidate pool
frozen PackPrize rows
changed catalog metadata since publish
changed estimated value since publish
inventory allocation state
```

4. **Source adapter policy**

The proposal recommends `pokemoncard.io` / `onepiecedb.io` as preferred and `tcgtracking` as fallback, but this should become configurable source policy, not hard-coded architecture.

---

## 5. What not to copy from pokemoncard.io / onepiecedb.io

Do **not** copy their hidden implementation. The artifact could not verify the private custom creator routes; onepiecedb’s creator is authenticated, and pokemoncard.io blocks unauthenticated/scraper access with Cloudflare.

Do **not** copy:

* **Simulator RNG for paid draws.** Oripa already has HMAC/provably-fair infrastructure; keep it.
* **Display name as identity.** Use source IDs, catalog IDs, vendor custom IDs, and immutable snapshots.
* **Live refreshing from upstream catalog rows.** Once a pack is live, upstream changes must not silently change odds/display.
* **Cloudflare-protected scraping as ingestion architecture.** The artifact explicitly warns against this.
* **Hidden custom packs entering global catalog by default.** Vendor-created templates/customs need private default state and review before global reuse.
* **Entertainment simulator assumptions as official collation/odds.** The observed pack openings are useful evidence of shape, not proof of exact official pack math.
* **A JSON-only prize pool for production.** JSON config is fine for draft UX; paid draws need resolved rows, snapshots, hashes, and ledger linkage.

What to copy as product patterns:

* official/custom unified picker;
* reusable custom pack templates;
* import/export config;
* shareable draft state;
* region/source filters;
* box mode / `packsPerBox`;
* batch actions adapted for vendor inventory workflows.

---

## 6. Final revised recommendation

**Build the feature, but frame it as Oripa’s own audited pack-template system, not a reverse-engineered clone.**

The safe implementation path is:

```text
P0:
Use existing CatalogItem + Pack + PackPrize.
Harden create/update APIs.
Persist catalog refs and catalogSnapshot.
Add publish/freeze behavior.
Keep HMAC/provably-fair draw flow.
Do not require risky migration first.

P1:
Add CatalogPackTemplate / CatalogPackSlotRule.
Add VendorPackTemplate / VendorPackSlotRule / VendorPackSlotItem.
Add VendorCustomItem.
Add preview/validate/simulate APIs.
Resolve templates into immutable PackPrize rows at publish.

P2:
Add source conflict review.
Add global template promotion.
Add admin diffing.
Add source policy governance.
```

The proposal’s strongest idea is the separation between **recipe/template** and **live sellable draw pool**. Keep that. The weakest parts are the inferred internals, loose JSON slot config, missing inventory allocation, and missing template versioning.

Final decision: **approve as a product/architecture direction; revise before engineering starts.** The revised architecture should be additive, snapshot-first, vendor-scoped, review-gated, and fair-draw-native:

```text
Source catalog rows
→ canonical/search catalog
→ official catalog pack templates + slot rules
→ vendor custom items + vendor pack templates
→ publish/freeze transaction
→ live Pack + immutable PackPrize snapshots
→ HMAC/provably-fair draw ledger
```

That captures the useful pokemoncard.io / onepiecedb.io pattern without importing their unaudited assumptions or hidden implementation risks.
