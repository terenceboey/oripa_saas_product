-- CreateEnum
CREATE TYPE "PackSourceTemplateType" AS ENUM ('CATALOG_TEMPLATE', 'VENDOR_TEMPLATE', 'MANUAL', 'LEGACY');

-- CreateEnum
CREATE TYPE "PackTemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VendorInventoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DAMAGED', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "PackPrizeInventoryAllocationStatus" AS ENUM ('HELD', 'COMMITTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "CreativeJobStatus" AS ENUM ('DRAFT', 'COMPLETED', 'FAILED', 'PUBLISH_BLOCKED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CreativeAssetStatus" AS ENUM ('PRIVATE_DRAFT', 'PUBLIC_IMMUTABLE', 'REJECTED');

-- DropForeignKey
ALTER TABLE "CanonicalCatalogCard" DROP CONSTRAINT "CanonicalCatalogCard_gameId_fkey";

-- DropForeignKey
ALTER TABLE "CanonicalCatalogCard" DROP CONSTRAINT "CanonicalCatalogCard_setId_fkey";

-- DropForeignKey
ALTER TABLE "CanonicalCatalogSet" DROP CONSTRAINT "CanonicalCatalogSet_gameId_fkey";

-- DropForeignKey
ALTER TABLE "CanonicalSealedProduct" DROP CONSTRAINT "CanonicalSealedProduct_gameId_fkey";

-- DropForeignKey
ALTER TABLE "CanonicalSealedProduct" DROP CONSTRAINT "CanonicalSealedProduct_setId_fkey";

-- DropForeignKey
ALTER TABLE "CanonicalSearchDoc" DROP CONSTRAINT "CanonicalSearchDoc_gameId_fkey";

-- DropForeignKey
ALTER TABLE "CanonicalSearchDoc" DROP CONSTRAINT "CanonicalSearchDoc_setId_fkey";

-- DropForeignKey
ALTER TABLE "CatalogSealedProduct" DROP CONSTRAINT "CatalogSealedProduct_catalogSetId_fkey";

-- DropIndex
DROP INDEX "CatalogSet_game_isActive_name_idx";

-- DropIndex
DROP INDEX "CatalogSet_game_isActive_releaseDate_idx";

-- DropIndex
DROP INDEX "CatalogSet_source_sourceSetId_game_key";

-- AlterTable
ALTER TABLE "CatalogSet" ALTER COLUMN "game" SET DEFAULT 'POKEMON';

-- AlterTable
ALTER TABLE "Pack" DROP COLUMN "packBannerImageUrl",
ADD COLUMN     "poolSnapshotHash" TEXT,
ADD COLUMN     "poolSnapshotVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "publishIdempotencyKey" TEXT,
ADD COLUMN     "publishedByUserId" TEXT,
ADD COLUMN     "publishedFromTemplateAt" TIMESTAMP(3),
ADD COLUMN     "sourceTemplateId" TEXT,
ADD COLUMN     "sourceTemplateType" "PackSourceTemplateType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceTemplateVersionId" TEXT;

-- AlterTable
ALTER TABLE "PackPrize" ADD COLUMN     "cardNumber" TEXT,
ADD COLUMN     "catalogItemId" TEXT,
ADD COLUMN     "catalogSnapshot" JSONB,
ADD COLUMN     "catalogSource" TEXT,
ADD COLUMN     "catalogSourceItemId" TEXT,
ADD COLUMN     "imageLargeUrl" TEXT,
ADD COLUMN     "localId" TEXT,
ADD COLUMN     "rarity" TEXT,
ADD COLUMN     "setId" TEXT,
ADD COLUMN     "setName" TEXT;

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "faviconImageUrl",
DROP COLUMN "logoImageUrl";

-- AlterTable
ALTER TABLE "VendorBanner" ADD COLUMN     "creativeAssetId" TEXT,
ADD COLUMN     "creativeHash" TEXT;

-- AlterTable
ALTER TABLE "VendorSettings" DROP COLUMN "storefrontAccent",
DROP COLUMN "storefrontMuted",
DROP COLUMN "storefrontPrimary",
DROP COLUMN "storefrontRadius",
DROP COLUMN "storefrontSecondary",
DROP COLUMN "storefrontSurface",
DROP COLUMN "storefrontText";

-- DropTable
DROP TABLE "CanonicalCatalogCard";

-- DropTable
DROP TABLE "CanonicalCatalogGame";

-- DropTable
DROP TABLE "CanonicalCatalogSet";

-- DropTable
DROP TABLE "CanonicalSealedProduct";

-- DropTable
DROP TABLE "CanonicalSearchDoc";

-- DropTable
DROP TABLE "CatalogSealedProduct";

-- DropEnum
DROP TYPE "CatalogEntityType";

