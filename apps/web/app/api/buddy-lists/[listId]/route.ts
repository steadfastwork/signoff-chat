import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { listId: string } };

async function getOwnedList(listId: string, userId: string) {
  const list = await prisma.buddyGroupList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== userId) return null;
  return list;
}

// ---------------------------------------------------------------------------
// PATCH /api/buddy-lists/[listId] — rename a list
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const list = await getOwnedList(params.listId, session.user.id);
  if (!list) return NextResponse.json({ error: "not found." }, { status: 404 });

  const { name } = (await req.json()) as { name: string };
  const trimmed = name?.trim().slice(0, 32);
  if (!trimmed) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const updated = await prisma.buddyGroupList.update({
    where: { id: list.id },
    data: { name: trimmed },
  });

  return NextResponse.json({ id: updated.id, name: updated.name });
}

// ---------------------------------------------------------------------------
// DELETE /api/buddy-lists/[listId] — delete a list
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const list = await getOwnedList(params.listId, session.user.id);
  if (!list) return NextResponse.json({ error: "not found." }, { status: 404 });

  await prisma.buddyGroupList.delete({ where: { id: list.id } });
  return NextResponse.json({ ok: true });
}
