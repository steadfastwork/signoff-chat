import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { rateLimit, limiters } from "@/lib/ratelimit";

// ---------------------------------------------------------------------------
// POST /api/channels/invites — generate an invite link
// No audit trail: we do not record who generated the link. See §7.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { channelName, maxUses = 10 } = (await req.json()) as {
    channelName: string;
    maxUses?: number;
  };

  if (!channelName) {
    return NextResponse.json({ error: "channelName is required." }, { status: 400 });
  }

  const usesRemaining = Math.min(Math.max(1, maxUses), 50);

  const channel = await prisma.channel.findUnique({ where: { name: channelName } });
  if (!channel) {
    return NextResponse.json({ error: "channel not found." }, { status: 404 });
  }
  if (channel.type === "PUBLIC") {
    return NextResponse.json(
      { error: "public channels don't need invite links." },
      { status: 400 }
    );
  }

  const rl = await rateLimit(limiters.invite, `invite:${session.user.id}:${channel.id}`);
  if (rl) return rl;

  const membership = await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId: session.user.id, channelId: channel.id } },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "you must be a member to generate an invite." },
      { status: 403 }
    );
  }

  const token = randomBytes(6).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const invite = await prisma.inviteLink.create({
    data: { token, channelId: channel.id, expiresAt, usesRemaining },
  });

  return NextResponse.json({
    token: invite.token,
    expiresAt: invite.expiresAt,
    usesRemaining: invite.usesRemaining,
    link: `https://signoff.chat/invite/${invite.token}`,
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/channels/invites — revoke an invite link
// Only the channel creator can revoke (no ownership tracking on invite). See §7.
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { token } = (await req.json()) as { token: string };
  if (!token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  const invite = await prisma.inviteLink.findUnique({
    where: { token },
    include: { channel: { select: { creatorId: true } } },
  });
  if (!invite) {
    return NextResponse.json({ error: "invite not found." }, { status: 404 });
  }

  if (invite.channel?.creatorId !== session.user.id) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  await prisma.inviteLink.update({ where: { token }, data: { isRevoked: true } });
  return NextResponse.json({ ok: true });
}
