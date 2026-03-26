-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- AlterTable: replace isAdmin with adminRole
ALTER TABLE "users" ADD COLUMN "adminRole" "AdminRole";
ALTER TABLE "users" ADD COLUMN "adminNotes" TEXT;
-- Copy existing isAdmin=true users to ADMIN role (safety)
UPDATE "users" SET "adminRole" = 'ADMIN' WHERE "isAdmin" = true;
ALTER TABLE "users" DROP COLUMN "isAdmin";

-- CreateTable admin_audit_logs
CREATE TABLE "admin_audit_logs" (
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
CREATE TABLE "admin_grants" (
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
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_adminId_key" ON "admin_sessions"("adminId");

-- CreateTable cron_logs
CREATE TABLE "cron_logs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "message" TEXT,
    "durationMs" INTEGER,
    "triggeredBy" TEXT,
    CONSTRAINT "cron_logs_pkey" PRIMARY KEY ("id")
);
