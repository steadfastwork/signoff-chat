-- AlterTable: add editedAt to away_message_history (IF NOT EXISTS for idempotency)
ALTER TABLE "away_message_history"
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
