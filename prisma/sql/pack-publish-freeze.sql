-- Additive local schema patch for pack publish/freeze metadata.
-- Do not run against staging/production without explicit approval and backup/snapshot.

SET lock_timeout = '5s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PackSourceTemplateType') THEN
    CREATE TYPE "PackSourceTemplateType" AS ENUM ('CATALOG_TEMPLATE', 'VENDOR_TEMPLATE', 'MANUAL', 'LEGACY');
  END IF;
END $$;

ALTER TABLE "Pack"
  ADD COLUMN IF NOT EXISTS "sourceTemplateType" "PackSourceTemplateType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "sourceTemplateId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceTemplateVersionId" TEXT,
  ADD COLUMN IF NOT EXISTS "poolSnapshotHash" TEXT,
  ADD COLUMN IF NOT EXISTS "poolSnapshotVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "publishedFromTemplateAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "publishIdempotencyKey" TEXT;

CREATE INDEX IF NOT EXISTS "Pack_vendorId_status_poolSnapshotHash_idx"
  ON "Pack" ("vendorId", "status", "poolSnapshotHash");
