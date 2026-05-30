# Oracle-closed revision addendum

Oracle run: `custom-pack-creator-architecture-review` using `gpt-5.5-pro` browser mode.
Oracle artifact: `docs/plans/custom-pack-creator-oracle-review-gpt55pro-20260530.md`.

## Oracle verdict

Conditional approve the architectural direction; do **not** treat the first proposal as implementation-ready. The correct direction is an additive Oripa-native pack-template system inspired by visible pokemoncard.io/onepiecedb.io patterns, not a clone of their hidden implementation.

## Accepted blockers / changes before engineering

1. **Observed slot rules are seed metadata only.** Do not treat sampled One Piece simulator rarity mixes as paid odds truth. Paid Oripa packs must resolve to explicit frozen pools with weights, stock, and snapshot hashes.
2. **Custom-pack persistence remains an assumption.** We observed gated creator routes and JS state fields like custom `pack_id`; we did not observe private write APIs or DB structure. Copy the product pattern only.
3. **JSON filters are draft UX, not audit substrate.** Keep flexible JSON for search/filter drafts, but normalize explicit prize-critical pool items.
4. **Vendor inventory allocation is mandatory.** Add a reservation/allocation concept so the same slab/sealed item cannot back multiple live packs unless explicitly allowed.
5. **Template versioning is mandatory.** Mutable templates need immutable versions/snapshots at publish time.
6. **Source priority must be configurable policy.** `pokemoncard.io`/`onepiecedb.io` preference is currently a reasonable product policy, not universal proof of canonical superiority.

## Revised target architecture

```text
CatalogItem / source catalog
  -> CatalogPackTemplate + CatalogPackSlotRule
  -> VendorPackTemplate + VendorPackSlotRule + VendorPackSlotItem
  -> VendorCustomItem + VendorInventoryItem
  -> publish/freeze transaction
  -> live Pack + immutable PackPrize snapshots + poolSnapshotHash
  -> HMAC/provably-fair draw ledger
```

## Revised P0/P1/P2

### P0 — before paid/custom-pack launch

- Pack create/update must persist catalog refs and snapshots into `PackPrize`.
- Add explicit publish/freeze boundary.
- Add `poolSnapshotHash` / template snapshot metadata to the live pack path.
- Normalize or explicitly store selected pool entries for audit; do not rely only on JSON filters.
- Keep HMAC draw engine separate from preview simulator.

### P1 — template builder layer

- `CatalogPackTemplate` + `CatalogPackSlotRule`.
- `VendorPackTemplate` + `VendorPackTemplateVersion`.
- `VendorPackSlotRule` + normalized `VendorPackSlotItem`.
- `VendorCustomItem`.
- Preview/validate APIs that resolve slots into candidate pools and show missing images/conflicts/coverage.

### P2 — governance/review

- Source conflict review.
- Global template promotion review.
- Admin diff: template version vs live frozen pack.
- Inventory allocation/reservation audit.

---

# Reverse engineering: pokemoncard.io / onepiecedb.io custom pack creator → Oripa collaborator DB proposal

Date: 2026-05-30
Scope: source-backed catalog + vendor pack-building architecture for Oripa collaborator DB.

## 0. Bottom line

The feature my boss likes is not just "search cards and add rows". The valuable pattern is a **two-layer pack builder**:

1. **Catalog-backed pack recipes**: choose official/source-backed sets/cards, preserve source IDs/images/rarity/set metadata, and model pack slots as rules.
2. **User/vendor custom packs**: authenticated users can create reusable custom pack definitions; those definitions become selectable/openable in the same pack-sim surface as official packs.

For Oripa, apply this as:

- Keep `CatalogItem` / future canonical catalog as the global search universe.
- Add a first-class **PackTemplate / PackRecipe / PackSlotRule** layer for reusable pack composition.
- Add **VendorCustomItem** and **VendorPackTemplate** for vendor-owned custom cards/slabs/sealed/manual prizes.
- When a vendor turns a template into a live sellable pack, copy immutable snapshots into `PackPrize`; never depend on live upstream catalog rows for live odds/display.
- Do **not** copy the exact unaudited simulator RNG model. Oripa already has provably-fair HMAC draw infrastructure; keep that and use recipes only to generate/validate pools.

## 1. What I could verify directly

### onepiecedb.io `/custom-pack-creator`

Direct request behavior:

- `GET https://onepiecedb.io/custom-pack-creator` redirects to/login under normal HTML navigation.
- With `Accept: application/json`, same route returns `401 {"message":"Unauthenticated."}`.
- Therefore custom pack creator is an authenticated feature, not public static content.

Tested endpoint probes:

