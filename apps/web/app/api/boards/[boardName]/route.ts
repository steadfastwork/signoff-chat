import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

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
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
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

  const isCreator = session?.user?.id === board.creatorId;
  const isAdmin = !isCreator && session?.user?.id
    ? (await prisma.user.findUnique({ where: { id: session.user.id }, select: { adminRole: true } }))?.adminRole != null
    : false;
  const canManage = isCreator || isAdmin;

  return NextResponse.json({
    id: board.id,
    name: board.name,
    displayName: board.displayName,
    vibeStatement: board.vibeStatement,
    type: board.type,
    memberCount: board.memberCount,
    creatorId: board.creatorId,
    canManage,
    isMember,
    isFoundingMember: membership?.isFoundingMember ?? false,
    isModerator: membership?.isModerator ?? false,
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/boards/[boardName] — update board settings (creator only)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const board = await prisma.board.findUnique({ where: { name: params.boardName } });
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

  const body = (await req.json()) as {
    displayName?: string;
    vibeStatement?: string;
    type?: "PUBLIC" | "INVITE_ONLY" | "SECRET";
  };

  const updated = await prisma.board.update({
    where: { id: board.id },
    data: {
      ...(body.displayName !== undefined
        ? { displayName: body.displayName.trim().slice(0, 40) }
        : {}),
      ...(body.vibeStatement !== undefined
        ? { vibeStatement: body.vibeStatement.trim().slice(0, 200) }
        : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
    },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    displayName: updated.displayName,
    vibeStatement: updated.vibeStatement,
    type: updated.type,
  });
}
