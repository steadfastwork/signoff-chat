import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";

type Params = { params: { channelName: string } };

// ---------------------------------------------------------------------------
// POST /api/channels/[channelName]/invite-member
// Direct invite by screenname — members can add others directly
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: Params) {
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

  // Must be a member to invite others
  const membership = await prisma.channelMember.findUnique({
    where: {
      userId_channelId: { userId: session.user.id, channelId: channel.id },
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "you must be a member to invite others." },
      { status: 403 }
    );
  }

  const { screenname } = (await req.json()) as { screenname: string };
  if (!screenname?.trim()) {
    return NextResponse.json(
      { error: "screenname is required." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { screenname: { equals: screenname.trim(), mode: "insensitive" } },
    select: { id: true, screenname: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  const alreadyMember = await prisma.channelMember.findUnique({
    where: {
      userId_channelId: { userId: target.id, channelId: channel.id },
    },
  });
  if (alreadyMember) {
    return NextResponse.json(
      { error: `${target.screenname} is already in this channel.` },
      { status: 409 }
    );
  }

  await prisma.channelMember.create({
    data: { userId: target.id, channelId: channel.id },
  });

  await pusherServer.trigger(
    CHANNELS.channelRoom(channel.name),
    EVENTS.CHANNEL_MEMBER_JOINED,
    { userId: target.id, screenname: target.screenname }
  );

  return NextResponse.json({ ok: true, screenname: target.screenname });
}
