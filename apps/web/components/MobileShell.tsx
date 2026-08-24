"use client";

// Mobile single-window experience (PROMPTS #9 + the approved SIGNOFF Retro Mobile
// mock): full-screen retro window + a rounded Buddies/Channels/Away/Setup bottom
// tab bar. Rendered only on <1024px viewports (see (app)/layout.tsx); desktop keeps
// its multi-window pages. Reuses the same gateway APIs + Pusher as the desktop UI.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { soketiClient } from "@/lib/soketi";
import { gatewayUserChannel } from "@/lib/gatewayChannel";
import { IRC_NETWORKS, findNetwork } from "@/lib/ircNetworks";
import {
  RetroWindow,
  BuddyRow,
  MessageLog,
  FormatToolbar,
  SendButton,
  AwayBanner,
  btnStyle,
  inputStyle,
  retro,
  snColor,
  sounds,
  type RetroBuddy,
  type RetroMessage,
  type RetroMessageFormat,
} from "@/components/retro/retro-components";

type Tab = "buddies" | "channels" | "away" | "setup";
type Presence = { name: string; online: boolean };

export function MobileShell() {
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const me = session?.user?.screenname ?? "";
  const [tab, setTab] = useState<Tab>("buddies");

  // buddies + DM
  const [buddies, setBuddies] = useState<RetroBuddy[]>([]);
  const [newBuddy, setNewBuddy] = useState("");
  const [dmTarget, setDmTarget] = useState<string | null>(null);
  const dmTargetRef = useRef<string | null>(null);
  dmTargetRef.current = dmTarget;
  const [dmByBuddy, setDmByBuddy] = useState<Record<string, RetroMessage[]>>({});

  // channels
  const [rooms, setRooms] = useState<{ name: string; participants?: unknown[] }[]>([]);
  const [room, setRoom] = useState<{ roomId: number; name: string } | null>(null);
  const roomRef = useRef<number | null>(null);
  const [roomMsgs, setRoomMsgs] = useState<RetroMessage[]>([]);
  const [roomWho, setRoomWho] = useState<string[]>([]);
  const [roomInput, setRoomInput] = useState("");

  // IRC
  const [ircNetId, setIrcNetId] = useState(IRC_NETWORKS[0].id);
  const [ircNick, setIrcNick] = useState("");
  const [ircPw, setIrcPw] = useState("");
  const [ircConnected, setIrcConnected] = useState<{ netId: string; nick: string } | null>(null);
  const [ircChannels, setIrcChannels] = useState<string[]>([]);
  const [ircJoinInput, setIrcJoinInput] = useState("");
  const [ircView, setIrcView] = useState<string | null>(null); // active irc channel
  const ircViewRef = useRef<string | null>(null);
  ircViewRef.current = ircView;
  const [ircMsgs, setIrcMsgs] = useState<Record<string, RetroMessage[]>>({});
  const [ircBusy, setIrcBusy] = useState(false);

  // away
  const [away, setAway] = useState(false);
  const [awayActive, setAwayActive] = useState("");
  const [awayInput, setAwayInput] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [saveForLater, setSaveForLater] = useState(true);

  // compose
  const [text, setText] = useState("");
  const [format, setFormat] = useState<RetroMessageFormat>({ color: retro.ink });

  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("signoff_away_presets") || "[]"));
    } catch {}
  }, []);

  const loadBuddies = useCallback(async () => {
    try {
      const j = await (await fetch("/api/buddies")).json();
      setBuddies(((j.buddies as Presence[]) ?? []).map((p) => ({ screenname: p.name, status: p.online ? "ONLINE" : "OFFLINE" }) as RetroBuddy).sort(sortB));
    } catch {}
  }, []);
  const loadRooms = useCallback(async () => {
    try {
      const j = await (await fetch("/api/chat/rooms")).json();
      setRooms(Array.isArray(j.rooms) ? j.rooms : []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!me) return;
    loadBuddies();
    loadRooms();
    const t = setInterval(loadBuddies, 30000);
    return () => clearInterval(t);
  }, [me, loadBuddies, loadRooms]);

  useEffect(() => {
    if (!me || !soketiClient) return;
    const ch = soketiClient.subscribe(gatewayUserChannel(me));
    const onIM = (m: { from: string; message: string }) => {
      setDmByBuddy((p) => ({ ...p, [m.from]: [...(p[m.from] ?? []), { screenname: m.from, text: m.message, time: now() }] }));
      sounds.msgIn();
    };
    const onBuddy = (b: { name: string; online: boolean }) =>
      setBuddies((p) => [...p.filter((x) => x.screenname.toLowerCase() !== b.name.toLowerCase()), { screenname: b.name, status: b.online ? "ONLINE" : "OFFLINE" } as RetroBuddy].sort(sortB));
    const onChat = (m: { roomId: number; from: string; message: string }) => {
      if (m.roomId === roomRef.current) setRoomMsgs((p) => [...p, { screenname: m.from, text: m.message, time: now() }]);
    };
    const onRoster = (r: { roomId: number; users: string[] }) => {
      if (r.roomId === roomRef.current) setRoomWho(r.users);
    };
    const onIrc = (m: { target: string; from: string; message: string }) => {
      setIrcMsgs((p) => ({ ...p, [m.target]: [...(p[m.target] ?? []), { screenname: m.from, text: m.message, time: now() }] }));
      if (m.target !== ircViewRef.current || m.from.toLowerCase() !== (ircNick || me).toLowerCase()) sounds.msgIn();
    };
    const onIrcSys = (s: { text: string }) => {
      const k = ircViewRef.current || "*server*";
      setIrcMsgs((p) => ({ ...p, [k]: [...(p[k] ?? []), { screenname: "sys", text: "", time: now(), sys: `— ${s.text} —` }] }));
    };
    ch.bind("im", onIM);
    ch.bind("buddy", onBuddy);
    ch.bind("chat", onChat);
    ch.bind("chat-roster", onRoster);
    ch.bind("irc", onIrc);
    ch.bind("irc-system", onIrcSys);
    const hb = setInterval(() => fetch("/api/im/heartbeat", { method: "POST" }).catch(() => {}), 240000);
    return () => {
      clearInterval(hb);
      ch.unbind("im", onIM); ch.unbind("buddy", onBuddy); ch.unbind("chat", onChat); ch.unbind("chat-roster", onRoster);
      ch.unbind("irc", onIrc); ch.unbind("irc-system", onIrcSys);
      soketiClient.unsubscribe(gatewayUserChannel(me));
    };
  }, [me]);

  async function addBuddy() {
    const n = newBuddy.trim(); if (!n) return; setNewBuddy("");
    await fetch("/api/buddies/add", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ names: [n] }) }).catch(() => {});
    setTimeout(loadBuddies, 900);
  }
  async function sendDM() {
    const body = text.trim(); if (!body || !dmTarget) return; setText("");
    setDmByBuddy((p) => ({ ...p, [dmTarget]: [...(p[dmTarget] ?? []), { screenname: me, text: body, time: now(), format }] }));
    sounds.msgOut();
    await fetch("/api/im/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: dmTarget, message: body }) }).catch(() => {});
  }
  async function joinRoom(name: string) {
    const j = await (await fetch("/api/chat/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: name }) })).json();
    if (j.roomId != null) { roomRef.current = j.roomId; setRoom({ roomId: j.roomId, name: j.room }); setRoomMsgs([{ screenname: "sys", text: "", time: now(), sys: `— you have entered "${j.room}" —` }]); setRoomWho([]); sounds.doorOpen(); }
  }
  async function sendRoom() {
    const body = text.trim(); if (!body || !room) return; setText("");
    sounds.msgOut();
    await fetch("/api/chat/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId: room.roomId, message: body }) }).catch(() => {});
  }
  async function setAwayStatus(message: string) {
    const j = await (await fetch("/api/away", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) })).json().catch(() => ({}));
    setAway(!!j.away); setAwayActive(message);
    if (message && saveForLater && !saved.includes(message)) {
      const next = [message, ...saved].slice(0, 8); setSaved(next);
      try { localStorage.setItem("signoff_away_presets", JSON.stringify(next)); } catch {}
    }
  }

  useEffect(() => { if (me) setIrcNick((n) => n || me); }, [me]);

  async function connectIrc() {
    const nick = ircNick.trim(); if (!nick || ircBusy) return;
    const net = findNetwork(ircNetId);
    setIrcBusy(true);
    try {
      const r = await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "connect", network: net.label, host: net.host, port: net.port, tls: net.tls, nick, saslPassword: ircPw.trim() || undefined }) });
      const j = await r.json();
      if (r.ok) { setIrcConnected({ netId: net.id, nick: j.nick || nick }); setIrcPw(""); sounds.doorOpen(); }
      else setIrcMsgs((p) => ({ ...p, "*server*": [...(p["*server*"] ?? []), { screenname: "sys", text: "", time: now(), sys: `— ${j.error || "connect failed"} —` }] }));
    } finally { setIrcBusy(false); }
  }
  async function joinIrc(chan: string) {
    let c = chan.trim(); if (!c || !ircConnected) return; if (!c.startsWith("#")) c = "#" + c;
    const net = findNetwork(ircConnected.netId);
    await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", network: net.label, channel: c }) }).catch(() => {});
    setIrcChannels((p) => (p.includes(c) ? p : [...p, c])); setIrcJoinInput(""); setIrcView(c); sounds.doorOpen();
  }
  async function sendIrc() {
    const body = text.trim(); if (!body || !ircView || !ircConnected) return; setText("");
    const net = findNetwork(ircConnected.netId);
    setIrcMsgs((p) => ({ ...p, [ircView]: [...(p[ircView] ?? []), { screenname: ircConnected.nick, text: body, time: now() }] })); // IRC doesn't echo own
    sounds.msgOut();
    await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send", network: net.label, target: ircView, message: body }) }).catch(() => {});
  }

  const online = buddies.filter((b) => b.status === "ONLINE").length;

  if (!isMobile || !me) return null; // desktop uses the multi-window pages

  // ── screen bodies ──────────────────────────────────────────────────────────
  let body: React.ReactNode;
  if (tab === "buddies" && dmTarget) {
    const msgs = dmByBuddy[dmTarget] ?? [];
    body = (
      <RetroWindow title={`${dmTarget} — Direct Message`} onBack={() => setDmTarget(null)} style={fullWin}>
        <div style={{ margin: "8px 10px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <MessageLog messages={msgs} me={me} height={9999} />
        </div>
        <div style={{ padding: "0 10px 6px" }}><FormatToolbar format={format} onChange={setFormat} onSmiley={() => setText(text + " :-)")} /></div>
        <div style={{ display: "flex", gap: 7, padding: "0 10px 10px" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendDM()} placeholder={`message ${dmTarget}…`} style={{ ...inputStyle, flex: 1, minWidth: 0, height: 40, fontSize: 16 }} />
          <SendButton onClick={sendDM} />
        </div>
      </RetroWindow>
    );
  } else if (tab === "buddies") {
    body = (
      <RetroWindow title={`${me || "…"}'s Buddy List`} badge style={fullWin}>
        {away && <div style={{ padding: 8 }}><AwayBanner message={awayActive || "(away)"} onBack={() => setAwayStatus("")} /></div>}
        <div style={{ padding: "6px 10px", borderBottom: `1px solid ${retro.hairline}`, fontSize: 11, color: retro.inkSoft }}>Buddies ({online}/{buddies.length})</div>
        <div style={{ flex: 1, overflowY: "auto", background: retro.well }}>
          {buddies.length === 0 && <div style={{ padding: "12px 14px", fontSize: 13, color: retro.inkMuted, fontStyle: "italic", fontFamily: retro.fontMsg }}>no buddies yet — add one below</div>}
          {buddies.map((b) => <BuddyRow key={b.screenname} buddy={b} onClick={() => { setDmTarget(b.screenname); }} />)}
        </div>
        <div style={{ display: "flex", gap: 5, padding: 8, borderTop: `1px solid ${retro.hairline}` }}>
          <input value={newBuddy} onChange={(e) => setNewBuddy(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBuddy()} placeholder="add buddy…" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 40, fontSize: 16 }} />
          <button onClick={addBuddy} style={{ ...btnStyle, height: 40, padding: "0 14px" }}>Add</button>
        </div>
      </RetroWindow>
    );
  } else if (tab === "channels" && ircView) {
    const msgs = ircMsgs[ircView] ?? [];
    body = (
      <RetroWindow title={`${findNetwork(ircConnected?.netId ?? "libera").label}: ${ircView}`} onBack={() => setIrcView(null)} style={fullWin}>
        <div style={{ margin: "8px 10px", flex: 1, minHeight: 0 }}><MessageLog messages={msgs} me={ircConnected?.nick ?? me} height={9999} /></div>
        <div style={{ display: "flex", gap: 7, padding: "0 10px 10px" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendIrc()} placeholder={`message ${ircView}…`} style={{ ...inputStyle, flex: 1, minWidth: 0, height: 40, fontSize: 16 }} />
          <SendButton onClick={sendIrc} />
        </div>
      </RetroWindow>
    );
  } else if (tab === "channels" && room) {
    body = (
      <RetroWindow title={`Chat Room: ${room.name}`} onBack={() => { setRoom(null); roomRef.current = null; }} style={fullWin}>
        <div style={{ fontSize: 10.5, color: retro.inkMuted, fontFamily: retro.fontMono, padding: "4px 12px", borderBottom: `1px solid ${retro.hairline}` }}>{roomWho.length} people here{roomWho.length ? ": " + roomWho.slice(0, 8).join(", ") : ""}</div>
        <div style={{ margin: "8px 10px", flex: 1, minHeight: 0 }}><MessageLog messages={roomMsgs} me={me} height={9999} /></div>
        <div style={{ display: "flex", gap: 7, padding: "0 10px 10px" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendRoom()} placeholder={`say something…`} style={{ ...inputStyle, flex: 1, minWidth: 0, height: 40, fontSize: 16 }} />
          <SendButton onClick={sendRoom} />
        </div>
      </RetroWindow>
    );
  } else if (tab === "channels") {
    const net = findNetwork(ircConnected?.netId ?? ircNetId);
    const section: React.CSSProperties = { fontSize: 12, fontWeight: "bold", color: retro.inkSoft, padding: "10px 12px 4px", textTransform: "uppercase", letterSpacing: 0.5 };
    const chip: React.CSSProperties = { fontSize: 12, color: retro.blue, border: `1px solid ${retro.inputBorder}`, borderRadius: 12, padding: "4px 10px", cursor: "pointer", background: "#fff" };
    body = (
      <RetroWindow title="Channels" badge style={fullWin}>
        <div style={{ flex: 1, overflowY: "auto", background: retro.well }}>
          {/* ── IRC ─────────────────────────────────────────── */}
          <div style={section}>IRC</div>
          {!ircConnected ? (
            <div style={{ padding: "4px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              <select value={ircNetId} onChange={(e) => setIrcNetId(e.target.value)} style={{ ...inputStyle, height: 40, fontSize: 15 }}>
                {IRC_NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
              <input value={ircNick} onChange={(e) => setIrcNick(e.target.value)} placeholder="nickname" style={{ ...inputStyle, height: 40, fontSize: 16, fontWeight: "bold", color: retro.blue }} />
              <input type="password" value={ircPw} onChange={(e) => setIrcPw(e.target.value)} placeholder="NickServ password (optional)" style={{ ...inputStyle, height: 40, fontSize: 16 }} />
              <button onClick={connectIrc} disabled={ircBusy || !ircNick.trim()} style={{ ...btnStyle, height: 42, color: retro.greenDeep, border: `2px solid ${retro.green}`, opacity: ircBusy ? 0.6 : 1 }}>{ircBusy ? "Connecting…" : `Connect to ${findNetwork(ircNetId).label}`}</button>
            </div>
          ) : (
            <div style={{ padding: "0 0 8px" }}>
              <div style={{ fontSize: 11, color: retro.inkMuted, padding: "0 12px 6px" }}>{net.label} · {ircConnected.nick}</div>
              {ircChannels.map((c) => (
                <div key={c} onClick={() => setIrcView(c)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${retro.hairline}`, color: retro.blue, fontWeight: "bold", fontSize: 15 }}>{c}</div>
              ))}
              <div style={{ display: "flex", gap: 5, padding: "8px 12px" }}>
                <input value={ircJoinInput} onChange={(e) => setIrcJoinInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && joinIrc(ircJoinInput)} placeholder="#channel" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 40, fontSize: 16 }} />
                <button onClick={() => joinIrc(ircJoinInput)} style={{ ...btnStyle, height: 40, padding: "0 12px" }}>Join</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 12px 8px" }}>
                {net.suggested.map((c) => <span key={c} onClick={() => joinIrc(c)} style={chip}>{c}</span>)}
              </div>
            </div>
          )}

          {/* ── SIGNOFF rooms ────────────────────────────────── */}
          <div style={section}>SIGNOFF Rooms</div>
          {rooms.map((r) => (
            <div key={r.name} onClick={() => joinRoom(r.name)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${retro.hairline}` }}>
              <span style={{ color: retro.blue, fontWeight: "bold", fontSize: 15 }}># {r.name}</span>
              <span style={{ fontSize: 11, color: retro.inkMuted }}>{r.participants?.length ?? 0}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 5, padding: "8px 12px" }}>
            <input value={roomInput} onChange={(e) => setRoomInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && joinRoom(roomInput.trim())} placeholder="new room name…" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 40, fontSize: 16 }} />
            <button onClick={() => joinRoom(roomInput.trim())} style={{ ...btnStyle, height: 40, padding: "0 12px" }}>Join</button>
          </div>
        </div>
      </RetroWindow>
    );
  } else if (tab === "away") {
    body = (
      <RetroWindow title="Away Message" badge style={fullWin}>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          {away && <AwayBanner message={awayActive || "(away)"} onBack={() => setAwayStatus("")} />}
          <div style={{ fontSize: 14, color: retro.ink }}>Enter new Away message:</div>
          <textarea value={awayInput} onChange={(e) => setAwayInput(e.target.value)} rows={4} placeholder="I am away from my computer right now." style={{ ...inputStyle, padding: 10, fontSize: 16, fontFamily: retro.fontMsg, resize: "none", height: "auto" }} />
          <div style={{ fontSize: 12, color: retro.inkMuted, fontFamily: retro.fontMono }}>Special Characters:<br />%n = screen name of buddy<br />%d = current date<br />%t = current time</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: retro.inkSoft }}>
              <input type="checkbox" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} /> Save for later use
            </label>
            <button onClick={() => setAwayStatus(awayInput || "I am away right now.")} style={{ ...btnStyle, height: 44, padding: "0 18px", color: retro.amberDeep, border: `1px solid ${retro.amber}` }}>Set Away</button>
          </div>
          {saved.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: "bold", color: retro.ink, marginTop: 4 }}>Saved auto-responses</div>
              <div style={{ fontSize: 11.5, color: retro.inkMuted, marginBottom: 8 }}>Buddies who message you while you&apos;re away get this reply automatically.</div>
              {saved.map((s, i) => (
                <div key={i} onClick={() => setAwayStatus(s)} style={{ padding: "12px 14px", border: `1px solid ${retro.wellBorder}`, borderRadius: 3, marginBottom: 8, cursor: "pointer", fontFamily: retro.fontMsg, fontStyle: "italic", color: retro.blue }}>{s}</div>
              ))}
            </div>
          )}
        </div>
      </RetroWindow>
    );
  } else {
    body = (
      <RetroWindow title="Setup" badge style={fullWin}>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 14, color: retro.ink }}>Signed on as <b style={{ color: retro.blue }}>{me}</b></div>
          <div style={{ fontSize: 12, color: retro.inkMuted, fontFamily: retro.fontMono }}>Server: oscar.signoff.chat:5190 · TOC2<br />Messages route through the SIGNOFF gateway.</div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ ...btnStyle, height: 44, color: retro.redDeep, border: `2px solid ${retro.red}` }}>Sign Off</button>
        </div>
      </RetroWindow>
    );
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "buddies", label: "Buddies", icon: "👥" },
    { key: "channels", label: "Channels", icon: "#" },
    { key: "away", label: "Away", icon: "☾" },
    { key: "setup", label: "Setup", icon: "⚙" },
  ];

  return (
    <div className="retro-desktop" style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top,0px)" }}>
      <div style={{ flex: 1, minHeight: 0, padding: 8, display: "flex" }}>{body}</div>
      {/* Bottom tab bar */}
      <div style={{ display: "flex", gap: 4, padding: "6px 8px calc(8px + env(safe-area-inset-bottom,0px))", background: retro.chrome, borderTop: `1px solid ${retro.border}`, borderRadius: "14px 14px 0 0", margin: "0 6px", boxShadow: "0 -6px 20px rgba(10,15,40,0.25)" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <div key={t.key} onClick={() => { setTab(t.key); if (t.key === "buddies") setDmTarget(null); if (t.key === "channels") { setRoom(null); roomRef.current = null; setIrcView(null); } }}
              style={{ flex: 1, minHeight: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", borderRadius: 8, background: active ? retro.selection : "transparent" }}>
              <span style={{ fontSize: 18, color: active ? retro.blue : retro.inkSoft, fontFamily: t.icon === "#" ? retro.fontBrand : "inherit" }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: "bold", color: retro.inkSoft }}>{t.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const fullWin: React.CSSProperties = { flex: 1, width: "100%", display: "flex", flexDirection: "column", minHeight: 0 };
function sortB(a: RetroBuddy, b: RetroBuddy) {
  const r = (s: RetroBuddy["status"]) => (s === "ONLINE" ? 0 : s === "AWAY" ? 1 : 2);
  return r(a.status) - r(b.status) || a.screenname.localeCompare(b.screenname);
}
