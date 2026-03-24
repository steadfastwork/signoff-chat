import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { screenname: string } };

// ---------------------------------------------------------------------------
// POST /api/users/[screenname]/block
// Block a user. Immediate + silent — no notification to the blocked user.
// Also removes any existing buddy relation in either direction.
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

  const blockerId = session.user.id;
  const blockedId = target.id;

  if (blockerId === blockedId) {
    return NextResponse.json({ error: "cannot block yourself." }, { status: 400 });
  }

  // Upsert the block (idempotent)
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });

  // Remove buddy relation in either direction (hard delete — no trace)
  await prisma.buddyRelation.deleteMany({
    where: {
      OR: [
        { requesterId: blockerId, addresseeId: blockedId },
        { requesterId: blockedId, addresseeId: blockerId },
      ],
    },
  });

  return NextResponse.json({ blocked: true });
}

// ---------------------------------------------------------------------------
// DELETE /api/users/[screenname]/block — unblock
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

  await prisma.block.deleteMany({
    where: { blockerId: session.user.id, blockedId: target.id },
  });

  return NextResponse.json({ blocked: false });
}
