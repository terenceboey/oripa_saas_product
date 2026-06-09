-- Audited redemption/custody ops lifecycle states.
ALTER TYPE "CustodyRequestStatus" ADD VALUE IF NOT EXISTS 'OPS_REVIEW';
ALTER TYPE "CustodyRequestStatus" ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE "CustodyRequestStatus" ADD VALUE IF NOT EXISTS 'FULFILLED_MANUAL';
