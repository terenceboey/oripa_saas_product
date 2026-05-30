# Oripa Catalog DB Architecture Oracle Evidence Packet

Read-only evidence packet for GPT-5.5 Pro / Oracle final database architecture proposal.

## Scope and non-mutation guarantee

- Investigation target: `/home/yeqiuqiu/oripa_saas`
- DB queries were read-only metadata/count/EXPLAIN queries via Prisma `$queryRawUnsafe`.
- No schema, migration, production data, or DB writes were performed.
- Goal: final architecture proposal for catalog/search/prize database model, optimized for query speed, search scalability, clean modeling, and extensibility.

## Product context

Oripa is a digital pack-opening platform. Vendors search prize-eligible catalog items and add them into packs as prizes.

Catalog is not only cards. It may include:

- raw single cards
- graded/slabbed cards
- sealed products / boxes / packs
- sets
- custom/vendor-created items
- accessories / future collectibles
- multiple games: Pokémon, One Piece, Yu-Gi-Oh, Weiss, etc.

Important product invariant: pack prizes need historical correctness. Odds/value/display should not silently mutate when upstream catalog data changes.

## Repo evidence

### Prisma `CatalogItem`

File: `prisma/schema.prisma`, around lines 663-691.

```prisma
model CatalogItem {
  id             String          @id @default(cuid())
  source         String
  sourceItemId   String
  itemType       CatalogItemType @default(CARD)
  game           String          @default("POKEMON")
  language       String          @default("en")
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
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@unique([source, sourceItemId, language])
  @@index([itemType, game, isActive])
  @@index([source, isActive])
  @@index([game, language, isActive])
  @@index([setId])
  @@index([name])
}
```

### Repo enum

DB enum / Prisma enum has at least:

- `CARD`
- `SEALED_PRODUCT`

### Live DB schema drift from repo schema

Read-only `information_schema.columns` found live `CatalogItem` has an extra nullable column:

- `catalogSetId text nullable`

Live DB constraints confirm:

```sql
FOREIGN KEY ("catalogSetId") REFERENCES "CatalogSet"(id)
ON UPDATE CASCADE ON DELETE SET NULL
```

Live DB has a `CatalogSet` table with columns:

- `id`
- `source`
- `sourceSetId`
- `game`
- `setCode`
- `name`
- `releaseDate`
- `productCount`
- `symbolImageUrl`
- `logoImageUrl`
- `bannerImageUrl`
- `isSupplemental`
- `searchText`
- `isActive`
- `createdAt`
- `updatedAt`

Current repo `prisma/schema.prisma` did **not** define `CatalogSet` or `catalogSetId` at investigation time.

### Catalog search endpoint

File: `apps/api/src/modules/catalog/router.ts`.

Route: `GET /v1/catalog/search`.

Input query params:

```ts
q: z.string().trim().min(2).max(120)
limit: int min 1 max 30 default 10
type: enum ["card", "sealed", "all"] default "card"
game: string max 40 default "POKEMON"
```

Worst case: 3 sequential DB queries.

1. `name startsWith q mode insensitive`, ordered by `name asc`, take limit.
2. fallback: `name contains q mode insensitive`, exclude seen IDs via `notIn`, ordered by `name asc`.
3. fallback: `searchText contains q mode insensitive`, exclude seen IDs via `notIn`, ordered by `name asc`.

Selected fields returned:

- `id`
- `source`
- `sourceItemId`
- `itemType`
- `game`
- `language`
- `name`
- `setId`
- `setName`
- `cardNumber`
- `rarity`
- `imageThumbUrl`
- `imageLargeUrl`
- `imageBaseUrl`

`sourcePayload` is excluded from the search response.

### Normalizer/import evidence

File: `apps/api/src/modules/catalog/tcgtracking-normalizer.ts`.

- `TCGTRACKING_SOURCE = "tcgtracking"`
- normalizer currently builds `CatalogItemProjection` rows.
- current row construction uses `itemType: CatalogItemType.CARD`.
- source payload is preserved in `sourcePayload`.
- `hasCardShape()` returns true for card-like products only.

File: `apps/api/scripts/sync-tcgtracking.ts`.

Approved game/category mapping includes:

