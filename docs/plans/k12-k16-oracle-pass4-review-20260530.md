## Verdict: CLEAN

No material blockers remain that prevent implementation planning.

The previous Oracle pass3 blockers are now patched in the repaired v2 plan:

1. **`/facets` and `/suggest` unresolved** — now explicitly handled as card-only in P0, with deterministic unsupported/capability behavior required for sealed/set requests and tests specified.

2. **`type` vs `itemClass` precedence** — now normalized through one internal class field, with explicit conflict handling and test cases.

3. **`sourceItemId` mapping for non-card entities** — now explicitly maps `CatalogSealedProduct.sourceProductId` and `CatalogSet.sourceSetId` into DTO `sourceItemId`, plus image normalization rules.

4. **Source-rank/collapse hardening** — K15.1 now requires a source-priority registry keyed by `game + itemClass + useCase + source`, separates display priority from collapse eligibility, forbids name-only collapse, and requires unknown sources to be low-rank/non-collapse eligible unless stable-ID collapse exists.

5. **P0 scope is properly narrowed** — P0 is limited to source-backed `CARD`, `SEALED_PRODUCT`, and `SET`; vendor inventory, labels/categories, prizeability, canonical docs, cursor pagination, and DB migrations are explicitly deferred/non-goals.

## Non-blocking notes

The attached current code is still old-world: router/search still query `CatalogItem` for search/facets/suggest, and dedupe still has hardcoded source ranking. That is not a plan blocker because the v2 plan now explicitly tells implementers to replace those seams.

One thing I would keep strict during implementation: do **K15.1 before K12.1**, exactly as the plan orders it, otherwise set imagery/source precedence and collapse behavior can regress while expanding search classes.
