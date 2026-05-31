CREATE INDEX IF NOT EXISTS "CatalogSet_sourceSetId_game_isActive_idx"
ON "CatalogSet" ("sourceSetId", "game", "isActive");

CREATE INDEX IF NOT EXISTS "CatalogItem_game_itemType_isActive_setId_rarity_idx"
ON "CatalogItem" ("game", "itemType", "isActive", "setId", "rarity");

CREATE INDEX IF NOT EXISTS "CatalogItem_game_itemType_isActive_name_idx"
ON "CatalogItem" ("game", "itemType", "isActive", "name");

CREATE INDEX IF NOT EXISTS "CatalogSealedProduct_game_isActive_catalogSetId_name_idx"
ON "CatalogSealedProduct" ("game", "isActive", "catalogSetId", "name");
