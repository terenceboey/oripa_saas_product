-- Add inventory allocation lifecycle counters and DB consistency checks for draw commit / archive release.
-- Safe intent: additive columns plus NOT VALID checks so existing data can be validated explicitly before enforcement.

ALTER TABLE "PackPrizeInventoryAllocation"
  ADD COLUMN IF NOT EXISTS "quantityCommitted" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "quantityReleased" integer NOT NULL DEFAULT 0;

ALTER TABLE "PackPrizeInventoryAllocation"
  DROP CONSTRAINT IF EXISTS "PackPrizeInventoryAllocation_quantity_lifecycle_check";
ALTER TABLE "PackPrizeInventoryAllocation"
  ADD CONSTRAINT "PackPrizeInventoryAllocation_quantity_lifecycle_check"
  CHECK (
    "quantityAllocated" >= 0
    AND "quantityCommitted" >= 0
    AND "quantityReleased" >= 0
    AND "quantityCommitted" + "quantityReleased" <= "quantityAllocated"
  ) NOT VALID;

ALTER TABLE "VendorInventoryItem"
  DROP CONSTRAINT IF EXISTS "VendorInventoryItem_quantity_accounting_check";
ALTER TABLE "VendorInventoryItem"
  ADD CONSTRAINT "VendorInventoryItem_quantity_accounting_check"
  CHECK (
    "quantityTotal" >= 0
    AND "quantityHeld" >= 0
    AND "quantitySold" >= 0
    AND "quantityHeld" + "quantitySold" <= "quantityTotal"
  ) NOT VALID;
