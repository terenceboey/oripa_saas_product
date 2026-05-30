# CatalogItem Source Delta: TCGTracking vs Dedicated DB Sources

Generated: 2026-05-30T05:34:49.932Z

## Target DB

- host: dpg-d8btgo6gvqtc73e24rsg-a.singapore-postgres.render.com
- port: (default)
- database: oripa_sg
- user: oripa_sg_user
- URL fingerprint: 1390ba22e29a
- table: `CatalogItem`
- query mode: read-only delta

## Match rules

Primary cross-source match uses upstream TCGPlayer product id:

- `tcgtracking`: `sourcePayload.raw.id`
- `pokemoncard.io`: `sourcePayload.raw.tcgplayer_id`
- `onepiecedb.io`: `sourcePayload.raw.tcgplayer_product_id`

Secondary weak match is normalized `(name, cardNumber/localId)`. It is only a coverage clue because names/variants/set naming differ by source.

## Summary

| comparison | rows | tcgplayer_id_overlap | left_matched | right_matched | left_only_by_id | right_only_by_id | name_number_key_overlap | name_number_set_key_overlap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pokemon | tcgtracking 58863 vs pokemoncard.io 22451 | 19962 IDs | 19962 (34.0% of rows with ID) | 19962 (99.9% of rows with ID) | 38823 | 14 | 303 keys | 151 keys |
| pokemon_en_only | tcgtracking 29377 vs pokemoncard.io 22451 | 19962 IDs | 19962 (68.1% of rows with ID) | 19962 (99.9% of rows with ID) | 9337 | 14 | 298 keys | 151 keys |
| one_piece | tcgtracking 6445 vs onepiecedb.io 2488 | 2396 IDs | 2396 (37.2% of rows with ID) | 2396 (100.0% of rows with ID) | 4049 | 0 | 2008 keys | 1507 keys |

## Full numeric summary

| label | game | left_source | right_source | language_scope | left_rows | right_rows | left_rows_with_tcgplayer_id | right_rows_with_tcgplayer_id | left_distinct_tcgplayer_ids | right_distinct_tcgplayer_ids | overlap_tcgplayer_ids | left_rows_matched_by_tcgplayer_id | right_rows_matched_by_tcgplayer_id | left_rows_only_by_tcgplayer_id | right_rows_only_by_tcgplayer_id | left_rows_without_tcgplayer_id | right_rows_without_tcgplayer_id | left_distinct_name_number_keys | right_distinct_name_number_keys | overlap_name_number_keys | left_distinct_name_number_set_keys | right_distinct_name_number_set_keys | overlap_name_number_set_keys |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pokemon | POKEMON | tcgtracking | pokemoncard.io | all | 58863 | 22451 | 58785 | 19976 | 58785 | 19976 | 19962 | 19962 | 19962 | 38823 | 14 | 78 | 2475 | 52949 | 20865 | 303 | 54750 | 22447 | 151 |
| pokemon_en_only | POKEMON | tcgtracking | pokemoncard.io | en | 29377 | 22451 | 29299 | 19976 | 29299 | 19976 | 19962 | 19962 | 19962 | 9337 | 14 | 78 | 2475 | 26611 | 20865 | 298 | 27629 | 22447 | 151 |
| one_piece | ONE_PIECE | tcgtracking | onepiecedb.io | all | 6445 | 2488 | 6445 | 2396 | 6445 | 2396 | 2396 | 2396 | 2396 | 4049 | 0 | 0 | 92 | 4985 | 2488 | 2008 | 6226 | 2488 | 1507 |

## Samples: pokemon

### tcgtracking only by TCGPlayer id

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tcgtracking | POKEMON | ja | 85:613779 | 613779 | Alto Mare's Latias | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613780 | 613780 | Alto Mare's Latios | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613777 | 613777 | Crystal Tower's Entei | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613776 | 613776 | Explosive Birth Lugia | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613785 | 613785 | Prince of the Sea Manaphy | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613781 | 613781 | Seven Nights Jirachi | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613775 | 613775 | Striking Back Mewtwo | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613778 | 613778 | Timeless Celebi | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613783 | 613783 | Tree of Beginning's Mew | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613782 | 613782 | Visitor Deoxys | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613784 | 613784 | Wave-Guiding Hero Lucario | 24146 | 10th Movie Commemoration Set |  |  | None |
| tcgtracking | POKEMON | ja | 85:613766 | 613766 | Icy Sky's Shaymin | 24145 | 11th Movie Commemoration Set | 001/009 | 001/009 | None |
| tcgtracking | POKEMON | ja | 85:613767 | 613767 | Piplup | 24145 | 11th Movie Commemoration Set | 002/009 | 002/009 | None |
| tcgtracking | POKEMON | ja | 85:613768 | 613768 | Pikachu | 24145 | 11th Movie Commemoration Set | 003/009 | 003/009 | None |
| tcgtracking | POKEMON | ja | 85:613769 | 613769 | Magnezone | 24145 | 11th Movie Commemoration Set | 004/009 | 004/009 | None |
| tcgtracking | POKEMON | ja | 85:613770 | 613770 | Reverse World's Giratina | 24145 | 11th Movie Commemoration Set | 005/009 | 005/009 | None |
| tcgtracking | POKEMON | ja | 85:613771 | 613771 | Mamoswine | 24145 | 11th Movie Commemoration Set | 006/009 | 006/009 | None |
| tcgtracking | POKEMON | ja | 85:613772 | 613772 | Shieldon | 24145 | 11th Movie Commemoration Set | 007/009 | 007/009 | None |
| tcgtracking | POKEMON | ja | 85:613773 | 613773 | Dialga | 24145 | 11th Movie Commemoration Set | 008/009 | 008/009 | None |
| tcgtracking | POKEMON | ja | 85:613774 | 613774 | Regigigas | 24145 | 11th Movie Commemoration Set | 009/009 | 009/009 | None |

