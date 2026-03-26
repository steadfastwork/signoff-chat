import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

type Params = { params: { boardName: string; postId: string; commentId: string } };

// ---------------------------------------------------------------------------
// POST /api/boards/.../comments/[commentId]/nudge — toggle comment nudge
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, { params }: Params) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const comment = await prisma.boardComment.findUnique({
    where: { id: params.commentId },
  });
  if (!comment || comment.boardPostId !== params.postId) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const existing = await prisma.boardCommentNudge.findUnique({
    where: {
      userId_boardCommentId: {
        userId: session.user.id,
        boardCommentId: comment.id,
      },
    },
  });

  if (existing) {
    await prisma.boardCommentNudge.delete({ where: { id: existing.id } });
  } else {
    await prisma.boardCommentNudge.create({
      data: { userId: session.user.id, boardCommentId: comment.id },
    });
  }

  const count = await prisma.boardCommentNudge.count({
    where: { boardCommentId: comment.id },
  });

  return NextResponse.json({ nudgedByMe: !existing, nudgeCount: count });
}
