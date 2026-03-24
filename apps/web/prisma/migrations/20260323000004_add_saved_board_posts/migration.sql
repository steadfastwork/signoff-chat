-- CreateTable: saved board posts
CREATE TABLE "saved_board_posts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "boardPostId" TEXT NOT NULL,
    CONSTRAINT "saved_board_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_board_posts_userId_boardPostId_key"
    ON "saved_board_posts"("userId", "boardPostId");

-- AddForeignKey
ALTER TABLE "saved_board_posts" ADD CONSTRAINT "saved_board_posts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_board_posts" ADD CONSTRAINT "saved_board_posts_boardPostId_fkey"
    FOREIGN KEY ("boardPostId") REFERENCES "board_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
