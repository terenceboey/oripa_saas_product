# Setlist Image Truth Gap Fill Candidates

Generated: 2026-06-05T12:28:50.107Z

## Safety

- Mode: read-only candidate generation
- DB writes: none
- Upstream push: none
- SQL plan: generated with `ROLLBACK`; not executed

## Coverage

- Target active sets needing image truth repair: 754
- Safe candidates: 3
- Rejected/no safe candidate: 751
- Existing active sets with no set image: 557
- Existing active sets with risky image: 197

## Candidate breakdown

- tcgdex:en: 3

## Rejection breakdown

- pokemon_jp_name_language_mismatch: 445
- no_authoritative_set_image_provider_for_lane: 224
- no_exact_or_safe_unique_match: 82

## Interpretation

This pass only accepts authoritative TCGdex Pokémon EN set-level logo/symbol matches. It deliberately refuses One Piece and Japanese Pokémon rows where the available source is a product/card image, language-mismatched, or lacks an exact/safe match.

Remaining rejected rows should become separate repair lanes: One Piece official set-art source discovery, Pokémon JP language/source mapping, and UI/API fallback removal.
