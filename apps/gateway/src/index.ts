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
import { IrcClient } from "./irc.js";

const PORT = Number(process.env.PORT || 8787);
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || "";
const OSCAR_HOST = process.env.OSCAR_HOST || "signoff-oscar.internal";
const OSCAR_TOC_PORT = Number(process.env.OSCAR_TOC_PORT || 9898);
// Management REST API (private 6PN only) — used to provision accounts.
const OSCAR_API_URL = process.env.OSCAR_API_URL || "http://signoff-oscar.internal:8080";
const SESSION_TTL_MS = 60 * 60 * 1000;

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
  irc: Map<string, IrcClient>; // network -> connection
}
const sessions = new Map<string, Session>();

function closeIrc(session: Session) {
  for (const c of session.irc.values()) c.close();
  session.irc.clear();
}

// IRC is decoupled from the OSCAR session: it works whenever the user is logged
// into the web app, even if their OSCAR session dropped (e.g. gateway restart).
interface IrcSession {
  irc: Map<string, IrcClient>;
  lastSeen: number;
}
const ircSessions = new Map<string, IrcSession>();
function ircSessionFor(sn: string): IrcSession {
  const key = norm(sn);
  let s = ircSessions.get(key);
  if (!s) {
    s = { irc: new Map(), lastSeen: Date.now() };
    ircSessions.set(key, s);
  }
  s.lastSeen = Date.now();
  return s;
}

