import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";

type Params = { params: { channelName: string; messageId: string } };

const authorSelect = {
  id: true,
  screenname: true,
  isGoldMember: true,
} as const;

// ---------------------------------------------------------------------------
// GET /api/channels/[channelName]/messages/[messageId]/thread
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);

  const channel = await prisma.channel.findUnique({
    where: { name: params.channelName },
  });
  if (!channel) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

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

  const message = await prisma.channelMessage.findUnique({
    where: { id: params.messageId },
    include: { author: { select: authorSelect } },
  });
  if (!message || message.channelId !== channel.id) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const thread = await prisma.channelThread.findFirst({
    where: { parentMessageId: params.messageId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: authorSelect } },
      },
    },
  });

  return NextResponse.json({
    parentMessage: {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      author: message.author,
    },
    thread: thread
      ? {
          id: thread.id,
          messageCount: thread.messageCount,
          messages: thread.messages,
        }
      : null,
  });
}

// ---------------------------------------------------------------------------
// POST /api/channels/[channelName]/messages/[messageId]/thread
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

  const membership = await prisma.channelMember.findUnique({
    where: {
      userId_channelId: { userId: session.user.id, channelId: channel.id },
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "you must be a member to reply." },
      { status: 403 }
    );
  }

  const message = await prisma.channelMessage.findUnique({
    where: { id: params.messageId },
  });
  if (!message || message.channelId !== channel.id) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const { content } = (await req.json()) as { content: string };
  if (!content?.trim()) {
    return NextResponse.json(
      { error: "content is required." },
      { status: 400 }
    );
  }
  if (content.length > 512) {
    return NextResponse.json(
      { error: "reply cannot exceed 512 characters." },
      { status: 400 }
    );
  }

  // Find or create the thread
  let thread = await prisma.channelThread.findFirst({
    where: { parentMessageId: params.messageId },
  });

  if (!thread) {
    thread = await prisma.channelThread.create({
      data: {
        parentMessageId: params.messageId,
        channelId: channel.id,
        messageCount: 0,
      },
    });
  }

  const [reply] = await prisma.$transaction([
    prisma.channelThreadMessage.create({
      data: {
        content: content.trim(),
        authorId: session.user.id,
        threadId: thread.id,
      },
      include: { author: { select: authorSelect } },
    }),
    prisma.channelThread.update({
      where: { id: thread.id },
      data: { messageCount: { increment: 1 } },
    }),
  ]);

  const out = {
    threadId: thread.id,
    messageId: params.messageId,
    reply: {
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt,
      author: reply.author,
    },
  };

  await pusherServer.trigger(
    CHANNELS.channelRoom(channel.name),
    EVENTS.CHANNEL_THREAD_REPLY,
    out
  );

  return NextResponse.json(out, { status: 201 });
}
