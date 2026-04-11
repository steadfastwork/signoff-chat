import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { channelName: string } };

// ---------------------------------------------------------------------------
// GET /api/channels/[channelName]/members
//
//   Default (no params)  — creator/admin only; returns full member list
//   ?away=true           — any member; returns members who are currently away
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
    // Verify requester is a member of the channel
    const membership = await prisma.channelMember.findUnique({
      where: { userId_channelId: { userId: session.user.id, channelId: channel.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "forbidden." }, { status: 403 });
    }

    const awayMembers = await prisma.channelMember.findMany({
      where: {
        channelId: channel.id,
        user: {
          status:      "AWAY",
          awayMessage: { not: null },
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id:             true,
            screenname:     true,
            isGoldMember:   true,
            awayMessage:    true,
            awayMessageSetAt: true,
            status:         true,
          },
        },
      },
      take: 5, // show at most 5 banners
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
  // Default — full member list; creator/admin only
  // ---------------------------------------------------------------------------

  const isCreator = channel.creatorId === session.user.id;
  const actor = isCreator ? null : await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { adminRole: true },
  });
  if (!isCreator && !actor?.adminRole) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  const members = await prisma.channelMember.findMany({
    where: { channelId: channel.id },
    select: {
      userId: true,
      joinedAt: true,
      mutedUntil: true,
      user: { select: { id: true, screenname: true, isGoldMember: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(
    members.map((m) => ({
      userId: m.userId,
      joinedAt: m.joinedAt,
      mutedUntil: m.mutedUntil ?? null,
      user: m.user,
    }))
  );
}