### pokemoncard.io only by TCGPlayer id

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pokemoncard.io | POKEMON | en | me2-22 | 664093 | Dewgong | me2 | Phantasmal Flames | 22 | 22 | Common |
| pokemoncard.io | POKEMON | en | me2-55 | 662168 | Haunter | me2 | Phantasmal Flames | 55 | 55 | Uncommon |
| pokemoncard.io | POKEMON | en | me2-68 | 662234 | Toxtricity | me2 | Phantasmal Flames | 68 | 68 | Rare |
| pokemoncard.io | POKEMON | en | me2-87 | 662148 | Dawn | me2 | Phantasmal Flames | 87 | 87 | Uncommon |
| pokemoncard.io | POKEMON | en | me2-90 | 662166 | Grimsley's Move | me2 | Phantasmal Flames | 90 | 90 | Uncommon |
| pokemoncard.io | POKEMON | en | me2-92 | 662217 | Punk Helmet | me2 | Phantasmal Flames | 92 | 92 | Uncommon |
| pokemoncard.io | POKEMON | en | svp-1 | 480663 | Sprigatito | svp | Scarlet & Violet Black Star Promos | 1 | 1 | Promo |
| pokemoncard.io | POKEMON | en | svp-169 | 611828 | Jolteon | svp | Scarlet & Violet Promos | 169 | 169 | Promo |
| pokemoncard.io | POKEMON | en | svp-26 | 499998 | Varoom | svp | Scarlet & Violet Promos | 26 | 26 | Promo |
| pokemoncard.io | POKEMON | en | smp-SM184 | 189757 | Eevee | smp | SM Black Star Promos | SM184 | SM184 | Promo |
| pokemoncard.io | POKEMON | en | swshp-SWSH112 | 242028 | Cinderace | swshp | SWSH Black Star Promos | SWSH112 | SWSH112 | Promo |
| pokemoncard.io | POKEMON | en | swshp-SWSH113 | 242029 | Inteleon | swshp | SWSH Black Star Promos | SWSH113 | SWSH113 | Promo |
| pokemoncard.io | POKEMON | en | swshp-SWSH114 | 242030 | Cresselia | swshp | SWSH Black Star Promos | SWSH114 | SWSH114 | Promo |
| pokemoncard.io | POKEMON | en | swshp-SWSH115 | 242031 | Passimian | swshp | SWSH Black Star Promos | SWSH115 | SWSH115 | Promo |

