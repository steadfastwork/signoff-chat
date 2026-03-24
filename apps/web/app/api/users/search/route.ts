import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, limiters } from "@/lib/ratelimit";

// ---------------------------------------------------------------------------
// GET /api/users/search?q= — partial screenname match
//
// Excludes:
//   • the current user
//   • users already in any buddy relation (PENDING / ACCEPTED / BLOCKED)
//   • users who have blocked the current user
//
// INVISIBLE users are returned with status OFFLINE to preserve privacy.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 searches/min per user
  const rl = await rateLimit(limiters.search, `search:${session.user.id}`);
  if (rl) return rl;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { screenname: { contains: q, mode: "insensitive" } },
        { id: { not: session.user.id } },
        // No relation I initiated (I sent request, I blocked them)
        { receivedRequests: { none: { requesterId: session.user.id } } },
        // No relation they initiated (they sent request, they blocked me)
        { sentRequests: { none: { addresseeId: session.user.id } } },
      ],
    },
    select: {
      id: true,
      screenname: true,
      isGoldMember: true,
      status: true,
      bio: true,
    },
    take: 10,
    orderBy: { screenname: "asc" },
  });

  const results = users.map((u) => ({
    ...u,
    status: u.status === "INVISIBLE" ? "OFFLINE" : u.status,
  }));

  return NextResponse.json(results);
}
