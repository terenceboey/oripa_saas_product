# Prisma data-loss warning incident — 2026-05-31

## Immediate instruction

Do **not** run `prisma db push --accept-data-loss`.

The warning is Prisma protecting the live DB from a stale/incomplete local schema. The live DB still contains populated catalog metadata columns that must be preserved.

## Root cause

A `prisma db push` was run against a Prisma schema that did not include these live columns:

- `CatalogSet.sourcePayload`
- `CatalogSet.sourceCategoryId`
- `CatalogSet.reviewStatus`
- `CatalogSet.language`
- `CatalogSet.groupKind`
- `CatalogSealedProduct.sourcePayload`
- `CatalogSealedProduct.sourceCategoryId`
- `CatalogSealedProduct.productKind`
- `CatalogItem.color`
- `CatalogItem.cardType`
- `CatalogItem.attribute`

Because those columns exist in live Postgres and contain data, Prisma correctly warned that pushing the stale schema would drop them.

## Evidence

Read-only diff from live DB to the current local schema in `/home/yeqiuqiu/oripa_saas/prisma/schema.prisma`:

```text
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
-- This is an empty migration.
```

Live DB column presence check:

```text
CatalogSet groupKind,language,reviewStatus,sourceCategoryId,sourcePayload
CatalogSealedProduct productKind,sourceCategoryId,sourcePayload
CatalogItem attribute,cardType,color
```

Safe push check using the current schema:

```text
npx prisma db push --schema prisma/schema.prisma --skip-generate
The database is already in sync with the Prisma schema.
```

## Safe command

Only run from a checkout whose `prisma/schema.prisma` contains the columns above:

```bash
set -a
source .env
set +a
npx prisma db push --schema prisma/schema.prisma --skip-generate
```

Expected output:

```text
The database is already in sync with the Prisma schema.
```

## Unsafe command

Do not run this for this incident:

```bash
prisma db push --accept-data-loss
```

That would authorize Prisma to drop populated columns and delete catalog metadata.

## Boss-facing summary

No live data was dropped by the remediation run. The scary message was a local schema drift guard: someone ran `db push` from a schema that lagged behind the live database. Prisma saw populated live columns missing from that local schema and refused to drop them unless `--accept-data-loss` was supplied. The correct fix is to use the updated schema that preserves those columns; with that schema, Prisma reports the DB is already in sync.