function wire(client: TocClient, screenname: string) {
  const ch = channelFor(screenname);
  client.on("im", (im) => void pusher.trigger(ch, "im", im).catch(() => {}));
  client.on("buddy", (b) => void pusher.trigger(ch, "buddy", b).catch(() => {}));
  client.on("chat", (m) => void pusher.trigger(ch, "chat", m).catch(() => {}));
  client.on("chatroster", (r) => void pusher.trigger(ch, "chat-roster", r).catch(() => {}));
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
  sessions.set(key, { client, screenname, lastSeen: Date.now(), irc: new Map() });
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
  for (const [k, s] of sessions) if (now - s.lastSeen > SESSION_TTL_MS) { closeIrc(s); s.client.close(); sessions.delete(k); }
  for (const [k, s] of ircSessions) if (now - s.lastSeen > SESSION_TTL_MS) { for (const c of s.irc.values()) c.close(); ircSessions.delete(k); }
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
      case "/register": {
        // Provision a new AIM/ICQ account on open-oscar-server (canonical store).
        const pw = String(body.password || "");
        if (pw.length < 3) throw new HttpError(400, "password too short");
        const r = await fetch(`${OSCAR_API_URL}/user`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ screen_name: sn, password: pw }),
        });
        if (r.ok) return send(200, { ok: true });
        if (r.status === 409) return send(409, { error: "screenname already taken" });
        return send(502, { error: `oscar mgmt api returned ${r.status}` });
      }
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
        const s = sessions.get(norm(sn));
        if (s) { closeIrc(s); s.client.close(); }
        sessions.delete(norm(sn));
        const is = ircSessions.get(norm(sn));
        if (is) { for (const c of is.irc.values()) c.close(); ircSessions.delete(norm(sn)); }
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
      case "/roster": {
        return send(200, { buddies: requireSession(sn).client.getRoster() });
      }
      case "/chat/rooms": {
        // List public chat rooms via the OSCAR management API (exchange 5).
        requireSession(sn); // must be signed in
        const r = await fetch(`${OSCAR_API_URL}/chat/room/public`);
        if (!r.ok) return send(502, { error: `oscar mgmt api ${r.status}` });
        return send(200, { rooms: await r.json() });
      }
      case "/chat/join": {
        const room = String(body.room || "").trim();
        if (!room) throw new HttpError(400, "room required");
        const session = requireSession(sn);
        // open-oscar-server's TOC create-room path is broken; public rooms must be
        // created via the management API first, then joined over TOC. Idempotent.
        await fetch(`${OSCAR_API_URL}/chat/room/public`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: room }),
        }).catch(() => {});
        const res = await session.client.joinChat(room);
        return send(200, res);
      }
      case "/chat/send": {
        requireSession(sn).client.sendChat(Number(body.roomId), String(body.message || ""));
        return send(200, { ok: true });
      }
      case "/chat/leave": {
        requireSession(sn).client.leaveChat(Number(body.roomId));
        return send(200, { ok: true });
      }
      case "/irc/connect": {
        const session = ircSessionFor(sn);
        const network = String(body.network || "").trim();
        const host = String(body.host || "").trim();
        const nick = String(body.nick || "").trim();
        if (!network || !host || !nick) throw new HttpError(400, "network, host, nick required");
        const saslPassword = String(body.saslPassword || "") || undefined;
        const existing = session.irc.get(network);
        // Reuse a live connection ONLY if it's already on the requested nick and
        // no new password was supplied. If it's stuck on a suffixed nick (e.g.
        // `saynotozog_`) or the user just entered their NickServ password, tear it
        // down and reconnect fresh so SASL identify + nick-reclaim actually run.
        if (existing?.isRegistered() && existing.nick.toLowerCase() === nick.toLowerCase() && !saslPassword) {
          return send(200, { ok: true, nick: existing.nick });
        }
        if (existing) { existing.close(); session.irc.delete(network); }
        const irc = new IrcClient(network, host, Number(body.port) || 6697, body.tls !== false, nick);
        const ch = channelFor(sn);
        irc.on("message", (m) => void pusher.trigger(ch, "irc", m).catch(() => {}));
        irc.on("names", (n) => void pusher.trigger(ch, "irc-names", n).catch(() => {}));
        irc.on("system", (s2) => void pusher.trigger(ch, "irc-system", s2).catch(() => {}));
        irc.on("close", () => session.irc.delete(network));
        irc.on("error", (e) => console.warn(`[${sn}] irc ${network} error:`, e.message));
        session.irc.set(network, irc);
        try {
          await irc.connect("SIGNOFF user", saslPassword);
        } catch (e) {
          session.irc.delete(network);
          return send(502, { error: e instanceof Error ? e.message : "irc connect failed" });
        }
        for (const c of Array.isArray(body.channels) ? body.channels.map(String) : []) irc.join(c);
        return send(200, { ok: true, nick: irc.nick });
      }
      case "/irc/list": {
        const irc = ircSessionFor(sn).irc.get(String(body.network || ""));
        if (!irc) throw new HttpError(409, "not connected to that network");
        const channels = await irc.list(body.filter ? String(body.filter) : undefined);
        return send(200, { channels });
      }
      case "/irc/join": {
        const irc = ircSessionFor(sn).irc.get(String(body.network || ""));
        if (!irc) throw new HttpError(409, "not connected to that network");
        irc.join(String(body.channel || ""));
        return send(200, { ok: true });
      }
      case "/irc/send": {
        const irc = ircSessionFor(sn).irc.get(String(body.network || ""));
        if (!irc) throw new HttpError(409, "not connected to that network");
        irc.say(String(body.target || ""), String(body.message || ""));
        return send(200, { ok: true });
      }
      case "/irc/part": {
        ircSessionFor(sn).irc.get(String(body.network || ""))?.part(String(body.channel || ""));
        return send(200, { ok: true });
      }
      case "/irc/raw": {
        const irc = ircSessionFor(sn).irc.get(String(body.network || ""));
        if (!irc) throw new HttpError(409, "not connected to that network");
        irc.raw(String(body.line || ""));
        return send(200, { ok: true });
      }
      case "/irc/disconnect": {
        const s2 = ircSessionFor(sn);
        s2.irc.get(String(body.network || ""))?.close();
        s2.irc.delete(String(body.network || ""));
        return send(200, { ok: true });
      }
      case "/irc/status": {
        const s2 = ircSessionFor(sn);
        const networks = Array.from(s2.irc.entries()).map(([network, c]) => ({ network, nick: c.nick, channels: c.getChannels() }));
        return send(200, { networks });
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