### tcgtracking only by weak name+number

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tcgtracking | POKEMON | ja | 85:613766 | 613766 | Icy Sky's Shaymin | 24145 | 11th Movie Commemoration Set | 001/009 | 001/009 | None |
| tcgtracking | POKEMON | ja | 85:613767 | 613767 | Piplup | 24145 | 11th Movie Commemoration Set | 002/009 | 002/009 | None |
| tcgtracking | POKEMON | ja | 85:613768 | 613768 | Pikachu | 24145 | 11th Movie Commemoration Set | 003/009 | 003/009 | None |
| tcgtracking | POKEMON | ja | 85:613769 | 613769 | Magnezone | 24145 | 11th Movie Commemoration Set | 004/009 | 004/009 | None |
| tcgtracking | POKEMON | ja | 85:613770 | 613770 | Reverse World's Giratina | 24145 | 11th Movie Commemoration Set | 005/009 | 005/009 | None |
| tcgtracking | POKEMON | ja | 85:613771 | 613771 | Mamoswine | 24145 | 11th Movie Commemoration Set | 006/009 | 006/009 | None |
| tcgtracking | POKEMON | ja | 85:613772 | 613772 | Shieldon | 24145 | 11th Movie Commemoration Set | 007/009 | 007/009 | None |
| tcgtracking | POKEMON | ja | 85:613773 | 613773 | Dialga | 24145 | 11th Movie Commemoration Set | 008/009 | 008/009 | None |
| tcgtracking | POKEMON | ja | 85:613774 | 613774 | Regigigas | 24145 | 11th Movie Commemoration Set | 009/009 | 009/009 | None |
| tcgtracking | POKEMON | ja | 85:613042 | 613042 | Koffing | 24129 | ADV Expansion Pack | 001/055 | 001/055 | Common |
| tcgtracking | POKEMON | ja | 85:613078 | 613078 | Weezing | 24129 | ADV Expansion Pack | 002/055 | 002/055 | Rare |
| tcgtracking | POKEMON | ja | 85:613063 | 613063 | Sceptile | 24129 | ADV Expansion Pack | 003/055 | 003/055 | Holo Rare |
| tcgtracking | POKEMON | ja | 85:613051 | 613051 | Wurmple | 24129 | ADV Expansion Pack | 004/055 | 004/055 | Common |
| tcgtracking | POKEMON | ja | 85:613092 | 613092 | Silcoon | 24129 | ADV Expansion Pack | 005/055 | 005/055 | Uncommon |
| tcgtracking | POKEMON | ja | 85:613054 | 613054 | Beautifly | 24129 | ADV Expansion Pack | 006/055 | 006/055 | Holo Rare |
| tcgtracking | POKEMON | ja | 85:613086 | 613086 | Cascoon | 24129 | ADV Expansion Pack | 007/055 | 007/055 | Uncommon |
| tcgtracking | POKEMON | ja | 85:613058 | 613058 | Dustox | 24129 | ADV Expansion Pack | 008/055 | 008/055 | Holo Rare |
| tcgtracking | POKEMON | ja | 85:613048 | 613048 | Shroomish | 24129 | ADV Expansion Pack | 009/055 | 009/055 | Common |
| tcgtracking | POKEMON | ja | 85:613067 | 613067 | Breloom | 24129 | ADV Expansion Pack | 010/055 | 010/055 | Rare |
| tcgtracking | POKEMON | ja | 85:613055 | 613055 | Blaziken | 24129 | ADV Expansion Pack | 011/055 | 011/055 | Holo Rare |

### pokemoncard.io only by weak name+number

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pokemoncard.io | POKEMON | en | sv3pt5-1 | 502552 | Bulbasaur | sv3pt5 | 151 | 1 | 1 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-10 | 502559 | Caterpie | sv3pt5 | 151 | 10 | 10 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-100 | 516669 | Voltorb | sv3pt5 | 151 | 100 | 100 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-101 | 516670 | Electrode | sv3pt5 | 151 | 101 | 101 | Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-102 | 516671 | Exeggcute | sv3pt5 | 151 | 102 | 102 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-103 | 516672 | Exeggutor | sv3pt5 | 151 | 103 | 103 | Uncommon |
| pokemoncard.io | POKEMON | en | sv3pt5-104 | 516673 | Cubone | sv3pt5 | 151 | 104 | 104 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-105 | 516674 | Marowak | sv3pt5 | 151 | 105 | 105 | Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-106 | 516675 | Hitmonlee | sv3pt5 | 151 | 106 | 106 | Uncommon |
| pokemoncard.io | POKEMON | en | sv3pt5-107 | 516676 | Hitmonchan | sv3pt5 | 151 | 107 | 107 | Uncommon |
| pokemoncard.io | POKEMON | en | sv3pt5-108 | 516677 | Lickitung | sv3pt5 | 151 | 108 | 108 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-109 | 516679 | Koffing | sv3pt5 | 151 | 109 | 109 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-11 | 502560 | Metapod | sv3pt5 | 151 | 11 | 11 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-110 | 516680 | Weezing | sv3pt5 | 151 | 110 | 110 | Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-111 | 516570 | Rhyhorn | sv3pt5 | 151 | 111 | 111 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-112 | 516573 | Rhydon | sv3pt5 | 151 | 112 | 112 | Uncommon |
| pokemoncard.io | POKEMON | en | sv3pt5-113 | 516575 | Chansey | sv3pt5 | 151 | 113 | 113 | Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-114 | 516579 | Tangela | sv3pt5 | 151 | 114 | 114 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-115 | 516581 | Kangaskhan ex | sv3pt5 | 151 | 115 | 115 | Double Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-116 | 516583 | Horsea | sv3pt5 | 151 | 116 | 116 | Common |

## Samples: pokemon_en_only

