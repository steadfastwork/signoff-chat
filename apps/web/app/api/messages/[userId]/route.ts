import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";

const senderSelect = {
  id: true,
  screenname: true,
  isGoldMember: true,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Direct messages live in ChannelMessage via a private DM channel.
  // Messages are fetched per-room; return empty array here as a stub.
  return NextResponse.json([]);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (session.user.id === params.userId) {
    return NextResponse.json({ error: "cannot message yourself." }, { status: 400 });
  }

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "message content is required." }, { status: 400 });
  }

  const receiver = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, screenname: true },
  });
  if (!receiver) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  // Find or create a private DM channel for this pair
  const dmName = [session.user.id, params.userId].sort().join("__dm__");

  let dmChannel = await prisma.channel.findUnique({ where: { name: dmName } });
  if (!dmChannel) {
    dmChannel = await prisma.channel.create({
      data: {
        name: dmName,
        isPrivate: true,
        creatorId: session.user.id,
        members: {
          create: [
            { userId: session.user.id },
            { userId: params.userId },
          ],
        },
      },
    });
  }

  // DM expiry: gold members get 90 days, others 30 days.
  const dmExpiresAt = new Date();
  dmExpiresAt.setDate(
    dmExpiresAt.getDate() + (session.user.isGoldMember ? 90 : 30)
  );

  const message = await prisma.channelMessage.create({
    data: {
      content: content.trim(),
      authorId: session.user.id,
      channelId: dmChannel.id,
      expiresAt: dmExpiresAt,
    },
    include: { author: { select: senderSelect } },
  });

  const pusherChannel = CHANNELS.dm(session.user.id, params.userId);
  await pusherServer.trigger(pusherChannel, EVENTS.NEW_DM, message);

  return NextResponse.json(message, { status: 201 });
}
