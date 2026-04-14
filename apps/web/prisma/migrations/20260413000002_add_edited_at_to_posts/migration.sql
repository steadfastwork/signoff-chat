-- AlterTable: add editedAt to away_message_history
ALTER TABLE "away_message_history"
  ADD COLUMN "editedAt" TIMESTAMP(3);
