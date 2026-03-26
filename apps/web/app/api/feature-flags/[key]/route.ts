import { NextRequest, NextResponse } from "next/server";
import { getFeatureFlag } from "@/lib/featureFlags";

/**
 * GET /api/feature-flags/:key
 *
 * Public endpoint — no auth required.
 * Returns { enabled: boolean } for any flag key.
 * Unknown keys return { enabled: false }.
 * Used by mobile app and edge clients that can't call Prisma directly.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string } }
) {
  const enabled = await getFeatureFlag(params.key);
  return NextResponse.json({ enabled });
}