- MAGIC
- YUGIOH
- POKEMON
- CARDFIGHT_VANGUARD
- WEISS_SCHWARZ
- DRAGON_BALL_SUPER
- FLESH_AND_BLOOD
- ONE_PIECE
- LORCANA
- POKEMON_JAPAN
- RIFTBOUND

### Pack/prize evidence

File: `apps/api/src/modules/packs/router.ts`.

Current prize row type:

```ts
type CreatePrizeRow = {
  label: string;
  imageUrl: string;
  weight: number;
  stock: number;
  remainingStock: number;
  estimatedValue: number;
};
```

Pack prize creation copies label/image/value/weight/stock only. It does not store `catalogItemId`.

File: `packages/shared/src/index.ts`.

Pack creation schemas accept tier items / prizes with:

- `label`
- `estimatedValue`
- `stock`
- `imageUrl?`
- `weight` for direct prizes

No canonical catalog ID is required.

File: `apps/web/app/vendor/page.tsx`.

Vendor UI calls:

```ts
/v1/catalog/search?q=<query>&limit=8&type=card
```

Selecting a catalog suggestion copies label and image into local pack draft state. It does not persist `catalogItemId` into the pack payload.

## Live DB contents

Target DB observed: `oripa_sg`.

### CatalogItem counts

```text
total: 220,905
active: 220,905
inactive: 0
distinct_games: 10
distinct_item_types: 1
distinct_sources: 1
```

Counts by game:

```text
POKEMON: 58,863
YUGIOH: 45,564
WEISS_SCHWARZ: 29,907
POKEMON_JAPAN: 29,557
CARDFIGHT_VANGUARD: 25,043
DRAGON_BALL_SUPER: 11,692
FLESH_AND_BLOOD: 9,628
ONE_PIECE: 6,445
LORCANA: 3,048
RIFTBOUND: 1,158
```

Counts by itemType:

```text
CARD: 220,905
```

Counts by source:

```text
tcgtracking: 220,905
```

Null/missing rates:

```text
total: 220,905
missing_name: 0
missing_search_text: 0
missing_set_id: 0
missing_set_name: 0
missing_card_number: 7,645
missing_rarity: 4,114
missing_all_images: 0
missing_payload: 29,635
```

Source payload size for rows with payload:

```text
payload_rows: 191,270
avg_bytes: 1,501
p50_bytes: 1,566
p95_bytes: 1,632
max_bytes: 1,835
```

Table sizes:

```text
CatalogItem total_size: 756 MB
CatalogItem table_size: 321 MB
CatalogItem indexes_size: 98 MB

CatalogSet total_size: 432 kB
CatalogSet table_size: 160 kB
CatalogSet indexes_size: 240 kB

Pack total_size: 48 kB
PackPrize total_size: 48 kB
```

CatalogSet contents:

```text
CatalogSet total: 662
active: 662
games: 2
sources: 1

POKEMON_JAPAN / tcgtracking: 446
POKEMON / tcgtracking: 216
```

CatalogItem -> CatalogSet link health:

```text
CatalogItem total: 220,905
with_catalog_set_id: 58,732
without_catalog_set_id: 162,173
```

Pack/prize current data:

```text
PackPrize total: 9
packs_with_prizes: 3

Pack total: 3
draft: 1
live: 2
archived: 0
```

Live PackPrize columns:

- `id`
- `packId`
- `label`
- `imageUrl`
- `estimatedValue`
- `weight`
- `stock`
- `remainingStock`
- `createdAt`
- `updatedAt`

No FK/reference from `PackPrize` to `CatalogItem`.

## Live DB indexes and constraints

### CatalogItem indexes

```sql
CREATE UNIQUE INDEX "CatalogItem_pkey"
ON public."CatalogItem" USING btree (id);

CREATE UNIQUE INDEX "CatalogItem_source_sourceItemId_language_key"
ON public."CatalogItem" USING btree (source, "sourceItemId", language);

CREATE INDEX "CatalogItem_itemType_game_isActive_idx"
ON public."CatalogItem" USING btree ("itemType", game, "isActive");

CREATE INDEX "CatalogItem_source_isActive_idx"
ON public."CatalogItem" USING btree (source, "isActive");

CREATE INDEX "CatalogItem_name_idx"
ON public."CatalogItem" USING btree (name);

CREATE INDEX "CatalogItem_lower_name_trgm_idx"
ON public."CatalogItem" USING gin (lower(name) gin_trgm_ops);

CREATE INDEX "CatalogItem_catalogSetId_isActive_idx"
ON public."CatalogItem" USING btree ("catalogSetId", "isActive");
```

