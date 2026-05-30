-- Manual migration for TCGdex CatalogItem support.
-- Safe to run once against Postgres after reviewing the Prisma schema diff.
-- Do not run against production/live without operator approval and a backup/snapshot.

ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "localId" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "sourcePayload" JSONB;

CREATE INDEX IF NOT EXISTS "CatalogItem_game_language_isActive_idx" ON "CatalogItem"("game", "language", "isActive");
CREATE INDEX IF NOT EXISTS "CatalogItem_setId_idx" ON "CatalogItem"("setId");
