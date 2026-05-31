# Live DB missing-data audit — 2026-05-31T05-41-42-389Z

Scope: read-only live DB audit; no writes. Target DB host: `dpg-d8btgo6gvqtc73e24rsg-a.singapore-postgres.render.com`. No DB writes performed.

## Issues

1. **P1 / CatalogItem** — 29634 CatalogItem rows lack sourcePayload
   - Fix: Re-run imports with payload retention or mark legacy rows as low-trust.
2. **P2 / CatalogSet** — bulbapedia/POKEMON has 11/144 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
3. **P2 / CatalogSet source metadata** — bulbapedia/POKEMON has 144/144 sets missing sourceCategoryId
   - Fix: Backfill only when deterministic same-source category mapping exists; otherwise keep as source_metadata_gap.
4. **P2 / CatalogSet source metadata** — bulbapedia/POKEMON has 144/144 sets missing productCount
   - Fix: Backfill only from source-provided product_count metadata; do not fabricate from partial local row counts.
5. **P2 / CatalogSet** — onepiecedb.io/ONE_PIECE has 51/51 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
6. **P2 / CatalogSet source metadata** — onepiecedb.io/ONE_PIECE has 51/51 sets missing sourceCategoryId
   - Fix: Backfill only when deterministic same-source category mapping exists; otherwise keep as source_metadata_gap.
7. **P2 / CatalogSet** — pokemoncard.io/POKEMON has 14/196 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
8. **P2 / CatalogSet source metadata** — pokemoncard.io/POKEMON has 196/196 sets missing sourceCategoryId
   - Fix: Backfill only when deterministic same-source category mapping exists; otherwise keep as source_metadata_gap.
9. **P2 / CatalogSet** — tcgtracking/CARDFIGHT_VANGUARD has 263/263 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
10. **P2 / CatalogSet** — tcgtracking/DRAGON_BALL_SUPER has 101/101 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
11. **P2 / CatalogSet** — tcgtracking/FLESH_AND_BLOOD has 94/94 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
12. **P2 / CatalogSet** — tcgtracking/LORCANA has 18/18 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
13. **P2 / CatalogSet** — tcgtracking/ONE_PIECE has 76/76 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
14. **P2 / CatalogSet** — tcgtracking/POKEMON has 443/447 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
15. **P2 / CatalogSet** — tcgtracking/POKEMON_JAPAN has 93/446 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
16. **P2 / CatalogSet source metadata** — tcgtracking/POKEMON_JAPAN has 446/446 sets missing sourceCategoryId
   - Fix: Backfill only when deterministic same-source category mapping exists; otherwise keep as source_metadata_gap.
17. **P2 / CatalogSet** — tcgtracking/RIFTBOUND has 7/7 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
18. **P2 / CatalogSet** — tcgtracking/WEISS_SCHWARZ has 163/163 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
19. **P2 / CatalogSet** — tcgtracking/YUGIOH has 605/605 sets missing all set images
   - Fix: Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.
20. **P1 / VendorInventoryItem** — No owned/vendor inventory rows exist
   - Fix: Build/import owned stock lane; catalog rows are not inventory.
21. **P1 / PackPrize** — Existing PackPrize rows are all unlinked manual/demo rows
   - Fix: Backfill deterministic refs where possible or recreate through source-backed import flow.

## CatalogItem totals

total | active | inactive | missing_any_image | missing_search_text | missing_source_payload | missing_catalog_set_link
--- | --- | --- | --- | --- | --- | ---
246170 | 246170 | 0 | 0 | 0 | 29634 | 0


## CatalogItem by source/game/language/type

source | game | language | itemType | isActive | total | missing_image | missing_rarity | missing_card_number | missing_source_payload | missing_catalog_set_link | first_created | last_updated
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
onepiecedb.io | ONE_PIECE | en | CARD | true | 2488 | 0 | 0 | 0 | 0 | 0 | Sat May 30 2026 11:39:44 GMT+0700 (Indochina Time) | Sun May 31 2026 08:53:47 GMT+0700 (Indochina Time)
pokemoncard.io | POKEMON | en | CARD | true | 22451 | 0 | 883 | 0 | 0 | 0 | Sat May 30 2026 10:32:11 GMT+0700 (Indochina Time) | Sun May 31 2026 08:52:41 GMT+0700 (Indochina Time)
tcgtracking | CARDFIGHT_VANGUARD | en | CARD | true | 25043 | 0 | 31 | 46 | 0 | 0 | Fri May 29 2026 19:02:18 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)
tcgtracking | DRAGON_BALL_SUPER | en | CARD | true | 11692 | 0 | 0 | 418 | 0 | 0 | Fri May 29 2026 19:09:50 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)
tcgtracking | FLESH_AND_BLOOD | en | CARD | true | 9628 | 0 | 3 | 122 | 0 | 0 | Fri May 29 2026 19:11:45 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)
tcgtracking | LORCANA | en | CARD | true | 3048 | 0 | 0 | 40 | 0 | 0 | Fri May 29 2026 19:39:51 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)
tcgtracking | ONE_PIECE | en | CARD | true | 6593 | 0 | 0 | 6591 | 0 | 0 | Fri May 29 2026 19:38:58 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)
tcgtracking | POKEMON | en | CARD | true | 29379 | 0 | 113 | 25859 | 77 | 0 | Fri May 29 2026 04:19:51 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)
tcgtracking | POKEMON | ja | CARD | true | 29662 | 0 | 1990 | 29660 | 0 | 0 | Fri May 29 2026 19:16:34 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)
tcgtracking | POKEMON_JAPAN | en | CARD | true | 29557 | 0 | 2005 | 2397 | 29557 | 0 | Sat May 30 2026 03:22:16 GMT+0700 (Indochina Time) | Sat May 30 2026 08:47:47 GMT+0700 (Indochina Time)
tcgtracking | RIFTBOUND | en | CARD | true | 1158 | 0 | 0 | 2 | 0 | 0 | Fri May 29 2026 19:40:20 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)
tcgtracking | WEISS_SCHWARZ | en | CARD | true | 29907 | 0 | 27 | 215 | 0 | 0 | Fri May 29 2026 19:06:53 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)
tcgtracking | YUGIOH | en | CARD | true | 45564 | 0 | 0 | 113 | 0 | 0 | Fri May 29 2026 18:51:20 GMT+0700 (Indochina Time) | Sun May 31 2026 08:46:31 GMT+0700 (Indochina Time)


