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
// Handler — set isArchived=true on board posts older than 30 days
// ---------------------------------------------------------------------------

async function run() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Gold members get unlimited board post history — only archive non-Gold posts
  const result = await prisma.boardPost.updateMany({
    where: {
      isArchived: false,
      createdAt: { lt: cutoff },
      author: { isGoldMember: false },
    },
    data: { isArchived: true },
  });

  return {
    archived: result.count,
    cutoff: cutoff.toISOString(),
    ranAt: new Date().toISOString(),
  };
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
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "GET /api/cron/archive-board-posts");
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "POST /api/cron/archive-board-posts");
  }
}
