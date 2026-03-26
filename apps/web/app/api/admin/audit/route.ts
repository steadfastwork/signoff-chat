import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, notFound } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = 50;

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const logs = await prisma.adminAuditLog.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where,
    orderBy: { createdAt: "desc" },
  });

  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Resolve admin screennames
  const rawItems = items as Array<{ id: string; adminId: string; adminRole: string; action: string; createdAt: Date; targetId?: string | null; targetType?: string | null; note?: string | null; metadata?: unknown }>;
  const adminIds: string[] = Array.from(new Set(rawItems.map((l) => l.adminId)));
  const admins = await prisma.user.findMany({
    where: { id: { in: adminIds } },
    select: { id: true, screenname: true },
  });
  const adminMap = Object.fromEntries(admins.map((a) => [a.id, a.screenname]));

  return NextResponse.json({
    logs: rawItems.map((l) => ({
      ...l,
      adminScreenname: adminMap[l.adminId] ?? l.adminId,
    })),
    nextCursor,
  });
}
