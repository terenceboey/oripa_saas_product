# Setlist image URL second-pass gap fill

Run date: 2026-06-05
Scope: local Docker PG only (`localhost:15433/oripa_sg`). No Render/prod writes.

## Final coverage after second pass

- Pokémon EN (`POKEMON`, `en`): 178 / 216 filled, 38 gaps
- Pokémon JP native (`POKEMON`, `ja`): 228 / 447 filled, 219 gaps
- Pokémon Japan EN projection (`POKEMON_JAPAN`, `en`): 111 / 148 filled, 37 gaps
- One Piece EN (`ONE_PIECE`, `en`): 71 / 76 filled, 5 gaps
- Unsafe image URLs remaining: 0

## Added in this pass

- One Piece official Bandai page mappings:
  - Learn Together Deck Set (`ld01`)
  - Super Pre-Release starter decks 1–4 (`st01-04_pre`)
- Pokémon EN official/manual mappings:
  - McDonald's Promos 2011/2012/2014/2015/2016/2017/2018/2019/2022 via PokémonTCG official set IDs
  - Trick or Trade BOOster Bundle 2023/2024 via Bulbagarden logo-like set art files
- Pokémon JP mappings/discovery:
  - Bulbagarden `allimages` prefix discovery for logo/symbol files
  - `SVM: Generations Start Decks` via `SVM_Generations_Start_Decks_logo.png`
- Web UI fix:
  - failed image state is now tied to the failed URL, so a stale broken-image state does not hide a newly valid image when list data changes.

## Verification

- `npm run lint -w @oripa/api` passed
- `npm run lint -w @oripa/web` passed
- `npm run build -w @oripa/web` passed
- API proof: `M5: Abyss Eye` returns `https://archives.bulbagarden.net/media/upload/7/71/M5_Logo_JP.png`
- Browser proof: after forcing a real refetch, `M5: Abyss Eye` rendered an `<img>` with natural size `795x241` from that URL

## Remaining gap policy

Remaining gaps are intentionally honest `image missing` rows unless a legitimate set-logo/symbol/banner source is found. Do not fill them with card art, sealed product box art, generic Pokémon/TCG logos, or TCGtracking `set-symbol.php` badges.
