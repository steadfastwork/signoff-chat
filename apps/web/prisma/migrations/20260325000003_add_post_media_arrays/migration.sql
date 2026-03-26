-- Add multi-media array fields to posts
ALTER TABLE "posts" ADD COLUMN "mediaUrls" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "posts" ADD COLUMN "gifUrls"   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "posts" ADD COLUMN "gifIds"    TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: migrate existing mediaUrl into arrays
-- IMAGE/VIDEO → mediaUrls
UPDATE "posts"
SET "mediaUrls" = ARRAY["mediaUrl"]
WHERE "mediaUrl" IS NOT NULL AND "mediaType" IN ('IMAGE', 'VIDEO');

-- GIF → gifUrls (gifIds left empty — no ID available for legacy rows)
UPDATE "posts"
SET "gifUrls" = ARRAY["mediaUrl"],
    "gifIds"  = ARRAY['']
WHERE "mediaUrl" IS NOT NULL AND "mediaType" = 'GIF';
