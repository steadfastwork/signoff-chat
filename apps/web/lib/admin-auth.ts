import { type Session } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const ADMIN_PATH = "/admin";

export function isAdmin(session: Session | null): boolean {
  return session?.user?.adminRole != null;
}

export function isSuperAdmin(session: Session | null): boolean {
  return session?.user?.adminRole === "SUPER_ADMIN";
}

/** Throws a 404 error if not admin. Use in API route handlers. */
export function requireAdmin(session: Session | null): void {
  if (!isAdmin(session)) {
    throw Object.assign(new Error("not found"), { status: 404 });
  }
}

/** Throws a 404 error if not super admin. Use in API route handlers. */
export function requireSuperAdmin(session: Session | null): void {
  if (!isSuperAdmin(session)) {
    throw Object.assign(new Error("not found"), { status: 404 });
  }
}

/** Returns a 404 JSON response. Use this in admin API routes for consistency. */
export function notFound() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

/** Log an admin action to AdminAuditLog. Fire-and-forget safe. */
export async function auditLog(params: {
  adminId: string;
  adminRole: "ADMIN" | "SUPER_ADMIN";
  action: string;
  targetId?: string;
  targetType?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.adminAuditLog.create({
    data: {
      ...params,
      metadata: params.metadata as never,
    },
  });
}

/** Upsert AdminSession to track last-active time for this admin. */
export async function touchAdminSession(adminId: string) {
  await prisma.adminSession.upsert({
    where: { adminId },
    create: { adminId, accessedAt: new Date() },
    update: { accessedAt: new Date() },
  });
}
