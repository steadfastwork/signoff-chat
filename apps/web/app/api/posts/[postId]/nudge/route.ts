import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyPostNudged } from "@/lib/expoNotifications";

// ---------------------------------------------------------------------------
// POST /api/posts/[postId]/nudge — toggle nudge (returns new count + state)
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const existing = await prisma.nudge.findUnique({
    where: { userId_postId: { userId: session.user.id, postId: params.postId } },
  });

  if (existing) {
    await prisma.nudge.delete({ where: { id: existing.id } });
  } else {
    await prisma.nudge.create({
      data: { userId: session.user.id, postId: params.postId },
    });

    // Notify the post author — only on adding a nudge, not removing
    const post = await prisma.post.findUnique({
      where:  { id: params.postId },
      select: { authorId: true, content: true },
    });
    if (post && post.authorId !== session.user.id) {
      notifyPostNudged(
        post.authorId,
        session.user.screenname,
        params.postId,
        post.content
      ).catch(() => {});
    }
  }

  const count = await prisma.nudge.count({ where: { postId: params.postId } });

  return NextResponse.json({ nudgedByMe: !existing, count });
}