### tcgtracking only by TCGPlayer id

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tcgtracking | POKEMON | en | 180514 | 180514 | Alolan Exeggutor - 2a/131 | 1938 | Alternate Art Promos | 002a/131 | 002a/131 | Promo |
| tcgtracking | POKEMON | en | 164234 | 164234 | Entei GX - 10a/73 | 1938 | Alternate Art Promos | 010a/073 | 010a/073 | Promo |
| tcgtracking | POKEMON | en | 189786 | 189786 | Sceptile - 10a/168 | 1938 | Alternate Art Promos | 010a/168 | 010a/168 | Promo |
| tcgtracking | POKEMON | en | 186106 | 186106 | Charmander - 18a/147 | 1938 | Alternate Art Promos | 018a/147 | 018a/147 | Promo |
| tcgtracking | POKEMON | en | 197853 | 197853 | Alolan Sandshrew - 19a/145 | 1938 | Alternate Art Promos | 019a/145 | 019a/145 | Promo |
| tcgtracking | POKEMON | en | 148388 | 148388 | Slowking - 21/122 (Cosmos Holo) | 1938 | Alternate Art Promos | 021/122 | 021/122 | Promo |
| tcgtracking | POKEMON | en | 174488 | 174488 | Alolan Vulpix - 21a/145 | 1938 | Alternate Art Promos | 021a/145 | 021a/145 | Promo |
| tcgtracking | POKEMON | en | 211603 | 211603 | Oshawott - 27/114 (Cosmos Holo) | 1938 | Alternate Art Promos | 027/114 | 027/114 | Promo |
| tcgtracking | POKEMON | en | 131697 | 131697 | Jolteon EX - 28a/83 | 1938 | Alternate Art Promos | 028a/083 | 028a/083 | Promo |
| tcgtracking | POKEMON | en | 179371 | 179371 | Tapu Fini GX - 39a/147 | 1938 | Alternate Art Promos | 039a/147 | 039a/147 | Promo |
| tcgtracking | POKEMON | en | 184219 | 184219 | Altaria - 40a/70 | 1938 | Alternate Art Promos | 040a/070 | 040a/070 | Promo |
| tcgtracking | POKEMON | en | 148348 | 148348 | Regirock EX - 43a/124 | 1938 | Alternate Art Promos | 043a/124 | 043a/124 | Promo |
| tcgtracking | POKEMON | en | 191907 | 191907 | Garbodor - 51a/145 (Cosmos Holo) | 1938 | Alternate Art Promos | 051a/145 | 051a/145 | Promo |
| tcgtracking | POKEMON | en | 131698 | 131698 | Zygarde EX - 54a/124 | 1938 | Alternate Art Promos | 054a/124 | 054a/124 | Promo |
| tcgtracking | POKEMON | en | 131695 | 131695 | M Lucario EX - 55a/111 | 1938 | Alternate Art Promos | 055a/111 | 055a/111 | Promo |
| tcgtracking | POKEMON | en | 179367 | 179367 | Tapu Lele GX - 60a/145 | 1938 | Alternate Art Promos | 060a/145 | 060a/145 | Promo |
| tcgtracking | POKEMON | en | 155599 | 155599 | Guzzlord GX - 63a/111 | 1938 | Alternate Art Promos | 063a/111 | 063a/111 | Promo |
| tcgtracking | POKEMON | en | 148351 | 148351 | Team Flare Grunt - 73a/83 | 1938 | Alternate Art Promos | 073a/083 | 073a/083 | Promo |
| tcgtracking | POKEMON | en | 148342 | 148342 | Hex Maniac - 75a/98 | 1938 | Alternate Art Promos | 075a/098 | 075a/098 | Promo |
| tcgtracking | POKEMON | en | 198529 | 198529 | Zoroark GX - 77a/73 | 1938 | Alternate Art Promos | 077a/073 | 077a/073 | Promo |

### pokemoncard.io only by TCGPlayer id

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pokemoncard.io | POKEMON | en | me2-22 | 664093 | Dewgong | me2 | Phantasmal Flames | 22 | 22 | Common |
| pokemoncard.io | POKEMON | en | me2-55 | 662168 | Haunter | me2 | Phantasmal Flames | 55 | 55 | Uncommon |
| pokemoncard.io | POKEMON | en | me2-68 | 662234 | Toxtricity | me2 | Phantasmal Flames | 68 | 68 | Rare |
| pokemoncard.io | POKEMON | en | me2-87 | 662148 | Dawn | me2 | Phantasmal Flames | 87 | 87 | Uncommon |
| pokemoncard.io | POKEMON | en | me2-90 | 662166 | Grimsley's Move | me2 | Phantasmal Flames | 90 | 90 | Uncommon |
| pokemoncard.io | POKEMON | en | me2-92 | 662217 | Punk Helmet | me2 | Phantasmal Flames | 92 | 92 | Uncommon |
| pokemoncard.io | POKEMON | en | svp-1 | 480663 | Sprigatito | svp | Scarlet & Violet Black Star Promos | 1 | 1 | Promo |
| pokemoncard.io | POKEMON | en | svp-169 | 611828 | Jolteon | svp | Scarlet & Violet Promos | 169 | 169 | Promo |
| pokemoncard.io | POKEMON | en | svp-26 | 499998 | Varoom | svp | Scarlet & Violet Promos | 26 | 26 | Promo |
| pokemoncard.io | POKEMON | en | smp-SM184 | 189757 | Eevee | smp | SM Black Star Promos | SM184 | SM184 | Promo |
| pokemoncard.io | POKEMON | en | swshp-SWSH112 | 242028 | Cinderace | swshp | SWSH Black Star Promos | SWSH112 | SWSH112 | Promo |
| pokemoncard.io | POKEMON | en | swshp-SWSH113 | 242029 | Inteleon | swshp | SWSH Black Star Promos | SWSH113 | SWSH113 | Promo |
| pokemoncard.io | POKEMON | en | swshp-SWSH114 | 242030 | Cresselia | swshp | SWSH Black Star Promos | SWSH114 | SWSH114 | Promo |
| pokemoncard.io | POKEMON | en | swshp-SWSH115 | 242031 | Passimian | swshp | SWSH Black Star Promos | SWSH115 | SWSH115 | Promo |

