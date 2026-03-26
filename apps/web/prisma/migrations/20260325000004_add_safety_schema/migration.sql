-- Migration: add_safety_schema
-- Adds safety/moderation fields that exist in schema.prisma but were never
-- included in a migration file. Uses IF NOT EXISTS / DO…END guards throughout
-- so this can run safely on a DB that was already synced via `prisma db push`.

-- ---------------------------------------------------------------------------
-- email → emailHash transition on users
-- ---------------------------------------------------------------------------

-- Add emailHash column (nullable first so existing rows don't violate NOT NULL)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailHash" TEXT;

-- For any rows that still have no emailHash (legacy rows from old `email` schema),
-- assign a unique stand-in derived from the row id so the NOT NULL constraint
-- and UNIQUE index can be added without conflicts.
UPDATE "users" SET "emailHash" = 'legacy_' || id WHERE "emailHash" IS NULL;

-- Now enforce NOT NULL
ALTER TABLE "users" ALTER COLUMN "emailHash" SET NOT NULL;

-- Add unique index (IF NOT EXISTS equivalent via DO block)
DO $$ BEGIN
  CREATE UNIQUE INDEX "users_emailHash_key" ON "users"("emailHash");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Drop the old plaintext email column if it still exists
ALTER TABLE "users" DROP COLUMN IF EXISTS "email";
DROP INDEX IF EXISTS "users_email_key";

-- ---------------------------------------------------------------------------
-- Safety / moderation columns on users
-- ---------------------------------------------------------------------------

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSuspended"    BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspendedAt"    TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspendReason"  TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "warningCount"   INTEGER   NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "expoPushToken"  TEXT;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'CSAM', 'THREAT', 'IMPERSONATION', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentType" AS ENUM ('CSAM', 'CSAM_SUSPECTED', 'ILLEGAL_CONTENT', 'THREAT', 'USER_REPORT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentStatus" AS ENUM (
    'DETECTED', 'CONFIRMED', 'REPORTED_TO_NCMEC', 'CONTENT_REMOVED',
    'ACCOUNT_SUSPENDED', 'RESOLVED', 'FALSE_POSITIVE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "blocks" (
  "id"        TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "blocks_blockerId_blockedId_key" ON "blocks"("blockerId", "blockedId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blockedId_fkey"
    FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- mutes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "mutes" (
  "id"      TEXT NOT NULL,
  "muterId" TEXT NOT NULL,
  "mutedId" TEXT NOT NULL,
  CONSTRAINT "mutes_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "mutes_muterId_mutedId_key" ON "mutes"("muterId", "mutedId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "mutes" ADD CONSTRAINT "mutes_muterId_fkey"
    FOREIGN KEY ("muterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "mutes" ADD CONSTRAINT "mutes_mutedId_fkey"
    FOREIGN KEY ("mutedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "reports" (
  "id"           TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reporterId"   TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetPostId" TEXT,
  "targetMsgId"  TEXT,
  "reason"       "ReportReason" NOT NULL,
  "detail"       VARCHAR(500),
  "status"       "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedAt"   TIMESTAMP(3),
  "resolvedBy"   TEXT,
  "resolution"   TEXT,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- safety_incidents
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "safety_incidents" (
  "id"                 TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "incidentType"       "IncidentType" NOT NULL,
  "status"             "IncidentStatus" NOT NULL DEFAULT 'DETECTED',
  "reporterId"         TEXT,
  "uploaderId"         TEXT,
  "uploaderName"       TEXT NOT NULL,
  "uploaderEmailHash"  TEXT NOT NULL,
  "contentUrl"         TEXT NOT NULL,
  "fileKey"            TEXT NOT NULL,
  "contentType"        TEXT NOT NULL,
  "fileSizeBytes"      INTEGER,
  "contentHash"        TEXT,
  "matchProvider"      TEXT,
  "matchConfidence"    DOUBLE PRECISION,
  "allProviders"       TEXT,
  "scannedAt"          TIMESTAMP(3),
  "actionsTaken"       TEXT,
  "preservedPath"      TEXT,
  "preservedAt"        TIMESTAMP(3),
  "ncmecReportId"      TEXT,
  "ncmecReportedAt"    TIMESTAMP(3),
  "resolvedAt"         TIMESTAMP(3),
  "resolvedBy"         TEXT,
  "internalNotes"      TEXT,
  CONSTRAINT "safety_incidents_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE INDEX "safety_incidents_uploaderId_idx" ON "safety_incidents"("uploaderId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "safety_incidents_incidentType_idx" ON "safety_incidents"("incidentType");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "safety_incidents_status_idx" ON "safety_incidents"("status");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX "safety_incidents_ncmecReportedAt_idx" ON "safety_incidents"("ncmecReportedAt");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_uploaderId_fkey"
    FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- favorite_channels
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "favorite_channels" (
  "id"        TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"    TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  CONSTRAINT "favorite_channels_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "favorite_channels_userId_channelId_key" ON "favorite_channels"("userId", "channelId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "favorite_channels" ADD CONSTRAINT "favorite_channels_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "favorite_channels" ADD CONSTRAINT "favorite_channels_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- channel_bans
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "channel_bans" (
  "id"        TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  CONSTRAINT "channel_bans_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "channel_bans_channelId_userId_key" ON "channel_bans"("channelId", "userId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "channel_bans" ADD CONSTRAINT "channel_bans_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- board_bans
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "board_bans" (
  "id"      TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "userId"  TEXT NOT NULL,
  CONSTRAINT "board_bans_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "board_bans_boardId_userId_key" ON "board_bans"("boardId", "userId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "board_bans" ADD CONSTRAINT "board_bans_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- buddy_group_lists + buddy_group_members
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "buddy_group_lists" (
  "id"        TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"      TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "position"  INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "buddy_group_lists_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "buddy_group_lists" ADD CONSTRAINT "buddy_group_lists_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "buddy_group_members" (
  "listId"  TEXT NOT NULL,
  "buddyId" TEXT NOT NULL,
  CONSTRAINT "buddy_group_members_pkey" PRIMARY KEY ("listId", "buddyId")
);

DO $$ BEGIN
  ALTER TABLE "buddy_group_members" ADD CONSTRAINT "buddy_group_members_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "buddy_group_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
