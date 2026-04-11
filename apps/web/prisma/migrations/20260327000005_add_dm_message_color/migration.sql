-- Add per-message text color and font size to room_messages table
-- These are only populated for DM messages when the DM_FONT_COLORS flag is enabled.
ALTER TABLE "room_messages" ADD COLUMN "textColor" TEXT;
ALTER TABLE "room_messages" ADD COLUMN "fontSize"  TEXT;