### tcgtracking only by weak name+number

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tcgtracking | POKEMON | en | 180514 | 180514 | Alolan Exeggutor - 2a/131 | 1938 | Alternate Art Promos | 002a/131 | 002a/131 | Promo |
| tcgtracking | POKEMON | en | 164234 | 164234 | Entei GX - 10a/73 | 1938 | Alternate Art Promos | 010a/073 | 010a/073 | Promo |
| tcgtracking | POKEMON | en | 189786 | 189786 | Sceptile - 10a/168 | 1938 | Alternate Art Promos | 010a/168 | 010a/168 | Promo |
| tcgtracking | POKEMON | en | 186106 | 186106 | Charmander - 18a/147 | 1938 | Alternate Art Promos | 018a/147 | 018a/147 | Promo |
| tcgtracking | POKEMON | en | 197853 | 197853 | Alolan Sandshrew - 19a/145 | 1938 | Alternate Art Promos | 019a/145 | 019a/145 | Promo |
| tcgtracking | POKEMON | en | 148388 | 148388 | Slowking - 21/122 (Cosmos Holo) | 1938 | Alternate Art Promos | 021/122 | 021/122 | Promo |
| tcgtracking | POKEMON | en | 174488 | 174488 | Alolan Vulpix - 21a/145 | 1938 | Alternate Art Promos | 021a/145 | 021a/145 | Promo |
| tcgtracking | POKEMON | en | 131696 | 131696 | M Manectric EX - 24a/119 | 1938 | Alternate Art Promos | 024a/119 | 024a/119 | Promo |
| tcgtracking | POKEMON | en | 211603 | 211603 | Oshawott - 27/114 (Cosmos Holo) | 1938 | Alternate Art Promos | 027/114 | 027/114 | Promo |
| tcgtracking | POKEMON | en | 131697 | 131697 | Jolteon EX - 28a/83 | 1938 | Alternate Art Promos | 028a/083 | 028a/083 | Promo |
| tcgtracking | POKEMON | en | 179371 | 179371 | Tapu Fini GX - 39a/147 | 1938 | Alternate Art Promos | 039a/147 | 039a/147 | Promo |
| tcgtracking | POKEMON | en | 184219 | 184219 | Altaria - 40a/70 | 1938 | Alternate Art Promos | 040a/070 | 040a/070 | Promo |
| tcgtracking | POKEMON | en | 148348 | 148348 | Regirock EX - 43a/124 | 1938 | Alternate Art Promos | 043a/124 | 043a/124 | Promo |
| tcgtracking | POKEMON | en | 191907 | 191907 | Garbodor - 51a/145 (Cosmos Holo) | 1938 | Alternate Art Promos | 051a/145 | 051a/145 | Promo |
| tcgtracking | POKEMON | en | 131698 | 131698 | Zygarde EX - 54a/124 | 1938 | Alternate Art Promos | 054a/124 | 054a/124 | Promo |
| tcgtracking | POKEMON | en | 131695 | 131695 | M Lucario EX - 55a/111 | 1938 | Alternate Art Promos | 055a/111 | 055a/111 | Promo |
| tcgtracking | POKEMON | en | 179367 | 179367 | Tapu Lele GX - 60a/145 | 1938 | Alternate Art Promos | 060a/145 | 060a/145 | Promo |
| tcgtracking | POKEMON | en | 155599 | 155599 | Guzzlord GX - 63a/111 | 1938 | Alternate Art Promos | 063a/111 | 063a/111 | Promo |
| tcgtracking | POKEMON | en | 148340 | 148340 | Aegislash EX - 65a/119 | 1938 | Alternate Art Promos | 065a/119 | 065a/119 | Promo |
| tcgtracking | POKEMON | en | 148351 | 148351 | Team Flare Grunt - 73a/83 | 1938 | Alternate Art Promos | 073a/083 | 073a/083 | Promo |

