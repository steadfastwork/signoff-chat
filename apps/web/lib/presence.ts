/**
 * Server-side presence helpers.
 * Import only in API routes / server components — uses Prisma + pusherServer.
 */
import { prisma } from "@/lib/prisma";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import type { UserStatus } from "@prisma/client";

export type { UserStatus };

// ---------------------------------------------------------------------------
// Buddy helpers
// ---------------------------------------------------------------------------

/** Return the user IDs of all ACCEPTED buddies for the given user. */
export async function getAcceptedBuddyIds(userId: string): Promise<string[]> {
  const relations = await prisma.buddyRelation.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });

  return relations.map((r) =>
    r.requesterId === userId ? r.addresseeId : r.requesterId
  );
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

/**
 * The status that buddies should see.
 * INVISIBLE → broadcast OFFLINE so the user appears offline to everyone.
 */
export function externalStatus(status: UserStatus): UserStatus {
  return status === "INVISIBLE" ? "OFFLINE" : status;
}

// ---------------------------------------------------------------------------
// Core: update DB + broadcast
// ---------------------------------------------------------------------------

/**
 * Persist the new status and push a STATUS_CHANGE event to every accepted
 * buddy's personal presence channel.  INVISIBLE users appear OFFLINE to all
 * buddies (but their own real status is stored as INVISIBLE in the DB).
 */
export async function setAndBroadcastStatus(
  userId: string,
  status: UserStatus
): Promise<{ id: string; screenname: string; awayMessage: string | null }> {
  // 1. Persist
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: { id: true, screenname: true, awayMessage: true },
  });

  // 2. Find buddies
  const buddyIds = await getAcceptedBuddyIds(userId);
  if (buddyIds.length === 0) return user;

  // 3. Broadcast — INVISIBLE appears as OFFLINE to buddies
  const broadcastedStatus = externalStatus(status);
  const payload = {
    userId,
    screenname: user.screenname,
    status: broadcastedStatus,
    awayMessage: user.awayMessage,
  };

  // Pusher allows up to 10 channels per trigger call — batch accordingly
  for (let i = 0; i < buddyIds.length; i += 10) {
    const channels = buddyIds
      .slice(i, i + 10)
      .map((id) => CHANNELS.presenceBuddies(id));
    await pusherServer.trigger(channels, EVENTS.STATUS_CHANGE, payload);
  }

  return user;
}
