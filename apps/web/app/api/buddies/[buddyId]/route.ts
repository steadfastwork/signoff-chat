import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { notifyBuddyAccepted } from "@/lib/expoNotifications";

type Params = { params: { buddyId: string } };

// ---------------------------------------------------------------------------
// PATCH /api/buddies/[buddyId] — accept | decline | block
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { buddyId } = params;
  const { action } = await req.json() as { action: string };

  // ---- Accept ----
  if (action === "accept") {
    const relation = await prisma.buddyRelation.findFirst({
      where: {
        requesterId: buddyId,
        addresseeId: session.user.id,
        status: "PENDING",
      },
    });
    if (!relation) {
      return NextResponse.json({ error: "request not found." }, { status: 404 });
    }

    await prisma.buddyRelation.update({
      where: { id: relation.id },
      data: { status: "ACCEPTED" },
    });

    // Fetch the requester's data to return to the acceptee and notify the requester
    const requester = await prisma.user.findUnique({
      where: { id: buddyId },
      select: {
        id: true,
        screenname: true,
        isGoldMember: true,
        awayMessage: true,
        status: true,
      },
    });
    if (!requester) {
      return NextResponse.json({ error: "user not found." }, { status: 404 });
    }

    // Notify the requester that their request was accepted — include the
    // acceptee's current status so they can add them to their buddy list
    const accepteeStatus = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { status: true, awayMessage: true },
    });

    await pusherServer.trigger(
      CHANNELS.privateUser(buddyId),
      EVENTS.BUDDY_ACCEPTED,
      {
        id: session.user.id,
        screenname: session.user.screenname,
        isGoldMember: session.user.isGoldMember,
        status:
          accepteeStatus?.status === "INVISIBLE"
            ? "OFFLINE"
            : (accepteeStatus?.status ?? "ONLINE"),
        awayMessage: accepteeStatus?.awayMessage ?? null,
      }
    );

    // Push notification to the requester — fire-and-forget
    notifyBuddyAccepted(buddyId, session.user.screenname).catch(() => {});

    return NextResponse.json({
      ok: true,
      // Return the new buddy so the acceptee can add them to their list
      buddy: {
        id: requester.id,
        screenname: requester.screenname,
        isGoldMember: requester.isGoldMember,
        awayMessage: requester.awayMessage,
        status:
          requester.status === "INVISIBLE" ? "OFFLINE" : requester.status,
      },
    });
  }

  // ---- Decline ----
  if (action === "decline") {
    await prisma.buddyRelation.deleteMany({
      where: {
        requesterId: buddyId,
        addresseeId: session.user.id,
        status: "PENDING",
      },
    });
    return NextResponse.json({ ok: true });
  }

  // ---- Block ----
  if (action === "block") {
    // Remove any existing relation between the two users
    await prisma.buddyRelation.deleteMany({
      where: {
        OR: [
          { requesterId: session.user.id, addresseeId: buddyId },
          { requesterId: buddyId, addresseeId: session.user.id },
        ],
      },
    });

    // Create a BLOCKED relation — blocker is always the requester
    await prisma.buddyRelation.create({
      data: {
        requesterId: session.user.id,
        addresseeId: buddyId,
        status: "BLOCKED",
      },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid action." }, { status: 400 });
}

// ---------------------------------------------------------------------------
// DELETE /api/buddies/[buddyId] — remove an accepted buddy
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { buddyId } = params;

  await prisma.buddyRelation.deleteMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: session.user.id, addresseeId: buddyId },
        { requesterId: buddyId, addresseeId: session.user.id },
      ],
    },
  });

  return NextResponse.json({ ok: true });
}
