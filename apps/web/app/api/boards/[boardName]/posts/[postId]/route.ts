import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { boardName: string; postId: string } };

async function getPostAndBoard(boardName: string, postId: string) {
  const [board, post] = await Promise.all([
    prisma.board.findUnique({ where: { name: boardName } }),
    prisma.boardPost.findUnique({ where: { id: postId } }),
  ]);
  if (!board || !post || post.boardId !== board.id) return null;
  return { board, post };
}

// ---------------------------------------------------------------------------
// GET /api/boards/[boardName]/posts/[postId]
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const ctx = await getPostAndBoard(params.boardName, params.postId);
  if (!ctx) return NextResponse.json({ error: "not found." }, { status: 404 });

  const { board, post } = ctx;

  if (board.type === "SECRET") {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const m = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.user.id, boardId: board.id } },
    });
    if (!m) return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const [authorMembership, nudgedByMe, savedByMe] = await Promise.all([
    prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: post.authorId, boardId: board.id } },
      select: { isFoundingMember: true },
    }),
    session?.user?.id
      ? prisma.boardNudge.findUnique({
          where: {
            userId_boardPostId: { userId: session.user.id, boardPostId: post.id },
          },
        })
      : null,
    session?.user?.id
      ? prisma.savedBoardPost.findUnique({
          where: {
            userId_boardPostId: { userId: session.user.id, boardPostId: post.id },
          },
        })
      : null,
  ]);

  const author = await prisma.user.findUnique({
    where: { id: post.authorId },
    select: { id: true, screenname: true, isGoldMember: true, status: true },
  });

  return NextResponse.json({
    ...post,
    nudgedByMe: !!nudgedByMe,
    savedByMe: !!savedByMe,
    author: author
      ? {
          ...author,
          status: author.status === "INVISIBLE" ? "OFFLINE" : author.status,
          isFoundingMember: authorMembership?.isFoundingMember ?? false,
        }
      : null,
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/boards/[boardName]/posts/[postId] — edit own post (within 15 min)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = await getPostAndBoard(params.boardName, params.postId);
  if (!ctx) return NextResponse.json({ error: "not found." }, { status: 404 });
  const { post } = ctx;

  if (post.authorId !== session.user.id) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  const ageMs = Date.now() - post.createdAt.getTime();
  if (ageMs > 15 * 60 * 1000) {
    return NextResponse.json(
      { error: "posts can only be edited within 15 minutes of posting." },
      { status: 403 }
    );
  }

  const body = (await req.json()) as {
    title?: string;
    body?: string;
    tag?: string;
  };

  if (body.title && body.title.length > 140) {
    return NextResponse.json(
      { error: "title cannot exceed 140 characters." },
      { status: 400 }
    );
  }
  if (body.body && body.body.length > 2000) {
    return NextResponse.json(
      { error: "body cannot exceed 2000 characters." },
      { status: 400 }
    );
  }

  const updated = await prisma.boardPost.update({
    where: { id: post.id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.body !== undefined ? { body: body.body.trim() || null } : {}),
      ...(body.tag !== undefined
        ? { tag: body.tag.trim().toLowerCase() || null }
        : {}),
    },
  });

  return NextResponse.json(updated);
}

// ---------------------------------------------------------------------------
// DELETE /api/boards/[boardName]/posts/[postId] — delete own post
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = await getPostAndBoard(params.boardName, params.postId);
  if (!ctx) return NextResponse.json({ error: "not found." }, { status: 404 });
  const { post } = ctx;

  if (post.authorId !== session.user.id) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  await prisma.boardPost.delete({ where: { id: post.id } });

  return NextResponse.json({ ok: true });
}
