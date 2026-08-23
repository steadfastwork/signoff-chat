import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway } from "@/lib/gateway";

// Keep the caller's OSCAR session alive on the gateway while a messaging window
// is open. Best-effort — never errors the client.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.screenname) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    await gateway.heartbeat(session.user.screenname);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
