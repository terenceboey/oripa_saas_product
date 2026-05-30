# TCGTracking category 3 fixture capture + key-path notes

Capture date: 2026-05-29

## Capture method

- Direct HTTP from this execution environment to `https://tcgtracking.com/tcgapi/v1/*` returned Cloudflare 403 HTML (`content-type: text/html; charset=UTF-8`).
- Fixtures were captured via the `r.jina.ai/http://...` mirror from the same endpoints and saved as JSON under this directory.

## Required endpoint fixtures captured

- `/tcgapi/v1/categories` -> `categories.json`
- `/tcgapi/v1/3/sets` -> `3_sets.json`
- `/tcgapi/v1/3/sets/1938` -> `3_sets_1938.json`
- `/tcgapi/v1/3/sets/1938/pricing` -> `3_sets_1938_pricing.json`
- `/tcgapi/v1/3/sets/1938/skus` -> `3_sets_1938_skus.json`
- `/tcgapi/v1/products/180514` -> `products_180514.json`

Also captured while probing set shape (sealed-heavy modern set):
- `3_sets_24688.json`
- `3_sets_24688_pricing.json`
- `3_sets_24688_skus.json`
- `products_692938.json`

## Key paths (fixture-proven)

### Category and set scope

- Category list: `categories[].id`, `categories[].name`, `categories[].display_name`
- Category 3 set list root: `category_id`, `category_name`, `sets[]`
- Set identifiers: `sets[].id` (from `/3/sets`) and `set_id` (from `/3/sets/{set}`)
- Set metadata: `sets[].name`, `sets[].abbreviation`; and in set detail `set_name`, `set_abbr`, `set_released`

### Product identity and display

- Product id (set endpoint): `products[].id`
- Product id (single-product endpoint): `product.product_id`
- Product name: `products[].name` and `product.name`
- Image URL: `products[].image_url`, `product.image_url`

### Collector/local number

- Set endpoint card number: `products[].number` (example: `"002a/131"`)
- Product endpoint extended number: `product.ext_number` (example: `"002a/131"`)
- Note: set 24688 is mostly sealed products and has `number: null`; set 1938 provides card-shaped rows with populated number/rarity.

### Set/group id mapping

- Product-level group/set id: `product.group_id`
- Category id on product: `product.category_id`
- Set-level id: `set_id`

### Rarity/category/product type

- Rarity on set-product list: `products[].rarity`
- Rarity on product detail: `product.ext_rarity`
- Category naming: `product.category_name`, `product.category_display_name`
- Product type hint: `products[].cardtrader[].product_type` appears in set detail enrichment (example value: `"single"`)

### SKU language / variant / condition

Compact set-level SKU endpoint (`/skus`):
- root map: `products.{product_id}.{sku_id}`
- language code: `lng`
- variant code: `var`
- condition code: `cnd`
- vendor/variant id: `vid`
- price fields commonly present: `mkt`, `low`, `hi`, `cnt`

Expanded product endpoint (`/products/{id}`):
- `skus[].language_name`, `skus[].language_id`
- `skus[].variant_name`, `skus[].variant_id`
- `skus[].condition_name`, `skus[].condition_id`
- `sku_dimensions.languages[]`, `sku_dimensions.variants[]`, `sku_dimensions.conditions[]`

### Pricing shape

Set pricing endpoint (`/pricing`):
- root map: `prices.{product_id}.tcg.{sub_type}`
- sample leaf fields: `low`, `market`

Product endpoint (`/products/{id}`):
- `prices.tcgplayer[]` with `sub_type_name`, `low_price`, `mid_price`, `high_price`, `market_price`, `updated_at`

## Is category 3 sufficient for MVP?

For the current MVP scope (Pokemon import-only), yes: category 3 clearly returns Pokémon products, set lists, pricing, and SKU data needed for normalizer/importer work. Category 85 (Pokemon Japan) remains out of scope and should stay blocked until a reviewed category/language/source-key plan is approved.
