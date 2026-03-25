import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { channelName: string } };

const authorSelect = {
  id: true,
  screenname: true,
  isGoldMember: true,
  status: true,
} as const;

// ---------------------------------------------------------------------------
// GET /api/channels/[channelName]
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);

  const channel = await prisma.channel.findUnique({
    where: { name: params.channelName },
    include: { _count: { select: { members: true } } },
  });

  if (!channel) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const membership = session?.user?.id
    ? await prisma.channelMember.findUnique({
        where: {
          userId_channelId: {
            userId: session.user.id,
            channelId: channel.id,
          },
        },
      })
    : null;

  const isMember = !!membership;

  // SECRET: 404 to non-members
  if (channel.type === "SECRET" && !isMember) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  // INVITE_ONLY non-member: return basic info only (no messages/members)
  if (channel.type === "INVITE_ONLY" && !isMember) {
    return NextResponse.json({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      type: channel.type,
      tags: channel.tags,
      slowModeMinutes: channel.slowModeMinutes,
      memberCount: channel._count.members,
      isMember: false,
    });
  }

  // Full response for members or PUBLIC channels
  const isCreator = session?.user?.id === channel.creatorId;
  const isAdmin = !isCreator && session?.user?.id
    ? !!(await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } }))?.isAdmin
    : false;
  const canManage = isCreator || isAdmin;

  const favoriteByMe = session?.user?.id
    ? await prisma.favoriteChannel.findUnique({
        where: { userId_channelId: { userId: session.user.id, channelId: channel.id } },
      })
    : null;

  const [messages, members] = await Promise.all([
    prisma.channelMessage.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: {
        author: { select: authorSelect },
        threads: { select: { id: true, messageCount: true }, take: 1 },
      },
    }),
    prisma.channelMember.findMany({
      where: { channelId: channel.id },
      include: { user: { select: authorSelect } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    id: channel.id,
    name: channel.name,
    description: channel.description,
    type: channel.type,
    tags: channel.tags,
    slowModeMinutes: channel.slowModeMinutes,
    memberCap: channel.memberCap,
    creatorId: channel.creatorId,
    canManage,
    memberCount: channel._count.members,
    isMember,
    favoriteByMe: !!favoriteByMe,
    myMembership: membership
      ? {
          joinedAt: membership.joinedAt,
          lastMessageAt: membership.lastMessageAt,
        }
      : null,
    messages: messages.map((m) => ({
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
    members: members.map((m) => ({
      userId: m.userId,
      joinedAt: m.joinedAt,
      user: {
        ...m.user,
        status: m.user.status === "INVISIBLE" ? "OFFLINE" : m.user.status,
      },
    })),
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/channels/[channelName] — update channel settings (creator only)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({ where: { name: params.channelName } });
  if (!channel) return NextResponse.json({ error: "not found." }, { status: 404 });

  const isCreator = channel.creatorId === session.user.id;
  const actor = isCreator ? null : await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!isCreator && !actor?.isAdmin) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  const body = (await req.json()) as {
    description?: string;
    type?: "PUBLIC" | "INVITE_ONLY" | "SECRET";
    slowModeMinutes?: number;
    memberCap?: number | null;
    tags?: string[];
  };

  const data: Record<string, unknown> = {};

  if (body.description !== undefined) {
    data.description = body.description.trim() || null;
  }
  if (body.type !== undefined) {
    if (!["PUBLIC", "INVITE_ONLY", "SECRET"].includes(body.type)) {
      return NextResponse.json({ error: "invalid type." }, { status: 400 });
    }
    data.type = body.type;
  }
  if (body.slowModeMinutes !== undefined) {
    const sm = Number(body.slowModeMinutes);
    if (sm < 0 || sm > 60) {
      return NextResponse.json({ error: "slowModeMinutes must be 0–60." }, { status: 400 });
    }
    data.slowModeMinutes = sm;
  }
  if (body.memberCap !== undefined) {
    data.memberCap = body.memberCap != null ? Math.max(2, Math.min(body.memberCap, 500)) : null;
  }
  if (body.tags !== undefined) {
    data.tags = body.tags
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
      .filter(Boolean)
      .slice(0, 5);
  }

  const updated = await prisma.channel.update({ where: { id: channel.id }, data });
  return NextResponse.json(updated);
}
