-- CreateEnum
CREATE TYPE "BoardType" AS ENUM ('PUBLIC', 'INVITE_ONLY', 'SECRET');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'GIF');

-- CreateTable
CREATE TABLE "invite_links" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "channelId" TEXT,
    "boardId" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 10,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "invite_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boards" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "vibeStatement" VARCHAR(200) NOT NULL,
    "type" "BoardType" NOT NULL DEFAULT 'PUBLIC',
    "creatorId" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_members" (
    "id" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "isFoundingMember" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "board_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_posts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "body" VARCHAR(2000),
    "authorId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" "MediaType",
    "tag" VARCHAR(30),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "nudgeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "board_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_comments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "body" VARCHAR(512) NOT NULL,
    "authorId" TEXT NOT NULL,
    "boardPostId" TEXT NOT NULL,
    "parentCommentId" TEXT,

    CONSTRAINT "board_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_nudges" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "boardPostId" TEXT NOT NULL,

    CONSTRAINT "board_nudges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_comment_nudges" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "boardCommentId" TEXT NOT NULL,

    CONSTRAINT "board_comment_nudges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_threads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentMessageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "channel_threads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_links_token_key" ON "invite_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "boards_name_key" ON "boards"("name");

-- CreateIndex
CREATE UNIQUE INDEX "board_members_userId_boardId_key" ON "board_members"("userId", "boardId");

-- CreateIndex
CREATE UNIQUE INDEX "board_nudges_userId_boardPostId_key" ON "board_nudges"("userId", "boardPostId");

-- CreateIndex
CREATE UNIQUE INDEX "board_comment_nudges_userId_boardCommentId_key" ON "board_comment_nudges"("userId", "boardCommentId");

-- AddForeignKey
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_posts" ADD CONSTRAINT "board_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_posts" ADD CONSTRAINT "board_posts_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_comments" ADD CONSTRAINT "board_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_comments" ADD CONSTRAINT "board_comments_boardPostId_fkey" FOREIGN KEY ("boardPostId") REFERENCES "board_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_comments" ADD CONSTRAINT "board_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "board_comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "board_nudges" ADD CONSTRAINT "board_nudges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_nudges" ADD CONSTRAINT "board_nudges_boardPostId_fkey" FOREIGN KEY ("boardPostId") REFERENCES "board_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_comment_nudges" ADD CONSTRAINT "board_comment_nudges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_comment_nudges" ADD CONSTRAINT "board_comment_nudges_boardCommentId_fkey" FOREIGN KEY ("boardCommentId") REFERENCES "board_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_threads" ADD CONSTRAINT "channel_threads_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "room_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_threads" ADD CONSTRAINT "channel_threads_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
