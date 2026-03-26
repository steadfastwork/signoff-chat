import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  requireAdmin,
  requireSuperAdmin,
  notFound,
  auditLog,
  isAdmin,
  isSuperAdmin,
} from "@/lib/admin-auth";

type Params = { params: { userId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      screenname: true,
      emailHash: true,
      isGoldMember: true,
      adminRole: true,
      adminNotes: true,
      status: true,
      isSuspended: true,
      suspendedAt: true,
      suspendedUntil: true,
      suspendReason: true,
      warningCount: true,
      createdAt: true,
      bio: true,
      _count: { select: { posts: true, reports: true } },
    },
  });

  if (!user) return notFound();

  return NextResponse.json({
    ...user,
    emailHashTail: user.emailHash.slice(-8),
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  if (!session?.user) return notFound();

  const adminActions = ["grant-admin", "revoke-admin", "promote-super-admin"];
  let body: {
    action: string;
    reason?: string;
    note?: string;
    suspendDays?: number;
    adminNotes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { action } = body;
  const validActions = [
    "warn",
    "suspend",
    "unsuspend",
    "permanent-ban",
    "grant-gold",
    "revoke-gold",
    "delete",
    "grant-admin",
    "revoke-admin",
    "promote-super-admin",
    "update-notes",
  ];

  if (!validActions.includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  // Super-admin-only actions
  if (adminActions.includes(action)) {
    try { requireSuperAdmin(session); } catch { return notFound(); }
  }

  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      screenname: true,
      adminRole: true,
      isSuspended: true,
      warningCount: true,
    },
  });

  if (!target) return notFound();

  const adminId = session.user.id;
  const adminRole = session.user.adminRole as "ADMIN" | "SUPER_ADMIN";

  try {
    switch (action) {
      case "warn": {
        await prisma.user.update({
          where: { id: target.id },
          data: { warningCount: { increment: 1 } },
        });
        await auditLog({
          adminId,
          adminRole,
          action: "warn",
          targetId: target.id,
          targetType: "user",
          note: body.note,
        });
        break;
      }

      case "suspend": {
        const now = new Date();
        const suspendedUntil = body.suspendDays
          ? new Date(now.getTime() + body.suspendDays * 86400_000)
          : null;
        await prisma.user.update({
          where: { id: target.id },
          data: {
            isSuspended: true,
            suspendedAt: now,
            suspendedUntil,
            suspendReason: body.reason ?? "Violation of community guidelines.",
          },
        });
        await auditLog({
          adminId,
          adminRole,
          action: "suspend",
          targetId: target.id,
          targetType: "user",
          note: body.note,
          metadata: { suspendDays: body.suspendDays ?? null },
        });
        break;
      }

      case "unsuspend": {
        await prisma.user.update({
          where: { id: target.id },
          data: { isSuspended: false, suspendedUntil: null, suspendReason: null },
        });
        await auditLog({
          adminId,
          adminRole,
          action: "unsuspend",
          targetId: target.id,
          targetType: "user",
          note: body.note,
        });
        break;
      }

      case "permanent-ban": {
        await prisma.user.update({
          where: { id: target.id },
          data: {
            isSuspended: true,
            suspendedAt: new Date(),
            suspendedUntil: null,
            suspendReason: body.reason ?? "Permanent ban.",
          },
        });
        await auditLog({
          adminId,
          adminRole,
          action: "permanent-ban",
          targetId: target.id,
          targetType: "user",
          note: body.note,
        });
        break;
      }

      case "grant-gold": {
        await prisma.user.update({
          where: { id: target.id },
          data: { isGoldMember: true },
        });
        await auditLog({
          adminId,
          adminRole,
          action: "grant-gold",
          targetId: target.id,
          targetType: "user",
          note: body.note,
        });
        break;
      }

      case "revoke-gold": {
        await prisma.user.update({
          where: { id: target.id },
          data: { isGoldMember: false },
        });
        await auditLog({
          adminId,
          adminRole,
          action: "revoke-gold",
          targetId: target.id,
          targetType: "user",
          note: body.note,
        });
        break;
      }

      case "delete": {
        await prisma.user.delete({ where: { id: target.id } });
        await auditLog({
          adminId,
          adminRole,
          action: "delete-user",
          targetId: target.id,
          targetType: "user",
          note: body.note,
        });
        return NextResponse.json({ ok: true, action: "delete" });
      }

      case "grant-admin": {
        if (target.isSuspended) {
          return NextResponse.json({ error: "cannot grant admin to suspended user" }, { status: 400 });
        }
        if (target.warningCount > 0) {
          return NextResponse.json({ error: "cannot grant admin to user with warnings" }, { status: 400 });
        }
        if (target.adminRole != null) {
          return NextResponse.json({ error: "user is already an admin" }, { status: 400 });
        }
        await prisma.user.update({
          where: { id: target.id },
          data: { adminRole: "ADMIN" },
        });
        await prisma.adminGrant.create({
          data: {
            grantedById: adminId,
            grantedToId: target.id,
            role: "ADMIN",
            reason: body.reason ?? "",
          },
        });
        await auditLog({
          adminId,
          adminRole,
          action: "grant-admin",
          targetId: target.id,
          targetType: "user",
          note: body.note,
        });
        break;
      }

      case "revoke-admin": {
        if (target.adminRole === "SUPER_ADMIN") {
          return NextResponse.json({ error: "cannot revoke SUPER_ADMIN via API" }, { status: 400 });
        }
        await prisma.user.update({
          where: { id: target.id },
          data: { adminRole: null },
        });
        // Mark grant as revoked
        await prisma.adminGrant.updateMany({
          where: { grantedToId: target.id, revokedAt: null },
          data: { revokedAt: new Date(), revokedById: adminId },
        });
        await auditLog({
          adminId,
          adminRole,
          action: "revoke-admin",
          targetId: target.id,
          targetType: "user",
          note: body.note,
        });
        break;
      }

      case "promote-super-admin": {
        if (target.adminRole === "SUPER_ADMIN") {
          return NextResponse.json({ error: "user is already SUPER_ADMIN" }, { status: 400 });
        }
        await prisma.user.update({
          where: { id: target.id },
          data: { adminRole: "SUPER_ADMIN" },
        });
        await auditLog({
          adminId,
          adminRole,
          action: "promote-super-admin",
          targetId: target.id,
          targetType: "user",
          note: body.note,
        });
        break;
      }

      case "update-notes": {
        await prisma.user.update({
          where: { id: target.id },
          data: { adminNotes: body.adminNotes ?? null },
        });
        break;
      }
    }

    return NextResponse.json({ ok: true, action });
  } catch (err) {
    console.error(`[admin/users/${params.userId}] PATCH error:`, err);
    return notFound();
  }
}