### pokemoncard.io only by weak name+number

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pokemoncard.io | POKEMON | en | sv3pt5-1 | 502552 | Bulbasaur | sv3pt5 | 151 | 1 | 1 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-10 | 502559 | Caterpie | sv3pt5 | 151 | 10 | 10 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-100 | 516669 | Voltorb | sv3pt5 | 151 | 100 | 100 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-101 | 516670 | Electrode | sv3pt5 | 151 | 101 | 101 | Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-102 | 516671 | Exeggcute | sv3pt5 | 151 | 102 | 102 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-103 | 516672 | Exeggutor | sv3pt5 | 151 | 103 | 103 | Uncommon |
| pokemoncard.io | POKEMON | en | sv3pt5-104 | 516673 | Cubone | sv3pt5 | 151 | 104 | 104 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-105 | 516674 | Marowak | sv3pt5 | 151 | 105 | 105 | Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-106 | 516675 | Hitmonlee | sv3pt5 | 151 | 106 | 106 | Uncommon |
| pokemoncard.io | POKEMON | en | sv3pt5-107 | 516676 | Hitmonchan | sv3pt5 | 151 | 107 | 107 | Uncommon |
| pokemoncard.io | POKEMON | en | sv3pt5-108 | 516677 | Lickitung | sv3pt5 | 151 | 108 | 108 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-109 | 516679 | Koffing | sv3pt5 | 151 | 109 | 109 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-11 | 502560 | Metapod | sv3pt5 | 151 | 11 | 11 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-110 | 516680 | Weezing | sv3pt5 | 151 | 110 | 110 | Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-111 | 516570 | Rhyhorn | sv3pt5 | 151 | 111 | 111 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-112 | 516573 | Rhydon | sv3pt5 | 151 | 112 | 112 | Uncommon |
| pokemoncard.io | POKEMON | en | sv3pt5-113 | 516575 | Chansey | sv3pt5 | 151 | 113 | 113 | Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-114 | 516579 | Tangela | sv3pt5 | 151 | 114 | 114 | Common |
| pokemoncard.io | POKEMON | en | sv3pt5-115 | 516581 | Kangaskhan ex | sv3pt5 | 151 | 115 | 115 | Double Rare |
| pokemoncard.io | POKEMON | en | sv3pt5-116 | 516583 | Horsea | sv3pt5 | 151 | 116 | 116 | Common |

## Samples: one_piece

### tcgtracking only by TCGPlayer id

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tcgtracking | ONE_PIECE | en | 68:545922 | 545922 | Okiku (SP) | 23387 | 500 Years in the Future | OP01-035 | OP01-035 | R |
| tcgtracking | ONE_PIECE | en | 68:545923 | 545923 | Donquixote Doflamingo (SP) | 23387 | 500 Years in the Future | OP01-073 | OP01-073 | R |
| tcgtracking | ONE_PIECE | en | 68:545924 | 545924 | Izo (SP) | 23387 | 500 Years in the Future | OP03-003 | OP03-003 | R |
| tcgtracking | ONE_PIECE | en | 68:545926 | 545926 | Eustass"Captain"Kid (SP) | 23387 | 500 Years in the Future | OP05-074 | OP05-074 | SR |
| tcgtracking | ONE_PIECE | en | 68:545927 | 545927 | O-Nami (SP) | 23387 | 500 Years in the Future | OP06-101 | OP06-101 | R |
| tcgtracking | ONE_PIECE | en | 68:545778 | 545778 | Monkey.D.Dragon (001) | 23387 | 500 Years in the Future | OP07-001 | OP07-001 | L |
| tcgtracking | ONE_PIECE | en | 68:545779 | 545779 | Monkey.D.Dragon (001) (Parallel) | 23387 | 500 Years in the Future | OP07-001 | OP07-001 | L |
| tcgtracking | ONE_PIECE | en | 68:545783 | 545783 | Carina | 23387 | 500 Years in the Future | OP07-005 | OP07-005 | R |
| tcgtracking | ONE_PIECE | en | 68:545785 | 545785 | Sterry | 23387 | 500 Years in the Future | OP07-006 | OP07-006 | C |
| tcgtracking | ONE_PIECE | en | 68:545786 | 545786 | Dice | 23387 | 500 Years in the Future | OP07-007 | OP07-007 | C |
| tcgtracking | ONE_PIECE | en | 68:545787 | 545787 | Mr. Tanaka | 23387 | 500 Years in the Future | OP07-008 | OP07-008 | UC |
| tcgtracking | ONE_PIECE | en | 68:545788 | 545788 | Dogura & Magura | 23387 | 500 Years in the Future | OP07-009 | OP07-009 | C |
| tcgtracking | ONE_PIECE | en | 68:545789 | 545789 | Baccarat | 23387 | 500 Years in the Future | OP07-010 | OP07-010 | R |
| tcgtracking | ONE_PIECE | en | 68:545790 | 545790 | Bluejam | 23387 | 500 Years in the Future | OP07-011 | OP07-011 | C |
| tcgtracking | ONE_PIECE | en | 68:545791 | 545791 | Porchemy | 23387 | 500 Years in the Future | OP07-012 | OP07-012 | C |
| tcgtracking | ONE_PIECE | en | 68:545792 | 545792 | Masked Deuce | 23387 | 500 Years in the Future | OP07-013 | OP07-013 | UC |
| tcgtracking | ONE_PIECE | en | 68:545793 | 545793 | Moda | 23387 | 500 Years in the Future | OP07-014 | OP07-014 | UC |
| tcgtracking | ONE_PIECE | en | 68:545794 | 545794 | Monkey.D.Dragon (015) | 23387 | 500 Years in the Future | OP07-015 | OP07-015 | SR |
| tcgtracking | ONE_PIECE | en | 68:545795 | 545795 | Monkey.D.Dragon (015) (Parallel) | 23387 | 500 Years in the Future | OP07-015 | OP07-015 | SR |
| tcgtracking | ONE_PIECE | en | 68:545797 | 545797 | Dragon Breath | 23387 | 500 Years in the Future | OP07-017 | OP07-017 | UC |

