import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const awayId = params.id;

  // Verify entry exists
  const entry = await prisma.awayMessageHistory.findUnique({
    where: { id: awayId },
    select: { id: true, userId: true, nudgeCount: true },
  });
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Can't nudge own away message
  if (entry.userId === session.user.id) {
    return NextResponse.json({ error: "cannot nudge own message" }, { status: 400 });
  }

  // Toggle nudge
  const existing = await prisma.awayNudge.findUnique({
    where: { userId_awayId: { userId: session.user.id, awayId } },
  });

  let hasNudged: boolean;
  let nudgeCount: number;

  if (existing) {
    // Un-nudge
    await prisma.awayNudge.delete({
      where: { userId_awayId: { userId: session.user.id, awayId } },
    });
    const updated = await prisma.awayMessageHistory.update({
      where: { id: awayId },
      data: { nudgeCount: { decrement: 1 } },
      select: { nudgeCount: true },
    });
    hasNudged = false;
    nudgeCount = Math.max(0, updated.nudgeCount);
  } else {
    // Nudge
    await prisma.awayNudge.create({
      data: { userId: session.user.id, awayId },
    });
    const updated = await prisma.awayMessageHistory.update({
      where: { id: awayId },
      data: { nudgeCount: { increment: 1 } },
      select: { nudgeCount: true },
    });
    hasNudged = true;
    nudgeCount = updated.nudgeCount;
  }

  return NextResponse.json({ hasNudged, nudgeCount });
}
