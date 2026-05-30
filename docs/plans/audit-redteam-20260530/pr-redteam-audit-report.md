# Oripa PokemonCard MVP PR Red-Team Audit — 2026-05-30

## Scope

Repository: `/home/yeqiuqiu/oripa_saas`

Audit target: current dirty working tree for the PokemonCard.io-quality / pack correctness MVP queue before opening a PR.

Non-goals:
- No live/staging/prod DB writes.
- No branch push / PR creation.
- No production migration execution.

Artifacts captured in this folder:
- `scope.txt` — git status, diffstat, queue final report excerpts.
- `changed-files.txt` — changed/untracked file inventory.
- `tracked.diff` — tracked file diff snapshot.
- `static-scan.txt` / `static-redteam.log` — grep/static red-team probes.
- `verification.log` — full local verification output.

## Verdict

PR is **locally build/test clean**, but **not clean enough to present as production-ready without caveats**.

I found no P0 "do not open PR" code issue in the local MVP surface, but there are PR-blocking notes that should be explicit in the PR description, and at least two P1 follow-up fixes should be queued/reviewed before deploy:

1. Physical inventory reservations are created at publish, but draw/archive flows do not consume/release those allocation rows.
2. Search is still Prisma `mode: insensitive`/`contains`, despite prior live evidence showing this shape does not use the existing trigram index well.
3. Prisma schema still does not represent live `CatalogSet` / `catalogSetId` drift, so migrations must not be auto-applied to Render.
4. `npm run lint` is placeholder-only.

## Findings

### P1 — Inventory reservation lifecycle incomplete after publish

Evidence:
- Reservation at publish: `apps/api/src/modules/packs/router.ts:373-388` calls `reserveInventoryForPackPublish` before setting pack LIVE.
- Reservation increments held inventory: `apps/api/src/modules/packs/inventory-allocation.ts:208-218` increments `VendorInventoryItem.quantityHeld` and creates `PackPrizeInventoryAllocation` rows with `HELD`.
- Draw result decrements only pack/prize stock: `apps/api/src/modules/draws/router.ts:258-321` updates `PackPrize.remainingStock`, creates draw rows, then decrements `Pack.remainingStock`; it does not update `PackPrizeInventoryAllocation`, `VendorInventoryItem.quantityHeld`, or `quantitySold`.
- Archive path only sets status: `apps/api/src/modules/packs/router.ts:404-419`; delete/retire path at `422-459` archives/hides, but also does not release held inventory.
- Search probe found no release/commit implementation for allocations beyond type declarations/status enum usage.

Impact:
- A paid physical pack can reserve inventory at publish, but winning a prize does not commit/sell a reserved unit.
- Archived/retired packs can leave inventory held forever.
- This is acceptable only if fulfillment lifecycle is explicitly out of the MVP PR scope; otherwise it blocks paid-pack production deploy.

Recommended fix before deploy:
- Add transactional draw-time allocation consumption: pick a `HELD` allocation for selected `PackPrize`, mark it `COMMITTED`, decrement `VendorInventoryItem.quantityHeld`, increment `quantitySold` (or create fulfillment row if sold semantics differ).
- Add archive/delete release path for unused `HELD` rows: mark `RELEASED`, decrement `quantityHeld`.
- Add focused canaries for draw commit and archive release.

### P1 — Search path is not pokemoncard.io-speed proven and likely remains slow at 220k+ rows

Evidence:
- Current query builder: `apps/api/src/modules/catalog/search-query.ts:37-54` uses Prisma `startsWith` / `contains` / `searchText contains` with `mode: "insensitive"`.
- Router runs a candidate query and payload follow-up: `apps/api/src/modules/catalog/router.ts:162-180`.
- Prisma schema search needles found no `CatalogItem.searchText` trigram/fulltext index and no normalized lower-column search projection.
- Prior checked-in evidence says live DB has 220,905 active rows and Prisma-equivalent prefix search was multi-second while lower/trigram-compatible shape was much faster: `docs/plans/catalog-db-architecture-gpt55pro-oracle-proposal.md:37-41`, `:566`, `:761`.

Impact:
- Local canaries prove query shape/response shape only, not production latency.
- The PR should not claim pokemoncard.io-grade search speed until raw SQL/query-builder shape + indexes + EXPLAIN ANALYZE are added or accepted as post-PR work.

