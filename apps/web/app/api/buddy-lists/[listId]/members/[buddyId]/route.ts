import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { listId: string; buddyId: string } };

// ---------------------------------------------------------------------------
// DELETE /api/buddy-lists/[listId]/members/[buddyId] — remove buddy from list
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const list = await prisma.buddyGroupList.findUnique({ where: { id: params.listId } });
  if (!list || list.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  await prisma.buddyGroupMember.deleteMany({
    where: { listId: list.id, buddyId: params.buddyId },
  });

  return NextResponse.json({ ok: true });
}
