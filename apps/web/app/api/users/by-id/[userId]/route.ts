import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      screenname: true,
      isGoldMember: true,
      status: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    screenname: user.screenname,
    isGoldMember: user.isGoldMember,
    status: user.status === "INVISIBLE" ? "OFFLINE" : user.status,
  });
}
