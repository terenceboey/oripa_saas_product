-- Manual migration preflight for TCGTracking CatalogItem support (import-only MVP).
-- Idempotent: only adds missing CatalogItem columns/indexes.
-- Do not run against staging/production without explicit approval and backup/snapshot.
-- PackPrize catalog-reference SQL is intentionally deferred/out of scope for this MVP.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "localId" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "sourcePayload" JSONB;

CREATE INDEX IF NOT EXISTS "CatalogItem_game_language_isActive_idx"
  ON "CatalogItem"("game", "language", "isActive");

CREATE INDEX IF NOT EXISTS "CatalogItem_setId_idx"
  ON "CatalogItem"("setId");
