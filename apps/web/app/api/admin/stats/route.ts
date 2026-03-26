import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, notFound } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [total, newThisWeek, gold, online, openReports, suspended] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    prisma.user.count({ where: { isGoldMember: true } }),
    prisma.user.count({ where: { status: { in: ["ONLINE", "AWAY", "IDLE"] } } }),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { isSuspended: true } }),
  ]);

  return NextResponse.json({ total, newThisWeek, gold, online, openReports, suspended });
}
