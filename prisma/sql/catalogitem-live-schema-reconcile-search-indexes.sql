-- Oripa catalog live-schema reconciliation + search-speed indexes.
-- Safe intent: additive/preservative only. Review before applying to staging/production.
-- Do not run against a live Render database without an approved backup/snapshot and operator approval.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "CatalogSet" (
  "id" text PRIMARY KEY,
  "source" text NOT NULL,
  "sourceSetId" text NOT NULL,
  "game" text NOT NULL DEFAULT 'POKEMON',
  "setCode" text,
  "name" text NOT NULL,
  "releaseDate" timestamp,
  "productCount" integer,
  "symbolImageUrl" text,
  "logoImageUrl" text,
  "bannerImageUrl" text,
  "isSupplemental" boolean NOT NULL DEFAULT false,
  "searchText" text NOT NULL DEFAULT '',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "catalogSetId" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CatalogItem_catalogSetId_fkey'
  ) THEN
    ALTER TABLE "CatalogItem"
      ADD CONSTRAINT "CatalogItem_catalogSetId_fkey"
      FOREIGN KEY ("catalogSetId") REFERENCES "CatalogSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogSet_source_sourceSetId_key" ON "CatalogSet" ("source", "sourceSetId");
CREATE INDEX IF NOT EXISTS "CatalogSet_game_isActive_idx" ON "CatalogSet" ("game", "isActive");
CREATE INDEX IF NOT EXISTS "CatalogSet_source_isActive_idx" ON "CatalogSet" ("source", "isActive");
CREATE INDEX IF NOT EXISTS "CatalogSet_setCode_idx" ON "CatalogSet" ("setCode");
CREATE INDEX IF NOT EXISTS "CatalogSet_name_idx" ON "CatalogSet" ("name");
CREATE INDEX IF NOT EXISTS "CatalogItem_catalogSetId_isActive_idx" ON "CatalogItem" ("catalogSetId", "isActive");

-- Prisma cannot model this expression GIN index; keep it as hand-authored SQL.
-- It is required for pokemoncard.io-style contains search on lower(name).
CREATE INDEX IF NOT EXISTS "CatalogItem_lower_name_trgm_idx"
  ON "CatalogItem" USING gin (lower("name") gin_trgm_ops);
