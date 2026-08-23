import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gateway, GatewayError } from "@/lib/gateway";

// IRC bridge actions, all keyed to the caller's screenname (their gateway session
// holds the per-network IRC connections). POST { action, ... }.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sn = session?.user?.screenname;
  if (!sn) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");
  try {
    switch (action) {
      case "connect":
        return NextResponse.json(
          await gateway.ircConnect(sn, {
            network: String(body.network || ""),
            host: String(body.host || ""),
            port: body.port ? Number(body.port) : undefined,
            tls: body.tls !== false,
            nick: String(body.nick || ""),
            channels: Array.isArray(body.channels) ? body.channels.map(String) : [],
            saslPassword: body.saslPassword ? String(body.saslPassword) : undefined,
          }),
        );
      case "join":
        return NextResponse.json(await gateway.ircJoin(sn, String(body.network || ""), String(body.channel || "")));
      case "send":
        return NextResponse.json(await gateway.ircSend(sn, String(body.network || ""), String(body.target || ""), String(body.message || "")));
      case "part":
        return NextResponse.json(await gateway.ircPart(sn, String(body.network || ""), String(body.channel || "")));
      case "disconnect":
        return NextResponse.json(await gateway.ircDisconnect(sn, String(body.network || "")));
      case "status":
        return NextResponse.json(await gateway.ircStatus(sn));
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof GatewayError) {
      const msg = e.status === 409 ? "session expired — sign in again" : e.message;
      return NextResponse.json({ error: msg }, { status: e.status });
    }
    return NextResponse.json({ error: "irc request failed" }, { status: 502 });
  }
}
