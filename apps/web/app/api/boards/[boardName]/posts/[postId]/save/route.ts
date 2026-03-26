import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

type Params = { params: { boardName: string; postId: string } };

// ---------------------------------------------------------------------------
// POST /api/boards/[boardName]/posts/[postId]/save — toggle save
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, { params }: Params) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const post = await prisma.boardPost.findUnique({
    where: { id: params.postId },
    include: { board: { select: { name: true } } },
  });
  if (!post || post.board.name !== params.boardName) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const existing = await prisma.savedBoardPost.findUnique({
    where: {
      userId_boardPostId: { userId: session.user.id, boardPostId: post.id },
    },
  });

  if (existing) {
    await prisma.savedBoardPost.delete({ where: { id: existing.id } });
    return NextResponse.json({ savedByMe: false });
  } else {
    await prisma.savedBoardPost.create({
      data: { userId: session.user.id, boardPostId: post.id },
    });
    return NextResponse.json({ savedByMe: true });
  }
}
