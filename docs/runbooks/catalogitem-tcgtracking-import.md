# CatalogItem TCGTracking import runbook (import-only MVP)

## Scope and safety boundaries

- Scope in this runbook:
  - `CatalogItem` migration SQL in `prisma/sql/catalogitem-tcgtracking.sql`
  - Prisma client generate/build verification
  - TCGTracking importer dry-run and tiny pilot workflow
  - Inspection SQL and non-destructive rollback posture
- Explicitly out of scope / deferred:
  - Any PackPrize catalog-reference SQL (`PackPrize.catalogItemId`), pack API changes, shared pack schemas, public DTO mappers, vendor UI work
- Source/category guard:
  - Importer accepts only reviewed category IDs in `APPROVED_TCGTRACKING_CATEGORIES`
  - Current approved IDs: `1` Magic, `2` Yu-Gi-Oh!, `3` Pokémon EN, `16` Cardfight Vanguard, `20` Weiss Schwarz, `27` Dragon Ball Super, `62` Flesh and Blood, `85` Pokémon Japan
  - Category `3` keeps legacy `sourceItemId=<productId>` keys; other categories use `sourceItemId=<categoryId>:<productId>` to avoid cross-game collisions under the existing `@@unique([source, sourceItemId, language])` constraint

## Preconditions

1. You are in repo root:

```bash
cd /home/yeqiuqiu/oripa_saas
```

2. Confirm DB target before any write-mode command:

```bash
echo "$DATABASE_URL"
```

3. Never run live writes without explicit approval + backup/snapshot confirmation.

## 0) Backup/snapshot gate (required before any live mutation)

Before any staging/production SQL apply or importer write run (`TCGTRACKING_DRY_RUN=false`), obtain and record:

- Explicit operator approval for target environment (`staging` or `production`)
- Fresh DB backup/snapshot identifier and timestamp
- Rollback contact/on-call

If any of the above is missing: stop and do not mutate the DB.

## 1) Apply CatalogItem migration SQL only

This SQL is idempotent and intentionally limited to `CatalogItem` import support.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/sql/catalogitem-tcgtracking.sql
```

The SQL itself sets conservative timeouts:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';
```

Do not append or apply deferred PackPrize reference SQL in this MVP.

## 2) Prisma generate + API build verification

```bash
npx prisma generate
npm run build -w @oripa/api
```

If build fails, isolate whether it is pre-existing/unrelated before proceeding.

## 3) Dry-run importer (mandatory first)

Use dry-run first in the same environment you plan to write to later.

```bash
TCGTRACKING_DB_ENV=local \
TCGTRACKING_DRY_RUN=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

Expected dry-run posture:

- Prints sample normalized rows for card-bearing sets
- Does not write (`upserted=0`)
- Refuses category values not listed in `APPROVED_TCGTRACKING_CATEGORIES`
- If the first/latest sets are sealed-only, use `TCGTRACKING_START_SET_INDEX` to sample a known card-bearing set before live writes

## 4) Tiny pilot write (only after approval + backup)

Run only when explicit environment approval and backup/snapshot evidence are present.

Staging pilot example:

```bash
TCGTRACKING_DB_ENV=staging \
TCGTRACKING_DRY_RUN=false \
TCGTRACKING_ALLOW_LIVE_WRITE=true \
TCGTRACKING_CATEGORY_ID=3 \
TCGTRACKING_MAX_SETS=1 \
TCGTRACKING_MAX_CARDS=10 \
npm run catalog:sync:tcgtracking -w @oripa/api
```

Production uses the same shape with `TCGTRACKING_DB_ENV=production` and must still have explicit approval plus backup/snapshot.

## 5) Post-run inspection SQL

```sql
SELECT source, COUNT(*)
FROM "CatalogItem"
GROUP BY source
ORDER BY source;

SELECT id, source, "sourceItemId", name, "setId", "cardNumber", rarity, "imageThumbUrl", "isActive", "updatedAt"
FROM "CatalogItem"
WHERE source = 'tcgtracking'
ORDER BY "updatedAt" DESC
LIMIT 20;
```

Optional quality checks:

```sql
SELECT COUNT(*) AS missing_image
FROM "CatalogItem"
WHERE source = 'tcgtracking' AND "isActive" = true AND "imageThumbUrl" IS NULL;

SELECT "setId", COUNT(*)
FROM "CatalogItem"
WHERE source = 'tcgtracking' AND "isActive" = true
GROUP BY "setId"
ORDER BY COUNT(*) DESC, "setId";
```

## 6) Non-destructive rollback posture

Default rollback is deactivation, not delete:

Global rollback:

```sql
UPDATE "CatalogItem"
SET "isActive" = false,
    "updatedAt" = NOW()
WHERE source = 'tcgtracking' AND "isActive" = true;
```

Per-set rollback:

```sql
UPDATE "CatalogItem"
SET "isActive" = false,
    "updatedAt" = NOW()
WHERE source = 'tcgtracking'
  AND "setId" = '<SET_ID>'
  AND "isActive" = true;
```

Only perform destructive delete paths with separate explicit approval.

## 7) Evidence to capture in rollout notes

- Commands run + exit codes
- DB target env (`TCGTRACKING_DB_ENV`) and whether write-mode was executed
- Backup/snapshot identifier (for any live mutation)
- Dry-run summary and tiny pilot summary
- Inspection SQL outputs (or saved excerpts)
- Confirmation that deferred PackPrize catalog-reference SQL was not applied