### onepiecedb.io only by TCGPlayer id

_No sample rows._

### tcgtracking only by weak name+number

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tcgtracking | ONE_PIECE | en | 68:545922 | 545922 | Okiku (SP) | 23387 | 500 Years in the Future | OP01-035 | OP01-035 | R |
| tcgtracking | ONE_PIECE | en | 68:545923 | 545923 | Donquixote Doflamingo (SP) | 23387 | 500 Years in the Future | OP01-073 | OP01-073 | R |
| tcgtracking | ONE_PIECE | en | 68:545924 | 545924 | Izo (SP) | 23387 | 500 Years in the Future | OP03-003 | OP03-003 | R |
| tcgtracking | ONE_PIECE | en | 68:545925 | 545925 | Issho (SP) | 23387 | 500 Years in the Future | OP03-078 | OP03-078 | SR |
| tcgtracking | ONE_PIECE | en | 68:545926 | 545926 | Eustass"Captain"Kid (SP) | 23387 | 500 Years in the Future | OP05-074 | OP05-074 | SR |
| tcgtracking | ONE_PIECE | en | 68:545927 | 545927 | O-Nami (SP) | 23387 | 500 Years in the Future | OP06-101 | OP06-101 | R |
| tcgtracking | ONE_PIECE | en | 68:545778 | 545778 | Monkey.D.Dragon (001) | 23387 | 500 Years in the Future | OP07-001 | OP07-001 | L |
| tcgtracking | ONE_PIECE | en | 68:545779 | 545779 | Monkey.D.Dragon (001) (Parallel) | 23387 | 500 Years in the Future | OP07-001 | OP07-001 | L |
| tcgtracking | ONE_PIECE | en | 68:545784 | 545784 | Carina (Parallel) | 23387 | 500 Years in the Future | OP07-005 | OP07-005 | R |
| tcgtracking | ONE_PIECE | en | 68:545794 | 545794 | Monkey.D.Dragon (015) | 23387 | 500 Years in the Future | OP07-015 | OP07-015 | SR |
| tcgtracking | ONE_PIECE | en | 68:545795 | 545795 | Monkey.D.Dragon (015) (Parallel) | 23387 | 500 Years in the Future | OP07-015 | OP07-015 | SR |
| tcgtracking | ONE_PIECE | en | 68:545799 | 545799 | Jewelry Bonney (019) | 23387 | 500 Years in the Future | OP07-019 | OP07-019 | L |
| tcgtracking | ONE_PIECE | en | 68:545800 | 545800 | Jewelry Bonney (019) (Parallel) | 23387 | 500 Years in the Future | OP07-019 | OP07-019 | L |
| tcgtracking | ONE_PIECE | en | 68:545804 | 545804 | Otama (Parallel) | 23387 | 500 Years in the Future | OP07-022 | OP07-022 | R |
| tcgtracking | ONE_PIECE | en | 68:545808 | 545808 | Jewelry Bonney (026) | 23387 | 500 Years in the Future | OP07-026 | OP07-026 | SR |
| tcgtracking | ONE_PIECE | en | 68:545809 | 545809 | Jewelry Bonney (026) (Parallel) | 23387 | 500 Years in the Future | OP07-026 | OP07-026 | SR |
| tcgtracking | ONE_PIECE | en | 68:545810 | 545810 | Jinbe (027) | 23387 | 500 Years in the Future | OP07-027 | OP07-027 | C |
| tcgtracking | ONE_PIECE | en | 68:545813 | 545813 | Basil Hawkins (Parallel) | 23387 | 500 Years in the Future | OP07-029 | OP07-029 | SR |
| tcgtracking | ONE_PIECE | en | 68:545817 | 545817 | Monkey.D.Luffy (033) | 23387 | 500 Years in the Future | OP07-033 | OP07-033 | UC |
| tcgtracking | ONE_PIECE | en | 68:545818 | 545818 | Roronoa Zoro (034) | 23387 | 500 Years in the Future | OP07-034 | OP07-034 | UC |

