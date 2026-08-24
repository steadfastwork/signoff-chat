import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET  /api/user/profile — the signed-in user's editable profile fields.
// PATCH /api/user/profile { bio } — update the bio (mirror only; 160 chars max).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { screenname: true, bio: true },
  });
  return NextResponse.json({ screenname: user?.screenname ?? "", bio: user?.bio ?? "" });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { bio?: unknown };
  const bio = typeof body.bio === "string" ? body.bio.slice(0, 160) : undefined;
  if (bio === undefined) return NextResponse.json({ error: "bio required" }, { status: 400 });
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { bio },
    select: { bio: true },
  });
  return NextResponse.json({ ok: true, bio: user.bio });
}
