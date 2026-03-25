import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { channelName: string } };

// ---------------------------------------------------------------------------
// POST /api/channels/[channelName]/favorite — toggle favorite
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({ where: { name: params.channelName } });
  if (!channel) return NextResponse.json({ error: "not found." }, { status: 404 });

  const existing = await prisma.favoriteChannel.findUnique({
    where: { userId_channelId: { userId: session.user.id, channelId: channel.id } },
  });

  if (existing) {
    await prisma.favoriteChannel.delete({ where: { id: existing.id } });
    return NextResponse.json({ favoriteByMe: false });
  } else {
    await prisma.favoriteChannel.create({
      data: { userId: session.user.id, channelId: channel.id },
    });
    return NextResponse.json({ favoriteByMe: true });
  }
}
