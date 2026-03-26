import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, notFound } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = 50;

  const now = new Date();
  const invites = await prisma.inviteLink.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    where: { isRevoked: false, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    include: {
      channel: { select: { id: true, name: true } },
      board: { select: { id: true, name: true } },
    },
  });

  const hasMore = invites.length > limit;
  const items = hasMore ? invites.slice(0, limit) : invites;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ invites: items, nextCursor });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const { searchParams } = new URL(req.url);
  const inviteId = searchParams.get("inviteId");
  if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });

  await prisma.inviteLink.update({
    where: { id: inviteId },
    data: { isRevoked: true },
  });

  return NextResponse.json({ ok: true });
}
