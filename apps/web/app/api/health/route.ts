import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/health
// Lightweight liveness + readiness check for Vercel / uptime monitors.
// Does not require authentication — safe to expose publicly.
// ---------------------------------------------------------------------------

export async function GET() {
  // Check database connectivity
  let dbStatus: "connected" | "error" = "connected";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  // Check Pusher configuration (env vars present)
  const pusherStatus =
    process.env.PUSHER_APP_ID &&
    process.env.PUSHER_KEY &&
    process.env.PUSHER_SECRET &&
    process.env.PUSHER_CLUSTER
      ? "configured"
      : "missing_config";

  const allHealthy = dbStatus === "connected" && pusherStatus === "configured";

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      db: dbStatus,
      pusher: pusherStatus,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 }
  );
}
