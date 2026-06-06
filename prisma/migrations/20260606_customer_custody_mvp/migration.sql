-- Customer custody/backpack phase 2: internal OriPa ledger only.
CREATE TYPE "CustodyProvider" AS ENUM ('ORIPA_INTERNAL', 'COLLECTOR_CRYPT', 'PHYGITALS');
CREATE TYPE "CustodyItemStatus" AS ENUM ('HELD', 'REDEMPTION_REQUESTED', 'BUYBACK_REQUESTED', 'REDEEMED', 'BOUGHT_BACK', 'VOIDED');
CREATE TYPE "CustodyRequestType" AS ENUM ('REDEMPTION', 'BUYBACK');
CREATE TYPE "CustodyRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "CustodyItem" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "packPrizeId" TEXT NOT NULL,
  "drawOrderId" TEXT NOT NULL,
  "drawResultId" TEXT NOT NULL,
  "status" "CustodyItemStatus" NOT NULL DEFAULT 'HELD',
  "provider" "CustodyProvider" NOT NULL DEFAULT 'ORIPA_INTERNAL',
  "providerItemId" TEXT,
  "providerMemo" TEXT,
  "providerTxSig" TEXT,
  "prizeLabel" TEXT NOT NULL,
  "imageUrl" TEXT,
  "imageLargeUrl" TEXT,
  "setName" TEXT,
  "cardName" TEXT,
  "rarity" TEXT,
  "catalogSnapshot" JSONB,
  "estimatedValue" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustodyItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustodyRequest" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "custodyItemId" TEXT NOT NULL,
  "type" "CustodyRequestType" NOT NULL,
  "status" "CustodyRequestStatus" NOT NULL DEFAULT 'PENDING',
  "customerNote" TEXT,
  "opsNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustodyRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustodyItem_drawResultId_key" ON "CustodyItem"("drawResultId");
CREATE INDEX "CustodyItem_vendorId_userId_status_createdAt_idx" ON "CustodyItem"("vendorId", "userId", "status", "createdAt");
CREATE INDEX "CustodyItem_userId_createdAt_idx" ON "CustodyItem"("userId", "createdAt");
CREATE INDEX "CustodyItem_vendorId_createdAt_idx" ON "CustodyItem"("vendorId", "createdAt");
CREATE INDEX "CustodyItem_packPrizeId_idx" ON "CustodyItem"("packPrizeId");
CREATE INDEX "CustodyItem_drawOrderId_idx" ON "CustodyItem"("drawOrderId");
CREATE INDEX "CustodyRequest_vendorId_userId_status_requestedAt_idx" ON "CustodyRequest"("vendorId", "userId", "status", "requestedAt");
CREATE INDEX "CustodyRequest_custodyItemId_status_idx" ON "CustodyRequest"("custodyItemId", "status");
CREATE INDEX "CustodyRequest_vendorId_type_status_requestedAt_idx" ON "CustodyRequest"("vendorId", "type", "status", "requestedAt");

ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_packPrizeId_fkey" FOREIGN KEY ("packPrizeId") REFERENCES "PackPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_drawOrderId_fkey" FOREIGN KEY ("drawOrderId") REFERENCES "DrawOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustodyItem" ADD CONSTRAINT "CustodyItem_drawResultId_fkey" FOREIGN KEY ("drawResultId") REFERENCES "DrawResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustodyRequest" ADD CONSTRAINT "CustodyRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustodyRequest" ADD CONSTRAINT "CustodyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustodyRequest" ADD CONSTRAINT "CustodyRequest_custodyItemId_fkey" FOREIGN KEY ("custodyItemId") REFERENCES "CustodyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
