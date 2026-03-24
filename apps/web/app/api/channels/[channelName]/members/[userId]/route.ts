import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { channelName: string; userId: string } };

// ---------------------------------------------------------------------------
// Channel founder/creator member management.
// Only the channel creator can remove members or issue bans.
// Platform staff (isAdmin) can also remove/ban.
// ---------------------------------------------------------------------------

async function getActorRole(
  actorId: string,
  channel: { creatorId: string }
): Promise<"creator" | "admin" | null> {
  if (actorId === channel.creatorId) return "creator";
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isAdmin: true },
  });
  if (actor?.isAdmin) return "admin";
  return null;
}

// ---------------------------------------------------------------------------
// DELETE /api/channels/[channelName]/members/[userId]
// Remove a member from the channel. Optionally ban (prevent rejoin).
// Body: { ban?: boolean }
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({
    where: { name: params.channelName },
    select: { id: true, creatorId: true },
  });
  if (!channel) {
    return NextResponse.json({ error: "channel not found." }, { status: 404 });
  }

  const role = await getActorRole(session.user.id, channel);
  if (!role) {
    return NextResponse.json({ error: "forbidden — creator or admin only." }, { status: 403 });
  }

  if (params.userId === channel.creatorId) {
    return NextResponse.json({ error: "cannot remove the channel creator." }, { status: 400 });
  }

  let ban = false;
  try {
    const body = await req.json();
    ban = body?.ban === true;
  } catch {}

  // Remove member
  await prisma.channelMember.deleteMany({
    where: { channelId: channel.id, userId: params.userId },
  });

  // Optionally ban (prevent rejoin via invite)
  if (ban) {
    await prisma.channelBan.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: params.userId } },
      create: { channelId: channel.id, userId: params.userId },
      update: {},
    });
  }

  return NextResponse.json({ removed: true, banned: ban });
}

// ---------------------------------------------------------------------------
// POST /api/channels/[channelName]/members/[userId]
// Ban a user from the channel (without removing if already out).
// Body: { ban: true } — explicit, prevents accidental bans
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channel = await prisma.channel.findUnique({
    where: { name: params.channelName },
    select: { id: true, creatorId: true },
  });
  if (!channel) {
    return NextResponse.json({ error: "channel not found." }, { status: 404 });
  }

  const role = await getActorRole(session.user.id, channel);
  if (!role) {
    return NextResponse.json({ error: "forbidden — creator or admin only." }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  if (body.ban !== true) {
    return NextResponse.json({ error: "set ban: true to confirm." }, { status: 400 });
  }

  if (params.userId === channel.creatorId) {
    return NextResponse.json({ error: "cannot ban the channel creator." }, { status: 400 });
  }

  // Remove from channel + add to ban list
  await Promise.all([
    prisma.channelMember.deleteMany({
      where: { channelId: channel.id, userId: params.userId },
    }),
    prisma.channelBan.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: params.userId } },
      create: { channelId: channel.id, userId: params.userId },
      update: {},
    }),
  ]);

  return NextResponse.json({ banned: true });
}
