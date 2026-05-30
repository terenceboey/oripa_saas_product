# K12–K16 Oracle Repair Loop Summary

Date: 2026-05-30

## Loop result

**CONVERGED.** Oracle pass4 verdict: `CLEAN` — no material blockers remain that prevent implementation planning.

Final implementation plan:

- `docs/plans/k12-k16-repaired-plan-v2-20260530.md`

Final Oracle review:

- `docs/plans/k12-k16-oracle-pass4-review-20260530.md`

## Loop history

1. Initial local repair / plan packet:
   - `docs/plans/k12-k16-oracle-pass2-input-20260530.md`
   - `docs/plans/k12-k16-refined-local-review-20260530.md`

2. Oracle pass2 repaired run:
   - `docs/plans/k12-k16-oracle-pass2-review-20260530.md`
   - verdict: `NOT CLEAN as-written`, but K12/K13 can start if narrowed.
   - accepted blockers: separate source-backed search, vendor inventory, and prizeability/taxonomy seams; fix sealed search backing table; do not leak owned inventory fields; defer K16 as design.

3. Repair v1:
   - `docs/plans/k12-k16-repaired-plan-v1-20260530.md`
   - applied pass2 blockers into implementation plan.

4. Oracle pass3:
   - `docs/plans/k12-k16-oracle-pass3-review-20260530.md`
   - verdict: `NOT CLEAN`
   - remaining blockers:
     - `/facets` and `/suggest` unresolved while remaining card-only.
     - `type` vs `itemClass` precedence underspecified.
     - `sourceItemId`/image normalization for non-card entities underspecified.

5. Repair v2:
   - `docs/plans/k12-k16-repaired-plan-v2-20260530.md`
   - patched pass3 blockers:
     - explicit `/facets` and `/suggest` P0 card-only contract with deterministic unsupported behavior for sealed/set.
     - normalized internal search class with `itemClass` canonical and `type` legacy alias.
     - explicit source ID/image normalization for `CatalogItem`, `CatalogSealedProduct`, and `CatalogSet`.

6. Oracle pass4:
   - `docs/plans/k12-k16-oracle-pass4-review-20260530.md`
   - verdict: `CLEAN`
   - non-blocking note: current code remains old-world, but v2 plan explicitly replaces those seams. Keep implementation order strict: **K15.1 before K12.1**.

## Final P0 implementation order

1. K15.1 — source rank registry.
2. K12.1 — typed source-backed search adapters.
3. K12.2 — narrowed source-backed DTO.
4. K13.1 — games/sets endpoints.
5. K15.2 — provenance/collapse hardening.

## Final gates

- No DB writes/migrations in P0.
- No vendor-owned inventory/slab/custom/accessory search in P0.
- No label/category filters in P0.
- No cursor pagination in P0.
- No canonical search doc dependency in P0.
- No name-only collapse.
- No `sourcePayload` or owned inventory/private fields in responses.
- `/facets` and `/suggest` remain card-only unless separately implemented with typed adapters.
