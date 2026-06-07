# Vendor Pack + Setlist Data Model (Phase 2)

## Primary tables used today

- `CatalogSet`
  - One row per source set (`source`, `sourceSetId`, `game`).
  - Parent for both card items and sealed products.

- `CatalogItem`
  - Card-level rows used by vendor card search and by card prizes in packs.
  - Key columns: `id`, `source`, `sourceItemId`, `game`, `language`, `setId`, `rarity`, `catalogSetId`, `isActive`.

- `CatalogSealedProduct`
  - Sealed-product rows used by vendor sealed search and set sealed listings.
  - Key columns: `id`, `source`, `sourceProductId`, `game`, `language`, `catalogSetId`, `isActive`.

- `Pack`
  - Vendor pack header.

- `PackPrize`
  - Prize rows frozen into a pack.
  - Catalog references today are flexible (`catalogItemId`, `catalogSource`, `catalogSourceItemId`, `catalogSnapshot`).

- `VendorInventoryItem`
  - Physical inventory pool for paid packs.

- `PackPrizeInventoryAllocation`
  - Allocation rows linking `PackPrize` to `VendorInventoryItem`.

## Core relations

- `CatalogSet.id -> CatalogItem.catalogSetId`
- `CatalogSet.id -> CatalogSealedProduct.catalogSetId`
- `Pack.id -> PackPrize.packId`
- `PackPrize.id -> PackPrizeInventoryAllocation.packPrizeId`
- `VendorInventoryItem.id -> PackPrizeInventoryAllocation.vendorInventoryItemId`

## Runtime query paths

- Vendor picker facets/search:
  - Cards: `CatalogItem`
  - Sealed: `CatalogSealedProduct`
- Public setlists:
  - Set list: `CatalogSet`
  - Set cards: `CatalogItem` by resolved set
  - Set sealed: `CatalogSealedProduct` by resolved set
- Pack creation/update:
  - Prize references resolved to catalog snapshot before write

## Phase 2 fixes applied

1. Setlist source-resolution now avoids hardcoded source defaults and resolves by actual set source.
2. Pack prize catalog lookup now resolves against both `CatalogItem` and `CatalogSealedProduct` so sealed-product prizes can be stored consistently.
3. Added catalog-focused indexes for game/set/rarity access patterns.

## Recommended target setup (next phase)

1. Keep `CatalogSet` as the single set anchor used by both cards and sealed.
2. Continue freezing `catalogSnapshot` in `PackPrize` for immutability and auditability.
3. Add a first-class catalog reference type column on prize/inventory/template rows (card vs sealed) to remove ambiguity and tighten inventory matching.
4. Keep the current `CatalogSet`, `CatalogItem`, and `CatalogSealedProduct` tables as the catalog source of truth until a future canonical layer is intentionally reintroduced with a new migration.
