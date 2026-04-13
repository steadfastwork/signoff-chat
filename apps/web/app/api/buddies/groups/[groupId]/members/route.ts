import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/buddies/groups/[groupId]/members
// Body: { buddyId: string; action: "add" | "remove" }

export async function PATCH(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const buddyId: string = body.buddyId ?? "";
  const action: string  = body.action ?? "";

  if (!buddyId || !["add", "remove"].includes(action)) {
    return NextResponse.json({ error: "buddyId and action (add|remove) required" }, { status: 400 });
  }

  // Verify the group belongs to the caller
  const group = await prisma.buddyGroupList.findUnique({
    where: { id: params.groupId },
    select: { ownerId: true },
  });
  if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (group.ownerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (action === "add") {
    await prisma.buddyGroupMember.upsert({
      where: { listId_buddyId: { listId: params.groupId, buddyId } },
      create: { listId: params.groupId, buddyId },
      update: {},
    });
  } else {
    await prisma.buddyGroupMember.deleteMany({
      where: { listId: params.groupId, buddyId },
    });
  }

  return NextResponse.json({ ok: true });
}
