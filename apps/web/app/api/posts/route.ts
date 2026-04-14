import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PostType, FeedVisibility } from "@prisma/client";
import { authOptions, deriveAvatarColor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { rateLimit, limiters, isRestrictedUser } from "@/lib/ratelimit";
import { stripHtml, sanitizeRichText, richTextLength, sanitizeUrl } from "@/lib/sanitize";
import { internalError } from "@/lib/api-error";
import { getExcludedUserIds } from "@/lib/blocks";

// UploadThing CDN hostnames accepted for imageUrl
const UPLOADTHING_HOSTS = new Set(["utfs.io", "uploadthing.com"]);

function isUploadthingUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === "https:" || protocol === "http:") && UPLOADTHING_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

/** Strip leading #, lowercase, trim, enforce per-tag max length, deduplicate. */
function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= 5) break;
    const t = String(item).replace(/^#+/, "").toLowerCase().trim().slice(0, 30);
    if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

const VIS_MAP: Record<string, FeedVisibility> = {
  EVERYONE: "PUBLIC",
  BUDDIES:  "BUDDIES",
  PRIVATE:  "PRIVATE",
};

// ---------------------------------------------------------------------------
// Shared post select — reused by GET and POST responses
// ---------------------------------------------------------------------------

function buildPostSelect(viewerId: string) {
  return {
    id: true,
    setAt: true,
    content: true,
    visibility: true,
    nudgeCount: true,
    replyCount: true,
    echoCount: true,
    editedAt: true,
    postType: true,
    bodyText: true,
    quoteText: true,
    quoteAttrib: true,
    imageUrl: true,
    imageCaption: true,
    tags: true,
    echoOfId: true,
    echoOf: {
      select: {
        id: true,
        content: true,
        postType: true,
        bodyText: true,
        quoteText: true,
        quoteAttrib: true,
        imageUrl: true,
        imageCaption: true,
        tags: true,
        setAt: true,
        user: {
          select: {
            id: true,
            screenname: true,
            isGoldMember: true,
            avatarUrl: true,
          },
        },
      },
    },
    user: {
      select: {
        id: true,
        screenname: true,
        isGoldMember: true,
        avatarUrl: true,
        status: true,
        currently: true,
      },
    },
    nudges: {
      where: { userId: viewerId },
      select: { id: true },
    },
  } as const;
}

// ---------------------------------------------------------------------------
// GET /api/posts — microblog feed, cursor-paginated
//
// Query params:
//   type?   — filter by PostType
//   tag?    — filter by hashtag (# optional)
//   userId? — profile view (shows that user's posts)
//   cursor? — pagination cursor (post id)
//   limit?  — default 20, max 50
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const typeParam    = searchParams.get("type") as PostType | null;
    const tagParam     = searchParams.get("tag")?.replace(/^#/, "").toLowerCase() ?? null;
    const filterUserId = searchParams.get("userId") ?? null;
    const cursor       = searchParams.get("cursor") ?? null;
    const rawLimit     = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit        = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 50);

    const excludedIds = await getExcludedUserIds(session.user.id);

    // ── Visibility filter ────────────────────────────────────────────────────
    let userFilter: object;

    if (filterUserId) {
      // Profile view
      if (filterUserId === session.user.id) {
        // Own profile: all visibility levels
        userFilter = { userId: filterUserId };
      } else if (excludedIds.includes(filterUserId)) {
        // Blocked/muted user — return nothing
        return NextResponse.json({ posts: [], nextCursor: null });
      } else {
        const isBuddy = !!(await prisma.buddyRelation.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { requesterId: session.user.id, addresseeId: filterUserId },
              { requesterId: filterUserId,    addresseeId: session.user.id },
            ],
          },
          select: { id: true },
        }));
        userFilter = {
          userId: filterUserId,
          visibility: isBuddy ? { in: ["PUBLIC", "BUDDIES"] as const } : "PUBLIC",
        };
      }
    } else {
      // Feed view: own posts + accepted buddies' non-private posts
      const relations = await prisma.buddyRelation.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: session.user.id }, { addresseeId: session.user.id }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const buddyIds = relations.map((r) =>
        r.requesterId === session.user.id ? r.addresseeId : r.requesterId
      );
      userFilter = {
        OR: [
          { userId: session.user.id },
          {
            userId: { in: buddyIds },
            visibility: { in: ["PUBLIC", "BUDDIES"] as const },
          },
        ],
      };
    }

    const posts = await prisma.awayMessageHistory.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        userId: { notIn: excludedIds },
        ...(typeParam ? { postType: typeParam } : {}),
        ...(tagParam  ? { tags: { has: tagParam } } : {}),
        ...userFilter,
      },
      orderBy: { setAt: "desc" },
      select: buildPostSelect(session.user.id),
    });

    const hasMore = posts.length > limit;
    const data    = hasMore ? posts.slice(0, limit) : posts;

    const result = data.map((p) => ({
      ...p,
      hasNudged: p.nudges.length > 0,
      nudges: undefined,
      user: {
        ...p.user,
        avatarColor: deriveAvatarColor(p.user.id),
        status: p.user.status === "INVISIBLE" ? "OFFLINE" : p.user.status,
      },
    }));

    return NextResponse.json({
      posts:      result,
      nextCursor: hasMore ? data[data.length - 1].id : null,
    });
  } catch (err) {
    return internalError(err, "GET /api/posts");
  }
}

