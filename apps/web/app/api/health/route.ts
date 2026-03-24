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

  // Check Soketi configuration (env vars present)
  const soketiStatus =
    process.env.SOKETI_APP_ID &&
    process.env.SOKETI_APP_KEY &&
    process.env.SOKETI_APP_SECRET &&
    process.env.SOKETI_HOST
      ? "configured"
      : "missing_config";

  const allHealthy = dbStatus === "connected" && soketiStatus === "configured";

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      db:     dbStatus,
      soketi: soketiStatus,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 }
  );
}
