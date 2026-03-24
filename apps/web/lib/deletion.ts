/**
 * Hard account deletion.
 *
 * No grace period. No soft delete. No recovery.
 * Once called, every trace of the user is permanently removed.
 *
 * Deletion order respects FK constraints (children before parents).
 */

import { prisma } from "@/lib/prisma";
import { cancelStripeSubscription } from "@/lib/stripe";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Redis (for clearing presence / session cache)
// ---------------------------------------------------------------------------

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------

export async function deleteAccount(userId: string): Promise<void> {
  // ── 1. Remove all social graph data ────────────────────────────────────
  await prisma.boardCommentNudge.deleteMany({ where: { userId } });
  await prisma.boardNudge.deleteMany({ where: { userId } });
  await prisma.savedBoardPost.deleteMany({ where: { userId } });

  // ── 2. Remove authored content ──────────────────────────────────────────
  await prisma.boardComment.deleteMany({ where: { authorId: userId } });
  await prisma.boardPost.deleteMany({ where: { authorId: userId } });
  await prisma.channelMessage.deleteMany({ where: { authorId: userId } });
  await prisma.nudge.deleteMany({ where: { userId } });
  await prisma.reply.deleteMany({ where: { authorId: userId } });
  await prisma.post.deleteMany({ where: { authorId: userId } });

  // ── 3. Remove memberships and relationships ──────────────────────────────
  await prisma.boardMember.deleteMany({ where: { userId } });
  await prisma.channelMember.deleteMany({ where: { userId } });
  await prisma.buddyRelation.deleteMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
  });

  // ── 4. Remove invite links created by this user ─────────────────────────
  // Note: InviteLink no longer tracks createdById, so no action needed here.

  // ── 5. Clear push token (best-effort, before hard delete) ───────────────
  await prisma.user.update({
    where: { id: userId },
    data:  { expoPushToken: null },
  }).catch(() => {});

  // ── 6. Hard delete the user record ──────────────────────────────────────
  await prisma.user.delete({ where: { id: userId } });

  // ── 7. Cancel Stripe subscription (non-fatal if it fails) ───────────────
  try {
    await cancelStripeSubscription(userId);
  } catch (err) {
    console.error("[deletion] stripe cancellation failed for", userId, err);
  }

  // ── 8. Clear Redis presence / cache keys ─────────────────────────────────
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`user:${userId}`);
      await redis.del(`presence:${userId}`);
    } catch (err) {
      console.error("[deletion] redis cleanup failed for", userId, err);
    }
  }
}
