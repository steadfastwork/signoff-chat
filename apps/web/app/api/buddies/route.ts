import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { notifyBuddyRequest } from "@/lib/expoNotifications";

const buddySelect = {
  id: true,
  screenname: true,
  status: true,
  awayMessage: true,
  isGoldMember: true,
} as const;

// ---------------------------------------------------------------------------
// GET /api/buddies — list accepted buddies with live status
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const relations = await prisma.buddyRelation.findMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: session.user.id },
        { addresseeId: session.user.id },
      ],
    },
    include: {
      requester: { select: buddySelect },
      addressee: { select: buddySelect },
    },
  });

  const buddies = relations.map((r) => {
    const buddy =
      r.requesterId === session.user.id ? r.addressee : r.requester;
    return {
      ...buddy,
      // INVISIBLE users appear OFFLINE to everyone except themselves
      status: buddy.status === "INVISIBLE" ? "OFFLINE" : buddy.status,
    };
  });

  return NextResponse.json(buddies);
}

// ---------------------------------------------------------------------------
// POST /api/buddies — send a buddy request by screenname
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const targetScreenname: string | undefined = body.targetScreenname;

  if (!targetScreenname?.trim()) {
    return NextResponse.json(
      { error: "targetScreenname is required." },
      { status: 400 }
    );
  }

  // Find target (case-insensitive)
  const target = await prisma.user.findFirst({
    where: { screenname: { equals: targetScreenname.trim(), mode: "insensitive" } },
    select: { id: true, screenname: true, isGoldMember: true },
  });

  if (!target) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }
  if (target.id === session.user.id) {
    return NextResponse.json({ error: "cannot add yourself." }, { status: 400 });
  }

  // Block check — either party has blocked the other
  const blocked = await prisma.buddyRelation.findFirst({
    where: {
      status: "BLOCKED",
      OR: [
        { requesterId: session.user.id, addresseeId: target.id },
        { requesterId: target.id, addresseeId: session.user.id },
      ],
    },
  });
  if (blocked) {
    return NextResponse.json(
      { error: "cannot send request." },
      { status: 403 }
    );
  }

  // Existing relation check
  const existing = await prisma.buddyRelation.findFirst({
    where: {
      OR: [
        { requesterId: session.user.id, addresseeId: target.id },
        { requesterId: target.id, addresseeId: session.user.id },
      ],
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "request already exists." },
      { status: 409 }
    );
  }

  const relation = await prisma.buddyRelation.create({
    data: {
      requesterId: session.user.id,
      addresseeId: target.id,
      status: "PENDING",
    },
  });

  // Notify the target in real-time (Soketi) + push notification (fire-and-forget)
  await pusherServer.trigger(
    CHANNELS.privateUser(target.id),
    EVENTS.BUDDY_REQUEST,
    {
      requesterId: session.user.id,
      screenname: session.user.screenname,
      isGoldMember: session.user.isGoldMember,
    }
  );

  notifyBuddyRequest(target.id, session.user.screenname).catch(() => {});

  return NextResponse.json(relation, { status: 201 });
}
