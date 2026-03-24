import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { postId: string } };

// ---------------------------------------------------------------------------
// GET /api/posts/[postId] — single post with replies + nudge count
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  const session = await getServerSession(authOptions);

  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    include: {
      author: {
        select: {
          id: true,
          screenname: true,
          isGoldMember: true,
          status: true,
          awayMessage: true,
        },
      },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, screenname: true, isGoldMember: true } },
        },
      },
      _count: { select: { replies: true, nudges: true } },
      nudges: session?.user?.id
        ? { where: { userId: session.user.id }, select: { id: true } }
        : { take: 0, select: { id: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  return NextResponse.json({
    ...post,
    nudgedByMe: post.nudges.length > 0,
    nudges: undefined,
    author: {
      ...post.author,
      status: post.author.status === "INVISIBLE" ? "OFFLINE" : post.author.status,
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/posts/[postId] — delete own post
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: Params
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    select: { authorId: true },
  });

  if (!post) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }
  if (post.authorId !== session.user.id) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  await prisma.post.delete({ where: { id: params.postId } });

  return NextResponse.json({ ok: true });
}
