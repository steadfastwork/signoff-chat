import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway } from "@/lib/gateway";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.screenname) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { roomId } = (await req.json().catch(() => ({}))) as { roomId?: number };
  if (roomId == null) return NextResponse.json({ error: "roomId required" }, { status: 400 });
  try {
    await gateway.chatLeave(session.user.screenname, Number(roomId));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
