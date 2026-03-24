import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function validateChannelName(name: string): string | null {
  if (!name) return "name is required.";
  if (name.length < 3 || name.length > 32)
    return "name must be 3–32 characters.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && !/^[a-z0-9]{3}$/.test(name))
    return "name can only use lowercase letters, numbers, and hyphens.";
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/channels — search PUBLIC + INVITE_ONLY channels
//                     or ?mine=true for the session user's channels
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const mine = searchParams.get("mine") === "true";

  if (mine) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.channelMember.findMany({
      where: { userId: session.user.id },
      include: {
        channel: {
          include: { _count: { select: { members: true } } },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return NextResponse.json(
      memberships.map((m) => ({
        id: m.channel.id,
        name: m.channel.name,
        description: m.channel.description,
        type: m.channel.type,
        slowModeMinutes: m.channel.slowModeMinutes,
        memberCap: m.channel.memberCap,
        memberCount: m.channel._count.members,
        joinedAt: m.joinedAt,
      }))
    );
  }

  // Public search: PUBLIC and INVITE_ONLY channels only
  const channels = await prisma.channel.findMany({
    where: {
      type: { in: ["PUBLIC", "INVITE_ONLY"] },
      ...(q.length >= 1
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { members: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: 30,
  });

  return NextResponse.json(
    channels.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      slowModeMinutes: c.slowModeMinutes,
      memberCap: c.memberCap,
      memberCount: c._count.members,
    }))
  );
}

// ---------------------------------------------------------------------------
// POST /api/channels — create a channel
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    name: string;
    type?: "PUBLIC" | "INVITE_ONLY" | "SECRET";
    slowModeMinutes?: number;
    memberCap?: number;
    description?: string;
  };

  const {
    name,
    type = "PUBLIC",
    slowModeMinutes = 10,
    memberCap,
    description,
  } = body;

  const slug = name?.trim().toLowerCase() ?? "";
  const nameErr = validateChannelName(slug);
  if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

  const slowMode = slowModeMinutes ?? 10;
  if (slowMode < 0 || slowMode > 60) {
    return NextResponse.json(
      { error: "slowModeMinutes must be 0–60." },
      { status: 400 }
    );
  }

  // PUBLIC channels: max 500 members. INVITE_ONLY / SECRET: unlimited.
  let cap: number | null = null;
  if (type === "PUBLIC") {
    cap = memberCap != null ? Math.min(memberCap, 500) : 500;
    if (cap < 2) cap = 2;
  }

  const existing = await prisma.channel.findUnique({ where: { name: slug } });
  if (existing) {
    return NextResponse.json(
      { error: "channel name already taken." },
      { status: 409 }
    );
  }

  const channel = await prisma.$transaction(async (tx) => {
    const ch = await tx.channel.create({
      data: {
        name: slug,
        description: description?.trim() || null,
        type,
        slowModeMinutes: slowMode,
        memberCap: cap,
        creatorId: session.user.id,
      },
    });
    await tx.channelMember.create({
      data: { userId: session.user.id, channelId: ch.id },
    });
    return ch;
  });

  return NextResponse.json(channel, { status: 201 });
}
