-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('AWAY', 'THOUGHT', 'QUOTE', 'PHOTO');

-- AlterTable: extend away_message_history with new post-type fields
ALTER TABLE "away_message_history"
  ADD COLUMN "postType"     "PostType" NOT NULL DEFAULT 'AWAY',
  ADD COLUMN "bodyText"     TEXT,
  ADD COLUMN "quoteText"    TEXT,
  ADD COLUMN "quoteAttrib"  TEXT,
  ADD COLUMN "imageUrl"     TEXT,
  ADD COLUMN "imageCaption" TEXT,
  ADD COLUMN "tags"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "echoOfId"     TEXT,
  ADD COLUMN "echoCount"    INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey: self-referential echo relation
ALTER TABLE "away_message_history"
  ADD CONSTRAINT "away_message_history_echoOfId_fkey"
  FOREIGN KEY ("echoOfId")
  REFERENCES "away_message_history"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: post_tags (denormalized tag index)
CREATE TABLE "post_tags" (
  "id"        TEXT NOT NULL,
  "tag"       TEXT NOT NULL,
  "postId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "post_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_tags_tag_idx" ON "post_tags"("tag");

-- CreateIndex
CREATE INDEX "post_tags_postId_idx" ON "post_tags"("postId");

-- AddForeignKey: post_tags → away_message_history
ALTER TABLE "post_tags"
  ADD CONSTRAINT "post_tags_postId_fkey"
  FOREIGN KEY ("postId")
  REFERENCES "away_message_history"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
