# PokemonCard.io Quality Bar for Oripa — Oracle/Fallback Review

Live Oracle browser execution was attempted but failed before model submission because no ChatGPT cookies were available in the Oracle browser profile; API preflight also reported missing `OPENAI_API_KEY`. Per the Oracle skill workflow, a bounded fallback review was run across three lanes: catalog/search/DB, paid-pack correctness, and external benchmark interpretation.

## Verdict

- **CLEAN FOR PLANNING** after patching.
- **NOT CLEAN FOR IMPLEMENTATION** until the live DB/Prisma schema drift gate is completed.

## Accepted P0 blockers

1. Reconcile live DB schema/index drift before any Prisma migration. Watch `CatalogSet` / `CatalogItem.catalogSetId` and existing trigram indexes.
2. Treat ranked SQL search rewrite as P0, not P1; the current Prisma waterfall is too slow for pokemoncard-style UX.
3. Remove `sourcePayload` from normal search/autocomplete responses.
4. Add `language` and structured filters (`source`, `setId`, `rarity`, `localId`, `cardNumber`) to search.
5. Populate `PackPrize` catalog identity and immutable snapshots in `buildPrizeRows()`.
6. Reject prize mutation for `LIVE` / `ARCHIVED` packs.
7. Add publish/freeze endpoint and `Pack.poolSnapshotHash`.
8. Make draw handler verify the current prize rows against `Pack.poolSnapshotHash` before HMAC selection.
9. Add vendor inventory allocation before physical paid packs go live.
10. Downgrade pokemoncard.io custom-pack internals to gated/inferred; do not claim private implementation.

## Patch result

Patched plan:

`docs/plans/pokemoncard-io-quality-bar-oripa-architecture-plan-20260530.md`

Key patch additions:

- Oracle status and fallback note.
- Live DB/schema drift gate.
- Custom-pack overclaim correction.
- Static filter vs live facet warning.
- Measured-performance caveat.
- Typeahead and iterative facet-refinement UX requirements.
- P0 ranked SQL task.
- Oracle review closure addendum with final implementation order.
