import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

function validateBoardName(name: string): string | null {
  if (!name) return "name is required.";
  if (name.length < 3 || name.length > 40)
    return "name must be 3–40 characters.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && !/^[a-z0-9]{3}$/.test(name))
    return "name can only use lowercase letters, numbers, and hyphens.";
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/boards — search PUBLIC + INVITE_ONLY boards; ?mine=true for own
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const mine = searchParams.get("mine") === "true";

  if (mine) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const memberships = await prisma.boardMember.findMany({
      where: { userId: session.user.id },
      include: { board: true },
      orderBy: { joinedAt: "desc" },
    });
    return NextResponse.json(
      memberships.map((m) => ({
        id: m.board.id,
        name: m.board.name,
        displayName: m.board.displayName,
        vibeStatement: m.board.vibeStatement,
        type: m.board.type,
        memberCount: m.board.memberCount,
        isFoundingMember: m.isFoundingMember,
        joinedAt: m.joinedAt,
        canManage: m.board.creatorId === session.user.id,
      }))
    );
  }

  const boards = await prisma.board.findMany({
    where: {
      type: { in: ["PUBLIC", "INVITE_ONLY"] },
      ...(q.length >= 1
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
              { vibeStatement: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ memberCount: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  return NextResponse.json(boards);
}

// ---------------------------------------------------------------------------
// POST /api/boards — create a board (creator auto-joins as founding member)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!await getFeatureFlag(BOARDS_ENABLED)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    name: string;
    displayName: string;
    vibeStatement: string;
    type?: "PUBLIC" | "INVITE_ONLY" | "SECRET";
  };

  const { displayName, vibeStatement, type = "PUBLIC" } = body;
  const slug = body.name?.trim().toLowerCase() ?? "";

  const nameErr = validateBoardName(slug);
  if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

  if (!displayName?.trim()) {
    return NextResponse.json({ error: "displayName is required." }, { status: 400 });
  }
  if (!vibeStatement?.trim() || vibeStatement.length > 200) {
    return NextResponse.json(
      { error: "vibeStatement is required (max 200 chars)." },
      { status: 400 }
    );
  }

  const existing = await prisma.board.findUnique({ where: { name: slug } });
  if (existing) {
    return NextResponse.json({ error: "board name already taken." }, { status: 409 });
  }

  const board = await prisma.$transaction(async (tx) => {
    const b = await tx.board.create({
      data: {
        name: slug,
        displayName: displayName.trim(),
        vibeStatement: vibeStatement.trim(),
        type,
        creatorId: session.user.id,
        memberCount: 1, // creator is first member
      },
    });
    await tx.boardMember.create({
      data: {
        userId: session.user.id,
        boardId: b.id,
        isFoundingMember: true, // creator is always founding member
      },
    });
    return b;
  });

  return NextResponse.json(board, { status: 201 });
}
