import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

type Params = { params: { boardName: string; userId: string } };

// ---------------------------------------------------------------------------
// PATCH /api/boards/[boardName]/members/[userId] — toggle moderator (creator only)
// Body: { isModerator: boolean }
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const board = await prisma.board.findUnique({
    where: { name: params.boardName },
    select: { id: true, creatorId: true },
  });
  if (!board) {
    return NextResponse.json({ error: "board not found." }, { status: 404 });
  }

  if (session.user.id !== board.creatorId) {
    return NextResponse.json({ error: "forbidden — creator only." }, { status: 403 });
  }

  if (params.userId === board.creatorId) {
    return NextResponse.json({ error: "creator cannot be assigned as moderator." }, { status: 400 });
  }

  const body = (await req.json()) as { isModerator: boolean };

  const updated = await prisma.boardMember.updateMany({
    where: { boardId: board.id, userId: params.userId },
    data: { isModerator: !!body.isModerator },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "user is not a member of this board." }, { status: 404 });
  }

  return NextResponse.json({ isModerator: !!body.isModerator });
}

async function getActorRole(
  actorId: string,
  board: { creatorId: string }
): Promise<"creator" | "admin" | null> {
  if (actorId === board.creatorId) return "creator";
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { adminRole: true },
  });
  if (actor?.adminRole != null) return "admin";
  return null;
}

// ---------------------------------------------------------------------------
// DELETE /api/boards/[boardName]/members/[userId]
// Remove a member from the board. Optionally ban (prevent rejoin).
// Body: { ban?: boolean }
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const board = await prisma.board.findUnique({
    where: { name: params.boardName },
    select: { id: true, creatorId: true },
  });
  if (!board) {
    return NextResponse.json({ error: "board not found." }, { status: 404 });
  }

  const role = await getActorRole(session.user.id, board);
  if (!role) {
    return NextResponse.json({ error: "forbidden — founder or admin only." }, { status: 403 });
  }

  if (params.userId === board.creatorId) {
    return NextResponse.json({ error: "cannot remove the board founder." }, { status: 400 });
  }

  let ban = false;
  try {
    const body = await req.json();
    ban = body?.ban === true;
  } catch {}

  await prisma.boardMember.deleteMany({
    where: { boardId: board.id, userId: params.userId },
  });

  if (ban) {
    await prisma.boardBan.upsert({
      where: { boardId_userId: { boardId: board.id, userId: params.userId } },
      create: { boardId: board.id, userId: params.userId },
      update: {},
    });
  }

  // Decrement memberCount
  await prisma.board.update({
    where: { id: board.id },
    data: { memberCount: { decrement: 1 } },
  });

  return NextResponse.json({ removed: true, banned: ban });
}

// ---------------------------------------------------------------------------
// POST /api/boards/[boardName]/members/[userId]
// Ban a user from the board.
// Body: { ban: true }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: Params) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const board = await prisma.board.findUnique({
    where: { name: params.boardName },
    select: { id: true, creatorId: true },
  });
  if (!board) {
    return NextResponse.json({ error: "board not found." }, { status: 404 });
  }

  const role = await getActorRole(session.user.id, board);
  if (!role) {
    return NextResponse.json({ error: "forbidden — founder or admin only." }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  if (body.ban !== true) {
    return NextResponse.json({ error: "set ban: true to confirm." }, { status: 400 });
  }

  if (params.userId === board.creatorId) {
    return NextResponse.json({ error: "cannot ban the board founder." }, { status: 400 });
  }

  await Promise.all([
    prisma.boardMember.deleteMany({
      where: { boardId: board.id, userId: params.userId },
    }),
    prisma.boardBan.upsert({
      where: { boardId_userId: { boardId: board.id, userId: params.userId } },
      create: { boardId: board.id, userId: params.userId },
      update: {},
    }),
    prisma.board.update({
      where: { id: board.id },
      data: { memberCount: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ banned: true });
}
