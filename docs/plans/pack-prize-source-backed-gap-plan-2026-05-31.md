# PackPrize source-backed gap repair plan — 2026-05-31

## Done definition

Goal: pack prize creation/import must freeze authoritative source-backed catalog snapshots when a prize row can be linked to catalog/vendor source data, while preserving manual prize support for intentionally unlinked demo/custom rows.

Non-goals:
- Do not delete existing demo packs/prizes in production.
- Do not invent owned inventory rows; catalog rows are source-backed metadata, not stock.
- Do not perform broad live DB cleanup of old prize rows unless a safe deterministic match exists.

Acceptance criteria:
1. CSV pack import resolves catalog matches into payload refs (`catalogItemId`, `catalogSource`, `catalogSourceItemId`, `language`) instead of returning image-only matches.
2. Pack create/update consumes those refs through existing `resolvePackPrizeRows`, freezing `catalogSnapshot`, normalized label, image URLs, set/card/rarity fields, and provenance into `PackPrize`.
3. Manual prizes without catalog refs remain allowed and explicitly unlinked.
4. Existing publish/pool hash freeze continues to include catalog provenance/snapshots.
5. Tests cover: catalog-id CSV import preservation; source-id CSV import preservation; no fake client image/label overriding catalog snapshot; manual fallback remains manual.
6. Verification: relevant pack/catalog tests + API build pass.

## Evidence of current gap

Live DB read-only sample:
- `PackPrize` has rows with image fallback cardback but `catalogItemId/catalogSource/catalogSourceItemId/catalogSnapshot` all null.
- Existing `prize-snapshots.ts` already freezes source-backed snapshots when create/update payload contains refs.
- Existing CSV import endpoint only resolves catalog rows for images and returns tier items without refs, so CSV-imported packs lose catalog linkage before create/update.

## Repair plan

### P1 — Wire CSV import to source-backed refs

Files:
- `apps/api/src/modules/packs/router.ts`

Changes:
1. Extend `CsvImportRow` parsing:
   - keep `catalog_item_id`
   - add `catalog_source`
   - keep `source_item_id`
   - add optional `language`
   - default `catalog_source` to `tcgtracking` only when `source_item_id` is provided and `catalog_source` is absent.
2. Replace image-only `resolveCatalogItemForRow` return shape with a full selected catalog item shape compatible with `CatalogItemSnapshotSource`:
   - import/use `CatalogItemSnapshotSource` from `prize-snapshots.ts`.
   - change cache type to `Map<string, CatalogItemSnapshotSource | null>`.
   - change `found` type to `CatalogItemSnapshotSource | null`.
   - all `findUnique`/`findFirst` branches must use the existing full `catalogItemSelect`, not image-only selects.
3. Matching order must be exactly:
   - exact `catalogItemId`
   - exact `(catalogSource/sourceItemId/language)`, where `catalogSource` is explicit or defaults to `tcgtracking`
   - if both exact refs are present and resolve to different catalog items, reject the CSV row as contradictory instead of silently choosing one
   - `(game,setId,cardNumber)`
   - `(game,setId,name)`
   - `(game,name)` only as last fallback
4. Update the CSV preview response `tiers[].items[]` shape. The endpoint is not creating the pack; the client uses this preview to POST `/v1/vendor/packs`, so every matched preview item must include:
   - authoritative display image
   - `catalogItemId`
   - `catalogSource`
   - `catalogSourceItemId`
   - `language`
5. Preserve vendor value/stock/tier from CSV.
6. Expand CSV template optional headers to include `catalog_source` and `language`.
7. Leave unmatched rows manual but surface them in `unmatchedRows`; do not fabricate catalog refs.

### P2 — Regression tests

Files:
- `apps/api/scripts/test-pack-prize-catalog-snapshots.ts`
- possibly add router/static test if direct endpoint test infra is too heavy.

Tests:
1. `createPackSchema` accepts refs on pack tier/import style items.
2. `resolvePackPrizeRows` with source refs freezes catalog authoritative label/image/snapshot.
3. Catalog-sourced prizes override client-supplied `label` and `imageUrl`; vendor value/stock/weight remain pack-specific.
4. Missing refs reject, not silently manualize.
5. Manual no-ref rows remain valid and unlinked.
6. Router-level/static regression confirms CSV import preview code propagates `catalogItemId`, `catalogSource`, `catalogSourceItemId`, and `language` into tier items and exposes `catalog_source`/`language` headers.

### P3 — Optional deterministic production backfill

Only after code/test verification:
1. Generate dry-run candidate matches for existing unlinked `PackPrize` rows.
2. Auto-backfill only exact/unambiguous rows with real card names/refs.
3. Leave generic tier-label rows (`SAR`, `AR`, `R`, misspelled demo labels) unlinked and report them as intentionally manual/demo.

Current live sample suggests no safe deterministic backfill for the existing generic/demo rows, so likely no production mutation here.

## Verification commands

```bash
cd apps/api
npm run test:pack-prize-catalog-snapshots
npm run test:pack-publish-freeze
npm run test:draw-pool-integrity
npm run build
```

## Recovery path

- Code changes are local git diffs and can be reverted.
- No DB writes are part of P1/P2.
- If a later backfill is approved, run it as dry-run first and wrap live updates in a transaction with before/after counts.