// ---------------------------------------------------------------------------
// POST /api/posts — create a microblog post (AwayMessageHistory)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Rate limiting (same limits as old post creation)
    const userMeta = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { createdAt: true, warningCount: true },
    });
    const restricted = userMeta ? isRestrictedUser(userMeta) : false;
    const rl = await rateLimit(
      restricted ? limiters.postCreateRestricted : limiters.postCreate,
      `post:${session.user.id}`
    );
    if (rl) return rl;

    const body = await req.json() as {
      postType?:     string;
      awayMessage?:  string;
      visibility?:   string;
      bodyText?:     string;
      quoteText?:    string;
      quoteAttrib?:  string;
      imageUrl?:     string;
      imageCaption?: string;
      tags?:         unknown;
    };

    // ── Validate postType ────────────────────────────────────────────────────
    const postType = body.postType as PostType | undefined;
    if (!postType || !Object.values(PostType).includes(postType)) {
      return NextResponse.json({ error: "postType is required." }, { status: 400 });
    }

    const visibility: FeedVisibility = VIS_MAP[body.visibility ?? "EVERYONE"] ?? "PUBLIC";
    const tags = normalizeTags(body.tags);

    // ── Type-specific validation and sanitization ────────────────────────────
    let content      = "";   // AWAY posts use this; other types leave it empty
    let bodyText:     string | null = null;
    let quoteText:    string | null = null;
    let quoteAttrib:  string | null = null;
    let imageUrl:     string | null = null;
    let imageCaption: string | null = null;

    if (postType === "AWAY") {
      const cleaned = stripHtml(body.awayMessage ?? "").trim();
      if (!cleaned) {
        return NextResponse.json({ error: "awayMessage is required for AWAY posts." }, { status: 400 });
      }
      if (cleaned.length > 140) {
        return NextResponse.json({ error: "awayMessage cannot exceed 140 characters." }, { status: 400 });
      }
      content = cleaned;

    } else if (postType === "THOUGHT") {
      // Long-form: sanitize rich text, measure visible length
      const cleaned = sanitizeRichText(body.bodyText ?? "");
      const len = richTextLength(cleaned);
      if (!len) {
        return NextResponse.json({ error: "bodyText is required for THOUGHT posts." }, { status: 400 });
      }
      if (len > 5000) {
        return NextResponse.json({ error: "bodyText cannot exceed 5000 characters." }, { status: 400 });
      }
      bodyText = cleaned;

    } else if (postType === "QUOTE") {
      const cleaned = stripHtml(body.quoteText ?? "").trim();
      if (!cleaned) {
        return NextResponse.json({ error: "quoteText is required for QUOTE posts." }, { status: 400 });
      }
      if (cleaned.length > 500) {
        return NextResponse.json({ error: "quoteText cannot exceed 500 characters." }, { status: 400 });
      }
      quoteText = cleaned;
      if (body.quoteAttrib) {
        const attr = stripHtml(body.quoteAttrib).trim().slice(0, 140);
        quoteAttrib = attr || null;
      }

    } else if (postType === "PHOTO") {
      const sanitized = sanitizeUrl(body.imageUrl);
      if (!sanitized) {
        return NextResponse.json({ error: "imageUrl is required for PHOTO posts." }, { status: 400 });
      }
      if (!isUploadthingUrl(sanitized)) {
        return NextResponse.json({ error: "imageUrl must be a valid UploadThing URL." }, { status: 400 });
      }
      imageUrl = sanitized;
      if (body.imageCaption) {
        const cap = stripHtml(body.imageCaption).trim().slice(0, 200);
        imageCaption = cap || null;
      }
    }

    // ── Create post + tags atomically ────────────────────────────────────────
    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.awayMessageHistory.create({
        data: {
          content,
          userId:   session.user.id,
          visibility,
          postType,
          bodyText,
          quoteText,
          quoteAttrib,
          imageUrl,
          imageCaption,
          tags,
        },
        select: buildPostSelect(session.user.id),
      });

      if (tags.length > 0) {
        await tx.postTag.createMany({
          data:            tags.map((t) => ({ tag: t, postId: created.id })),
          skipDuplicates:  true,
        });
      }

      // AWAY posts: keep the User.awayMessage field in sync (backwards compat)
      if (postType === "AWAY") {
        await tx.user.update({
          where: { id: session.user.id },
          data:  { awayMessage: content, awayMessageSetAt: new Date() },
        });
      }

      return created;
    });

    // ── Notify buddies via Soketi (fire-and-forget) ──────────────────────────
    const relations = await prisma.buddyRelation.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: session.user.id }, { addresseeId: session.user.id }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const buddyIds = relations.map((r) =>
      r.requesterId === session.user.id ? r.addresseeId : r.requesterId
    );

    const postOut = {
      ...post,
      hasNudged: false,
      nudges:    undefined,
      user: {
        ...post.user,
        avatarColor: deriveAvatarColor(post.user.id),
        status: post.user.status === "INVISIBLE" ? "OFFLINE" : post.user.status,
      },
    };

    if (buddyIds.length > 0) {
      // Pusher supports up to 100 channels per trigger call
      const BATCH = 100;
      const triggers: Promise<unknown>[] = [];
      for (let i = 0; i < buddyIds.length; i += BATCH) {
        const channels = buddyIds.slice(i, i + BATCH).map((id) => CHANNELS.privateUser(id));
        triggers.push(pusherServer.trigger(channels, EVENTS.NEW_POST, postOut).catch(() => {}));
      }
      await Promise.all(triggers);
    }

    return NextResponse.json(postOut, { status: 201 });
  } catch (err) {
    return internalError(err, "POST /api/posts");
  }
}
