import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { rateLimit, limiters } from "@/lib/ratelimit";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

// ---------------------------------------------------------------------------
// POST /api/boards/invites — generate an invite link for a board
// No audit trail: we do not record who generated the link. See §7.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { boardName, maxUses = 10 } = (await req.json()) as {
    boardName: string;
    maxUses?: number;
  };
  if (!boardName) {
    return NextResponse.json({ error: "boardName is required." }, { status: 400 });
  }

  const usesRemaining = Math.min(Math.max(1, maxUses), 50);

  const board = await prisma.board.findUnique({ where: { name: boardName } });
  if (!board) {
    return NextResponse.json({ error: "board not found." }, { status: 404 });
  }
  if (board.type === "PUBLIC") {
    return NextResponse.json(
      { error: "public boards don't need invite links." },
      { status: 400 }
    );
  }

  const rl = await rateLimit(limiters.invite, `invite:${session.user.id}:${board.id}`);
  if (rl) return rl;

  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: session.user.id, boardId: board.id } },
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
    data: { token, boardId: board.id, expiresAt, usesRemaining },
  });

  return NextResponse.json({
    token: invite.token,
    expiresAt: invite.expiresAt,
    usesRemaining: invite.usesRemaining,
    link: `https://signoff.chat/invite/${invite.token}`,
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/boards/invites — revoke an invite link
// Any board member can revoke (no ownership tracking). See §7.
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
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
    include: { board: { select: { creatorId: true } } },
  });
  if (!invite) {
    return NextResponse.json({ error: "invite not found." }, { status: 404 });
  }

  // Only the board creator can revoke (no creator tracking on invite itself)
  if (invite.board?.creatorId !== session.user.id) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  await prisma.inviteLink.update({ where: { token }, data: { isRevoked: true } });
  return NextResponse.json({ ok: true });
}
