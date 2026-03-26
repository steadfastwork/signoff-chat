import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, notFound } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const tab = searchParams.get("tab") ?? "all";
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = 50;

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {};

  if (search) {
    where.screenname = { contains: search, mode: "insensitive" };
  }

  if (tab === "suspended") {
    where.isSuspended = true;
  } else if (tab === "gold") {
    where.isGoldMember = true;
  } else if (tab === "new") {
    where.createdAt = { gte: oneWeekAgo };
  }

  const users = await prisma.user.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      screenname: true,
      isGoldMember: true,
      adminRole: true,
      status: true,
      isSuspended: true,
      suspendedUntil: true,
      warningCount: true,
      createdAt: true,
      _count: { select: { posts: true, reports: true } },
    },
  });

  const hasMore = users.length > limit;
  const items = hasMore ? users.slice(0, limit) : users;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ users: items, nextCursor });
}
