/**
 * Founders channel helpers.
 *
 * When a FOUNDER badge is awarded (via admin or onboarding auto-award),
 * the user is automatically added to the #founders SECRET channel if it exists.
 */

import { prisma } from "@/lib/prisma";

const FOUNDERS_CHANNEL_NAME = "founders";

/**
 * If the #founders channel exists, add userId as a member.
 * Idempotent — safe to call multiple times.
 */
export async function addUserToFoundersChannel(userId: string): Promise<void> {
  const channel = await prisma.channel.findUnique({
    where: { name: FOUNDERS_CHANNEL_NAME },
    select: { id: true },
  });
  if (!channel) return;

  // upsert avoids duplicate-member errors
  const existing = await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId, channelId: channel.id } },
  });
  if (existing) return;

  await prisma.$transaction([
    prisma.channelMember.create({
      data: { userId, channelId: channel.id },
    }),
    prisma.channel.update({
      where: { id: channel.id },
      data: { memberCount: { increment: 1 } },
    }),
  ]);
}
