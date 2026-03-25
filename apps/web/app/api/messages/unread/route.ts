import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/messages/unread
//
// Accepts optional query params `since_{partnerId}=ISO_TIMESTAMP` so the
// server can count messages newer than the client's "last read" timestamp.
// Returns: Array<{ partnerId, unreadCount, latestMessageAt }>
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);

  // Build a map of partnerId → lastReadDate from query params
  const sinceMap: Record<string, Date> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith("since_")) {
      const partnerId = key.slice(6);
      const d = new Date(value);
      if (!isNaN(d.getTime())) sinceMap[partnerId] = d;
    }
  });

  const memberships = await prisma.channelMember.findMany({
    where: {
      userId,
      channel: { name: { contains: "__dm__" } },
    },
    select: { channelId: true, channel: { select: { name: true } } },
  });

  if (memberships.length === 0) return NextResponse.json([]);

  const results = await Promise.all(
    memberships.map(async (m) => {
      const parts = m.channel.name.split("__dm__");
      const partnerId = parts[0] === userId ? parts[1] : parts[0];
      const since = sinceMap[partnerId];

      const [unreadCount, latest] = await Promise.all([
        prisma.channelMessage.count({
          where: {
            channelId: m.channelId,
            authorId: { not: userId },
            ...(since ? { createdAt: { gt: since } } : {}),
          },
        }),
        prisma.channelMessage.findFirst({
          where: { channelId: m.channelId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

      if (!latest) return null;

      return {
        partnerId,
        unreadCount,
        latestMessageAt: latest.createdAt,
      };
    })
  );

  return NextResponse.json(results.filter(Boolean));
}
