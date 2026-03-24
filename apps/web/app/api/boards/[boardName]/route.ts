import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { boardName: string } };

const authorSelect = {
  id: true,
  screenname: true,
  isGoldMember: true,
  status: true,
} as const;

// ---------------------------------------------------------------------------
// GET /api/boards/[boardName] — board details + recent posts
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);

  const board = await prisma.board.findUnique({
    where: { name: params.boardName },
  });
  if (!board) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const membership = session?.user?.id
    ? await prisma.boardMember.findUnique({
        where: {
          userId_boardId: { userId: session.user.id, boardId: board.id },
        },
      })
    : null;

  const isMember = !!membership;

  if (board.type === "SECRET" && !isMember) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  if (board.type === "INVITE_ONLY" && !isMember) {
    return NextResponse.json({
      id: board.id,
      name: board.name,
      displayName: board.displayName,
      vibeStatement: board.vibeStatement,
      type: board.type,
      memberCount: board.memberCount,
      isMember: false,
      isFoundingMember: false,
    });
  }

  return NextResponse.json({
    id: board.id,
    name: board.name,
    displayName: board.displayName,
    vibeStatement: board.vibeStatement,
    type: board.type,
    memberCount: board.memberCount,
    creatorId: board.creatorId,
    isMember,
    isFoundingMember: membership?.isFoundingMember ?? false,
  });
}
