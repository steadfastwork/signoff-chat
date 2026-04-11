import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/messages/[userId]/read
// Stamps lastReadAt on the caller's DM channel membership.
// Called when the DM panel mounts or a new message arrives.
export async function POST(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const myId = session.user.id;
  const otherId = params.userId;

  // The DM channel name is always stored as "smaller_id__dm__larger_id" or
  // either order — match whichever exists.
  const membership = await prisma.channelMember.findFirst({
    where: {
      userId: myId,
      channel: {
        name: {
          contains: "__dm__",
        },
        members: {
          some: { userId: otherId },
        },
      },
    },
    select: { id: true },
  });

  if (membership) {
    await prisma.channelMember.update({
      where: { id: membership.id },
      data: { lastReadAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