### CatalogSet indexes

```sql
CatalogSet_pkey
CatalogSet_source_sourceSetId_game_key
CatalogSet_game_isActive_name_idx
CatalogSet_game_isActive_releaseDate_idx
```

### Extensions

Enabled:

- `pg_trgm`
- `pg_stat_statements`
- `plpgsql`

### Absent indexes relevant to current search

- No `CatalogItem(searchText)` btree index.
- No `CatalogItem_searchText_trgm_idx`.
- No composite `(game, itemType, isActive, name)` index.
- No lower/searchText expression index.
- No covering index for current search response columns.
- No sourceItemId prefix/trigram index.
- No FK from `PackPrize` to `CatalogItem`.

## EXPLAIN ANALYZE performance findings

Read-only `EXPLAIN (ANALYZE, BUFFERS)` against current DB.

### Current Prisma-equivalent prefix name search

Shape:

```sql
WHERE isActive = true
  AND game = 'POKEMON'
  AND itemType = 'CARD'
  AND name ILIKE 'char%'
ORDER BY name ASC
LIMIT 8
```

Result summary:

```text
Index Scan using "CatalogItem_name_idx"
Rows Removed by Filter: 29,908
Execution Time: 5164.624 ms
```

### Current contains name search

Shape:

```sql
name ILIKE '%char%'
```

Result summary:

```text
Index Scan using "CatalogItem_name_idx"
Rows Removed by Filter: 17,650
Execution Time: 2305.560 ms
```

### Rewritten lower(name) trigram-compatible shape

Shape:

```sql
lower(name) LIKE '%char%'
```

Result summary:

```text
Bitmap Index Scan on "CatalogItem_lower_name_trgm_idx"
Execution Time: 405.730 ms
```

This proves the trigram index can help, but current Prisma `mode: insensitive` query shape does not use it.

### Current searchText contains

Shape:

```sql
searchText ILIKE '%char%'
```

Result summary:

```text
Index Scan using "CatalogItem_itemType_game_isActive_idx"
Rows Removed by Filter: 57,459
Execution Time: 2141.354 ms
```

No searchText trigram/full-text index exists.

### sourceItemId prefix future lookup

Shape:

```sql
sourceItemId ILIKE '123%'
```

Result summary:

```text
Index Scan using "CatalogItem_itemType_game_isActive_idx"
Rows Removed by Filter: 58,802
Execution Time: 2888.821 ms
```

## Current risks to be addressed

P0:

1. Prisma schema drift from live DB (`CatalogSet`, `catalogSetId`, indexes).
2. Multi-second current catalog autocomplete query shapes at 220k rows.
3. `PackPrize` has no canonical catalog identity or immutable source/catalog snapshot.
4. Current `CatalogItem` is card-shaped, while product scope requires slabs/sealed/sets/custom/accessories.

P1:

1. `game` and `source` are raw strings.
2. `sourcePayload` stores important type/source details but is untyped and not query-model-friendly.
3. Search reads from wide canonical table, not a narrow projection.
4. `CatalogSet` coverage is partial and only two games have sets linked.

## Requested Oracle output

Produce the final database architecture proposal for Oripa catalog/search/prize modeling.

Required final proposal sections:

1. Executive recommendation.
2. Evidence-backed current-state summary.
3. Final target architecture.
4. Canonical global catalog model.
5. Type-specific model strategy for raw cards, graded/slabbed cards, sealed products, sets, vendor custom items, accessories/future collectibles.
6. Vendor inventory/listing layer strategy.
7. PackPrize immutable snapshot strategy.
8. Catalog search projection and Postgres search/index strategy.
9. Migration phases from current state, explicitly non-destructive.
10. Query examples and index examples.
11. Decisions required from product.
12. Risks and rollout gates.

Important: do not propose destructive migrations as immediate actions. The final answer should be a proposal, not runnable production migration code.
