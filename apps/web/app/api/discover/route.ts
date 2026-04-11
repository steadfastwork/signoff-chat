import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, deriveAvatarColor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCurrently } from "@/lib/currently";

const OFFLINE_KEYWORDS = [
  "offline",
  "away",
  "somewhere",
  "without wifi",
  "no signal",
  "going",
  "leaving",
  "disconnecting",
  "no internet",
  "out of office",
];

const FILTER_TO_CURRENTLY_KEY: Record<string, string> = {
  books: "reading",
  music: "listening",
  film: "watching",
  games: "playing",
  making: "making",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = (searchParams.get("filter") ?? "all").toLowerCase();

  const myId = session.user.id;

  // Get existing buddy IDs + blocked users
  const [buddyRelations, blocks] = await Promise.all([
    prisma.buddyRelation.findMany({
      where: {
        OR: [{ requesterId: myId }, { addresseeId: myId }],
      },
      select: { requesterId: true, addresseeId: true },
    }),
    prisma.block.findMany({
      where: { OR: [{ blockerId: myId }, { blockedId: myId }] },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const excludedIds = new Set<string>([myId]);
  for (const r of buddyRelations) {
    excludedIds.add(r.requesterId);
    excludedIds.add(r.addresseeId);
  }
  for (const b of blocks) {
    excludedIds.add(b.blockerId);
    excludedIds.add(b.blockedId);
  }

  // Find the latest public away message for non-excluded users
  // who have at least one currently field set (or matching the filter)
  const currentlyFilter =
    filter !== "all" && filter !== "offline"
      ? FILTER_TO_CURRENTLY_KEY[filter]
      : null;

  // Fetch candidates — users with recent public away messages
  const candidates = await prisma.awayMessageHistory.findMany({
    where: {
      visibility: "PUBLIC",
      content: { not: "" },
      userId: { notIn: Array.from(excludedIds) },
    },
    orderBy: { setAt: "desc" },
    take: 100,
    select: {
      id: true,
      content: true,
      setAt: true,
      nudgeCount: true,
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

  // Deduplicate by userId
  const seen = new Set<string>();
  const deduped = candidates.filter((c) => {
    if (seen.has(c.userId)) return false;
    seen.add(c.userId);
    return true;
  });

  // Apply filter
  const filtered = deduped.filter((c) => {
    const currently = parseCurrently(c.user.currently);

    if (filter === "offline") {
      const lower = c.content.toLowerCase();
      return OFFLINE_KEYWORDS.some((kw) => lower.includes(kw));
    }
    if (filter === "all") {
      // Show anyone with at least one currently field
      return Object.values(currently).some(Boolean);
    }
    if (currentlyFilter) {
      return !!(currently as Record<string, string | undefined>)[currentlyFilter];
    }
    return true;
  });

  // Get mutual buddy counts
  const myBuddyIds = new Set(
    buddyRelations
      .filter((r) => r.requesterId === myId || r.addresseeId === myId)
      .map((r) => (r.requesterId === myId ? r.addresseeId : r.requesterId))
  );

  const results = filtered.slice(0, 20).map((c) => ({
    userId: c.userId,
    screenname: c.user.screenname,
    isGoldMember: c.user.isGoldMember,
    avatarColor: deriveAvatarColor(c.userId),
    avatarUrl: c.user.avatarUrl,
    currently: parseCurrently(c.user.currently),
    status: c.user.status,
    away: {
      id: c.id,
      content: c.content,
      setAt: c.setAt.toISOString(),
      nudgeCount: c.nudgeCount,
    },
    mutualBuddyCount: 0, // could compute but expensive; skip for now
  }));

  return NextResponse.json({ results });
}
