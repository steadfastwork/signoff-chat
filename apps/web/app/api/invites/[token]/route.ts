import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";

type Params = { params: { token: string } };

function validateInvite(invite: {
  isRevoked: boolean;
  expiresAt: Date;
  usesRemaining: number;
}) {
  if (invite.isRevoked)
    return { error: "this invite has been revoked.", status: 410 };
  if (invite.expiresAt < new Date())
    return { error: "this invite has expired.", status: 410 };
  if (invite.usesRemaining <= 0)
    return { error: "this invite has reached its maximum uses.", status: 410 };
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/invites/[token] — validate token (channel OR board)
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  const invite = await prisma.inviteLink.findUnique({
    where: { token: params.token },
    include: {
      channel: {
        select: { id: true, name: true, description: true, type: true, _count: { select: { members: true } } },
      },
      board: {
        select: { id: true, name: true, displayName: true, vibeStatement: true, type: true, memberCount: true },
      },
    },
  });

  if (!invite || (!invite.channel && !invite.board)) {
    return NextResponse.json({ error: "invite not found." }, { status: 404 });
  }

  const err = validateInvite(invite);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  if (invite.channel) {
    return NextResponse.json({
      kind: "channel",
      channelName: invite.channel.name,
      channelDescription: invite.channel.description,
      channelType: invite.channel.type,
      memberCount: invite.channel._count.members,
      expiresAt: invite.expiresAt,
      usesRemaining: invite.usesRemaining,
    });
  }

  const board = invite.board!;
  return NextResponse.json({
    kind: "board",
    boardName: board.name,
    boardDisplayName: board.displayName,
    boardVibeStatement: board.vibeStatement,
    boardType: board.type,
    memberCount: board.memberCount,
    expiresAt: invite.expiresAt,
    usesRemaining: invite.usesRemaining,
  });
}

// ---------------------------------------------------------------------------
// POST /api/invites/[token] — consume token
// We do NOT log which userId used which token. See §7.
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const invite = await prisma.inviteLink.findUnique({
    where: { token: params.token },
    include: { channel: true, board: true },
  });

  if (!invite || (!invite.channel && !invite.board)) {
    return NextResponse.json({ error: "invite not found." }, { status: 404 });
  }

  const err = validateInvite(invite);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  // ---- Channel invite ----
  if (invite.channel) {
    const channel = invite.channel;
    const existing = await prisma.channelMember.findUnique({
      where: { userId_channelId: { userId: session.user.id, channelId: channel.id } },
    });
    if (!existing) {
      const newUsesRemaining = invite.usesRemaining - 1;
      if (newUsesRemaining <= 0) {
        // Hard delete when fully used — no audit trail
        await prisma.$transaction([
          prisma.channelMember.create({
            data: { userId: session.user.id, channelId: channel.id },
          }),
          prisma.inviteLink.delete({ where: { token: params.token } }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.channelMember.create({
            data: { userId: session.user.id, channelId: channel.id },
          }),
          prisma.inviteLink.update({
            where: { token: params.token },
            data: { usesRemaining: { decrement: 1 } },
          }),
        ]);
      }
      await pusherServer.trigger(
        CHANNELS.channelRoom(channel.name),
        EVENTS.CHANNEL_MEMBER_JOINED,
        { userId: session.user.id, screenname: session.user.screenname }
      );
    }
    return NextResponse.json({ kind: "channel", channelName: channel.name });
  }

  // ---- Board invite ----
  const board = invite.board!;
  const existing = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: session.user.id, boardId: board.id } },
  });
  if (!existing) {
    const isFoundingMember = board.memberCount < 50;
    const newUsesRemaining = invite.usesRemaining - 1;
    if (newUsesRemaining <= 0) {
      await prisma.$transaction([
        prisma.boardMember.create({
          data: { userId: session.user.id, boardId: board.id, isFoundingMember },
        }),
        prisma.board.update({
          where: { id: board.id },
          data: { memberCount: { increment: 1 } },
        }),
        prisma.inviteLink.delete({ where: { token: params.token } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.boardMember.create({
          data: { userId: session.user.id, boardId: board.id, isFoundingMember },
        }),
        prisma.board.update({
          where: { id: board.id },
          data: { memberCount: { increment: 1 } },
        }),
        prisma.inviteLink.update({
          where: { token: params.token },
          data: { usesRemaining: { decrement: 1 } },
        }),
      ]);
    }
  }
  return NextResponse.json({ kind: "board", boardName: board.name });
}
