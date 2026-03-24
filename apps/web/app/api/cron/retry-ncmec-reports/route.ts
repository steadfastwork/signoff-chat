import { NextRequest, NextResponse } from "next/server";
import { retryFailedNCMECReports } from "@/lib/safety/ncmec";
import { internalError } from "@/lib/api-error";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// GET / POST /api/cron/retry-ncmec-reports
//
// Retries any SafetyIncident records where NCMEC filing previously failed.
// ESPs have 24 hours to file — this cron runs hourly to ensure compliance.
// ---------------------------------------------------------------------------

async function run() {
  await retryFailedNCMECReports();
  return { ok: true, ranAt: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "GET /api/cron/retry-ncmec-reports");
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "POST /api/cron/retry-ncmec-reports");
  }
}
