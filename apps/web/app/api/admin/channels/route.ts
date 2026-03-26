import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin, notFound } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = 50;

  const channels = await prisma.channel.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, screenname: true } },
      _count: { select: { members: true } },
    },
  });

  const hasMore = channels.length > limit;
  const items = hasMore ? channels.slice(0, limit) : channels;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ channels: items, nextCursor });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireSuperAdmin(session); } catch { return notFound(); }

  const body = (await req.json()) as {
    channelId: string;
    isFeatured?: boolean;
    isVerified?: boolean;
  };

  const { channelId, isFeatured, isVerified } = body;
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof isFeatured === "boolean") data.isFeatured = isFeatured;
  if (typeof isVerified === "boolean") data.isVerified = isVerified;

  const updated = await prisma.channel.update({ where: { id: channelId }, data });
  return NextResponse.json({ channel: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch { return notFound(); }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

  await prisma.channel.delete({ where: { id: channelId } });
  return NextResponse.json({ ok: true });
}
