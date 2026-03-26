import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, notFound, auditLog } from "@/lib/admin-auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  try { requireSuperAdmin(session); } catch { return notFound(); }

  const admins = await prisma.user.findMany({
    where: { adminRole: { not: null } },
    select: {
      id: true,
      screenname: true,
      adminRole: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Get last active from AdminSession
  const sessions = await prisma.adminSession.findMany({
    where: { adminId: { in: admins.map((a) => a.id) } },
  });
  type AdminSessionEntry = { id: string; adminId: string; accessedAt: Date };
  const sessionMap = Object.fromEntries((sessions as AdminSessionEntry[]).map((s) => [s.adminId, s.accessedAt]));

  // Get grants
  const grants = await prisma.adminGrant.findMany({
    where: { grantedToId: { in: admins.map((a) => a.id) }, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const grantMap: Record<string, { grantedById: string; createdAt: Date }> = {};
  for (const g of grants) {
    if (!grantMap[g.grantedToId]) {
      grantMap[g.grantedToId] = { grantedById: g.grantedById, createdAt: g.createdAt };
    }
  }

  // Resolve grantor screennames
  const grantorIds = Array.from(new Set(Object.values(grantMap).map((g) => g.grantedById)));
  const grantors = await prisma.user.findMany({
    where: { id: { in: grantorIds } },
    select: { id: true, screenname: true },
  });
  const grantorMap = Object.fromEntries(grantors.map((g) => [g.id, g.screenname]));

  return NextResponse.json(
    admins.map((a) => ({
      ...a,
      lastActive: sessionMap[a.id] ?? null,
      grantedAt: grantMap[a.id]?.createdAt ?? null,
      grantedBy: grantMap[a.id] ? (grantorMap[grantMap[a.id].grantedById] ?? "database") : "database",
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireSuperAdmin(session); } catch { return notFound(); }
  if (!session?.user) return notFound();

  let body: { screenname: string; role: "ADMIN" | "SUPER_ADMIN"; reason: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.screenname || !body.role || !body.reason) {
    return NextResponse.json({ error: "screenname, role, and reason are required" }, { status: 400 });
  }
  if (!["ADMIN", "SUPER_ADMIN"].includes(body.role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { screenname: { equals: body.screenname, mode: "insensitive" } },
    select: { id: true, screenname: true, adminRole: true, isSuspended: true, warningCount: true },
  });

  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
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
    data: { adminRole: body.role },
  });

  await prisma.adminGrant.create({
    data: {
      grantedById: session.user.id,
      grantedToId: target.id,
      role: body.role,
      reason: body.reason,
    },
  });

  await auditLog({
    adminId: session.user.id,
    adminRole: session.user.adminRole as "ADMIN" | "SUPER_ADMIN",
    action: "grant-admin",
    targetId: target.id,
    targetType: "user",
    note: body.reason,
    metadata: { role: body.role },
  });

  return NextResponse.json({ ok: true, userId: target.id, role: body.role });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireSuperAdmin(session); } catch { return notFound(); }
  if (!session?.user) return notFound();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (userId === session.user.id) {
    return NextResponse.json({ error: "cannot revoke your own admin access" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, adminRole: true },
  });

  if (!target || !target.adminRole) return notFound();

  if (target.adminRole === "SUPER_ADMIN") {
    return NextResponse.json({ error: "cannot revoke SUPER_ADMIN via API" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { adminRole: null },
  });

  await prisma.adminGrant.updateMany({
    where: { grantedToId: userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedById: session.user.id },
  });

  await auditLog({
    adminId: session.user.id,
    adminRole: session.user.adminRole as "ADMIN" | "SUPER_ADMIN",
    action: "revoke-admin",
    targetId: userId,
    targetType: "user",
  });

  return NextResponse.json({ ok: true });
}
