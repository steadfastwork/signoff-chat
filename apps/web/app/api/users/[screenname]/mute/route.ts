import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { screenname: string } };

// ---------------------------------------------------------------------------
// POST /api/users/[screenname]/mute
// Mute a user. Muted users disappear from the muter's feed/channels.
// The muted user sees the muter normally. Silent — no notification.
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const target = await prisma.user.findFirst({
    where: { screenname: { equals: params.screenname, mode: "insensitive" } },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  const muterId = session.user.id;
  const mutedId = target.id;

  if (muterId === mutedId) {
    return NextResponse.json({ error: "cannot mute yourself." }, { status: 400 });
  }

  await prisma.mute.upsert({
    where: { muterId_mutedId: { muterId, mutedId } },
    create: { muterId, mutedId },
    update: {},
  });

  return NextResponse.json({ muted: true });
}

// ---------------------------------------------------------------------------
// DELETE /api/users/[screenname]/mute — unmute
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const target = await prisma.user.findFirst({
    where: { screenname: { equals: params.screenname, mode: "insensitive" } },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  await prisma.mute.deleteMany({
    where: { muterId: session.user.id, mutedId: target.id },
  });

  return NextResponse.json({ muted: false });
}
