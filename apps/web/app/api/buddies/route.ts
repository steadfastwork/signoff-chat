import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { notifyBuddyRequest } from "@/lib/expoNotifications";
import { parseCurrently } from "@/lib/currently";

const buddySelect = {
  id: true,
  screenname: true,
  status: true,
  awayMessage: true,
  currently: true,
  isGoldMember: true,
  badges: { select: { id: true, badge: true, awardedAt: true } },
};

// ---------------------------------------------------------------------------
// GET /api/buddies — return AIM-style grouped buddy list
// Response: { groups, ungrouped, offlineBuddies }
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [relations, buddyLists] = await Promise.all([
    prisma.buddyRelation.findMany({
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
    }),
    prisma.buddyGroupList.findMany({
      where: { ownerId: session.user.id },
      include: { members: { select: { buddyId: true } } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  // Build flat buddy list with computed isOnline / isAway
  const allBuddies = relations.map((r) => {
    const buddy = r.requesterId === session.user.id ? r.addressee : r.requester;
    const effectiveStatus = buddy.status === "INVISIBLE" ? "OFFLINE" : buddy.status;
    const isOnline = effectiveStatus !== "OFFLINE";
    const isAway =
      effectiveStatus === "AWAY" ||
      (buddy.awayMessage != null && buddy.awayMessage.length > 0);
    return {
      userId: buddy.id,
      relationId: r.id,
      screenname: buddy.screenname,
      isGold: buddy.isGoldMember,
      isOnline,
      isAway,
      awayMessage: buddy.awayMessage ? buddy.awayMessage.slice(0, 60) : "",
      currently: parseCurrently(buddy.currently),
      badges: buddy.badges,
    };
  });

  // Sort online buddies: not-away first, then away; alphabetically within each
  const sortOnline = (
    a: (typeof allBuddies)[number],
    b: (typeof allBuddies)[number]
  ) => {
    if (a.isAway !== b.isAway) return a.isAway ? 1 : -1;
    return a.screenname.localeCompare(b.screenname);
  };

  const buddyMap = new Map(allBuddies.map((b) => [b.userId, b]));

  const offlineBuddies = allBuddies
    .filter((b) => !b.isOnline)
    .sort((a, b) => a.screenname.localeCompare(b.screenname));

  // Build groups — each group shows only its online buddies
  const allMemberIdSet = new Set(
    buddyLists.flatMap((l) => l.members.map((m) => m.buddyId))
  );

  const groups = buddyLists.map((list, idx) => {
    const memberIds = list.members.map((m) => m.buddyId);
    const totalCount = memberIds.filter((id) => buddyMap.has(id)).length;
    const onlineInGroup = memberIds
      .map((id) => buddyMap.get(id))
      .filter((b): b is (typeof allBuddies)[number] => b != null && b.isOnline)
      .sort(sortOnline);

    return {
      id: list.id,
      name: list.name,
      order: idx,
      memberIds,
      buddies: onlineInGroup,
      totalCount,
    };
  });

  // Ungrouped = online buddies not in any group
  const ungrouped = allBuddies
    .filter((b) => b.isOnline && !allMemberIdSet.has(b.userId))
    .sort(sortOnline);

  return NextResponse.json({ groups, ungrouped, offlineBuddies });
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
    where: {
      screenname: { equals: targetScreenname.trim(), mode: "insensitive" },
    },
    select: { id: true, screenname: true, isGoldMember: true },
  });

  if (!target) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }
  if (target.id === session.user.id) {
    return NextResponse.json(
      { error: "cannot add yourself." },
      { status: 400 }
    );
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
    return NextResponse.json({ error: "cannot send request." }, { status: 403 });
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
