import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway } from "@/lib/gateway";

// Add one or more buddies to the caller's OSCAR buddy list. Presence for the new
// buddy then arrives as `buddy` events on the caller's Pusher channel.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.screenname) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { names } = (await req.json().catch(() => ({}))) as { names?: string[] };
  const list = (Array.isArray(names) ? names : []).map((n) => String(n).trim()).filter(Boolean);
  if (!list.length) return NextResponse.json({ error: "names required" }, { status: 400 });
  try {
    await gateway.addBuddies(session.user.screenname, list);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "could not add buddy" }, { status: 502 });
  }
}
