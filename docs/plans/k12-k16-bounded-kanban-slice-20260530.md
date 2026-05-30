# K12-K16 bounded kanban slice — 2026-05-30

Scope: launch five implementation slices from the Oracle-clean P0 plan. No DB writes, no migrations, no vendor-owned/slab/private-field exposure.

## Acceptance gate

- K15.1 source rank registry exists and replaces hardcoded dedupe rank logic.
- K12.1 typed adapters route CARD/SEALED_PRODUCT/SET to CatalogItem/CatalogSealedProduct/CatalogSet.
- K12.2 search query normalization supports itemClass, keeps type as legacy alias, rejects conflicts, rejects offset.
- K13.1 set/sealed DTO normalization uses sourceItemId and entity-specific images.
- K15.2 facets/suggest are explicit card-only P0, not misleading sealed/set coverage.
- API tests/build pass.
- After implementation/verification, run `git pull` per user request.

## Board

1. K15.1 Source rank registry — completed
2. K12.1 Typed source-backed search adapters — completed
3. K12.2 Query normalization / conflict handling — completed
4. K13.1 Set/sealed DTO normalization — completed
5. K15.2 Facets/suggest card-only contract — completed

## Verification evidence

- `npm run test:catalog:source-priority -w @oripa/api` — passed.
- `npm run test:catalog:search-dedupe -w @oripa/api` — passed.
- `npm run test:catalog:search-query -w @oripa/api` — passed.
- `npm run test:catalog:search-adapters -w @oripa/api` — passed.
- `npm run build -w @oripa/shared && npm run build -w @oripa/api` — passed.

## Blockers handled

- `pnpm` unavailable on this host; used npm workspace scripts from repo package.json.
- Initial API build failed on missing generated/install artifacts and stale shared dist; ran `npm install`, `npm run db:generate`, and built shared before API. No DB writes/migrations were run.

## Recovery path

If a blocker appears: capture command/error, repair locally if bounded to this slice, otherwise stop with exact blocker and rollback guidance.