```text
GET /api/custom-pack-creator -> 404 JSON route not found
GET /api/custom-pack         -> 404 JSON route not found
GET /api/custom-packs        -> 404 JSON route not found
GET /api/packs/custom        -> 404 JSON route not found
GET /api/pack-sim/custom-packs -> 404 JSON route not found
GET /custom-pack-creator with Accept: application/json -> 401 Unauthenticated
POST /custom-pack-creator -> 405, supported methods GET/HEAD
```

Interpretation: the creator is probably a server-rendered authenticated Laravel page, not a public REST API endpoint. The custom-pack write endpoints are either form posts behind authenticated HTML routes or named routes not inferable unauthenticated.

### pokemoncard.io `/custom-pack-creator`

Direct request behavior:

- Cloudflare blocks unauthenticated/scraper requests with a managed challenge.
- The sites are sibling implementations, and pokemoncard.io appears to share route/asset conventions with onepiecedb.io.

Interpretation: do not depend on scraping pokemoncard.io custom creator internals for production design. Use our already-ingested `pokemoncard.io` catalog source as data; design our own pack builder.

### Public pack simulator APIs reveal the reusable model

Although custom creator is gated, onepiecedb.io public pack simulator exposes enough to infer the shape they use for official and custom packs.

Observed JS bundle endpoints:

```text
GET /api/pack-sim/regions
GET /api/pack-sim/packs?search=...&region=...&sort=...&pack_type=...
GET /api/pack-sim/open?format=...&settype=...&sim_session_token=...
POST /api/tcgplayer/mass-entry
```

`/api/pack-sim/packs` official pack shape:

```json
{
  "pack_name": "Adventure on Kami's Island",
  "name": "Adventure on Kami's Island",
  "code": "12",
  "img_code": "OP15",
  "alias": "Adventure on Kami's Island",
  "release_date": "2026-02-03",
  "region": "en",
  "type": "normal",
  "set_id": "OP15",
  "packs_per_box": 24
}
```

Pack-open response shape:

```json
{
  "name": "Leo",
  "id": "OP15-052",
  "pretty_url": "leo-op15-052",
  "cardrarity": "Uncommon",
  "image_url": "https://images.onepiecedb.io/images/OP15/OP15-052.png",
  "color": "Blue",
  "cardset": "Adventure on Kami's Island",
  "price": "0.00",
  "rarity": "Uncommon",
  "editioncheck": "No",
  "edition": "Normal",
  "type": "Character"
}
```

Observed One Piece official packs return 12 cards. Sample rarity mixes from five recent packs:

- OP15: 6 Common, 3 Uncommon, 2 Rare, 1 Secret Rare
- OP14: 6 Common, 3 Uncommon, 2 Rare, 1 Secret Rare
- OP13: 6 Common, 3 Uncommon, 3 Rare
- OP12: 6 Common, 3 Uncommon, 2 Rare, 1 Leader
- OP11: 6 Common, 3 Uncommon, 2 Rare, 1 Leader

This looks like a slot-rule engine: a pack template has set/format metadata plus a set of slot rules like "6 common, 3 uncommon, 2 rare, 1 chase/leader/secret". Some slots are probably deterministic rarity buckets; higher-rarity slots vary by product/set.

### Frontend behavior from onepiecedb pack simulator bundle

The bundle supports:

- pack search by name
- region filter (`en`, `jp`)
- sort filter
- official/custom filter (`pack_type=official|custom`)
- selected pack quantity
- open mode: single pack vs box
- `packs_per_box`, default 24 for normal One Piece boxes
- random pack button
- import/export config as `Pack Name|Quantity`
- shareable URL state containing selected packs
- auto-open up to 300 packs
- add pulled cards to collection
- export draft / TCGPlayer mass-entry integration

Important custom-pack fields visible in JS state:

```text
pack_id
packPackType: "normal" | "custom"
pack_type / type: "custom"
img_code
packs_per_box
```

So their custom packs are not merely local browser drafts. They are persisted server-side pack records with a `pack_id`, then reused by the simulator alongside official packs.

## 2. Current Oripa baseline relevant to this

Repo schema already has the start of the right shape:

- `CatalogItem`
  - `source`, `sourceItemId`, `itemType`, `game`, `language`, `name`, set/card fields, image URLs, `sourcePayload`
  - unique identity: `(source, sourceItemId, language)`
- `Pack`
  - sellable pack/campaign surface: title, price, stock, live/draft state, draw limits
- `PackPrize`
  - draw pool row with `catalogItemId?`, `catalogSource?`, `catalogSourceItemId?`, `catalogSnapshot?`, label/image/set/card/rarity fields, value, weight, stock
- Draw engine
  - already HMAC/provably-fair, idempotent, stock-aware

The missing layer is **reusable recipe/template**. Right now `PackPrize` is doing two jobs:

1. persistent live draw row
2. implicit draft recipe row

