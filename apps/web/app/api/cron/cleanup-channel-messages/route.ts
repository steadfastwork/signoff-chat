import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { internalError } from "@/lib/api-error";

const MAX_MESSAGES_PER_CHANNEL = 500;

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Handler — keep the newest MAX_MESSAGES_PER_CHANNEL messages per channel
// ---------------------------------------------------------------------------

async function run() {
  // Get all channels that have messages
  const channels = await prisma.channel.findMany({
    select: { id: true, name: true },
    where: {
      messages: { some: {} },
    },
  });

  let totalDeleted = 0;
  const details: { channel: string; deleted: number }[] = [];

  for (const channel of channels) {
    const count = await prisma.channelMessage.count({
      where: { channelId: channel.id },
    });

    if (count <= MAX_MESSAGES_PER_CHANNEL) continue;

    // Find the IDs to delete (oldest messages beyond the cap)
    const excess = count - MAX_MESSAGES_PER_CHANNEL;
    const toDelete = await prisma.channelMessage.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: "asc" },
      take: excess,
      select: { id: true },
    });

    const { count: deleted } = await prisma.channelMessage.deleteMany({
      where: { id: { in: toDelete.map((m) => m.id) } },
    });

    totalDeleted += deleted;
    details.push({ channel: channel.name, deleted });
  }

  return { totalDeleted, channelsProcessed: channels.length, details };
}

// ---------------------------------------------------------------------------
// GET — invoked by Vercel Cron (crons always send GET)
// POST — for manual / authenticated invocation
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json({ ...result, ranAt: new Date().toISOString() });
  } catch (err) {
    return internalError(err, "GET /api/cron/cleanup-channel-messages");
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json({ ...result, ranAt: new Date().toISOString() });
  } catch (err) {
    return internalError(err, "POST /api/cron/cleanup-channel-messages");
  }
}
