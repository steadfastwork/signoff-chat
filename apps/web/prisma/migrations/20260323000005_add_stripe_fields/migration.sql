ALTER TABLE "users" ADD COLUMN "stripeCustomerId" TEXT;
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");
