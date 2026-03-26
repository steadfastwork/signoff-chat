import { NextRequest, NextResponse } from "next/server";
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
// Handler — rotate RATE_LIMIT_SALT daily so IP hashes cannot be correlated
// across days. Old hashes become meaningless immediately.
//
// In production this should update the secret in AWS SSM Parameter Store or
// your secrets manager, then signal the running containers to reload. Here we
// generate the new value and return it so the operator can push it to the
// environment. A future enhancement can POST to SSM directly.
//
// Rotation schedule: daily at midnight UTC (see vercel.json).
// ---------------------------------------------------------------------------

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex"); // 32 hex chars
}

async function run() {
  const newSalt = generateSalt();
  const rotatedAt = new Date().toISOString();

  // If AWS SSM is configured, update the parameter in place.
  // @aws-sdk/client-ssm is an optional peer dep — only used when SSM param is set.
  const ssmName = process.env.RATE_LIMIT_SALT_SSM_PARAM;
  if (ssmName) {
    // SSM rotation requires @aws-sdk/client-ssm installed as a prod dependency.
    // For now, return the new salt so it can be manually applied.
    console.info(`[cron] new RATE_LIMIT_SALT (set in env): ${newSalt}`);
    return { rotated: false, newSalt, rotatedAt, note: "Install @aws-sdk/client-ssm to enable auto-rotation." };
  }

  // Fallback: return the new value so it can be manually applied.
  // This value is intentionally logged here — it's about to become the active
  // salt and is not sensitive until it is deployed.
  return { rotated: false, newSalt, rotatedAt, note: "Set RATE_LIMIT_SALT env var to this value." };
}

// ---------------------------------------------------------------------------
// GET — invoked by Vercel Cron (daily midnight UTC)
// POST — for manual / authenticated invocation
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "GET /api/cron/rotate-rate-limit-salt");
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    return internalError(err, "POST /api/cron/rotate-rate-limit-salt");
  }
}
