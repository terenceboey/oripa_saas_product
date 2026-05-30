# CatalogItem Inventory by Source and Game

Generated: 2026-05-30T05:15:56.930Z

## Target DB

- host: dpg-d8btgo6gvqtc73e24rsg-a.singapore-postgres.render.com
- port: (default)
- database: oripa_sg
- user: oripa_sg_user
- URL fingerprint: 1390ba22e29a
- table: `CatalogItem`
- query mode: read-only inventory

## Summary

- total rows: 245844
- duplicate source identity groups `(source, sourceItemId, language)`: 0
- inactive rows: 0

## By source

| source | count | games | languages | item_types | active | inactive |
| --- | --- | --- | --- | --- | --- | --- |
| tcgtracking | 220905 | 10 | 2 | 1 | 220905 | 0 |
| pokemoncard.io | 22451 | 1 | 1 | 1 | 22451 | 0 |
| onepiecedb.io | 2488 | 1 | 1 | 1 | 2488 | 0 |

## By source and game

| source | game | count | languages | item_types | active | inactive |
| --- | --- | --- | --- | --- | --- | --- |
| onepiecedb.io | ONE_PIECE | 2488 | 1 | 1 | 2488 | 0 |
| pokemoncard.io | POKEMON | 22451 | 1 | 1 | 22451 | 0 |
| tcgtracking | POKEMON | 58863 | 2 | 1 | 58863 | 0 |
| tcgtracking | YUGIOH | 45564 | 1 | 1 | 45564 | 0 |
| tcgtracking | WEISS_SCHWARZ | 29907 | 1 | 1 | 29907 | 0 |
| tcgtracking | POKEMON_JAPAN | 29557 | 1 | 1 | 29557 | 0 |
| tcgtracking | CARDFIGHT_VANGUARD | 25043 | 1 | 1 | 25043 | 0 |
| tcgtracking | DRAGON_BALL_SUPER | 11692 | 1 | 1 | 11692 | 0 |
| tcgtracking | FLESH_AND_BLOOD | 9628 | 1 | 1 | 9628 | 0 |
| tcgtracking | ONE_PIECE | 6445 | 1 | 1 | 6445 | 0 |
| tcgtracking | LORCANA | 3048 | 1 | 1 | 3048 | 0 |
| tcgtracking | RIFTBOUND | 1158 | 1 | 1 | 1158 | 0 |

## By game

| game | count | sources | languages | item_types | active | inactive |
| --- | --- | --- | --- | --- | --- | --- |
| POKEMON | 81314 | 2 | 2 | 1 | 81314 | 0 |
| YUGIOH | 45564 | 1 | 1 | 1 | 45564 | 0 |
| WEISS_SCHWARZ | 29907 | 1 | 1 | 1 | 29907 | 0 |
| POKEMON_JAPAN | 29557 | 1 | 1 | 1 | 29557 | 0 |
| CARDFIGHT_VANGUARD | 25043 | 1 | 1 | 1 | 25043 | 0 |
| DRAGON_BALL_SUPER | 11692 | 1 | 1 | 1 | 11692 | 0 |
| FLESH_AND_BLOOD | 9628 | 1 | 1 | 1 | 9628 | 0 |
| ONE_PIECE | 8933 | 2 | 1 | 1 | 8933 | 0 |
| LORCANA | 3048 | 1 | 1 | 1 | 3048 | 0 |
| RIFTBOUND | 1158 | 1 | 1 | 1 | 1158 | 0 |

## Full source/game/language/itemType detail

| source | game | language | itemType | isActive | count | first_created | last_created |
| --- | --- | --- | --- | --- | --- | --- | --- |
| onepiecedb.io | ONE_PIECE | en | CARD | true | 2488 | 2026-05-30T04:39:44.872Z | 2026-05-30T04:39:53.006Z |
| pokemoncard.io | POKEMON | en | CARD | true | 22451 | 2026-05-30T03:32:11.491Z | 2026-05-30T04:39:21.114Z |
| tcgtracking | CARDFIGHT_VANGUARD | en | CARD | true | 25043 | 2026-05-29T12:02:18.729Z | 2026-05-29T12:05:03.445Z |
| tcgtracking | DRAGON_BALL_SUPER | en | CARD | true | 11692 | 2026-05-29T12:09:50.891Z | 2026-05-29T12:10:35.282Z |
| tcgtracking | FLESH_AND_BLOOD | en | CARD | true | 9628 | 2026-05-29T12:11:45.842Z | 2026-05-29T12:12:25.525Z |
| tcgtracking | LORCANA | en | CARD | true | 3048 | 2026-05-29T12:39:51.046Z | 2026-05-29T12:40:03.853Z |
| tcgtracking | ONE_PIECE | en | CARD | true | 6445 | 2026-05-29T12:38:58.149Z | 2026-05-29T12:39:33.178Z |
| tcgtracking | POKEMON | en | CARD | true | 29377 | 2026-05-28T21:19:51.172Z | 2026-05-29T20:16:34.249Z |
| tcgtracking | POKEMON | ja | CARD | true | 29486 | 2026-05-29T12:16:34.610Z | 2026-05-29T12:19:16.304Z |
| tcgtracking | POKEMON_JAPAN | en | CARD | true | 29557 | 2026-05-29T20:22:16.076Z | 2026-05-30T01:47:47.346Z |
| tcgtracking | RIFTBOUND | en | CARD | true | 1158 | 2026-05-29T12:40:20.372Z | 2026-05-29T12:40:24.639Z |
| tcgtracking | WEISS_SCHWARZ | en | CARD | true | 29907 | 2026-05-29T12:06:53.812Z | 2026-05-29T12:08:33.395Z |
| tcgtracking | YUGIOH | en | CARD | true | 45564 | 2026-05-29T11:51:20.997Z | 2026-05-29T11:55:18.370Z |

## Pruning note

Do not delete anything from this table without an explicit target slice. Use stable filters such as `source`, `game`, `language`, `itemType`, and optionally `sourceItemId` prefix/category. For destructive pruning, capture before counts, delete transactionally with assertions, then re-run this inventory.
