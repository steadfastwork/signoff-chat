import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

type Params = { params: { boardName: string } };

// ---------------------------------------------------------------------------
// POST /api/boards/[boardName]/invite-member — direct add by screenname
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
  });
  if (!board) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: session.user.id, boardId: board.id } },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "you must be a member to invite others." },
      { status: 403 }
    );
  }

  const { screenname } = (await req.json()) as { screenname: string };
  if (!screenname?.trim()) {
    return NextResponse.json({ error: "screenname is required." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { screenname: { equals: screenname.trim(), mode: "insensitive" } },
    select: { id: true, screenname: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  const alreadyMember = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: target.id, boardId: board.id } },
  });
  if (alreadyMember) {
    return NextResponse.json(
      { error: `${target.screenname} is already a member.` },
      { status: 409 }
    );
  }

  const isFoundingMember = board.memberCount < 50;

  await prisma.$transaction([
    prisma.boardMember.create({
      data: { userId: target.id, boardId: board.id, isFoundingMember },
    }),
    prisma.board.update({
      where: { id: board.id },
      data: { memberCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true, screenname: target.screenname });
}
