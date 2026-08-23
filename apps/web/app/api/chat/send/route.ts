import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway } from "@/lib/gateway";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.screenname) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { roomId, message } = (await req.json().catch(() => ({}))) as { roomId?: number; message?: string };
  if (roomId == null || !message?.trim()) return NextResponse.json({ error: "roomId and message required" }, { status: 400 });
  try {
    await gateway.chatSend(session.user.screenname, Number(roomId), message);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }
}
