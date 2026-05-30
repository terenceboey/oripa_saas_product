# Reconciliation Report — local DB clone, search speed, PR cleanup

## What changed after red-team

- Cloned the collaborator/Render catalog DB into local Docker Postgres 18 (`oripa-collab-postgres18`, DB `oripa_collab_clone_20260530`) without writing to live DB.
- Measured search on 268,355 `CatalogItem` rows.
- Reconciled repo schema with live catalog drift by adding `CatalogSet`, `catalogSetId`, live-compatible image fields, and `pg_trgm` search SQL.
- Reconciled search implementation to use indexed raw SQL for the hot `q` path instead of Prisma `contains` filtering.
- Fixed inventory lifecycle gap: draw commit moves held inventory to sold; archive/delete release held inventory.
- Fixed case-insensitive title lookup for inventory fallback.
- Replaced placeholder lint scripts with real TypeScript no-emit checks.
- Ignored generated local artifacts: `*.tsbuildinfo`, `.hermes/`.

## Local clone evidence

Clone metadata:

```text
oripa_collab_clone_20260530|PostgreSQL 18.4|268355|670 MB
extensions: pg_stat_statements, pg_trgm, plpgsql
```

Full clone probe: `docs/plans/audit-redteam-20260530/local-clone-search-probe.txt`

## Search speed evidence

Probe summary from local clone:

```text
current charizard: 70.450 ms -> optimized_name: 2.607 ms
current pikachu:  59.815 ms -> optimized_name: 3.762 ms
current mew:     130.702 ms -> optimized_name: 5.250 ms
current miss:     57.979 ms -> optimized_name: 0.339 ms
```

The optimized plan uses `CatalogItem_lower_name_trgm_idx` on `lower(name) gin_trgm_ops`.

Full EXPLAIN JSON artifacts:

- `docs/plans/audit-redteam-20260530/search-explain-json/current-charizard.json`
- `docs/plans/audit-redteam-20260530/search-explain-json/optimized_name-charizard.json`
- `docs/plans/audit-redteam-20260530/search-explain-json/current-pikachu.json`
- `docs/plans/audit-redteam-20260530/search-explain-json/optimized_name-pikachu.json`
- `docs/plans/audit-redteam-20260530/search-explain-json/current-mew.json`
- `docs/plans/audit-redteam-20260530/search-explain-json/optimized_name-mew.json`
- `docs/plans/audit-redteam-20260530/search-explain-json/current-nonexistentzz.json`
- `docs/plans/audit-redteam-20260530/search-explain-json/optimized_name-nonexistentzz.json`

## SQL artifacts

- `prisma/sql/catalogitem-live-schema-reconcile-search-indexes.sql`
  - additive/preservative catalog live-schema reconciliation
  - `pg_trgm`
  - `CatalogItem_lower_name_trgm_idx`
  - additional filter indexes
- `prisma/sql/pack-prize-inventory-allocation-lifecycle.sql`
  - `quantityCommitted`
  - `quantityReleased`

## Remaining deployment gate

Do not auto-run Prisma migrations against production. Apply/review the SQL artifacts intentionally against staging/local clone first, then production only after approval.
