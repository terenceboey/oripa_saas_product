# Prisma Migration Runbook (Safe Workflow)

This project now has a Prisma migration baseline:

- Migration folder: `prisma/migrations/0000_baseline/migration.sql`
- Database migration marker: `_prisma_migrations` contains `0000_baseline`

## Why this matters

`prisma db push` directly mutates schema and can propose destructive drops when schema drift exists.

Use Prisma Migrate history for controlled, reviewable schema changes.

## Day-to-day commands

- Check status: `npm run db:migrate:status`
- Create/apply local migration: `npm run db:migrate -- --name <change_name>`
- Apply pending migrations in deploy/prod: `npm run db:migrate:deploy`

## Rules

1. Do not run `db push --accept-data-loss` on shared or production databases.
2. For any column drop/rename:
   - take a backup snapshot first
   - review impact
   - apply via migration SQL
3. Keep `prisma/schema.prisma` and `prisma/migrations/*` in source control.

## Safety query template (before destructive changes)

Use this to verify whether a target column has data:

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE "targetColumn" IS NOT NULL) AS non_null_rows,
  COUNT(DISTINCT "targetColumn") AS distinct_values
FROM public."TargetTable";
```

## Notes for this codebase

The following catalog metadata columns were preserved in schema to prevent accidental data loss:

- `CatalogSet`: `sourcePayload`, `sourceCategoryId`, `reviewStatus`, `language`, `groupKind`
- `CatalogSealedProduct`: `sourcePayload`, `sourceCategoryId`, `productKind`
- `CatalogItem`: `cardType`, `color`, `attribute`
