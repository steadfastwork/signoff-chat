import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";

type Params = { params: { channelName: string } };

// ---------------------------------------------------------------------------
// POST /api/channels/[channelName]/join — join a PUBLIC channel
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({
    where: { name: params.channelName },
    include: { _count: { select: { members: true } } },
  });

  if (!channel) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  if (channel.type !== "PUBLIC") {
    return NextResponse.json(
      { error: "this channel requires an invite to join." },
      { status: 403 }
    );
  }

  if (channel.memberCap && channel._count.members >= channel.memberCap) {
    return NextResponse.json(
      { error: "channel is full." },
      { status: 409 }
    );
  }

  const existing = await prisma.channelMember.findUnique({
    where: {
      userId_channelId: { userId: session.user.id, channelId: channel.id },
    },
  });

  if (existing) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  await prisma.channelMember.create({
    data: { userId: session.user.id, channelId: channel.id },
  });

  await pusherServer.trigger(
    CHANNELS.channelRoom(channel.name),
    EVENTS.CHANNEL_MEMBER_JOINED,
    {
      userId: session.user.id,
      screenname: session.user.screenname,
    }
  );

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// DELETE /api/channels/[channelName]/join — leave channel
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
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

  await prisma.channelMember.deleteMany({
    where: { userId: session.user.id, channelId: channel.id },
  });

  await pusherServer.trigger(
    CHANNELS.channelRoom(channel.name),
    EVENTS.CHANNEL_MEMBER_LEFT,
    {
      userId: session.user.id,
      screenname: session.user.screenname,
    }
  );

  return NextResponse.json({ ok: true });
}
