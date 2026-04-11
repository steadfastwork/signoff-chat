import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/messages/unread
//
// Returns unread DM counts for all DM channels the user belongs to.
// Uses lastReadAt from ChannelMember (set server-side) as the cutoff —
// no client-supplied timestamps needed.
// Returns: Array<{ partnerId, unreadCount, latestMessageAt }>
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const memberships = await prisma.channelMember.findMany({
    where: {
      userId,
      channel: { name: { contains: "__dm__" } },
    },
    select: {
      channelId: true,
      lastReadAt: true,
      channel: { select: { name: true } },
    },
  });

  if (memberships.length === 0) return NextResponse.json([]);

  const results = await Promise.all(
    memberships.map(async (m) => {
      const parts = m.channel.name.split("__dm__");
      const partnerId = parts[0] === userId ? parts[1] : parts[0];
      const since = m.lastReadAt;

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
