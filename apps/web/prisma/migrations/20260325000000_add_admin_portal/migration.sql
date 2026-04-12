-- CreateEnum (idempotent — may already exist if previous deploy partially ran)
DO $$ BEGIN
    CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: add adminRole and adminNotes (idempotent)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adminRole" "AdminRole";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;

-- CreateTable admin_audit_logs
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,
    "adminRole" "AdminRole" NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable admin_grants
CREATE TABLE IF NOT EXISTS "admin_grants" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" TEXT NOT NULL,
    "grantedToId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "reason" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    CONSTRAINT "admin_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable admin_sessions
CREATE TABLE IF NOT EXISTS "admin_sessions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "admin_sessions_adminId_key" ON "admin_sessions"("adminId");

-- CreateTable cron_logs
CREATE TABLE IF NOT EXISTS "cron_logs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "message" TEXT,
    "durationMs" INTEGER,
    "triggeredBy" TEXT,
    CONSTRAINT "cron_logs_pkey" PRIMARY KEY ("id")
);
