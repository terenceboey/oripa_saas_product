-- Fail-closed physical inventory allocation proof for physical pack draws.
-- Adds an explicit backend inventory mode; physical is the safe default.
CREATE TYPE "PackInventoryMode" AS ENUM ('PHYSICAL_REQUIRED', 'DIGITAL_NO_ALLOCATION', 'PILOT_NO_ALLOCATION');

ALTER TABLE "Pack"
  ADD COLUMN "inventoryMode" "PackInventoryMode" NOT NULL DEFAULT 'PHYSICAL_REQUIRED';

ALTER TABLE "CustodyItem"
  ADD COLUMN "packPrizeInventoryAllocationId" TEXT;

CREATE INDEX "CustodyItem_packPrizeInventoryAllocationId_idx"
  ON "CustodyItem"("packPrizeInventoryAllocationId");

ALTER TABLE "CustodyItem"
  ADD CONSTRAINT "CustodyItem_packPrizeInventoryAllocationId_fkey"
  FOREIGN KEY ("packPrizeInventoryAllocationId")
  REFERENCES "PackPrizeInventoryAllocation"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
