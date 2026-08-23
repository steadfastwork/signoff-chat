import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway, GatewayError } from "@/lib/gateway";

// Join (or create) a public chat room by name; returns its OSCAR room id.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.screenname) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { room } = (await req.json().catch(() => ({}))) as { room?: string };
  if (!room?.trim()) return NextResponse.json({ error: "room required" }, { status: 400 });
  try {
    const res = await gateway.chatJoin(session.user.screenname, room.trim());
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof GatewayError && e.status === 409) {
      return NextResponse.json({ error: "session expired — sign in again" }, { status: 409 });
    }
    return NextResponse.json({ error: "could not join room" }, { status: 502 });
  }
}
