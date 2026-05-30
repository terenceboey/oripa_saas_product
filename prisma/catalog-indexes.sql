-- Catalog search performance indexes (safe, additive only).
-- No table/column drops. Intended for production datasets.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Helps filtered lookups for active catalog rows by game/type.
CREATE INDEX IF NOT EXISTS "CatalogItem_isActive_game_itemType_idx"
  ON "CatalogItem" ("isActive", "game", "itemType");

-- Helps stable alphabetical ordering once filtered.
CREATE INDEX IF NOT EXISTS "CatalogItem_isActive_game_itemType_name_idx"
  ON "CatalogItem" ("isActive", "game", "itemType", "name");

-- Speeds case-insensitive contains/startsWith matching on name.
CREATE INDEX IF NOT EXISTS "CatalogItem_lower_name_trgm_idx"
  ON "CatalogItem" USING GIN (lower("name") gin_trgm_ops);

-- Speeds matching by set + card number during CSV/content mapping flows.
CREATE INDEX IF NOT EXISTS "CatalogItem_game_setId_cardNumber_idx"
  ON "CatalogItem" ("game", "setId", "cardNumber");
