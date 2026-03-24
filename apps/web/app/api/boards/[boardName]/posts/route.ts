import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { stripHtml, sanitizeUrl } from "@/lib/sanitize";

type Params = { params: { boardName: string } };

function authorWithMembership(boardId: string) {
  return {
    select: {
      id: true,
      screenname: true,
      isGoldMember: true,
      status: true,
      boardMemberships: {
        where: { boardId },
        select: { isFoundingMember: true },
      },
    },
  } as const;
}

function flattenPost(
  p: Awaited<ReturnType<typeof fetchPosts>>[number],
  userId?: string
) {
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    mediaUrl: p.mediaUrl,
    mediaType: p.mediaType,
    tag: p.tag,
    isArchived: p.isArchived,
    nudgeCount: p.nudgeCount,
    commentCount: p.commentCount,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    nudgedByMe: p.nudges.length > 0,
    savedByMe: p.savedBy.length > 0,
    author: {
      id: p.author.id,
      screenname: p.author.screenname,
      isGoldMember: p.author.isGoldMember,
      status: p.author.status === "INVISIBLE" ? "OFFLINE" : p.author.status,
      isFoundingMember: p.author.boardMemberships[0]?.isFoundingMember ?? false,
    },
  };
}

// Helper used only for type inference
async function fetchPosts(
  boardId: string,
  where: object,
  orderBy: object[],
  limit: number,
  cursor: string | null,
  userId?: string
) {
  return prisma.boardPost.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where: { boardId, ...where },
    orderBy,
    include: {
      author: authorWithMembership(boardId),
      nudges: userId
        ? { where: { userId }, select: { id: true } }
        : { take: 0, select: { id: true } },
      savedBy: userId
        ? { where: { userId }, select: { id: true } }
        : { take: 0, select: { id: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/boards/[boardName]/posts
// ?sort=recent|nudged|saved  ?tag=  ?archived=false  ?cursor=
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);

  const board = await prisma.board.findUnique({
    where: { name: params.boardName },
  });
  if (!board) return NextResponse.json({ error: "not found." }, { status: 404 });

  if (board.type === "SECRET") {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const m = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.user.id, boardId: board.id } },
    });
    if (!m) return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "recent";
  const tag = searchParams.get("tag");
  const archived = searchParams.get("archived") === "true";
  const cursor = searchParams.get("cursor");
  const limit = 20;

  const baseWhere: Record<string, unknown> = { isArchived: archived };
  if (tag) baseWhere.tag = tag;

  if (sort === "saved") {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    baseWhere.savedBy = { some: { userId: session.user.id } };
  }

  const orderBy =
    sort === "nudged"
      ? [{ nudgeCount: "desc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  const posts = await fetchPosts(
    board.id,
    baseWhere,
    orderBy,
    limit,
    cursor,
    session?.user?.id
  );

  const hasMore = posts.length > limit;
  const data = hasMore ? posts.slice(0, limit) : posts;

  return NextResponse.json({
    posts: data.map((p) => flattenPost(p, session?.user?.id)),
    nextCursor: hasMore ? data[data.length - 1].id : null,
  });
}

// ---------------------------------------------------------------------------
// POST /api/boards/[boardName]/posts — create a post
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const board = await prisma.board.findUnique({
    where: { name: params.boardName },
  });
  if (!board) return NextResponse.json({ error: "not found." }, { status: 404 });

  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: session.user.id, boardId: board.id } },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "you must be a member to post." },
      { status: 403 }
    );
  }

  // Rate limit: 5 board posts/min per user
  const rl = await rateLimit(limiters.boardPostCreate, `bpost:${session.user.id}`);
  if (rl) return rl;

  const raw = (await req.json()) as {
    title: string;
    body?: string;
    mediaUrl?: string;
    mediaType?: "IMAGE" | "VIDEO" | "GIF";
    tag?: string;
  };

  const title = stripHtml(raw.title ?? "");
  const postBody = raw.body ? stripHtml(raw.body) : undefined;
  const mediaUrl = sanitizeUrl(raw.mediaUrl);
  const tag = raw.tag ? stripHtml(raw.tag) : undefined;

  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }
  if (title.length > 140) {
    return NextResponse.json(
      { error: "title cannot exceed 140 characters." },
      { status: 400 }
    );
  }
  if (postBody && postBody.length > 2000) {
    return NextResponse.json(
      { error: "body cannot exceed 2000 characters." },
      { status: 400 }
    );
  }
  if (tag && tag.length > 30) {
    return NextResponse.json(
      { error: "tag cannot exceed 30 characters." },
      { status: 400 }
    );
  }

  const post = await prisma.boardPost.create({
    data: {
      title,
      body: postBody || null,
      mediaUrl: mediaUrl ?? null,
      mediaType: raw.mediaType ?? null,
      tag: tag?.toLowerCase() || null,
      authorId: session.user.id,
      boardId: board.id,
    },
    include: {
      author: authorWithMembership(board.id),
    },
  });

  return NextResponse.json(
    {
      ...post,
      nudgedByMe: false,
      savedByMe: false,
      author: {
        id: post.author.id,
        screenname: post.author.screenname,
        isGoldMember: post.author.isGoldMember,
        status: post.author.status === "INVISIBLE" ? "OFFLINE" : post.author.status,
        isFoundingMember: post.author.boardMemberships[0]?.isFoundingMember ?? false,
      },
    },
    { status: 201 }
  );
}
