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
      slowModeMinutes: channel.slowModeMinutes,
      memberCount: channel._count.members,
      isMember: false,
    });
  }

  // Full response for members or PUBLIC channels
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
    slowModeMinutes: channel.slowModeMinutes,
    memberCap: channel.memberCap,
    creatorId: channel.creatorId,
    memberCount: channel._count.members,
    isMember,
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
