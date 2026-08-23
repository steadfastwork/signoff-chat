import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway } from "@/lib/gateway";

// List public chat rooms (OSCAR exchange 5).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.screenname) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { rooms } = await gateway.chatRooms(session.user.screenname);
    return NextResponse.json({ rooms: Array.isArray(rooms) ? rooms : [] });
  } catch {
    return NextResponse.json({ rooms: [] });
  }
}
