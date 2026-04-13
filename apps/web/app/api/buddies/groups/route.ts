import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/buddies/groups — already served by /api/buddies (kept here as alias)
// POST /api/buddies/groups — create a new buddy group

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name: string = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Max 20 groups per user
  const count = await prisma.buddyGroupList.count({ where: { ownerId: session.user.id } });
  if (count >= 20) {
    return NextResponse.json({ error: "group limit reached" }, { status: 400 });
  }

  const group = await prisma.buddyGroupList.create({
    data: { name, ownerId: session.user.id },
    select: { id: true, name: true, position: true, createdAt: true },
  });

  return NextResponse.json(group, { status: 201 });
}
