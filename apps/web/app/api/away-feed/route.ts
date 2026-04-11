import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, deriveAvatarColor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCurrently } from "@/lib/currently";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor"); // ISO timestamp string

  // Get all accepted buddy IDs
  const relations = await prisma.buddyRelation.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: session.user.id }, { addresseeId: session.user.id }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const buddyIds = relations.map((r) =>
    r.requesterId === session.user.id ? r.addresseeId : r.requesterId
  );

  if (buddyIds.length === 0) {
    return NextResponse.json({ entries: [], cursor: null });
  }

  // For each buddy, get their most recent non-empty AwayMessageHistory entry
  // that is PUBLIC or BUDDIES (buddies = always shown since we are buddies)
  const rows = await prisma.awayMessageHistory.findMany({
    where: {
      userId: { in: buddyIds },
      content: { not: "" },
      visibility: { in: ["PUBLIC", "BUDDIES"] },
      ...(cursor ? { setAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { setAt: "desc" },
    take: 60, // fetch extra to deduplicate (1 per user)
    select: {
      id: true,
      content: true,
      setAt: true,
      visibility: true,
      nudgeCount: true,
      replyCount: true,
      userId: true,
      user: {
        select: {
          id: true,
          screenname: true,
          isGoldMember: true,
          avatarUrl: true,
          currently: true,
          status: true,
        },
      },
    },
  });

  // Deduplicate: take only the latest entry per user
  const seen = new Set<string>();
  const deduplicated = rows.filter((r) => {
    if (seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });

  // Check which entries the current user has nudged
  const entryIds = deduplicated.map((r) => r.id);
  const myNudges = await prisma.awayNudge.findMany({
    where: { userId: session.user.id, awayId: { in: entryIds } },
    select: { awayId: true },
  });
  const nudgedSet = new Set(myNudges.map((n) => n.awayId));

  const entries = deduplicated.slice(0, 20).map((r) => ({
    userId: r.userId,
    screenname: r.user.screenname,
    isGoldMember: r.user.isGoldMember,
    avatarColor: deriveAvatarColor(r.userId),
    avatarUrl: r.user.avatarUrl,
    currently: parseCurrently(r.user.currently),
    status: r.user.status,
    away: {
      id: r.id,
      content: r.content,
      setAt: r.setAt.toISOString(),
      visibility: r.visibility,
      nudgeCount: r.nudgeCount,
      replyCount: r.replyCount,
      hasNudged: nudgedSet.has(r.id),
    },
  }));

  const nextCursor =
    entries.length === 20
      ? entries[entries.length - 1]!.away.setAt
      : null;

  return NextResponse.json({ entries, cursor: nextCursor });
}
