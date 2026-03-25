import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { channelName: string } };

// ---------------------------------------------------------------------------
// GET /api/channels/[channelName]/members — creator/admin only
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
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
