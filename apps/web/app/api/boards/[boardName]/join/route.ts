import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

type Params = { params: { boardName: string } };

// ---------------------------------------------------------------------------
// POST /api/boards/[boardName]/join — join PUBLIC board
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, { params }: Params) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const board = await prisma.board.findUnique({
    where: { name: params.boardName },
  });
  if (!board) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }
  if (board.type !== "PUBLIC") {
    return NextResponse.json(
      { error: "this board requires an invite to join." },
      { status: 403 }
    );
  }

  const existing = await prisma.boardMember.findUnique({
    where: {
      userId_boardId: { userId: session.user.id, boardId: board.id },
    },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  // Founding member if they're within the first 50
  const isFoundingMember = board.memberCount < 50;

  await prisma.$transaction([
    prisma.boardMember.create({
      data: {
        userId: session.user.id,
        boardId: board.id,
        isFoundingMember,
      },
    }),
    prisma.board.update({
      where: { id: board.id },
      data: { memberCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true, isFoundingMember });
}

// ---------------------------------------------------------------------------
// DELETE /api/boards/[boardName]/join — leave board
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const board = await prisma.board.findUnique({
    where: { name: params.boardName },
  });
  if (!board) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const deleted = await prisma.boardMember.deleteMany({
    where: { userId: session.user.id, boardId: board.id },
  });

  if (deleted.count > 0) {
    await prisma.board.update({
      where: { id: board.id },
      data: { memberCount: { decrement: 1 } },
    });
  }

  return NextResponse.json({ ok: true });
}
