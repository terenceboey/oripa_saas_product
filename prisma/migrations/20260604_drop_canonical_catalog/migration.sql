-- Remove the unused canonical catalog/search projection.
-- The app-facing source-backed catalog remains in CatalogItem, CatalogSet, and CatalogSealedProduct.

DROP TABLE IF EXISTS "CanonicalSearchDoc";
DROP TABLE IF EXISTS "CanonicalSealedProduct";
DROP TABLE IF EXISTS "CanonicalCatalogCard";
DROP TABLE IF EXISTS "CanonicalCatalogSet";
DROP TABLE IF EXISTS "CanonicalCatalogGame";
DROP TYPE IF EXISTS "CatalogEntityType";