-- CreateTable
CREATE TABLE "PackTemplate" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "activeVersionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackTemplateSlot" (
    "id" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackTemplateSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInventoryItem" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "customItemId" TEXT,
    "title" TEXT NOT NULL,
    "condition" TEXT,
    "gradeCompany" TEXT,
    "grade" TEXT,
    "certNumber" TEXT,
    "imageUrl" TEXT,
    "quantityTotal" INTEGER NOT NULL,
    "quantityHeld" INTEGER NOT NULL DEFAULT 0,
    "quantitySold" INTEGER NOT NULL DEFAULT 0,
    "status" "VendorInventoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackPrizeInventoryAllocation" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "packPrizeId" TEXT NOT NULL,
    "vendorInventoryItemId" TEXT NOT NULL,
    "quantityAllocated" INTEGER NOT NULL,
    "quantityCommitted" INTEGER NOT NULL DEFAULT 0,
    "quantityReleased" INTEGER NOT NULL DEFAULT 0,
    "status" "PackPrizeInventoryAllocationStatus" NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackPrizeInventoryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeJob" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "status" "CreativeJobStatus" NOT NULL DEFAULT 'DRAFT',
    "stylePreset" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "safePrompt" TEXT NOT NULL,
    "forbiddenTerms" JSONB NOT NULL,
    "packSnapshot" JSONB NOT NULL,
    "prizeSnapshot" JSONB NOT NULL,
    "errorMessage" TEXT,
    "actorUserId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeAsset" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "creativeJobId" TEXT NOT NULL,
    "status" "CreativeAssetStatus" NOT NULL DEFAULT 'PRIVATE_DRAFT',
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT,
    "width" INTEGER NOT NULL DEFAULT 1600,
    "height" INTEGER NOT NULL DEFAULT 900,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackTemplate_vendorId_isActive_idx" ON "PackTemplate"("vendorId", "isActive");

-- CreateIndex
CREATE INDEX "PackTemplateVersion_vendorId_status_idx" ON "PackTemplateVersion"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PackTemplateVersion_templateId_version_key" ON "PackTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "PackTemplateSlot_templateVersionId_sortOrder_idx" ON "PackTemplateSlot"("templateVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "PackTemplateSlot_catalogItemId_idx" ON "PackTemplateSlot"("catalogItemId");

-- CreateIndex
CREATE INDEX "VendorInventoryItem_vendorId_status_idx" ON "VendorInventoryItem"("vendorId", "status");

-- CreateIndex
CREATE INDEX "VendorInventoryItem_vendorId_catalogItemId_idx" ON "VendorInventoryItem"("vendorId", "catalogItemId");

-- CreateIndex
CREATE INDEX "VendorInventoryItem_vendorId_title_idx" ON "VendorInventoryItem"("vendorId", "title");

-- CreateIndex
CREATE INDEX "PackPrizeInventoryAllocation_vendorId_vendorInventoryItemId_idx" ON "PackPrizeInventoryAllocation"("vendorId", "vendorInventoryItemId");

-- CreateIndex
CREATE INDEX "PackPrizeInventoryAllocation_packId_status_idx" ON "PackPrizeInventoryAllocation"("packId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PackPrizeInventoryAllocation_packPrizeId_vendorInventoryIte_key" ON "PackPrizeInventoryAllocation"("packPrizeId", "vendorInventoryItemId");

-- CreateIndex
CREATE INDEX "CreativeJob_vendorId_status_createdAt_idx" ON "CreativeJob"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeJob_packId_createdAt_idx" ON "CreativeJob"("packId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeAsset_vendorId_status_createdAt_idx" ON "CreativeAsset"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeAsset_creativeJobId_idx" ON "CreativeAsset"("creativeJobId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeAsset_creativeJobId_contentHash_key" ON "CreativeAsset"("creativeJobId", "contentHash");

-- CreateIndex
CREATE INDEX "CatalogItem_game_language_isActive_idx" ON "CatalogItem"("game", "language", "isActive");

-- CreateIndex
CREATE INDEX "CatalogItem_setId_idx" ON "CatalogItem"("setId");

-- CreateIndex
CREATE INDEX "Pack_vendorId_status_poolSnapshotHash_idx" ON "Pack"("vendorId", "status", "poolSnapshotHash");

-- CreateIndex
CREATE INDEX "PackPrize_catalogItemId_idx" ON "PackPrize"("catalogItemId");

-- CreateIndex
CREATE INDEX "VendorBanner_creativeAssetId_idx" ON "VendorBanner"("creativeAssetId");

-- AddForeignKey
ALTER TABLE "PackTemplate" ADD CONSTRAINT "PackTemplate_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackTemplateVersion" ADD CONSTRAINT "PackTemplateVersion_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackTemplateVersion" ADD CONSTRAINT "PackTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PackTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackTemplateSlot" ADD CONSTRAINT "PackTemplateSlot_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "PackTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInventoryItem" ADD CONSTRAINT "VendorInventoryItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackPrizeInventoryAllocation" ADD CONSTRAINT "PackPrizeInventoryAllocation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackPrizeInventoryAllocation" ADD CONSTRAINT "PackPrizeInventoryAllocation_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackPrizeInventoryAllocation" ADD CONSTRAINT "PackPrizeInventoryAllocation_packPrizeId_fkey" FOREIGN KEY ("packPrizeId") REFERENCES "PackPrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackPrizeInventoryAllocation" ADD CONSTRAINT "PackPrizeInventoryAllocation_vendorInventoryItemId_fkey" FOREIGN KEY ("vendorInventoryItemId") REFERENCES "VendorInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeJob" ADD CONSTRAINT "CreativeJob_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeJob" ADD CONSTRAINT "CreativeJob_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_creativeJobId_fkey" FOREIGN KEY ("creativeJobId") REFERENCES "CreativeJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
