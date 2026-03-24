/**
 * Key Rotation Cron — /api/cron/rotate-channel-keys
 *
 * Triggered externally (e.g., Vercel Cron, GitHub Actions) every 6 hours.
 * Finds ChannelKey records expiring within the next 24 hours, generates a
 * fresh session key for each channel, and re-encrypts it for all current
 * members who have uploaded their ML-KEM-1024 public key.
 *
 * Authorization: Bearer token in Authorization header must match CRON_SECRET.
 *
 * Old ChannelKey records are intentionally kept (never deleted) so that
 * clients can still decrypt historical messages using the correct epoch key.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateSessionKey,
  buildEncryptedKeysMap,
} from "@/lib/crypto/index";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 h from now

  // Find all ChannelKey records expiring within the next 24 hours
  const expiringKeys = await prisma.channelKey.findMany({
    where: { expiresAt: { lte: cutoff } },
    select: { channelId: true, keyVersion: true },
    distinct: ["channelId"],
    orderBy: { keyVersion: "desc" },
  });

  if (expiringKeys.length === 0) {
    return NextResponse.json({ rotated: 0 });
  }

  const results: Array<{ channelId: string; keyVersion: number; memberCount: number }> = [];

  for (const { channelId, keyVersion } of expiringKeys) {
    // Fetch all channel members who have uploaded a public key
    const members = await prisma.channelMember.findMany({
      where: { channelId },
      select: {
        userId: true,
        user: { select: { mlkemPublicKey: true } },
      },
    });

    const eligibleMembers = members
      .filter((m) => m.user.mlkemPublicKey)
      .map((m) => ({ userId: m.userId, mlkemPublicKey: m.user.mlkemPublicKey! }));

    if (eligibleMembers.length === 0) {
      // No members with public keys — skip rotation for this channel
      continue;
    }

    // Generate a new session key and encrypt it per member
    const sessionKey = generateSessionKey();
    const encryptedKeys = buildEncryptedKeysMap(sessionKey, eligibleMembers);

    const nextVersion = keyVersion + 1;
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.channelKey.create({
      data: {
        channelId,
        encryptedKeys,
        keyVersion: nextVersion,
        expiresAt,
      },
    });

    results.push({ channelId, keyVersion: nextVersion, memberCount: eligibleMembers.length });
  }

  return NextResponse.json({
    rotated: results.length,
    channels: results,
  });
}

// Also support GET for Vercel Cron (which uses GET by default)
export async function GET(req: NextRequest) {
  return POST(req);
}
