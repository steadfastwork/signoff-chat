import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, notFound } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = 50;

  const boards = await prisma.board.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, screenname: true } },
      _count: { select: { members: true } },
    },
  });

  const hasMore = boards.length > limit;
  const items = hasMore ? boards.slice(0, limit) : boards;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ boards: items, nextCursor });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const { searchParams } = new URL(req.url);
  const boardId = searchParams.get("boardId");
  if (!boardId) return NextResponse.json({ error: "boardId required" }, { status: 400 });

  await prisma.board.delete({ where: { id: boardId } });
  return NextResponse.json({ ok: true });
}
