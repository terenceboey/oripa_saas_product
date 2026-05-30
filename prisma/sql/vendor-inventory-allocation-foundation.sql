-- Additive local schema foundation for vendor inventory allocation before paid physical pack publish.
-- Do not run against live/staging/prod without the repo/live-schema drift gate approval.

CREATE TYPE "VendorInventoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DAMAGED', 'SOLD_OUT');
CREATE TYPE "PackPrizeInventoryAllocationStatus" AS ENUM ('HELD', 'COMMITTED', 'RELEASED');

CREATE TABLE "VendorInventoryItem" (
  "id" TEXT PRIMARY KEY,
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
  CONSTRAINT "VendorInventoryItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PackPrizeInventoryAllocation" (
  "id" TEXT PRIMARY KEY,
  "vendorId" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "packPrizeId" TEXT NOT NULL,
  "vendorInventoryItemId" TEXT NOT NULL,
  "quantityAllocated" INTEGER NOT NULL,
  "status" "PackPrizeInventoryAllocationStatus" NOT NULL DEFAULT 'HELD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackPrizeInventoryAllocation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PackPrizeInventoryAllocation_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PackPrizeInventoryAllocation_packPrizeId_fkey" FOREIGN KEY ("packPrizeId") REFERENCES "PackPrize"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PackPrizeInventoryAllocation_vendorInventoryItemId_fkey" FOREIGN KEY ("vendorInventoryItemId") REFERENCES "VendorInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "VendorInventoryItem_vendorId_status_idx" ON "VendorInventoryItem"("vendorId", "status");
CREATE INDEX "VendorInventoryItem_vendorId_catalogItemId_idx" ON "VendorInventoryItem"("vendorId", "catalogItemId");
CREATE INDEX "VendorInventoryItem_vendorId_title_idx" ON "VendorInventoryItem"("vendorId", "title");
CREATE UNIQUE INDEX "PackPrizeInventoryAllocation_packPrizeId_vendorInventoryItemId_key" ON "PackPrizeInventoryAllocation"("packPrizeId", "vendorInventoryItemId");
CREATE INDEX "PackPrizeInventoryAllocation_vendorId_vendorInventoryItemId_idx" ON "PackPrizeInventoryAllocation"("vendorId", "vendorInventoryItemId");
CREATE INDEX "PackPrizeInventoryAllocation_packId_status_idx" ON "PackPrizeInventoryAllocation"("packId", "status");
