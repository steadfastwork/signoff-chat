import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { internalError } from "@/lib/api-error";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Handler — delete invite links that are expired, revoked, or exhausted.
//
// usesRemaining reaches 0 → hard-deleted inline at consumption time.
// This cron is a safety net for anything that slipped through.
// ---------------------------------------------------------------------------

async function run() {
  const now = new Date();

  const { count } = await prisma.inviteLink.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { isRevoked: true },
        { usesRemaining: { lte: 0 } },
      ],
    },
  });

  return { deleted: count, ranAt: now.toISOString() };
}

// ---------------------------------------------------------------------------
// GET — invoked by Vercel Cron
// POST — for manual / authenticated invocation
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json(result);
  } catch (err) {
    return internalError(err, "GET /api/cron/cleanup-invite-links");
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json(result);
  } catch (err) {
    return internalError(err, "POST /api/cron/cleanup-invite-links");
  }
}
