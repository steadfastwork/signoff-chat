import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { sanitizeRichText, richTextLength, sanitizeUrl } from "@/lib/sanitize";
import { internalError } from "@/lib/api-error";
import { getExcludedUserIds } from "@/lib/blocks";
import { isRestrictedUser, contentHash } from "@/lib/ratelimit";

const authorSelect = {
  id: true,
  screenname: true,
  isGoldMember: true,
  status: true,
  awayMessage: true,
} as const;

// ---------------------------------------------------------------------------
// GET /api/posts — buddy + own feed, cursor-paginated (20/page)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = 20;

  // Block/mute exclusion — server-side, not just UI hiding
  const excludedIds = await getExcludedUserIds(session.user.id);

  // Accepted buddy IDs
  const relations = await prisma.buddyRelation.findMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: session.user.id },
        { addresseeId: session.user.id },
      ],
    },
    select: { requesterId: true, addresseeId: true },
  });

  const buddyIds = relations.map((r) =>
    r.requesterId === session.user.id ? r.addresseeId : r.requesterId
  );

  const posts = await prisma.post.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where: {
      // Never show blocked or muted users' content
      authorId: { notIn: excludedIds },
      OR: [
        // Own posts (all privacy levels)
        { authorId: session.user.id },
        // Buddy posts — PUBLIC or BUDDIES_ONLY
        {
          authorId: { in: buddyIds },
          privacy: { in: ["PUBLIC", "BUDDIES_ONLY"] },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: authorSelect },
      _count: { select: { replies: true, nudges: true } },
      nudges: {
        where: { userId: session.user.id },
        select: { id: true },
      },
      replies: {
        take: 2,
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, screenname: true, isGoldMember: true } } },
      },
    },
  });

  const hasMore = posts.length > limit;
  const data = hasMore ? posts.slice(0, limit) : posts;

  // Flatten: add nudgedByMe boolean, hide INVISIBLE status
  const result = data.map((p) => ({
    ...p,
    nudgedByMe: p.nudges.length > 0,
    nudges: undefined,
    author: {
      ...p.author,
      status: p.author.status === "INVISIBLE" ? "OFFLINE" : p.author.status,
    },
  }));

  return NextResponse.json({
    posts: result,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  });
  } catch (err) {
    return internalError(err, "GET /api/posts");
  }
}

// ---------------------------------------------------------------------------
// POST /api/posts — create a post
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    content: string;
    privacy?: "PUBLIC" | "BUDDIES_ONLY";
    isAwayMessage?: boolean;
    // Legacy single-media (kept for backwards compat)
    mediaUrl?: string;
    mediaType?: "IMAGE" | "VIDEO" | "GIF";
    // New multi-media arrays
    mediaUrls?: string[];
    gifUrls?: string[];
    gifIds?: string[];
  };

  // Fetch user for restriction check (new account / warned)
  const userMeta = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { createdAt: true, warningCount: true },
  });
  const restricted = userMeta ? isRestrictedUser(userMeta) : false;

  // Rate limit: restricted accounts get 50% of normal rate
  const limiter = restricted ? limiters.postCreateRestricted : limiters.postCreate;
  const rl = await rateLimit(limiter, `post:${session.user.id}`);
  if (rl) return rl;

  const { content: rawContent, privacy = "PUBLIC", isAwayMessage = false, mediaUrl: rawMediaUrl, mediaType } = body;
  const content = sanitizeRichText(rawContent ?? "");
  const textLen = richTextLength(content);
  const mediaUrl = sanitizeUrl(rawMediaUrl);

  // Sanitize new array fields
  const mediaUrls = (body.mediaUrls ?? []).map((u) => sanitizeUrl(u)).filter((u): u is string => !!u);
  const gifUrls   = (body.gifUrls ?? []).map((u) => sanitizeUrl(u)).filter((u): u is string => !!u);
  const gifIds    = (body.gifIds ?? []).map((s) => s.trim()).filter(Boolean);

  const hasMedia = mediaUrls.length > 0 || gifUrls.length > 0 || !!mediaUrl;
  if (!textLen && !hasMedia) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }

  // Duplicate content detection: same message 3+ times in 1hr → auto-flag
  const dupKey = `dup:${session.user.id}:${contentHash(content)}`;
  const dupRl  = await rateLimit(limiters.duplicateContent, dupKey);
  if (dupRl) {
    // Auto-create a spam report and reject
    await prisma.report.create({
      data: {
        reporterId: session.user.id,
        reason:     "SPAM",
        detail:     `Auto-flagged: same content posted 3+ times in 1 hour. Content hash: ${contentHash(content)}`,
      },
    }).catch(() => {});
    return NextResponse.json(
      { error: "duplicate content detected. please vary your posts." },
      { status: 429 }
    );
  }

  const maxLen = isAwayMessage ? 140 : 512;
  if (textLen > maxLen) {
    return NextResponse.json(
      { error: `post cannot exceed ${maxLen} characters.` },
      { status: 400 }
    );
  }

  const post = await prisma.post.create({
    data: {
      content,
      authorId: session.user.id,
      privacy,
      isAwayMessage,
      mediaUrl: mediaUrl ?? null,
      mediaType: mediaType ?? null,
      mediaUrls,
      gifUrls,
      gifIds,
    },
    include: {
      author: { select: authorSelect },
      _count: { select: { replies: true, nudges: true } },
    },
  });

  if (isAwayMessage) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { awayMessage: content },
    });
  }

  const postOut = {
    ...post,
    nudgedByMe: false,
    replies: [] as [],
    author: {
      ...post.author,
      status: post.author.status === "INVISIBLE" ? "OFFLINE" : post.author.status,
    },
  };

  await pusherServer.trigger(CHANNELS.GLOBAL_FEED, EVENTS.NEW_POST, postOut);

  return NextResponse.json(postOut, { status: 201 });
  } catch (err) {
    return internalError(err, "POST /api/posts");
  }
}
