import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin, notFound, auditLog } from "@/lib/admin-auth";
import { BADGE_ORDER, FOUNDER_CAP, type BadgeType } from "@/lib/badges";
import { addUserToFoundersChannel } from "@/lib/founders";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const { searchParams } = new URL(req.url);
  const badge = searchParams.get("badge") as BadgeType | null;
  const search = searchParams.get("search") ?? "";
  const cursor = searchParams.get("cursor");
  const limit = 50;

  const where = {
    ...(badge ? { badge } : {}),
    ...(search ? { user: { screenname: { contains: search, mode: "insensitive" as const } } } : {}),
  };

  const [awards, total] = await Promise.all([
    prisma.userBadge.findMany({
      where,
      include: { user: { select: { screenname: true, isGoldMember: true } } },
      orderBy: { awardedAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }),
    prisma.userBadge.count({ where }),
  ]);

  return NextResponse.json({ awards, total });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireSuperAdmin(session); } catch { return notFound(); }
  if (!session?.user) return notFound();

  let body: { screenname: string; badge: BadgeType; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const { screenname, badge, note } = body;

  if (!BADGE_ORDER.includes(badge)) {
    return NextResponse.json({ error: "invalid badge type" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { screenname: { equals: screenname.trim(), mode: "insensitive" } },
    select: { id: true, screenname: true, emailHash: true },
  });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // Check duplicate
  const existing = await prisma.userBadge.findUnique({
    where: { userId_badge: { userId: user.id, badge } },
  });
  if (existing) {
    return NextResponse.json({ error: `${user.screenname} already has the ${badge} badge.` }, { status: 409 });
  }

  // Enforce Founder cap
  if (badge === "FOUNDER") {
    const count = await prisma.userBadge.count({ where: { badge: "FOUNDER" } });
    if (count >= FOUNDER_CAP) {
      return NextResponse.json({
        error: `Founder badge is limited to 100 members. This would be number ${count + 1}.`,
      }, { status: 400 });
    }
  }

  const awarded = await prisma.userBadge.create({
    data: {
      userId: user.id,
      badge,
      awardedById: session.user.screenname,
      note: note?.trim() || null,
    },
  });

  // Auto-add to #founders channel when awarding FOUNDER badge
  if (badge === "FOUNDER") {
    await addUserToFoundersChannel(user.id);
  }

  await auditLog({
    adminId: session.user.id,
    adminRole: session.user.adminRole as "ADMIN" | "SUPER_ADMIN",
    action: "badge_awarded",
    targetId: user.id,
    targetType: "user",
    metadata: { badge, screenname: user.screenname, note },
  });

  return NextResponse.json({ badge: awarded }, { status: 201 });
}
