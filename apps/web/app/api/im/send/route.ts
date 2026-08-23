import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway, GatewayError } from "@/lib/gateway";

// Send an instant message over OSCAR via the gateway. The gateway holds the
// caller's live session (established at login); inbound replies arrive on the
// caller's Pusher channel (see lib/gatewayChannel.ts).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.screenname) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { to, message } = (await req.json().catch(() => ({}))) as { to?: string; message?: string };
  if (!to || !message?.trim()) {
    return NextResponse.json({ error: "to and message are required" }, { status: 400 });
  }

  try {
    await gateway.sendIM(session.user.screenname, to.trim(), message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof GatewayError && e.status === 409) {
      // No live OSCAR session — the user needs to sign in again to re-establish it.
      return NextResponse.json({ error: "session expired — sign in again" }, { status: 409 });
    }
    const msg = e instanceof Error ? e.message : "send failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
