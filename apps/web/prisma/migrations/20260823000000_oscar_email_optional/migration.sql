-- SIGNOFF revival: AIM/ICQ accounts live on open-oscar-server and have no email,
-- so mirror `users` rows are created without one. Allow NULL emailHash.
-- (The @unique index stays; Postgres treats NULLs as distinct.)
ALTER TABLE "users" ALTER COLUMN "emailHash" DROP NOT NULL;
