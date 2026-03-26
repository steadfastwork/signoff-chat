import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  requireSuperAdmin,
  notFound,
  auditLog,
} from "@/lib/admin-auth";
import { invalidateFlagCache } from "@/lib/featureFlags";

// ---------------------------------------------------------------------------
// GET /api/admin/flags — list all feature flags (admin only)
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  return NextResponse.json({ flags });
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/flags — toggle a feature flag (super admin only)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireSuperAdmin(session); } catch { return notFound(); }

  const body = (await req.json()) as { key: string; enabled: boolean };
  const { key, enabled } = body;

  if (!key || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "key and enabled are required." }, { status: 400 });
  }

  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) {
    return NextResponse.json({ error: "flag not found." }, { status: 404 });
  }

  const now = new Date();
  const updated = await prisma.featureFlag.update({
    where: { key },
    data: {
      enabled,
      enabledAt: enabled ? now : null,
      enabledBy: enabled ? session!.user!.screenname : null,
    },
  });

  // Invalidate cache (no-op currently, placeholder for future Redis layer)
  await invalidateFlagCache(key);

  // Audit log
  await auditLog({
    adminId: session!.user!.id,
    adminRole: session!.user!.adminRole as "ADMIN" | "SUPER_ADMIN",
    action: enabled ? "feature_enabled" : "feature_disabled",
    metadata: { key },
  });

  return NextResponse.json({ flag: updated });
}
