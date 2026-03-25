import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/buddy-lists — list all buddy group lists for the session user
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const lists = await prisma.buddyGroupList.findMany({
    where: { ownerId: session.user.id },
    include: { members: { select: { buddyId: true } } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    lists.map((l) => ({
      id: l.id,
      name: l.name,
      position: l.position,
      buddyIds: l.members.map((m) => m.buddyId),
    }))
  );
}

// ---------------------------------------------------------------------------
// POST /api/buddy-lists — create a new buddy list
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { name } = (await req.json()) as { name: string };
  const trimmed = name?.trim().slice(0, 32);
  if (!trimmed) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const list = await prisma.buddyGroupList.create({
    data: { name: trimmed, ownerId: session.user.id },
  });

  return NextResponse.json({ id: list.id, name: list.name, position: list.position, buddyIds: [] }, { status: 201 });
}
