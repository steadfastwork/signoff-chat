import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, deriveAvatarColor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { screenname: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);

  const target = await prisma.user.findFirst({
    where: { screenname: { equals: params.screenname, mode: "insensitive" } },
    select: {
      id: true,
      screenname: true,
      bio: true,
      awayMessage: true,
      status: true,
      isGoldMember: true,
      createdAt: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  // ---------------------------------------------------------------------------
  // Determine relationship
  // ---------------------------------------------------------------------------

  type Relationship = "self" | "buddy" | "pending" | "none" | "blocked";
  let relationship: Relationship = "none";
  let pendingDirection: "sent" | "received" | null = null;

  if (session?.user?.id === target.id) {
    relationship = "self";
  } else if (session?.user?.id) {
    const relation = await prisma.buddyRelation.findFirst({
      where: {
        OR: [
          { requesterId: session.user.id, addresseeId: target.id },
          { requesterId: target.id, addresseeId: session.user.id },
        ],
      },
    });

    if (relation) {
      if (relation.status === "ACCEPTED") {
        relationship = "buddy";
      } else if (relation.status === "BLOCKED") {
        relationship = "blocked";
      } else if (relation.status === "PENDING") {
        relationship = "pending";
        pendingDirection =
          relation.requesterId === session.user.id ? "sent" : "received";
      }
    }
  }

  // Blocked either direction → 404 (hide the user entirely)
  if (relationship === "blocked") {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  const isSelf = relationship === "self";
  const isBuddy = relationship === "buddy";

  // ---------------------------------------------------------------------------
  // Display status — INVISIBLE appears OFFLINE to others
  // ---------------------------------------------------------------------------

  const displayStatus =
    isSelf
      ? target.status
      : target.status === "INVISIBLE"
      ? "OFFLINE"
      : target.status;

  // ---------------------------------------------------------------------------
  // Counts
  // ---------------------------------------------------------------------------

  const [postCount, buddyCount] = await Promise.all([
    prisma.post.count({ where: { authorId: target.id } }),
    prisma.buddyRelation.count({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: target.id },
          { addresseeId: target.id },
        ],
      },
    }),
  ]);

  // ---------------------------------------------------------------------------
  // Posts — scoped by relationship
  // ---------------------------------------------------------------------------

  const postWhere = isSelf
    ? { authorId: target.id }
    : isBuddy
    ? { authorId: target.id, privacy: { in: ["PUBLIC", "BUDDIES_ONLY"] as Array<"PUBLIC" | "BUDDIES_ONLY"> } }
    : { authorId: target.id, privacy: "PUBLIC" as const };

  const posts = await prisma.post.findMany({
    where: postWhere,
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      content: true,
      privacy: true,
      mediaUrl: true,
      mediaType: true,
      createdAt: true,
      _count: { select: { nudges: true, replies: true } },
    },
  });

  // ---------------------------------------------------------------------------
  // Mutual channels (self: all non-SECRET; buddy: intersection, non-SECRET)
  // ---------------------------------------------------------------------------

  let mutualChannels: { name: string; type: string }[] = [];

  if (isSelf || isBuddy) {
    if (isSelf) {
      const memberships = await prisma.channelMember.findMany({
        where: { userId: target.id },
        select: { channel: { select: { name: true, type: true } } },
      });
      mutualChannels = memberships
        .map((m) => m.channel)
        .filter((c) => c.type !== "SECRET");
    } else {
      const [viewerMemberships, targetMemberships] = await Promise.all([
        prisma.channelMember.findMany({
          where: { userId: session!.user!.id },
          select: { channelId: true },
        }),
        prisma.channelMember.findMany({
          where: { userId: target.id },
          select: { channel: { select: { id: true, name: true, type: true } } },
        }),
      ]);

      const viewerChannelIds = new Set(viewerMemberships.map((m) => m.channelId));
      mutualChannels = targetMemberships
        .filter(
          (m) => viewerChannelIds.has(m.channel.id) && m.channel.type !== "SECRET"
        )
        .map((m) => ({ name: m.channel.name, type: m.channel.type }));
    }
  }

  // ---------------------------------------------------------------------------
  // Public boards (self or buddy — only PUBLIC type shown on profiles)
  // ---------------------------------------------------------------------------

  let publicBoards: { name: string; displayName: string }[] = [];

  if (isSelf || isBuddy) {
    const memberships = await prisma.boardMember.findMany({
      where: { userId: target.id },
      select: {
        board: { select: { name: true, displayName: true, type: true } },
      },
    });
    publicBoards = memberships
      .filter((m) => m.board.type === "PUBLIC")
      .map((m) => ({ name: m.board.name, displayName: m.board.displayName }));
  }

  // ---------------------------------------------------------------------------
  // Response
  // ---------------------------------------------------------------------------

  return NextResponse.json({
    id: target.id,
    screenname: target.screenname,
    bio: target.bio,
    awayMessage: target.awayMessage,
    status: displayStatus,
    isGoldMember: target.isGoldMember,
    avatarColor: deriveAvatarColor(target.id),
    postCount,
    buddyCount,
    joinedAt: target.createdAt,
    relationship,
    pendingDirection,
    posts,
    mutualChannels,
    publicBoards,
  });
}
