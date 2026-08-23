import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway } from "@/lib/gateway";

// Set (or clear, with empty message) the away message. While away, the gateway
// auto-responds once per buddy. Special chars: %n buddy, %d date, %t time.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.screenname) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { message } = (await req.json().catch(() => ({}))) as { message?: string };
  try {
    await gateway.setAway(session.user.screenname, (message ?? "").trim());
    return NextResponse.json({ ok: true, away: !!(message ?? "").trim() });
  } catch {
    return NextResponse.json({ error: "could not set away" }, { status: 502 });
  }
}
