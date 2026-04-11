import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, notFound, auditLog } from "@/lib/admin-auth";

type Params = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  try { requireSuperAdmin(session); } catch { return notFound(); }
  if (!session?.user) return notFound();

  const award = await prisma.userBadge.findUnique({
    where: { id: params.id },
    include: { user: { select: { id: true, screenname: true } } },
  });
  if (!award) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.userBadge.delete({ where: { id: params.id } });

  await auditLog({
    adminId: session.user.id,
    adminRole: session.user.adminRole as "ADMIN" | "SUPER_ADMIN",
    action: "badge_revoked",
    targetId: award.user.id,
    targetType: "user",
    metadata: { badge: award.badge, screenname: award.user.screenname },
  });

  return NextResponse.json({ success: true });
}
