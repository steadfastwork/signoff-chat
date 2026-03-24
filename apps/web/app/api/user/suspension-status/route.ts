import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/user/suspension-status
// Called by middleware on every protected page load.
// Auto-lifts temporary suspensions whose suspendedUntil has passed.
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ isSuspended: false, suspendedUntil: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isSuspended:    true,
      suspendedUntil: true,
    },
  });

  if (!user) {
    return NextResponse.json({ isSuspended: false, suspendedUntil: null });
  }

  // Auto-lift expired temporary suspensions
  if (user.isSuspended && user.suspendedUntil && user.suspendedUntil < new Date()) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        isSuspended:    false,
        suspendedAt:    null,
        suspendedUntil: null,
        suspendReason:  null,
      },
    });
    return NextResponse.json({ isSuspended: false, suspendedUntil: null });
  }

  return NextResponse.json({
    isSuspended:    user.isSuspended,
    suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
  });
}
