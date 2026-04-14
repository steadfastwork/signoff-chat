import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { channelName: string } };

// ---------------------------------------------------------------------------
// GET /api/channels/[channelName]/members
//
//   Default (no params)  — any member (PUBLIC channels: any authed user)
//                          Returns full member list with online status.
//   ?away=true           — any member; returns members who are currently away.
//                          Used by the AwayBanner component.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const awayOnly = req.nextUrl.searchParams.get("away") === "true";

  const channel = await prisma.channel.findUnique({ where: { name: params.channelName } });
  if (!channel) return NextResponse.json({ error: "not found." }, { status: 404 });

  // ---------------------------------------------------------------------------
  // ?away=true — lightweight away-status check, accessible to any member
  // ---------------------------------------------------------------------------

  if (awayOnly) {
    const membership = await prisma.channelMember.findUnique({
      where: { userId_channelId: { userId: session.user.id, channelId: channel.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "forbidden." }, { status: 403 });
    }

    const awayMembers = await prisma.channelMember.findMany({
      where: {
        channelId: channel.id,
        user: { status: "AWAY", awayMessage: { not: null } },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            screenname: true,
            isGoldMember: true,
            awayMessage: true,
            awayMessageSetAt: true,
            status: true,
          },
        },
      },
      take: 5,
    });

    return NextResponse.json(
      awayMembers
        .filter((m) => m.user.awayMessage)
        .map((m) => ({
          userId:      m.user.id,
          screenname:  m.user.screenname,
          isGold:      m.user.isGoldMember,
          awayMessage: m.user.awayMessage,
          setAt:       m.user.awayMessageSetAt ?? null,
        }))
    );
  }

  // ---------------------------------------------------------------------------
  // Full member list
  //
  // PUBLIC channels: any authenticated user may view the member list.
  // Non-public channels: requester must be a member, creator, or admin.
  // ---------------------------------------------------------------------------

  if (channel.type !== "PUBLIC") {
    const membership = await prisma.channelMember.findUnique({
      where: { userId_channelId: { userId: session.user.id, channelId: channel.id } },
    });
    if (!membership) {
      const isCreator = channel.creatorId === session.user.id;
      const actor = isCreator ? null : await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { adminRole: true },
      });
      if (!isCreator && !actor?.adminRole) {
        return NextResponse.json({ error: "forbidden." }, { status: 403 });
      }
    }
  }

  const members = await prisma.channelMember.findMany({
    where: { channelId: channel.id },
    select: {
      userId: true,
      joinedAt: true,
      mutedUntil: true,
      user: {
        select: {
          id: true,
          screenname: true,
          isGoldMember: true,
          status: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(
    members.map((m) => ({
      userId:    m.userId,
      joinedAt:  m.joinedAt,
      mutedUntil: m.mutedUntil ?? null,
      user: {
        id:           m.user.id,
        screenname:   m.user.screenname,
        isGoldMember: m.user.isGoldMember,
        status:       m.user.status === "INVISIBLE" ? "OFFLINE" : m.user.status,
      },
    }))
  );
}
