-- Add onboarding fields to User (@@map("users"))
ALTER TABLE "users" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "aimScreennameHash" TEXT;

-- Backfill: mark all pre-existing users as having completed onboarding
-- so they are not redirected into the new onboarding flow on next sign-in.
UPDATE "users" SET "onboardingComplete" = true, "onboardingStep" = 5;
