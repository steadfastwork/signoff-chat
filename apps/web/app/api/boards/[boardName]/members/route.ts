import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

type Params = { params: { boardName: string } };

// ---------------------------------------------------------------------------
// GET /api/boards/[boardName]/members — list members (creator only)
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
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
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  if (board.creatorId !== session.user.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { adminRole: true },
    });
    if (!user?.adminRole) {
      return NextResponse.json({ error: "forbidden — creator only." }, { status: 403 });
    }
  }

  const members = await prisma.boardMember.findMany({
    where: { boardId: board.id },
    orderBy: { joinedAt: "asc" },
    include: {
      user: {
        select: { id: true, screenname: true, isGoldMember: true },
      },
    },
  });

  return NextResponse.json(
    members.map((m) => ({
      userId: m.userId,
      joinedAt: m.joinedAt,
      isFoundingMember: m.isFoundingMember,
      isModerator: m.isModerator,
      user: m.user,
    }))
  );
}
