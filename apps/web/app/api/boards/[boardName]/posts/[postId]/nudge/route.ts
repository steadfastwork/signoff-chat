import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

type Params = { params: { boardName: string; postId: string } };

// ---------------------------------------------------------------------------
// POST /api/boards/[boardName]/posts/[postId]/nudge — toggle nudge
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

  const existing = await prisma.boardNudge.findUnique({
    where: {
      userId_boardPostId: { userId: session.user.id, boardPostId: post.id },
    },
  });

  const delta = existing ? -1 : 1;

  await prisma.$transaction([
    existing
      ? prisma.boardNudge.delete({ where: { id: existing.id } })
      : prisma.boardNudge.create({
          data: { userId: session.user.id, boardPostId: post.id },
        }),
    prisma.boardPost.update({
      where: { id: post.id },
      data: { nudgeCount: { increment: delta } },
    }),
  ]);

  const updated = await prisma.boardPost.findUnique({
    where: { id: post.id },
    select: { nudgeCount: true },
  });

  return NextResponse.json({
    nudgedByMe: !existing,
    nudgeCount: updated?.nudgeCount ?? 0,
  });
}
