import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { notifyBoardComment } from "@/lib/expoNotifications";
import { stripHtml } from "@/lib/sanitize";

type Params = { params: { boardName: string; postId: string } };

const authorSelect = {
  id: true,
  screenname: true,
  isGoldMember: true,
} as const;

// ---------------------------------------------------------------------------
// GET /api/boards/[boardName]/posts/[postId]/comments
// Returns flat list organised as top-level comments + one level of replies
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);

  const post = await prisma.boardPost.findUnique({
    where: { id: params.postId },
    include: { board: { select: { name: true, id: true } } },
  });
  if (!post || post.board.name !== params.boardName) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const all = await prisma.boardComment.findMany({
    where: { boardPostId: post.id },
    orderBy: { createdAt: "asc" },
    include: {
      author: {
        select: {
          ...authorSelect,
          boardMemberships: {
            where: { boardId: post.board.id },
            select: { isFoundingMember: true },
          },
        },
      },
      nudges: session?.user?.id
        ? { where: { userId: session.user.id }, select: { id: true } }
        : { take: 0, select: { id: true } },
      _count: { select: { nudges: true } },
    },
  });

  function flattenAuthor(c: (typeof all)[number]) {
    return {
      ...c.author,
      isFoundingMember: c.author.boardMemberships[0]?.isFoundingMember ?? false,
      boardMemberships: undefined,
    };
  }

  const topLevel = all
    .filter((c) => !c.parentCommentId)
    .map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      nudgeCount: c._count.nudges,
      nudgedByMe: c.nudges.length > 0,
      author: flattenAuthor(c),
      replies: all
        .filter((r) => r.parentCommentId === c.id)
        .map((r) => ({
          id: r.id,
          body: r.body,
          createdAt: r.createdAt,
          nudgeCount: r._count.nudges,
          nudgedByMe: r.nudges.length > 0,
          author: flattenAuthor(r),
          parentCommentId: r.parentCommentId,
        })),
    }));

  return NextResponse.json(topLevel);
}

// ---------------------------------------------------------------------------
// POST /api/boards/[boardName]/posts/[postId]/comments — add comment
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const post = await prisma.boardPost.findUnique({
    where: { id: params.postId },
    include: { board: { select: { name: true, id: true } } },
  });
  if (!post || post.board.name !== params.boardName) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const membership = await prisma.boardMember.findUnique({
    where: {
      userId_boardId: { userId: session.user.id, boardId: post.board.id },
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "you must be a member to comment." },
      { status: 403 }
    );
  }

  // Rate limit: 20 comments/min per user
  const rl = await rateLimit(limiters.boardComment, `bcomment:${session.user.id}`);
  if (rl) return rl;

  const { body: rawBody, parentCommentId } = (await req.json()) as {
    body: string;
    parentCommentId?: string;
  };

  const body = stripHtml(rawBody ?? "");

  if (!body) {
    return NextResponse.json({ error: "body is required." }, { status: 400 });
  }
  if (body.length > 512) {
    return NextResponse.json(
      { error: "comment cannot exceed 512 characters." },
      { status: 400 }
    );
  }

  // Validate parentCommentId depth: only one level of nesting
  if (parentCommentId) {
    const parent = await prisma.boardComment.findUnique({
      where: { id: parentCommentId },
    });
    if (!parent || parent.boardPostId !== post.id) {
      return NextResponse.json(
        { error: "parent comment not found." },
        { status: 404 }
      );
    }
    if (parent.parentCommentId) {
      return NextResponse.json(
        { error: "replies cannot be nested more than one level." },
        { status: 400 }
      );
    }
  }

  const [comment] = await prisma.$transaction([
    prisma.boardComment.create({
      data: {
        body,
        authorId: session.user.id,
        boardPostId: post.id,
        parentCommentId: parentCommentId ?? null,
      },
      include: {
        author: {
          select: {
            ...authorSelect,
            boardMemberships: {
              where: { boardId: post.board.id },
              select: { isFoundingMember: true },
            },
          },
        },
      },
    }),
    prisma.boardPost.update({
      where: { id: post.id },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  const out = {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    parentCommentId: comment.parentCommentId,
    nudgeCount: 0,
    nudgedByMe: false,
    replies: [],
    author: {
      ...comment.author,
      isFoundingMember:
        comment.author.boardMemberships[0]?.isFoundingMember ?? false,
      boardMemberships: undefined,
    },
  };

  // Notify post author if they're not the commenter — fire-and-forget
  if (post.authorId !== session.user.id) {
    notifyBoardComment(
      post.authorId,
      params.boardName,
      session.user.screenname,
      params.postId,
      post.title ?? params.postId
    ).catch(() => {});
  }

  return NextResponse.json(out, { status: 201 });
}
