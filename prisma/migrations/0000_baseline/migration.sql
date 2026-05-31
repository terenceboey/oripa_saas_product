-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "EmailVerificationStatus" AS ENUM ('PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "VendorMembershipRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "DrawOrderStatus" AS ENUM ('COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RevenueEntryType" AS ENUM ('DRAW_GROSS', 'PLATFORM_FEE', 'TENANT_NET', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TopupOrderStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('INITIATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "VendorPlanCode" AS ENUM ('BASIC', 'ELITE');

-- CreateEnum
CREATE TYPE "PackStatus" AS ENUM ('DRAFT', 'LIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PackSourceTemplateType" AS ENUM ('CATALOG_TEMPLATE', 'VENDOR_TEMPLATE', 'MANUAL', 'LEGACY');

-- CreateEnum
CREATE TYPE "PackTemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VendorInventoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DAMAGED', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "PackPrizeInventoryAllocationStatus" AS ENUM ('HELD', 'COMMITTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "DrawLimitMode" AS ENUM ('NONE', 'ONCE_PER_CUSTOMER', 'DAILY_RESET');

-- CreateEnum
CREATE TYPE "VendorPointGrantQrStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreativeJobStatus" AS ENUM ('DRAFT', 'COMPLETED', 'FAILED', 'PUBLISH_BLOCKED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CreativeAssetStatus" AS ENUM ('PRIVATE_DRAFT', 'PUBLIC_IMMUTABLE', 'REJECTED');

-- CreateEnum
CREATE TYPE "CatalogItemType" AS ENUM ('CARD', 'SEALED_PRODUCT');

-- CreateEnum
CREATE TYPE "CatalogEntityType" AS ENUM ('CARD', 'SEALED_PRODUCT', 'SET');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "logoImageUrl" TEXT,
    "faviconImageUrl" TEXT,
    "referralCode" TEXT,
    "businessLocation" TEXT,
    "businessContact" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "riskLevel" INTEGER NOT NULL DEFAULT 0,
    "complianceFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "displayName" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerificationStatus" "EmailVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "emailVerifiedAt" TIMESTAMP(3),
    "emailOtpCodeHash" TEXT,
    "emailOtpExpiresAt" TIMESTAMP(3),
    "emailOtpAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "emailOtpLastSentAt" TIMESTAMP(3),
    "emailOtpLockedUntil" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorMembership" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "VendorMembershipRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSettings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "pointsPerCurrencyUnit" INTEGER NOT NULL DEFAULT 100,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "platformFeeBps" INTEGER NOT NULL DEFAULT 0,
    "maxPackItems" INTEGER NOT NULL DEFAULT 500,
    "maxPackTiers" INTEGER NOT NULL DEFAULT 10,
    "maxDrawQuantity" INTEGER NOT NULL DEFAULT 100,
    "planCode" "VendorPlanCode" NOT NULL DEFAULT 'BASIC',
    "storefrontPrimary" TEXT NOT NULL DEFAULT '#0E6FFF',
    "storefrontSecondary" TEXT NOT NULL DEFAULT '#EAF2FF',
    "storefrontAccent" TEXT NOT NULL DEFAULT '#1353B5',
    "storefrontSurface" TEXT NOT NULL DEFAULT '#FFFFFF',
    "storefrontText" TEXT NOT NULL DEFAULT '#121826',
    "storefrontMuted" TEXT NOT NULL DEFAULT '#516074',
    "storefrontRadius" INTEGER NOT NULL DEFAULT 16,
    "payoutSchedule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "packBannerImageUrl" TEXT,
    "pricePoints" INTEGER NOT NULL,
    "totalStock" INTEGER NOT NULL,
    "remainingStock" INTEGER NOT NULL,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "limitedLabel" TEXT,
    "importantNotes" TEXT,
    "status" "PackStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceTemplateType" "PackSourceTemplateType" NOT NULL DEFAULT 'MANUAL',
    "sourceTemplateId" TEXT,
    "sourceTemplateVersionId" TEXT,
    "poolSnapshotHash" TEXT,
    "poolSnapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedFromTemplateAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "publishIdempotencyKey" TEXT,
    "drawLimitMode" "DrawLimitMode" NOT NULL DEFAULT 'NONE',
    "drawLimitValue" INTEGER,
    "drawLimitResetTimezone" TEXT DEFAULT 'Asia/Singapore',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackPrize" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "catalogSource" TEXT,
    "catalogSourceItemId" TEXT,
    "catalogSnapshot" JSONB,
    "label" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageLargeUrl" TEXT,
    "setId" TEXT,
    "setName" TEXT,
    "localId" TEXT,
    "cardNumber" TEXT,
    "rarity" TEXT,
    "estimatedValue" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "remainingStock" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackPrize_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "PackDraw" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "prizeId" TEXT,
    "pointsSpent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAccount" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT,
    "ownerLabel" TEXT NOT NULL,
    "balancePoints" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "walletAccountId" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "amountPoints" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "actorUserId" TEXT,
    "requestId" TEXT,
    "idempotencyScopeKey" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT,
    "requestId" TEXT,
    "statusCode" INTEGER,
    "responseJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawOrder" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT,
    "walletAccountId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePoints" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "status" "DrawOrderStatus" NOT NULL DEFAULT 'COMPLETED',
    "requestId" TEXT,
    "idempotencyScopeKey" TEXT,
    "clientIp" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawResult" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "drawOrderId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "packPrizeId" TEXT,
    "drawSequence" INTEGER NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "rngVersion" TEXT,
    "rngSeedHash" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawFairnessProof" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "drawOrderId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "userId" TEXT,
    "algorithmVersion" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "revealedServerSeed" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonceBase" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "poolSnapshotHash" TEXT NOT NULL,
    "poolSnapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawFairnessProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawFairnessSelection" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "drawOrderId" TEXT NOT NULL,
    "proofId" TEXT NOT NULL,
    "drawSequence" INTEGER NOT NULL,
    "hmacHex" TEXT NOT NULL,
    "randomFloat" DECIMAL(20,18) NOT NULL,
    "randomWeightValue" INTEGER NOT NULL,
    "totalWeightAtDraw" INTEGER NOT NULL,
    "tierLabel" TEXT,
    "tierLowerBound" INTEGER,
    "tierUpperBound" INTEGER,
    "rowSeedHex" TEXT NOT NULL,
    "chosenPackPrizeId" TEXT,
    "eligiblePrizeIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawFairnessSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorRevenueLedger" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "drawOrderId" TEXT,
    "type" "RevenueEntryType" NOT NULL,
    "amountPoints" INTEGER NOT NULL,
    "conversionRate" DECIMAL(18,6),
    "amountCurrency" DECIMAL(18,2),
    "currencyCode" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorRevenueLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopupOrder" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT,
    "walletAccountId" TEXT NOT NULL,
    "pointsToCredit" INTEGER NOT NULL,
    "expectedCurrencyAmount" DECIMAL(18,2),
    "currencyCode" TEXT,
    "status" "TopupOrderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerOrderRef" TEXT,
    "requestId" TEXT,
    "idempotencyScopeKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopupOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT,
    "topupOrderId" TEXT,
    "provider" TEXT NOT NULL,
    "providerPaymentRef" TEXT,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "amountCurrency" DECIMAL(18,2),
    "currencyCode" TEXT,
    "rawPayload" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBanner" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "creativeAssetId" TEXT,
    "creativeHash" TEXT,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "targetUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBanner_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "VendorReferralSignup" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorReferralSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPointGrantQr" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "VendorPointGrantQrStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "redeemedByUserId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPointGrantQr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "catalogSetId" TEXT,
    "localId" TEXT,
    "sourcePayload" JSONB,
    "cardType" TEXT,
    "color" TEXT,
    "attribute" TEXT,
    "itemType" "CatalogItemType" NOT NULL DEFAULT 'CARD',
    "game" TEXT NOT NULL DEFAULT 'POKEMON',
    "language" TEXT NOT NULL DEFAULT 'en',
    "name" TEXT NOT NULL,
    "setId" TEXT,
    "setName" TEXT,
    "cardNumber" TEXT,
    "rarity" TEXT,
    "imageBaseUrl" TEXT,
    "imageThumbUrl" TEXT,
    "imageLargeUrl" TEXT,
    "searchText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSet" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceSetId" TEXT NOT NULL,
    "sourceCategoryId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "groupKind" TEXT,
    "reviewStatus" TEXT,
    "sourcePayload" JSONB,
    "game" TEXT NOT NULL,
    "setCode" TEXT,
    "name" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "productCount" INTEGER,
    "symbolImageUrl" TEXT,
    "logoImageUrl" TEXT,
    "bannerImageUrl" TEXT,
    "isSupplemental" BOOLEAN NOT NULL DEFAULT false,
    "searchText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSealedProduct" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "sourceCategoryId" TEXT,
    "productKind" TEXT,
    "sourcePayload" JSONB,
    "catalogSetId" TEXT,
    "game" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "name" TEXT NOT NULL,
    "cleanName" TEXT,
    "imageUrl" TEXT,
    "imageCount" INTEGER,
    "isPresale" BOOLEAN NOT NULL DEFAULT false,
    "presaleReleaseDate" TIMESTAMP(3),
    "searchText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSealedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalCatalogGame" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalCatalogGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalCatalogSet" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceSetId" TEXT NOT NULL,
    "slug" TEXT,
    "setCode" TEXT,
    "name" TEXT NOT NULL,
    "series" TEXT,
    "releaseDate" TIMESTAMP(3),
    "totalCards" INTEGER,
    "printedTotal" INTEGER,
    "symbolImageUrl" TEXT,
    "logoImageUrl" TEXT,
    "bannerImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalCatalogSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalCatalogCard" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "setId" TEXT,
    "source" TEXT NOT NULL,
    "sourceCardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "cardNumber" TEXT,
    "rarity" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "imageThumbUrl" TEXT,
    "imageLargeUrl" TEXT,
    "imageBaseUrl" TEXT,
    "searchText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalCatalogCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalSealedProduct" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "setId" TEXT,
    "source" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "imageUrl" TEXT,
    "imageThumbUrl" TEXT,
    "searchText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalSealedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalSearchDoc" (
    "id" TEXT NOT NULL,
    "entityType" "CatalogEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "setId" TEXT,
    "displayName" TEXT NOT NULL,
    "tokens" TEXT NOT NULL,
    "imageThumbUrl" TEXT,
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalSearchDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_slug_key" ON "Vendor"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_host_key" ON "Vendor"("host");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_referralCode_key" ON "Vendor"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "VendorMembership_vendorId_role_isActive_idx" ON "VendorMembership"("vendorId", "role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VendorMembership_vendorId_userId_key" ON "VendorMembership"("vendorId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorSettings_vendorId_key" ON "VendorSettings"("vendorId");

-- CreateIndex
CREATE INDEX "Pack_vendorId_isActive_idx" ON "Pack"("vendorId", "isActive");

-- CreateIndex
CREATE INDEX "Pack_vendorId_status_poolSnapshotHash_idx" ON "Pack"("vendorId", "status", "poolSnapshotHash");

-- CreateIndex
CREATE INDEX "PackPrize_packId_idx" ON "PackPrize"("packId");

-- CreateIndex
CREATE INDEX "PackPrize_catalogItemId_idx" ON "PackPrize"("catalogItemId");

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
CREATE INDEX "PackDraw_vendorId_createdAt_idx" ON "PackDraw"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletAccount_vendorId_userId_idx" ON "WalletAccount"("vendorId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAccount_vendorId_userId_key" ON "WalletAccount"("vendorId", "userId");

-- CreateIndex
CREATE INDEX "WalletEntry_vendorId_createdAt_idx" ON "WalletEntry"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletEntry_walletAccountId_createdAt_idx" ON "WalletEntry"("walletAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletEntry_requestId_idx" ON "WalletEntry"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_scopeKey_key" ON "IdempotencyKey"("scopeKey");

-- CreateIndex
CREATE INDEX "IdempotencyKey_vendorId_operation_createdAt_idx" ON "IdempotencyKey"("vendorId", "operation", "createdAt");

-- CreateIndex
CREATE INDEX "DrawOrder_vendorId_createdAt_idx" ON "DrawOrder"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "DrawOrder_userId_createdAt_idx" ON "DrawOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DrawResult_vendorId_createdAt_idx" ON "DrawResult"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "DrawResult_drawOrderId_drawSequence_idx" ON "DrawResult"("drawOrderId", "drawSequence");

-- CreateIndex
CREATE UNIQUE INDEX "DrawFairnessProof_drawOrderId_key" ON "DrawFairnessProof"("drawOrderId");

-- CreateIndex
CREATE INDEX "DrawFairnessProof_vendorId_createdAt_idx" ON "DrawFairnessProof"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "DrawFairnessProof_userId_createdAt_idx" ON "DrawFairnessProof"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DrawFairnessSelection_vendorId_createdAt_idx" ON "DrawFairnessSelection"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "DrawFairnessSelection_proofId_drawSequence_idx" ON "DrawFairnessSelection"("proofId", "drawSequence");

-- CreateIndex
CREATE INDEX "DrawFairnessSelection_drawOrderId_drawSequence_idx" ON "DrawFairnessSelection"("drawOrderId", "drawSequence");

-- CreateIndex
CREATE INDEX "VendorRevenueLedger_vendorId_createdAt_idx" ON "VendorRevenueLedger"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "VendorRevenueLedger_drawOrderId_idx" ON "VendorRevenueLedger"("drawOrderId");

-- CreateIndex
CREATE INDEX "TopupOrder_vendorId_createdAt_idx" ON "TopupOrder"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "TopupOrder_provider_providerOrderRef_idx" ON "TopupOrder"("provider", "providerOrderRef");

-- CreateIndex
CREATE INDEX "PaymentTransaction_vendorId_createdAt_idx" ON "PaymentTransaction"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_provider_providerPaymentRef_idx" ON "PaymentTransaction"("provider", "providerPaymentRef");

-- CreateIndex
CREATE INDEX "AuditLog_vendorId_createdAt_idx" ON "AuditLog"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "OutboxEvent_vendorId_createdAt_idx" ON "OutboxEvent"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "VendorBanner_vendorId_isActive_sortOrder_idx" ON "VendorBanner"("vendorId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "VendorBanner_creativeAssetId_idx" ON "VendorBanner"("creativeAssetId");

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
CREATE INDEX "VendorReferralSignup_vendorId_createdAt_idx" ON "VendorReferralSignup"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "VendorReferralSignup_referralCode_createdAt_idx" ON "VendorReferralSignup"("referralCode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VendorReferralSignup_vendorId_customerUserId_key" ON "VendorReferralSignup"("vendorId", "customerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPointGrantQr_token_key" ON "VendorPointGrantQr"("token");

-- CreateIndex
CREATE INDEX "VendorPointGrantQr_vendorId_status_createdAt_idx" ON "VendorPointGrantQr"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "VendorPointGrantQr_vendorId_expiresAt_idx" ON "VendorPointGrantQr"("vendorId", "expiresAt");

-- CreateIndex
CREATE INDEX "CatalogItem_itemType_game_isActive_idx" ON "CatalogItem"("itemType", "game", "isActive");

-- CreateIndex
CREATE INDEX "CatalogItem_source_isActive_idx" ON "CatalogItem"("source", "isActive");

-- CreateIndex
CREATE INDEX "CatalogItem_name_idx" ON "CatalogItem"("name");

-- CreateIndex
CREATE INDEX "CatalogItem_catalogSetId_isActive_idx" ON "CatalogItem"("catalogSetId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_source_sourceItemId_language_key" ON "CatalogItem"("source", "sourceItemId", "language");

-- CreateIndex
CREATE INDEX "CatalogSet_game_isActive_releaseDate_idx" ON "CatalogSet"("game", "isActive", "releaseDate");

-- CreateIndex
CREATE INDEX "CatalogSet_game_isActive_name_idx" ON "CatalogSet"("game", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSet_source_sourceSetId_game_key" ON "CatalogSet"("source", "sourceSetId", "game");

-- CreateIndex
CREATE INDEX "CatalogSealedProduct_catalogSetId_isActive_idx" ON "CatalogSealedProduct"("catalogSetId", "isActive");

-- CreateIndex
CREATE INDEX "CatalogSealedProduct_game_isActive_name_idx" ON "CatalogSealedProduct"("game", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSealedProduct_source_sourceProductId_language_game_key" ON "CatalogSealedProduct"("source", "sourceProductId", "language", "game");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalCatalogGame_code_key" ON "CanonicalCatalogGame"("code");

-- CreateIndex
CREATE INDEX "CanonicalCatalogSet_gameId_releaseDate_idx" ON "CanonicalCatalogSet"("gameId", "releaseDate");

-- CreateIndex
CREATE INDEX "CanonicalCatalogSet_gameId_name_idx" ON "CanonicalCatalogSet"("gameId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalCatalogSet_gameId_source_sourceSetId_key" ON "CanonicalCatalogSet"("gameId", "source", "sourceSetId");

-- CreateIndex
CREATE INDEX "CanonicalCatalogCard_gameId_setId_name_idx" ON "CanonicalCatalogCard"("gameId", "setId", "name");

-- CreateIndex
CREATE INDEX "CanonicalCatalogCard_gameId_rarity_idx" ON "CanonicalCatalogCard"("gameId", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalCatalogCard_source_sourceCardId_language_gameId_key" ON "CanonicalCatalogCard"("source", "sourceCardId", "language", "gameId");

-- CreateIndex
CREATE INDEX "CanonicalSealedProduct_gameId_setId_name_idx" ON "CanonicalSealedProduct"("gameId", "setId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalSealedProduct_source_sourceProductId_language_game_key" ON "CanonicalSealedProduct"("source", "sourceProductId", "language", "gameId");

-- CreateIndex
CREATE INDEX "CanonicalSearchDoc_gameId_setId_isActive_idx" ON "CanonicalSearchDoc"("gameId", "setId", "isActive");

-- CreateIndex
CREATE INDEX "CanonicalSearchDoc_entityType_isActive_idx" ON "CanonicalSearchDoc"("entityType", "isActive");

-- CreateIndex
CREATE INDEX "CanonicalSearchDoc_displayName_idx" ON "CanonicalSearchDoc"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalSearchDoc_entityType_entityId_gameId_key" ON "CanonicalSearchDoc"("entityType", "entityId", "gameId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMembership" ADD CONSTRAINT "VendorMembership_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMembership" ADD CONSTRAINT "VendorMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSettings" ADD CONSTRAINT "VendorSettings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackPrize" ADD CONSTRAINT "PackPrize_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "PackDraw" ADD CONSTRAINT "PackDraw_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDraw" ADD CONSTRAINT "PackDraw_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDraw" ADD CONSTRAINT "PackDraw_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "PackPrize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "WalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawOrder" ADD CONSTRAINT "DrawOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawOrder" ADD CONSTRAINT "DrawOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawOrder" ADD CONSTRAINT "DrawOrder_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "WalletAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawOrder" ADD CONSTRAINT "DrawOrder_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawResult" ADD CONSTRAINT "DrawResult_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawResult" ADD CONSTRAINT "DrawResult_drawOrderId_fkey" FOREIGN KEY ("drawOrderId") REFERENCES "DrawOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawResult" ADD CONSTRAINT "DrawResult_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawResult" ADD CONSTRAINT "DrawResult_packPrizeId_fkey" FOREIGN KEY ("packPrizeId") REFERENCES "PackPrize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawFairnessProof" ADD CONSTRAINT "DrawFairnessProof_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawFairnessProof" ADD CONSTRAINT "DrawFairnessProof_drawOrderId_fkey" FOREIGN KEY ("drawOrderId") REFERENCES "DrawOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawFairnessProof" ADD CONSTRAINT "DrawFairnessProof_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawFairnessProof" ADD CONSTRAINT "DrawFairnessProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawFairnessSelection" ADD CONSTRAINT "DrawFairnessSelection_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawFairnessSelection" ADD CONSTRAINT "DrawFairnessSelection_drawOrderId_fkey" FOREIGN KEY ("drawOrderId") REFERENCES "DrawOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawFairnessSelection" ADD CONSTRAINT "DrawFairnessSelection_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "DrawFairnessProof"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRevenueLedger" ADD CONSTRAINT "VendorRevenueLedger_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopupOrder" ADD CONSTRAINT "TopupOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopupOrder" ADD CONSTRAINT "TopupOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopupOrder" ADD CONSTRAINT "TopupOrder_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "WalletAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBanner" ADD CONSTRAINT "VendorBanner_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeJob" ADD CONSTRAINT "CreativeJob_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeJob" ADD CONSTRAINT "CreativeJob_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_creativeJobId_fkey" FOREIGN KEY ("creativeJobId") REFERENCES "CreativeJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReferralSignup" ADD CONSTRAINT "VendorReferralSignup_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReferralSignup" ADD CONSTRAINT "VendorReferralSignup_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPointGrantQr" ADD CONSTRAINT "VendorPointGrantQr_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPointGrantQr" ADD CONSTRAINT "VendorPointGrantQr_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPointGrantQr" ADD CONSTRAINT "VendorPointGrantQr_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_catalogSetId_fkey" FOREIGN KEY ("catalogSetId") REFERENCES "CatalogSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSealedProduct" ADD CONSTRAINT "CatalogSealedProduct_catalogSetId_fkey" FOREIGN KEY ("catalogSetId") REFERENCES "CatalogSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalCatalogSet" ADD CONSTRAINT "CanonicalCatalogSet_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CanonicalCatalogGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalCatalogCard" ADD CONSTRAINT "CanonicalCatalogCard_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CanonicalCatalogGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalCatalogCard" ADD CONSTRAINT "CanonicalCatalogCard_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CanonicalCatalogSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalSealedProduct" ADD CONSTRAINT "CanonicalSealedProduct_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CanonicalCatalogGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalSealedProduct" ADD CONSTRAINT "CanonicalSealedProduct_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CanonicalCatalogSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalSearchDoc" ADD CONSTRAINT "CanonicalSearchDoc_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CanonicalCatalogGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalSearchDoc" ADD CONSTRAINT "CanonicalSearchDoc_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CanonicalCatalogSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

