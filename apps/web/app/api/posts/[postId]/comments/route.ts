import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";

const authorSelect = {
  id: true,
  screenname: true,
  isGoldMember: true,
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const replies = await prisma.reply.findMany({
    where: { postId: params.postId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: authorSelect } },
  });
  return NextResponse.json(replies);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }
  if (content.length > 256) {
    return NextResponse.json({ error: "reply cannot exceed 256 characters." }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: params.postId } });
  if (!post) {
    return NextResponse.json({ error: "post not found." }, { status: 404 });
  }

  const reply = await prisma.reply.create({
    data: {
      content: content.trim(),
      authorId: session.user.id,
      postId: params.postId,
    },
    include: { author: { select: authorSelect } },
  });

  await pusherServer.trigger(
    `${CHANNELS.GLOBAL_FEED}-${params.postId}`,
    EVENTS.NEW_COMMENT,
    reply
  );

  return NextResponse.json(reply, { status: 201 });
}
