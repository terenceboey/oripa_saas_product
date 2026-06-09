-- Buyback quote/request/credit backend state machine.
ALTER TYPE "CustodyRequestStatus" ADD VALUE IF NOT EXISTS 'QUOTED';
ALTER TYPE "CustodyRequestStatus" ADD VALUE IF NOT EXISTS 'CREDITED';
ALTER TYPE "CustodyRequestStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "CustodyItem"
  ADD COLUMN IF NOT EXISTS "estimatedValueSource" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedValueAsOf" TIMESTAMP(3);

ALTER TABLE "CustodyRequest"
  ADD COLUMN IF NOT EXISTS "quoteAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "quoteCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "buybackPercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "policyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "valueSource" TEXT,
  ADD COLUMN IF NOT EXISTS "valueAsOf" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "creditedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyScopeKey" TEXT,
  ADD COLUMN IF NOT EXISTS "walletEntryId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CustodyRequest_idempotencyScopeKey_key" ON "CustodyRequest"("idempotencyScopeKey");
CREATE INDEX IF NOT EXISTS "CustodyRequest_expiresAt_idx" ON "CustodyRequest"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "WalletEntry_idempotencyScopeKey_key" ON "WalletEntry"("idempotencyScopeKey");
