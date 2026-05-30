# PR-ready red-team loop report — 2026-05-30

## Verdict

Current working tree is PR-ready for review after the final audit/patch loop.

Deployment gate remains explicit: production/staging DB changes must be applied deliberately from reviewed SQL, not via Render build-time `prisma db push`.

## Red-team loop findings fixed

### P1 — local DB must be the full/proper schema, not just a clone snapshot

- Built a full local DB from the current Prisma schema: `oripa_full_local_20260530` in `oripa-collab-postgres18`.
- Applied catalog/search SQL and lifecycle SQL to local DB.
- Validated lifecycle constraints locally.
- Proved trigram search plan uses `CatalogItem_lower_name_trgm_idx`.

Evidence:

- `docs/plans/audit-redteam-20260530/local-full-db-build-20260530.txt`
- `docs/plans/audit-redteam-20260530/full-local-index-apply-and-search-20260530.txt`
- `docs/plans/audit-redteam-20260530/local-full-db-lifecycle-constraints-20260530.txt`

### P1 — inventory lifecycle race/concurrency safety

Patched `apps/api/src/modules/packs/inventory-allocation.ts`:

- Commit/release now use guarded `updateMany` with prior `status`, `quantityCommitted`, and `quantityReleased` in the `where` clause.
- Any changed allocation row during commit/release throws `concurrent_inventory_conflict`.
- Inventory lookup for catalog/title matching is vendor-scoped in the DB query, not only filtered in memory.

Tested in:

- `apps/api/scripts/test-pack-inventory-allocation.ts`

### P1 — editing/replacing prizes could strand held allocations

Patched `apps/api/src/modules/packs/router.ts`:

- `PATCH /v1/vendor/packs/:packId` now excludes archived packs.
- Prize replacement releases held allocations inside the same transaction before deleting/replacing prize rows.
- Prize replacement is blocked if committed allocations exist.

### P1/P2 — DB constraints must express inventory accounting invariants

Patched `prisma/sql/pack-prize-inventory-allocation-lifecycle.sql`:

- Adds lifecycle counters.
- Adds `NOT VALID` check constraints for allocation lifecycle accounting.
- Adds `NOT VALID` check constraints for vendor inventory quantity accounting.
- Validated successfully on the full local DB clone.

### P2 — deploy pipeline must not auto-push schema

Patched `render.yaml`:

- Removed `npx prisma db push` from Render build command.
- Final gate scans deploy/build scripts and confirms no `prisma db push` remains.

### P2 — vendor dashboard fetch failed to check referrals response

Patched `apps/web/app/vendor/page.tsx`:

- Dashboard load now checks `referralsRes.ok` before parsing.

### P2 — first major job route guard

Recreated and verified `/vendor/working/sorting`:

- File: `apps/web/app/vendor/working/sorting/page.tsx`
- Build output includes `○ /vendor/working/sorting`.
- Live dev curl returned `Catalog sorting workbench`.
- Source probe enforces the route exists.

### P2 — tracked static temp artifacts

- Deleted tracked generated `temp__static_js*` / `temp_static_js*` artifacts.
- Added ignore rules for future temp artifacts.

## Final verification

Canonical final gate:

- `docs/plans/audit-redteam-20260530/final-verification-pr-ready-20260530.txt`

Exit code: `0`

Commands covered:

```bash
npm run build
npm run lint
npm exec -- prisma validate --schema prisma/schema.prisma
npm run test:catalog:search-query -w @oripa/api
npm run test:catalog:search-dedupe -w @oripa/api
npx tsx apps/api/scripts/test-catalog-facets-suggest.ts
npm run test:packs:catalog-snapshots -w @oripa/api
npm run test:packs:immutability -w @oripa/api
npm run test:packs:publish-freeze -w @oripa/api
npm run test:draws:pool-integrity -w @oripa/api
npm run test:packs:inventory-allocation -w @oripa/api
npm run test:packs:template-publish -w @oripa/api
npx tsx apps/web/scripts/test-vendor-catalog-ux.ts
npm run test:catalog:tcgtracking:guardrails -w @oripa/api
git diff --check
```

Additional route check:

```bash
npm run dev -w @oripa/web -- --port 3000
curl -fsS http://127.0.0.1:3000/vendor/working/sorting
```

Result:

- `sorting route curl exit=0`
- HTML contained `Catalog sorting workbench`

## Local DB proof

Search index evidence from full local DB:

- `CatalogItem_lower_name_trgm_idx` exists.
- `EXPLAIN ANALYZE` uses `Bitmap Index Scan`.
- Execution times from final gate:
  - `2.786 ms`
  - `4.667 ms`
  - `5.606 ms`
  - miss: `0.293 ms`

Lifecycle constraints:

- `PackPrizeInventoryAllocation_quantity_lifecycle_check`: validated
- `VendorInventoryItem_quantity_accounting_check`: validated

## PR notes

Include the SQL files in the PR and call out that they are reviewed deployment artifacts:

- `prisma/sql/catalogitem-live-schema-reconcile-search-indexes.sql`
- `prisma/sql/pack-prize-inventory-allocation-lifecycle.sql`

Do not reintroduce build-time `prisma db push`.
