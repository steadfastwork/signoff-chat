import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { listId: string } };

// ---------------------------------------------------------------------------
// POST /api/buddy-lists/[listId]/members — add a buddy to a list
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const list = await prisma.buddyGroupList.findUnique({ where: { id: params.listId } });
  if (!list || list.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  const { buddyId } = (await req.json()) as { buddyId: string };
  if (!buddyId) return NextResponse.json({ error: "buddyId is required." }, { status: 400 });

  // Verify they are actually buddies
  const relation = await prisma.buddyRelation.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: session.user.id, addresseeId: buddyId },
        { requesterId: buddyId, addresseeId: session.user.id },
      ],
    },
  });
  if (!relation) {
    return NextResponse.json({ error: "not a buddy." }, { status: 403 });
  }

  await prisma.buddyGroupMember.upsert({
    where: { listId_buddyId: { listId: list.id, buddyId } },
    create: { listId: list.id, buddyId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
