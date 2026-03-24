import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const userSelect = {
  id: true,
  screenname: true,
  isGoldMember: true,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [sent, received] = await Promise.all([
    prisma.tip.findMany({
      where: { senderId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amount: true,
        message: true,
        createdAt: true,
        recipient: { select: userSelect },
      },
    }),
    prisma.tip.findMany({
      where: { recipientId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amount: true,
        message: true,
        createdAt: true,
        sender: { select: userSelect },
      },
    }),
  ]);

  return NextResponse.json({ sent, received });
}
