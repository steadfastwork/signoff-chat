import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { boardName: string; userId: string } };

async function getActorRole(
  actorId: string,
  board: { creatorId: string }
): Promise<"creator" | "admin" | null> {
  if (actorId === board.creatorId) return "creator";
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isAdmin: true },
  });
  if (actor?.isAdmin) return "admin";
  return null;
}

// ---------------------------------------------------------------------------
// DELETE /api/boards/[boardName]/members/[userId]
// Remove a member from the board. Optionally ban (prevent rejoin).
// Body: { ban?: boolean }
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
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