That is fine for MVP, but it is not enough for a boss-level custom pack creator UX.

## 3. What to apply to collaborator DB

### A. Add pack templates separate from live sellable packs

Add reusable catalog-backed templates:

```prisma
model CatalogPackTemplate {
  id              String   @id @default(cuid())
  source          String   // pokemoncard.io, onepiecedb.io, manual, tcgtracking, vendor
  sourcePackId    String?
  game            String
  language        String   @default("en")
  name            String
  setId           String?
  setName         String?
  imageUrl        String?
  releaseDate     DateTime?
  region          String?
  packKind        String   @default("official") // official, custom, promo, box
  packsPerBox     Int?
  sourcePayload   Json?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  slotRules       CatalogPackSlotRule[]

  @@unique([source, sourcePackId, language])
  @@index([game, language, isActive])
  @@index([setId])
  @@index([name])
}

model CatalogPackSlotRule {
  id              String @id @default(cuid())
  templateId      String
  slotIndex       Int
  quantity        Int
  ruleType        String // rarity_bucket, explicit_pool, weighted_pool, wildcard
  rarity          String?
  itemType        CatalogItemType @default(CARD)
  filters         Json?  // color, type, setId, language, edition, etc.
  weight          Int?   // optional group weight if competing bucket
  template        CatalogPackTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId, slotIndex])
}
```

Why:

- Mirrors the `pack_name/code/set_id/packs_per_box/type` shape from onepiecedb.
- Lets us import official pack recipes from card DB sources or create them manually.
- Lets a vendor start from “OP13 box / Surging Sparks style recipe” instead of manually adding 100 rows.

### B. Add vendor custom pack templates

```prisma
model VendorPackTemplate {
  id              String   @id @default(cuid())
  vendorId        String
  baseCatalogPackTemplateId String?
  game            String
  name            String
  description     String?
  imageUrl        String?
  packKind        String   @default("custom")
  packsPerBox     Int?
  status          String   @default("DRAFT") // DRAFT, REVIEW, APPROVED, ARCHIVED
  visibility      String   @default("PRIVATE") // PRIVATE, VENDOR_PUBLIC, GLOBAL_CANDIDATE
  config          Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  slots           VendorPackSlotRule[]

  @@index([vendorId, status])
  @@index([game, visibility])
}

model VendorPackSlotRule {
  id              String @id @default(cuid())
  vendorPackTemplateId String
  slotIndex       Int
  quantity        Int
  ruleType        String
  filters         Json?
  explicitItems   Json? // catalogItem/vendorInventory/vendorCustom refs with weights
  vendorPackTemplate VendorPackTemplate @relation(fields: [vendorPackTemplateId], references: [id], onDelete: Cascade)

  @@index([vendorPackTemplateId, slotIndex])
}
```

Why:

- Gives vendors a creator page that feels like onepiecedb/pokemoncard.io.
- Keeps vendor experiments/private customs out of global catalog search by default.
- Enables review before custom templates become globally reusable.

### C. Add vendor custom item + inventory references

The custom creator cannot be only official catalog rows. Vendors need to add slabs, sealed items, accessories, bonus prizes, and custom/manual items.

Use this shape:

```prisma
model VendorCustomItem {
  id             String @id @default(cuid())
  vendorId       String
  game           String?
  itemType       CatalogItemType
  name           String
  setName        String?
  localId        String?
  rarity         String?
  imageUrl       String?
  imageLargeUrl  String?
  attributes     Json?
  status         String @default("ACTIVE")
  visibility     String @default("PRIVATE")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([vendorId, status])
  @@index([itemType])
}
```

Then add/keep vendor inventory as cert/condition/quantity layer:

```text
CatalogItem / canonical template = global card/sealed identity
VendorInventoryItem = vendor owns/has/listed this specific thing
VendorCustomItem = vendor-created item when global identity does not exist
PackPrize = immutable snapshot of whichever source was chosen
```

### D. Build pack creator UX around templates, not raw DB rows

Recommended boss-facing UX:

1. **Choose mode**
   - Build from official set/pack template
   - Build custom pack from scratch
   - Import list / CSV / TCGPlayer mass-entry style

2. **Select game/source**
   - Pokémon: `pokemoncard.io` preferred, `tcgtracking` as coverage fallback
   - One Piece: `onepiecedb.io` preferred, `tcgtracking` as coverage fallback
   - Future games: tcgtracking/source-specific adapters

3. **Add slots**
   - rarity bucket slot: “6 Common”
   - explicit pool slot: “1 chase from these 20 cards”
   - weighted pool slot: “A/B/C tier with weights”
   - manual/vendor custom item slot

4. **Preview**
   - show card images, rarity distribution, source badges, estimated stock needs
   - show duplicate/canonical collapse from TCGPlayer product ID
   - validate source conflicts and missing images

