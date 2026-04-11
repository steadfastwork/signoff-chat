-- Add DM text color and font size preferences to users table
ALTER TABLE "users" ADD COLUMN "dmTextColor" TEXT DEFAULT '#c8860a';
ALTER TABLE "users" ADD COLUMN "dmFontSize"  TEXT DEFAULT 'md';
