CREATE TYPE "BadgeType" AS ENUM ('FOUNDER', 'FOUNDING_DONOR');

CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badge" "BadgeType" NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedById" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBadge_userId_badge_key" ON "UserBadge"("userId", "badge");
CREATE INDEX "UserBadge_badge_idx" ON "UserBadge"("badge");
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
