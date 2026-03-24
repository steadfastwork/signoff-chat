import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { stripHtml, sanitizeUrl } from "@/lib/sanitize";
import { internalError } from "@/lib/api-error";
import { getExcludedUserIds } from "@/lib/blocks";
import { notifyChannelMessage } from "@/lib/expoNotifications";

type Params = { params: { channelName: string } };

const authorSelect = {
  id: true,
  screenname: true,
  isGoldMember: true,
  status: true,
} as const;

const MAX_STORED = 500;

// ---------------------------------------------------------------------------
// GET /api/channels/[channelName]/messages — paginated history
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: Params) {
  try {
  const session = await getServerSession(authOptions);

  const channel = await prisma.channel.findUnique({
    where: { name: params.channelName },
  });
  if (!channel) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  // SECRET channels: members only
  if (channel.type === "SECRET") {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const membership = await prisma.channelMember.findUnique({
      where: {
        userId_channelId: { userId: session.user.id, channelId: channel.id },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "not found." }, { status: 404 });
    }
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = 50;

  // Filter out messages from blocked/muted users — server-side enforcement
  const excludedIds: string[] = session?.user?.id
    ? await getExcludedUserIds(session.user.id)
    : [];

  const messages = await prisma.channelMessage.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where: {
      channelId: channel.id,
      ...(excludedIds.length > 0 ? { authorId: { notIn: excludedIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: authorSelect },
      threads: { select: { id: true, messageCount: true }, take: 1 },
    },
  });

  const hasMore = messages.length > limit;
  const data = hasMore ? messages.slice(0, limit) : messages;

  return NextResponse.json({
    messages: data.map((m) => ({
      id: m.id,
      content: m.content,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      createdAt: m.createdAt,
      author: {
        ...m.author,
        status: m.author.status === "INVISIBLE" ? "OFFLINE" : m.author.status,
      },
      thread: m.threads[0] ?? null,
    })),
    nextCursor: hasMore ? data[data.length - 1].id : null,
  });
  } catch (err) {
    return internalError(err, `GET /api/channels/${params.channelName}/messages`);
  }
}

// ---------------------------------------------------------------------------
// POST /api/channels/[channelName]/messages — send a message
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: Params) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({
    where: { name: params.channelName },
  });
  if (!channel) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  // Membership check
  const membership = await prisma.channelMember.findUnique({
    where: {
      userId_channelId: { userId: session.user.id, channelId: channel.id },
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "you must be a member to post." },
      { status: 403 }
    );
  }

  // Slow mode enforcement
  if (channel.slowModeMinutes > 0 && membership.lastMessageAt) {
    const cooldownMs = channel.slowModeMinutes * 60 * 1000;
    const elapsed = Date.now() - membership.lastMessageAt.getTime();
    if (elapsed < cooldownMs) {
      const retryAfter = new Date(
        membership.lastMessageAt.getTime() + cooldownMs
      );
      return NextResponse.json(
        {
          error: "slow mode — please wait before posting again.",
          retryAfter: retryAfter.toISOString(),
          remainingMs: cooldownMs - elapsed,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((cooldownMs - elapsed) / 1000)),
          },
        }
      );
    }
  }

  // Rate limit: 30 messages/min per user (in addition to per-channel slow mode)
  const rl = await rateLimit(limiters.channelMessage, `ch-msg:${session.user.id}`);
  if (rl) return rl;

  const body = (await req.json()) as {
    content: string;
    mediaUrl?: string;
    mediaType?: "IMAGE" | "VIDEO" | "GIF";
  };

  const content = stripHtml(body.content ?? "");
  const mediaUrl = sanitizeUrl(body.mediaUrl);

  if (!content) {
    return NextResponse.json(
      { error: "content is required." },
      { status: 400 }
    );
  }
  if (content.length > 512) {
    return NextResponse.json(
      { error: "message cannot exceed 512 characters." },
      { status: 400 }
    );
  }

  const now = new Date();

  // Set expiry at send time. DB default covers the 30-day case but we must
  // explicitly set 90 days for gold members (DB default can't see the author).
  const expiresAt = new Date(now);
  if (session.user.isGoldMember) {
    expiresAt.setDate(expiresAt.getDate() + 90);
  } else {
    expiresAt.setDate(expiresAt.getDate() + 30);
  }

  const [message] = await prisma.$transaction([
    prisma.channelMessage.create({
      data: {
        content,
        mediaUrl: mediaUrl ?? null,
        mediaType: body.mediaType ?? null,
        authorId: session.user.id,
        channelId: channel.id,
        expiresAt,
      },
      include: {
        author: { select: authorSelect },
      },
    }),
    prisma.channelMember.update({
      where: {
        userId_channelId: { userId: session.user.id, channelId: channel.id },
      },
      data: { lastMessageAt: now },
    }),
  ]);

  // Trim to last MAX_STORED messages (keep newest)
  const total = await prisma.channelMessage.count({
    where: { channelId: channel.id },
  });
  if (total > MAX_STORED) {
    const oldest = await prisma.channelMessage.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: "asc" },
      take: total - MAX_STORED,
      select: { id: true },
    });
    await prisma.channelMessage.deleteMany({
      where: { id: { in: oldest.map((m) => m.id) } },
    });
  }

  const out = {
    id: message.id,
    content: message.content,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    createdAt: message.createdAt,
    author: {
      ...message.author,
      status:
        message.author.status === "INVISIBLE" ? "OFFLINE" : message.author.status,
    },
    thread: null,
  };

  await pusherServer.trigger(
    CHANNELS.channelRoom(channel.name),
    EVENTS.CHANNEL_MESSAGE,
    out
  );

  // Push to channel members who are not the sender — fire-and-forget
  // The client suppresses the notification if the user is on this channel screen.
  prisma.channelMember.findMany({
    where:  { channelId: channel.id, userId: { not: session.user.id } },
    select: { userId: true },
  }).then((members) => {
    for (const m of members) {
      notifyChannelMessage(
        m.userId,
        channel.name,
        session.user.screenname,
        content
      ).catch(() => {});
    }
  }).catch(() => {});

  return NextResponse.json(out, { status: 201 });
  } catch (err) {
    return internalError(err, `POST /api/channels/${params.channelName}/messages`);
  }
}
