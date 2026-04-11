-- AddColumn: encrypted email fields and digest settings on users

ALTER TABLE "users" ADD COLUMN "emailEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "emailNonce" TEXT;
ALTER TABLE "users" ADD COLUMN "digestEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "digestTime" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "users" ADD COLUMN "digestTimezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "users" ADD COLUMN "digestLastSentAt" TIMESTAMP(3);
