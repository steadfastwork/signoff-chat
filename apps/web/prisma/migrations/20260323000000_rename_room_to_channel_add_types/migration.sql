-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('PUBLIC', 'INVITE_ONLY', 'SECRET');

-- AlterTable: add Channel-specific columns to rooms
ALTER TABLE "rooms" ADD COLUMN "type" "ChannelType" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "rooms" ADD COLUMN "slowModeMinutes" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "rooms" ADD COLUMN "memberCap" INTEGER;

-- Rename roomId -> channelId in room_members
ALTER TABLE "room_members" DROP CONSTRAINT "room_members_roomId_fkey";
DROP INDEX "room_members_userId_roomId_key";
ALTER TABLE "room_members" RENAME COLUMN "roomId" TO "channelId";
CREATE UNIQUE INDEX "room_members_userId_channelId_key" ON "room_members"("userId", "channelId");
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename roomId -> channelId in room_messages
ALTER TABLE "room_messages" DROP CONSTRAINT "room_messages_roomId_fkey";
ALTER TABLE "room_messages" RENAME COLUMN "roomId" TO "channelId";
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
