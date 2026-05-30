-- Additive local schema patch for vendor pack template/version/slot MVP.
-- Do not run against staging/production without explicit approval and backup/snapshot.

SET lock_timeout = '5s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PackTemplateVersionStatus') THEN
    CREATE TYPE "PackTemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PackTemplate" (
  "id" TEXT PRIMARY KEY,
  "vendorId" TEXT NOT NULL REFERENCES "Vendor"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "activeVersionId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PackTemplateVersion" (
  "id" TEXT PRIMARY KEY,
  "templateId" TEXT NOT NULL REFERENCES "PackTemplate"("id") ON DELETE CASCADE,
  "vendorId" TEXT NOT NULL REFERENCES "Vendor"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "status" "PackTemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "pricePoints" INTEGER NOT NULL,
  "totalStock" INTEGER NOT NULL,
  "isNew" BOOLEAN NOT NULL DEFAULT true,
  "limitedLabel" TEXT,
  "importantNotes" TEXT,
  "drawLimitMode" "DrawLimitMode" NOT NULL DEFAULT 'NONE',
  "drawLimitValue" INTEGER,
  "drawLimitResetTimezone" TEXT DEFAULT 'Asia/Singapore',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackTemplateVersion_templateId_version_key" UNIQUE ("templateId", "version")
);

CREATE TABLE IF NOT EXISTS "PackTemplateSlot" (
  "id" TEXT PRIMARY KEY,
  "templateVersionId" TEXT NOT NULL REFERENCES "PackTemplateVersion"("id") ON DELETE CASCADE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT NOT NULL,
  "imageUrl" TEXT,
  "imageLargeUrl" TEXT,
  "setId" TEXT,
  "setName" TEXT,
  "localId" TEXT,
  "cardNumber" TEXT,
  "rarity" TEXT,
  "catalogItemId" TEXT,
  "catalogSource" TEXT,
  "catalogSourceItemId" TEXT,
  "catalogSnapshot" JSONB,
  "estimatedValue" INTEGER NOT NULL,
  "weight" INTEGER NOT NULL,
  "stock" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PackTemplate_vendorId_isActive_idx"
  ON "PackTemplate" ("vendorId", "isActive");
CREATE INDEX IF NOT EXISTS "PackTemplateVersion_vendorId_status_idx"
  ON "PackTemplateVersion" ("vendorId", "status");
CREATE INDEX IF NOT EXISTS "PackTemplateSlot_templateVersionId_sortOrder_idx"
  ON "PackTemplateSlot" ("templateVersionId", "sortOrder");
CREATE INDEX IF NOT EXISTS "PackTemplateSlot_catalogItemId_idx"
  ON "PackTemplateSlot" ("catalogItemId");
