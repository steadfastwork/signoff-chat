import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/buddies/groups/[groupId] — delete a buddy group

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const group = await prisma.buddyGroupList.findUnique({
    where: { id: params.groupId },
    select: { ownerId: true },
  });

  if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (group.ownerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.buddyGroupList.delete({ where: { id: params.groupId } });
  return new NextResponse(null, { status: 204 });
}
