// SIGNOFF gateway: holds one live OSCAR (TOC2) session per online user and
// relays inbound protocol events to Pusher, which the web/desktop/mobile clients
// already subscribe to. Outbound actions arrive as authenticated HTTP calls from
// the Next.js app (server-side). The browser never talks to this directly.
//
//   Browser ──HTTP──▶ Next API ──HTTP(x-gateway-secret)──▶ Gateway ──TOC──▶ OSCAR
//   Browser ◀──Pusher WS──────────────── Gateway (relays IM/presence) ◀──────┘
//
// Env: PORT, GATEWAY_SECRET, OSCAR_HOST, OSCAR_TOC_PORT,
//      PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER
import http from "node:http";
import Pusher from "pusher";
import { TocClient } from "./toc.js";

const PORT = Number(process.env.PORT || 8787);
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || "";
const OSCAR_HOST = process.env.OSCAR_HOST || "signoff-oscar.internal";
const OSCAR_TOC_PORT = Number(process.env.OSCAR_TOC_PORT || 9898);
const SESSION_TTL_MS = 15 * 60 * 1000;

if (!GATEWAY_SECRET) {
  console.error("FATAL: GATEWAY_SECRET is required");
  process.exit(1);
}

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.PUSHER_KEY || "",
  secret: process.env.PUSHER_SECRET || "",
  cluster: process.env.PUSHER_CLUSTER || "us2",
  useTLS: true,
});

// Pusher channel/name safety: allowed set is [A-Za-z0-9_\-=@,.;]. OSCAR
// screennames are case-insensitive and space-insensitive → normalize.
const norm = (sn: string) => sn.toLowerCase().replace(/[^a-z0-9]/g, "");
const channelFor = (sn: string) => `private-user-${norm(sn)}`;

interface Session {
  client: TocClient;
  screenname: string;
  lastSeen: number;
}
const sessions = new Map<string, Session>();

function wire(client: TocClient, screenname: string) {
  const ch = channelFor(screenname);
  client.on("im", (im) => void pusher.trigger(ch, "im", im).catch(() => {}));
  client.on("buddy", (b) => void pusher.trigger(ch, "buddy", b).catch(() => {}));
  client.on("close", () => {
    sessions.delete(norm(screenname));
    void pusher.trigger(ch, "session-closed", {}).catch(() => {});
  });
  client.on("error", (e) => console.warn(`[${screenname}] toc error:`, e.message));
}

/** Validate credentials by opening a fresh OSCAR session (replacing any prior). */
async function login(screenname: string, password: string): Promise<void> {
  const key = norm(screenname);
  sessions.get(key)?.client.close();
  const client = new TocClient(screenname, password, OSCAR_HOST, OSCAR_TOC_PORT);
  wire(client, screenname);
  await client.connect(); // rejects on bad credentials / timeout
  sessions.set(key, { client, screenname, lastSeen: Date.now() });
}

function requireSession(screenname: string): Session {
  const s = sessions.get(norm(screenname));
  if (!s || !s.client.isConnected()) throw new HttpError(409, "no active session; log in first");
  s.lastSeen = Date.now();
  return s;
}

// Idle sweep: close sessions the web app stopped heart-beating.
setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.lastSeen > SESSION_TTL_MS) { s.client.close(); sessions.delete(k); }
}, 60000);

class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new HttpError(400, "bad json")); } });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const send = (status: number, obj: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  try {
    const url = req.url || "/";
    if (url === "/health") return send(200, { ok: true, sessions: sessions.size });

    // Every other route requires the shared secret.
    if (req.headers["x-gateway-secret"] !== GATEWAY_SECRET) return send(401, { error: "unauthorized" });
    if (req.method !== "POST") return send(405, { error: "method not allowed" });

    const body = await readJson(req);
    const sn = String(body.screenname || "");
    if (!sn) throw new HttpError(400, "screenname required");

    switch (url) {
      case "/login": {
        try {
          await login(sn, String(body.password || ""));
        } catch (e) {
          // Any connect() rejection here is an auth failure (bad creds / timeout).
          return send(401, { error: "incorrect screenname or password" });
        }
        return send(200, { ok: true });
      }
      case "/logout": {
        sessions.get(norm(sn))?.client.close();
        sessions.delete(norm(sn));
        return send(200, { ok: true });
      }
      case "/heartbeat": {
        requireSession(sn);
        return send(200, { ok: true });
      }
      case "/im": {
        requireSession(sn).client.sendIM(String(body.dest || ""), String(body.message || ""), Boolean(body.auto));
        return send(200, { ok: true });
      }
      case "/buddies/add": {
        const names = Array.isArray(body.names) ? body.names.map(String) : [];
        requireSession(sn).client.addBuddies(names);
        return send(200, { ok: true });
      }
      case "/away": {
        requireSession(sn).client.setAway(String(body.message || ""));
        return send(200, { ok: true });
      }
      default:
        return send(404, { error: "not found" });
    }
  } catch (e) {
    if (e instanceof HttpError) return send(e.status, { error: e.message });
    // A failed login (bad creds) surfaces here as a connect() rejection.
    const msg = e instanceof Error ? e.message : "error";
    const status = /incorrect|timeout|auth/i.test(msg) ? 401 : 500;
    return send(status, { error: msg });
  }
});

server.listen(PORT, () => console.log(`signoff-gateway listening on :${PORT} → OSCAR ${OSCAR_HOST}:${OSCAR_TOC_PORT}`));
