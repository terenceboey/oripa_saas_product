-- Add customer onboarding fields collected after OTP/social signup.
ALTER TABLE "User" ADD COLUMN "age" INTEGER;
ALTER TABLE "User" ADD COLUMN "country" TEXT;