## TCGCSV quality

_none_


## CatalogSet by source/game

source | game | language | total | active | missing_any_image | missing_source_category_id | missing_product_count | missing_group_kind | missing_review_status | missing_source_payload
--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
bulbapedia | POKEMON | en | 144 | 144 | 11 | 144 | 144 | 0 | 0 | 0
onepiecedb.io | ONE_PIECE | en | 51 | 51 | 51 | 51 | 0 | 0 | 0 | 0
pokemoncard.io | POKEMON | en | 196 | 196 | 14 | 196 | 0 | 0 | 0 | 0
tcgtracking | CARDFIGHT_VANGUARD | en | 263 | 263 | 263 | 0 | 0 | 0 | 0 | 0
tcgtracking | DRAGON_BALL_SUPER | en | 101 | 101 | 101 | 0 | 0 | 0 | 0 | 0
tcgtracking | FLESH_AND_BLOOD | en | 94 | 94 | 94 | 0 | 0 | 0 | 0 | 0
tcgtracking | LORCANA | en | 18 | 18 | 18 | 0 | 0 | 0 | 0 | 0
tcgtracking | ONE_PIECE | en | 76 | 76 | 76 | 0 | 0 | 0 | 0 | 0
tcgtracking | POKEMON | en | 216 | 216 | 0 | 0 | 0 | 0 | 0 | 0
tcgtracking | POKEMON | ja | 447 | 447 | 443 | 0 | 0 | 0 | 0 | 0
tcgtracking | POKEMON_JAPAN | en | 446 | 446 | 93 | 446 | 0 | 0 | 0 | 0
tcgtracking | RIFTBOUND | en | 7 | 7 | 7 | 0 | 0 | 0 | 0 | 0
tcgtracking | WEISS_SCHWARZ | en | 163 | 163 | 163 | 0 | 0 | 0 | 0 | 0
tcgtracking | YUGIOH | en | 605 | 605 | 605 | 0 | 0 | 0 | 0 | 0


## CatalogSealedProduct by source/game

source | game | language | total | active | missing_image | missing_catalog_set_link | missing_product_kind | missing_clean_name | missing_source_payload
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
tcgtracking | ONE_PIECE | en | 261 | 261 | 0 | 0 | 0 | 0 | 0
tcgtracking | POKEMON | en | 2771 | 2771 | 0 | 0 | 45 | 1 | 45
tcgtracking | POKEMON | ja | 278 | 278 | 0 | 0 | 0 | 0 | 0
tcgtracking | POKEMON_JAPAN | en | 278 | 278 | 0 | 0 | 278 | 0 | 278


## VendorInventoryItem

total | quantity_total | quantity_held | quantity_sold | missing_catalog_or_custom_ref | missing_image | slab_like | slab_like_missing_cert | invalid_quantity_rows | negative_quantity_rows
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
0 |  |  |  |  |  |  |  |  |


## PackPrize

total | catalog_linked | unlinked_manual | linked_missing_snapshot | missing_image | missing_set_id | missing_card_number | missing_rarity | invalid_stock_rows
--- | --- | --- | --- | --- | --- | --- | --- | ---
6 | 0 | 6 | 0 | 0 | 6 | 6 | 6 | 0


## PackTemplateSlot

total | catalog_linked | unlinked_manual | linked_missing_snapshot | missing_image
--- | --- | --- | --- | ---
0 |  |  |  |


## Canonical catalog/search counts

table_name | total
--- | ---
CanonicalCatalogCard | 245844
CanonicalCatalogSet | 1053
CanonicalSealedProduct | 2963
CanonicalSearchDoc | 249860


## Search relation sizes

relname | total_size | bytes
--- | --- | ---
CatalogItem | 962 MB | 1009065984
CanonicalSearchDoc | 118 MB | 123527168
CatalogSealedProduct | 17 MB | 18317312
CatalogSet | 4408 kB | 4513792
PackPrize | 64 kB | 65536
VendorInventoryItem | 40 kB | 40960


Full JSON evidence: `docs/plans/live-db-missing-audit-2026-05-31T05-41-42-389Z.json`
