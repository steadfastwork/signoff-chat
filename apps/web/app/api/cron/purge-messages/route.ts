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
// Handler — hard DELETE all channel messages past their expiresAt.
//
// Expiry policy (set at send time):
//   Regular message:        30 days
//   Gold member message:    90 days
//   Delivered to all:       24 hours (overrides the above)
//
// Hard DELETE only — no soft delete, no archive. Gone is gone.
// ---------------------------------------------------------------------------

async function run() {
  const now = new Date();

  const { count } = await prisma.channelMessage.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  return { deleted: count, ranAt: now.toISOString() };
}

// ---------------------------------------------------------------------------
// GET — invoked by Vercel Cron (daily 3am UTC)
// POST — for manual / authenticated invocation
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "GET /api/cron/purge-messages");
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "POST /api/cron/purge-messages");
  }
}
