/**
 * Block + mute enforcement helpers.
 *
 * These return the full sets of user IDs that should be excluded
 * from feed, search, channel, and board queries — computed once
 * per request and passed into the Prisma `where` clause.
 *
 * Block is bidirectional at the query level:
 *   - If A blocked B: B disappears from A's view AND A disappears from B's view.
 * Mute is unidirectional:
 *   - If A muted B: B disappears from A's view only.
 */

import { prisma } from "@/lib/prisma";

/**
 * Returns the set of user IDs that `viewerId` should NEVER see content from.
 * Includes:
 *   - Users that viewerId has blocked
 *   - Users that have blocked viewerId
 *   - Users that viewerId has muted
 */
export async function getExcludedUserIds(viewerId: string): Promise<string[]> {
  const [blocking, blockedBy, muting] = await Promise.all([
    prisma.block.findMany({
      where:  { blockerId: viewerId },
      select: { blockedId: true },
    }),
    prisma.block.findMany({
      where:  { blockedId: viewerId },
      select: { blockerId: true },
    }),
    prisma.mute.findMany({
      where:  { muterId: viewerId },
      select: { mutedId: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const b of blocking)  ids.add(b.blockedId);
  for (const b of blockedBy) ids.add(b.blockerId);
  for (const m of muting)    ids.add(m.mutedId);

  return Array.from(ids);
}

/**
 * Returns only blocked user IDs (not mutes).
 * Used for profile lookups where mutes don't hide the profile.
 */
export async function getBlockedUserIds(viewerId: string): Promise<string[]> {
  const [blocking, blockedBy] = await Promise.all([
    prisma.block.findMany({
      where:  { blockerId: viewerId },
      select: { blockedId: true },
    }),
    prisma.block.findMany({
      where:  { blockedId: viewerId },
      select: { blockerId: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const b of blocking)  ids.add(b.blockedId);
  for (const b of blockedBy) ids.add(b.blockerId);
  return Array.from(ids);
}