5. **Freeze to live pack**
   - generate `PackPrize` rows with `catalogSnapshot`
   - copy image/name/set/rarity/value/stock/weight
   - store source refs for audit (`catalogItemId`, `catalogSource`, `catalogSourceItemId`)
   - after LIVE, never silently refresh from template/catalog

### E. Use our provably-fair draw engine, not their simulator RNG

onepiecedb pack-sim is good UX but not sufficient for Oripa money draws:

- It is public entertainment/simulation.
- It returns cards from `/api/pack-sim/open` without exposing fairness proof in the response.
- It supports collection and mass-entry workflows, not compliance/audit requirements.

Oripa should keep:

- HMAC server seed/client seed/nonce
- pool snapshot hash
- idempotency key
- draw ledger and stock decrements

The template system should produce the pool; the draw engine selects from the pool.

## 4. DB architecture impact on collaborator DB

### Short-term P0: no risky migration needed

Current collaborator DB can support a strong first implementation by using existing `PackPrize.catalogSnapshot` and source refs:

- Modify pack creation/update API to accept catalog-backed prize items including:
  - `catalogItemId`
  - `catalogSource`
  - `catalogSourceItemId`
  - `catalogSnapshot`
  - `setId`, `setName`, `localId`, `cardNumber`, `rarity`, images
- Use `/v1/catalog/search` dedupe output as the picker source.
- Add UI to import multiple rows and generate weights/stock from templates.

This gives immediate product value without adding template tables first.

### Medium-term P1: add template tables

Add `CatalogPackTemplate`, `CatalogPackSlotRule`, `VendorPackTemplate`, `VendorPackSlotRule`, `VendorCustomItem`.

Backfill official templates:

- Pokémon: from `pokemoncard.io` sets/cards + manually defined slot rules per product family.
- One Piece: from `onepiecedb.io` sets/cards + pack-sim observed metadata (`set_id`, release date, packs per box, region). Do not scrape private custom packs.
- TCGTracking: use as market/sealed/extra coverage fallback, not canonical for card-native metadata where dedicated sources exist.

### Long-term P2: source conflict/review workflow

When two sources disagree on rarity, image, set, or TCGPlayer ID:

- keep both external refs
- canonical item chooses current best source
- conflict row gets human review queue
- pack snapshots preserve what vendor actually selected at publish time

## 5. What not to copy

Do not copy:

- source display name as identity
- hidden custom packs into global catalog without review
- live refreshing of live pack contents from upstream source changes
- simulator RNG as paid draw RNG
- Cloudflare-protected scraping as source ingestion architecture

Do copy:

- custom pack templates as first-class persisted records
- official/custom pack unified picker
- import/export config
- shareable draft state
- region/source filters
- box mode and `packsPerBox`
- “add all pulled cards / mass entry” style batch actions adapted as vendor inventory import/export

## 6. Recommended implementation order

1. **Immediate API hardening**
   - Ensure `createPackSchema` / `updatePackSchema` accept catalog fields and snapshots for prizes/tiers.
   - Ensure `buildPrizeRows()` persists those fields, not just label/image/value.
   - Add tests proving catalog refs and snapshots survive create/update.

2. **Pack creator MVP**
   - UI picker uses deduped `/v1/catalog/search`.
   - Vendor can add rows, set stock, tier/weight, preview odds.
   - Add CSV/import text format similar to `Pack Name|Quantity`, but for prizes:
     - `source|sourceItemId|language|stock|weight|estimatedValue`
     - or `name|stock|weight|estimatedValue` only for manual custom rows.

3. **Template layer**
   - Add `CatalogPackTemplate` and slot rules.
   - Seed One Piece official pack templates from observed pack-sim metadata.
   - Seed Pokémon templates manually/source-backed; do not scrape Cloudflare pages.

4. **Vendor custom layer**
   - Add `VendorCustomItem` and `VendorPackTemplate`.
   - Private by default, review before global reuse.

5. **Fairness + audit**
   - Link draw proofs to template/prize snapshot hashes.
   - Add admin compare view: draft template vs frozen live pack.

## 7. Final proposal

The best DB architecture is an additive architecture:

```text
Source catalog rows
  -> Canonical/search catalog rows
  -> Official catalog pack templates + slot rules
  -> Vendor custom items + vendor pack templates
  -> Live Pack + immutable PackPrize snapshots
  -> Provably fair draw ledger
```

This captures what the boss likes from pokemoncard.io/onepiecedb.io — fast visual pack creation, official/custom templates, import/export, and opening preview — while keeping Oripa’s stronger requirements: collaborator/vendor ownership, source provenance, immutable prize snapshots, and paid-draw fairness.
