import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/buddies/requests — pending incoming buddy requests
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const relations = await prisma.buddyRelation.findMany({
    where: {
      addresseeId: session.user.id,
      status: "PENDING",
    },
    include: {
      requester: {
        select: { id: true, screenname: true, isGoldMember: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const requests = relations.map((r) => ({
    requesterId: r.requesterId,
    screenname: r.requester.screenname,
    isGoldMember: r.requester.isGoldMember,
    createdAt: r.createdAt,
  }));

  return NextResponse.json(requests);
}
