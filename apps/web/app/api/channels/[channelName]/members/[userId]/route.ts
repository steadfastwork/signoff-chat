import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { channelName: string; userId: string } };

async function getActorRole(channelId: string, actorId: string) {
  const [channel, actor] = await Promise.all([
    prisma.channel.findUnique({ where: { id: channelId }, select: { creatorId: true } }),
    prisma.user.findUnique({ where: { id: actorId }, select: { adminRole: true } }),
  ]);
  const isCreator = channel?.creatorId === actorId;
  const isAdmin = actor?.adminRole != null;
  return { isCreator, isAdmin, allowed: isCreator || isAdmin };
}

// ---------------------------------------------------------------------------
// DELETE /api/channels/[channelName]/members/[userId] — kick or ban
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({ where: { name: params.channelName } });
  if (!channel) return NextResponse.json({ error: "not found." }, { status: 404 });

  const { allowed } = await getActorRole(channel.id, session.user.id);
  if (!allowed) return NextResponse.json({ error: "forbidden." }, { status: 403 });

  if (params.userId === channel.creatorId) {
    return NextResponse.json({ error: "cannot remove the channel creator." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const ban = body.ban === true;

  await prisma.channelMember.deleteMany({
    where: { userId: params.userId, channelId: channel.id },
  });

  if (ban) {
    await prisma.channelBan.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: params.userId } },
      update: {},
      create: { channelId: channel.id, userId: params.userId },
    });
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// PATCH /api/channels/[channelName]/members/[userId] — mute or unmute
// Body: { mutedUntil: ISO string | null }
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({ where: { name: params.channelName } });
  if (!channel) return NextResponse.json({ error: "not found." }, { status: 404 });

  const { allowed } = await getActorRole(channel.id, session.user.id);
  if (!allowed) return NextResponse.json({ error: "forbidden." }, { status: 403 });

  if (params.userId === channel.creatorId) {
    return NextResponse.json({ error: "cannot mute the channel creator." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const mutedUntil = body.mutedUntil ? new Date(body.mutedUntil) : null;

  const updated = await prisma.channelMember.updateMany({
    where: { userId: params.userId, channelId: channel.id },
    data: { mutedUntil },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "member not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, mutedUntil: mutedUntil?.toISOString() ?? null });
}
