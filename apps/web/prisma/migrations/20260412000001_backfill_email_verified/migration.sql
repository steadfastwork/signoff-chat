-- Backfill: mark all existing users as email-verified.
-- New registrations after 20260412000000 require explicit verification.
UPDATE "users" SET "emailVerified" = NOW() WHERE "emailVerified" IS NULL;