### onepiecedb.io only by weak name+number

| source | game | language | sourceItemId | tcgplayer_id | name | setId | setName | localId | cardNumber | rarity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| onepiecedb.io | ONE_PIECE | en | ST14-001 | 548412 | Monkey.D.Luffy | ST14 | 3D2Y | ST14-001 | ST14-001 | Leader |
| onepiecedb.io | ONE_PIECE | en | ST14-012 | 548423 | Monkey.D.Luffy | ST14 | 3D2Y | ST14-012 | ST14-012 | Common |
| onepiecedb.io | ONE_PIECE | en | OP07-001 | 629179 | Monkey.D.Dragon | OP07 | 500 Years In The Future | OP07-001 | OP07-001 | Leader |
| onepiecedb.io | ONE_PIECE | en | OP07-015 | 659235 | Monkey.D.Dragon | OP07 | 500 Years In The Future | OP07-015 | OP07-015 | Super Rare |
| onepiecedb.io | ONE_PIECE | en | OP07-019 | 634599 | Jewelry Bonney | OP07 | 500 Years In The Future | OP07-019 | OP07-019 | Leader |
| onepiecedb.io | ONE_PIECE | en | OP07-026 | 656182 | Jewelry Bonney | OP07 | 500 Years In The Future | OP07-026 | OP07-026 | Super Rare |
| onepiecedb.io | ONE_PIECE | en | OP07-027 | 552065 | Jinbe | OP07 | 500 Years In The Future | OP07-027 | OP07-027 | Common |
| onepiecedb.io | ONE_PIECE | en | OP07-033 | 661695 | Monkey.D.Luffy | OP07 | 500 Years In The Future | OP07-033 | OP07-033 | Uncommon |
| onepiecedb.io | ONE_PIECE | en | OP07-034 | 634608 | Roronoa Zoro | OP07 | 500 Years In The Future | OP07-034 | OP07-034 | Uncommon |
| onepiecedb.io | ONE_PIECE | en | OP07-038 | 629181 | Boa Hancock | OP07 | 500 Years In The Future | OP07-038 | OP07-038 | Leader |
| onepiecedb.io | ONE_PIECE | en | OP07-042 | 552070 | Gecko Moria | OP07 | 500 Years In The Future | OP07-042 | OP07-042 | Common |
| onepiecedb.io | ONE_PIECE | en | OP07-045 | 545831 | Jinbe | OP07 | 500 Years In The Future | OP07-045 | OP07-045 | Super Rare |
| onepiecedb.io | ONE_PIECE | en | OP07-047 | 658341 | Trafalgar Law | OP07 | 500 Years In The Future | OP07-047 | OP07-047 | Rare |
| onepiecedb.io | ONE_PIECE | en | OP07-051 | 648101 | Boa Hancock | OP07 | 500 Years In The Future | OP07-051 | OP07-051 | Super Rare |
| onepiecedb.io | ONE_PIECE | en | OP07-053 | 661881 | Portgas.D.Ace | OP07 | 500 Years In The Future | OP07-053 | OP07-053 | Rare |
| onepiecedb.io | ONE_PIECE | en | OP07-059 | 629182 | Foxy | OP07 | 500 Years In The Future | OP07-059 | OP07-059 | Leader |
| onepiecedb.io | ONE_PIECE | en | OP07-066 | 649672 | Tony Tony.Chopper | OP07 | 500 Years In The Future | OP07-066 | OP07-066 | Rare |
| onepiecedb.io | ONE_PIECE | en | OP07-071 | 545864 | Foxy | OP07 | 500 Years In The Future | OP07-071 | OP07-071 | Rare |
| onepiecedb.io | ONE_PIECE | en | OP07-073 | 649696 | Monkey.D.Luffy | OP07 | 500 Years In The Future | OP07-073 | OP07-073 | Rare |
| onepiecedb.io | ONE_PIECE | en | OP07-075 | 552119 | Noro Noro Beam | OP07 | 500 Years In The Future | OP07-075 | OP07-075 | Uncommon |

## Interpretation guardrail

This is a delta report, not a delete list. Cross-source catalogs are not authoritative substitutes for each other. Use TCGPlayer-id overlap to identify duplicate external products, and inspect samples before pruning any source/game slice.
