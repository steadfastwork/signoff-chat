-- AlterTable: add media fields to channel messages
ALTER TABLE "room_messages" ADD COLUMN "mediaUrl" TEXT;
ALTER TABLE "room_messages" ADD COLUMN "mediaType" "MediaType";

-- AlterTable: add slow mode tracking to channel members
ALTER TABLE "room_members" ADD COLUMN "lastMessageAt" TIMESTAMP(3);

-- CreateTable: channel thread messages
CREATE TABLE "channel_thread_messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" VARCHAR(512) NOT NULL,
    "authorId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    CONSTRAINT "channel_thread_messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "channel_thread_messages" ADD CONSTRAINT "channel_thread_messages_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_thread_messages" ADD CONSTRAINT "channel_thread_messages_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "channel_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
