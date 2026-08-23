// Server-side client for the SIGNOFF protocol gateway (apps/gateway on Fly).
//
// ⚠️ SERVER ONLY — this uses GATEWAY_SECRET. Never import it into a client
// component. Call it from route handlers, server actions, and NextAuth.
//
// The gateway holds one live OSCAR session per user (keyed by screenname) and
// relays inbound IM/presence to Pusher; these helpers are the outbound side.
const GATEWAY_URL = process.env.GATEWAY_URL || "";
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || "";

export class GatewayError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

async function call<T = { ok: true }>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!GATEWAY_URL || !GATEWAY_SECRET) throw new GatewayError(500, "gateway not configured");
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-gateway-secret": GATEWAY_SECRET },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    throw new GatewayError(502, `gateway unreachable: ${e instanceof Error ? e.message : "network error"}`);
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!res.ok) throw new GatewayError(res.status, json?.error || `gateway returned ${res.status}`);
  return json as T;
}

export const gateway = {
  /** Provision a new AIM/ICQ account on open-oscar-server (canonical store). 409 if taken. */
  register: (screenname: string, password: string) => call("/register", { screenname, password }),
  /** Validate credentials by opening/keeping an OSCAR session. Throws GatewayError(401) on bad creds. */
  login: (screenname: string, password: string) => call("/login", { screenname, password }),
  logout: (screenname: string) => call("/logout", { screenname }),
  /** Refresh the gateway session's idle TTL (call periodically while the user is active). */
  heartbeat: (screenname: string) => call("/heartbeat", { screenname }),
  sendIM: (screenname: string, dest: string, message: string, auto = false) =>
    call("/im", { screenname, dest, message, auto }),
  addBuddies: (screenname: string, names: string[]) => call("/buddies/add", { screenname, names }),
  setAway: (screenname: string, message: string) => call("/away", { screenname, message }),
  roster: (screenname: string) =>
    call<{ buddies: BuddyPresence[] }>("/roster", { screenname }),
};

export interface BuddyPresence {
  name: string;
  online: boolean;
  warnLevel: number;
  idleMinutes: number;
  userClass: string;
}