Recommended fix:
- Either before PR or immediately after PR: implement raw SQL search using lower/normalized fields that hit trigram indexes; add `pg_trgm`/GIN migration plan and read-only EXPLAIN evidence.
- Keep PR description honest: "local MVP search shape passing; production latency gate pending."

### P1 — Live DB schema drift still blocks automatic migration/deploy

Evidence:
- `prisma/schema.prisma` grep found no `model CatalogSet` and no `catalogSetId` representation.
- Existing plan/report documents live drift: `docs/plans/pokemoncard-mvp-schema-preflight-20260530.md` and `docs/plans/catalog-db-architecture-gpt55pro-oracle-proposal.md`.
- `npm exec -- prisma validate --schema prisma/schema.prisma` passes locally, but that validates the repo schema, not safety against the live Render DB.

Impact:
- Opening a PR is okay, but deploy/migration is not safe without a reviewed additive migration/reconciliation plan.

Recommended fix:
- Before deploy, introspect/represent live `CatalogSet`/`catalogSetId` or create a hand-authored non-destructive migration plan.
- Do not run auto-generated Prisma migration against Render.

### P2 — Lint/static-analysis gate is fake green

Evidence:
- `apps/api/package.json:9` lint is `node -e "console.log('lint: add eslint config when ready')"`.
- `verification.log` shows all workspaces print `lint: add eslint config when ready` while exiting 0.
- Final queue report also documented the placeholder gap.

Impact:
- `npm run lint` gives no static analysis coverage. PR can still be reviewed, but reviewers should not treat lint as proof.

Recommended fix:
- Add real ESLint/tsc-strict/static scan, or mark lint coverage as an explicit non-blocking MVP gap in PR body.

### P2 — Fallback title-based inventory matching is internally inconsistent

Evidence:
- In-memory planner matches non-catalog prizes case-insensitively: `apps/api/src/modules/packs/inventory-allocation.ts:74-76`.
- DB lookup for prizes without `catalogItemId` uses exact `title: { in: labelsWithoutCatalogRef }`: `apps/api/src/modules/packs/inventory-allocation.ts:184-195`.

Impact:
- Custom/non-catalog prize labels that differ only by case/spacing can pass the intended planner semantics in unit tests but fail actual publish lookup as insufficient inventory.

Recommended fix:
- Prefer requiring `catalogItemId` for physical paid pack prizes, or use normalized title columns / case-insensitive query for fallback path.
- Add a canary where inventory title casing differs from prize label.

### P2 — Static scan command produced noisy grep path errors from deleted/symlinked files

Evidence:
- `static-redteam.log` includes many `grep: ... No such file or directory` entries while scanning changed/untracked paths.

Impact:
- Not an app bug; just means audit grep output needs manual filtering.

Recommended fix:
- Use null-delimited `git diff -z` / `git ls-files -z` in future scan script.

## Positive evidence

Local verification command in `verification.log` completed exit 0:

```bash
npm run build
npm run test:catalog:search-query -w @oripa/api
npm run test:catalog:search-dedupe -w @oripa/api
npx tsx apps/api/scripts/test-catalog-facets-suggest.ts
npm run test:packs:catalog-snapshots -w @oripa/api
npm run test:packs:immutability -w @oripa/api
npm run test:packs:publish-freeze -w @oripa/api
npm run test:draws:pool-integrity -w @oripa/api
npm run test:packs:inventory-allocation -w @oripa/api
npm run test:packs:template-publish -w @oripa/api
npm exec -- prisma validate --schema prisma/schema.prisma
npm run lint
```

Observed outputs:
- `npm run build`: success for shared/api/web/worker; Next build compiled, 10 static pages, dynamic `/pack/[packId]`.
- All catalog/pack/draw/template canaries printed `... tests passed`.
- Prisma schema valid.
- Lint exited 0 but placeholder-only.

## PR readiness recommendation

Open PR only if PR body contains the honest gate list:

- Local MVP canaries pass.
- No production migration should be run from this PR until live `CatalogSet` drift is reconciled.
- Search is not production-speed proven; live EXPLAIN/index work remains.
- Inventory reservation currently freezes/holds pack inventory at publish; draw-time commit/release lifecycle requires follow-up before paid-pack production launch.
- Lint/static analysis is placeholder-only.

If we want a cleaner PR before review, fix P1 inventory lifecycle first. If the PR is meant as a large MVP staging/review PR, it is acceptable to open as long as those P1/P2 gates are explicit and deployment is blocked.
