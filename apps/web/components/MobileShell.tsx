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
import { IRC_NETWORKS, findNetwork, findNetworkByLabel } from "@/lib/ircNetworks";
import { IrcText } from "@/components/retro/irc-text";
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
  unlockAudio,
  type RetroBuddy,
  type RetroMessage,
  type RetroMessageFormat,
} from "@/components/retro/retro-components";

type Tab = "buddies" | "channels" | "away" | "setup";
type Presence = { name: string; online: boolean; away?: boolean; group?: string };
const presenceStatus = (p: Presence): RetroBuddy["status"] => (p.away ? "AWAY" : p.online ? "ONLINE" : "OFFLINE");

export function MobileShell() {
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const me = session?.user?.screenname ?? "";
  const [tab, setTab] = useState<Tab>("buddies");

  // buddies + DM
  const [buddies, setBuddies] = useState<RetroBuddy[]>([]);
  const buddiesRef = useRef<RetroBuddy[]>([]);
  buddiesRef.current = buddies;
  const acceptedRef = useRef<Set<string>>(new Set());
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
  const [ircError, setIrcError] = useState<string | null>(null);
  const ircViewRef = useRef<string | null>(null);
  ircViewRef.current = ircView;
  const [ircMsgs, setIrcMsgs] = useState<Record<string, RetroMessage[]>>({});
  const [ircBusy, setIrcBusy] = useState(false);
  // channel browser
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseResults, setBrowseResults] = useState<{ channel: string; users: number; topic: string }[]>([]);
  const [browseFilter, setBrowseFilter] = useState("");
  const [browseLoading, setBrowseLoading] = useState(false);

  // away
  const [away, setAway] = useState(false);
  const [awayActive, setAwayActive] = useState("");
  const [awayInput, setAwayInput] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [saveForLater, setSaveForLater] = useState(true);

  // compose
  const [text, setText] = useState("");
  const [format, setFormat] = useState<RetroMessageFormat>({ color: retro.ink });

  // setup / my info
  const [bio, setBio] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [buddySounds, setBuddySounds] = useState(true);
  const [doorSounds, setDoorSounds] = useState(true);

  // buddy list — favorites + client-side groups (localStorage)
  const [favorites, setFavorites] = useState<string[]>([]);
  const [groupOf, setGroupOf] = useState<Record<string, string>>({}); // screenname(lower) -> group
  const [groupOrder, setGroupOrder] = useState<string[]>(["Buddies"]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [statusOpen, setStatusOpen] = useState(false);
  const [myStatus, setMyStatus] = useState<"Online" | "Away" | "Invisible" | "Offline">("Online");
  const [helpOpen, setHelpOpen] = useState(false);
  const [infoFor, setInfoFor] = useState<string | null>(null); // buddy info dialog
  const [pendingAccept, setPendingAccept] = useState<{ from: string; message: string } | null>(null);

  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("signoff_away_presets") || "[]"));
    } catch {}
    // sound prefs
    try {
      const b = localStorage.getItem("signoff_snd_buddy") !== "0";
      const d = localStorage.getItem("signoff_snd_door") !== "0";
      setBuddySounds(b); setDoorSounds(d); sounds.setMuted({ buddy: !b, door: !d });
    } catch {}
    // buddy list prefs
    try {
      setFavorites(JSON.parse(localStorage.getItem("signoff_favorites") || "[]"));
      setGroupOf(JSON.parse(localStorage.getItem("signoff_buddy_groups") || "{}"));
      const order = JSON.parse(localStorage.getItem("signoff_group_order") || "null");
      if (Array.isArray(order) && order.length) setGroupOrder(order);
    } catch {}
    // Unlock audio on the first user gesture (mobile browsers gate it otherwise).
    const un = () => { unlockAudio(); window.removeEventListener("pointerdown", un); window.removeEventListener("touchend", un); };
    window.addEventListener("pointerdown", un, { once: false });
    window.addEventListener("touchend", un, { once: false });
    return () => { window.removeEventListener("pointerdown", un); window.removeEventListener("touchend", un); };
  }, []);

  function toggleFavorite(name: string) {
    setFavorites((p) => { const n = p.includes(name) ? p.filter((x) => x !== name) : [...p, name]; try { localStorage.setItem("signoff_favorites", JSON.stringify(n)); } catch {} return n; });
  }
  function addGroup() {
    const name = (typeof window !== "undefined" ? window.prompt("New group name:") : "")?.trim();
    if (!name || groupOrder.includes(name)) return;
    setGroupOrder((p) => { const n = [...p, name]; try { localStorage.setItem("signoff_group_order", JSON.stringify(n)); } catch {} return n; });
  }
  function moveToGroup(name: string, group: string) {
    setGroupOf((p) => { const n = { ...p, [name.toLowerCase()]: group }; try { localStorage.setItem("signoff_buddy_groups", JSON.stringify(n)); } catch {} return n; });
  }
  function toggleCollapse(g: string) { setCollapsed((p) => ({ ...p, [g]: !p[g] })); }
  const statusDot = (s: string) => (s === "Online" ? retro.green : s === "Away" ? retro.amber : "#a5a29a");
  async function chooseStatus(s: "Online" | "Away" | "Invisible" | "Offline") {
    setMyStatus(s); setStatusOpen(false);
    if (s === "Online") { if (away) setAwayStatus(""); }
    else if (s === "Away") { setTab("away"); }
    else { fetch("/api/user/status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: s.toUpperCase() }) }).catch(() => {}); }
  }

  // load my profile (bio) once signed in
  useEffect(() => {
    if (!me) return;
    (async () => {
      try { const j = await (await fetch("/api/user/profile")).json(); setBio(j.bio || ""); setBioDraft(j.bio || ""); } catch {}
    })();
  }, [me]);

  function toggleBuddySounds() { const v = !buddySounds; setBuddySounds(v); sounds.setMuted({ buddy: !v }); try { localStorage.setItem("signoff_snd_buddy", v ? "1" : "0"); } catch {} }
  function toggleDoorSounds() { const v = !doorSounds; setDoorSounds(v); sounds.setMuted({ door: !v }); try { localStorage.setItem("signoff_snd_door", v ? "1" : "0"); } catch {} }
  async function saveBio() {
    const b = bioDraft.trim().slice(0, 160); setBio(b); setEditingBio(false);
    await fetch("/api/user/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ bio: b }) }).catch(() => {});
  }

  const loadBuddies = useCallback(async () => {
    try {
      const j = await (await fetch("/api/buddies")).json();
      setBuddies(((j.buddies as Presence[]) ?? []).map((p) => ({ screenname: p.name, status: presenceStatus(p), group: p.group }) as RetroBuddy).sort(sortB));
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
      // AIM-style gating: a message from someone not on your buddy list prompts an
      // Accept dialog (unless already accepted / it's the open DM / you opted out).
      const k = m.from.toLowerCase();
      const known = buddiesRef.current.some((b) => b.screenname.toLowerCase() === k);
      let optedOut = false; try { optedOut = localStorage.getItem("signoff_accept_dontask") === "1"; } catch {}
      if (!known && !optedOut && !acceptedRef.current.has(k) && dmTargetRef.current?.toLowerCase() !== k) {
        setPendingAccept({ from: m.from, message: m.message });
      }
    };
    const onBuddy = (b: Presence) =>
      setBuddies((p) => {
        const prev = p.find((x) => x.screenname.toLowerCase() === b.name.toLowerCase());
        return [...p.filter((x) => x.screenname.toLowerCase() !== b.name.toLowerCase()), { screenname: b.name, status: presenceStatus(b), group: b.group ?? prev?.group } as RetroBuddy].sort(sortB);
      });
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

  // IRC lives on the gateway (decoupled from this webview). Rehydrate the UI from
  // the live connection so switching tabs / reloading / re-focusing the app keeps
  // you "in" your channels instead of showing the Connect form again.
  const syncIrc = useCallback(async () => {
    try {
      const j = await (await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "status" }) })).json();
      const nets: { network: string; nick: string; channels: string[] }[] = Array.isArray(j.networks) ? j.networks : [];
      const active = nets[0];
      if (active) {
        const preset = findNetworkByLabel(active.network);
        setIrcConnected({ netId: preset?.id ?? IRC_NETWORKS[0].id, nick: active.nick });
        if (active.channels.length) setIrcChannels((p) => Array.from(new Set([...p, ...active.channels])));
      } else {
        setIrcConnected(null);
      }
    } catch { /* leave current UI state */ }
  }, []);

  useEffect(() => {
    if (!me) return;
    syncIrc();
    const onVis = () => { if (document.visibilityState === "visible") syncIrc(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [me, syncIrc]);

  // Re-check the moment the user opens the Channels tab.
  useEffect(() => { if (me && tab === "channels") syncIrc(); }, [tab, me, syncIrc]);

  async function connectIrc() {
    const nick = ircNick.trim(); if (!nick || ircBusy) return;
    const net = findNetwork(ircNetId);
    setIrcBusy(true); setIrcError(null);
    try {
      const r = await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "connect", network: net.label, host: net.host, port: net.port, tls: net.tls, nick, saslPassword: ircPw.trim() || undefined }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setIrcConnected({ netId: net.id, nick: j.nick || nick }); setIrcPw(""); sounds.doorOpen(); setTimeout(syncIrc, 3500); /* pick up a NickServ nick-reclaim */ }
      else if (r.status === 401 || r.status === 409) setIrcError("your session expired — pull down to refresh, then sign in again");
      else setIrcError(j.error || `couldn't connect to ${net.label}`);
    } catch {
      setIrcError("network error — try again");
    } finally { setIrcBusy(false); }
  }
  async function joinIrc(chan: string) {
    let c = chan.trim(); if (!c || !ircConnected) return; if (!c.startsWith("#")) c = "#" + c;
    const net = findNetwork(ircConnected.netId);
    await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", network: net.label, channel: c }) }).catch(() => {});
    setIrcChannels((p) => (p.includes(c) ? p : [...p, c])); setIrcJoinInput(""); setIrcView(c); sounds.doorOpen();
  }
  async function browseChannels() {
    if (!ircConnected) return;
    setBrowseOpen(true); setBrowseLoading(true); setBrowseResults([]);
    try {
      const net = findNetwork(ircConnected.netId);
      const j = await (await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "list", network: net.label }) })).json();
      setBrowseResults(Array.isArray(j.channels) ? j.channels : []);
    } catch {} finally { setBrowseLoading(false); }
  }
  async function sendIrc() {
    const body = text.trim(); if (!body || !ircView || !ircConnected) return; setText("");
    const net = findNetwork(ircConnected.netId);
    const api = (payload: Record<string, unknown>) =>
      fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, network: net.label }) }).catch(() => {});
    const echo = (buf: string, m: RetroMessage) => setIrcMsgs((p) => ({ ...p, [buf]: [...(p[buf] ?? []), m] }));
    const sys = (buf: string, t: string) => echo(buf, { screenname: "sys", text: "", time: now(), sys: `— ${t} —` });

    // Slash-commands, IRC-style ("as good as Pidgin").
    if (body.startsWith("/") && !body.startsWith("//")) {
      const sp = body.indexOf(" ");
      const cmd = (sp === -1 ? body.slice(1) : body.slice(1, sp)).toLowerCase();
      const arg = sp === -1 ? "" : body.slice(sp + 1).trim();
      sounds.msgOut();
      switch (cmd) {
        case "me":
          echo(ircView, { screenname: ircConnected.nick, text: `* ${ircConnected.nick} ${arg}`, time: now() });
          await api({ action: "raw", line: `PRIVMSG ${ircView} :ACTION ${arg}` }); return;
        case "msg": case "query": {
          const s2 = arg.indexOf(" "); const to = s2 === -1 ? arg : arg.slice(0, s2); const msg = s2 === -1 ? "" : arg.slice(s2 + 1);
          if (!to) { sys(ircView, "usage: /msg <nick> <message>"); return; }
          echo(to, { screenname: ircConnected.nick, text: msg, time: now() }); setIrcView(to);
          if (msg) await api({ action: "send", target: to, message: msg }); return;
        }
        case "join": case "j": { const c = arg.replace(/^#?/, "#"); if (arg) await joinIrc(c); return; }
        case "part": case "leave": { const c = arg || ircView; await api({ action: "part", channel: c }); setIrcChannels((p) => p.filter((x) => x !== c)); if (ircView === c) setIrcView(null); return; }
        case "nick": if (arg) await api({ action: "raw", line: `NICK ${arg}` }); return;
        case "topic": await api({ action: "raw", line: `TOPIC ${ircView}${arg ? ` :${arg}` : ""}` }); return;
        case "whois": if (arg) { sys(ircView, `whois ${arg}…`); await api({ action: "raw", line: `WHOIS ${arg}` }); } return;
        case "raw": case "quote": if (arg) await api({ action: "raw", line: arg }); return;
        default: await api({ action: "raw", line: `${cmd.toUpperCase()}${arg ? ` ${arg}` : ""}` }); sys(ircView, `sent: /${cmd} ${arg}`.trim()); return;
      }
    }

    const msg = body.startsWith("//") ? body.slice(1) : body; // // escapes a literal leading slash
    echo(ircView, { screenname: ircConnected.nick, text: msg, time: now() }); // IRC doesn't echo own
    sounds.msgOut();
    await api({ action: "send", target: ircView, message: msg });
  }

  const online = buddies.filter((b) => b.status === "ONLINE").length;

  if (!isMobile || !me) return null; // desktop uses the multi-window pages

  // ── screen bodies ──────────────────────────────────────────────────────────
  let body: React.ReactNode;
  if (tab === "buddies" && dmTarget) {
    const msgs = dmByBuddy[dmTarget] ?? [];
    body = (
      <RetroWindow title={`${dmTarget} — Direct Message`} onBack={() => setDmTarget(null)} style={fullWin}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", fontSize: 11.5, color: retro.inkSoft, borderBottom: `1px solid ${retro.hairline}`, background: "#faf8f3" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: buddies.find((b) => b.screenname.toLowerCase() === dmTarget.toLowerCase())?.status === "ONLINE" ? retro.green : "#c9c6bc" }} />
          <span style={{ fontFamily: retro.fontMono }}>direct message</span>
          <span style={{ flex: 1 }} />
          <span onClick={() => setInfoFor(dmTarget)} style={{ color: retro.blue, textDecoration: "underline", cursor: "pointer" }}>profile</span>
        </div>
        <div style={{ margin: "8px 10px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <MessageLog messages={msgs} me={me} height="100%" />
        </div>
        <div style={{ padding: "0 10px 6px" }}><FormatToolbar format={format} onChange={setFormat} onSmiley={() => setText(text + " :-)")} /></div>
        <div style={{ display: "flex", gap: 7, padding: "0 10px 10px" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendDM()} placeholder={`message ${dmTarget}…`} style={{ ...inputStyle, flex: 1, minWidth: 0, height: 40, fontSize: 16 }} />
          <SendButton onClick={sendDM} />
        </div>
      </RetroWindow>
    );
  } else if (tab === "buddies") {
    // favorites + client-side grouping, matching the approved mock
    const withFav = buddies.map((b) => ({ ...b, favorite: favorites.includes(b.screenname) }));
    // Groups come from the server (OSCAR SSI) merged with any client-made ones;
    // a manual move (groupOf) overrides the server's group for that buddy.
    const serverGroups = Array.from(new Set(buddies.map((b) => b.group).filter(Boolean) as string[]));
    const allGroups = Array.from(new Set([...groupOrder, ...serverGroups]));
    const primary = allGroups[0] || "Buddies";
    const groupFor = (b: RetroBuddy) => groupOf[b.screenname.toLowerCase()] || b.group || primary;
    const buckets = allGroups.map((g) => ({
      g,
      items: withFav
        .filter((b) => groupFor(b) === g)
        .sort((a, c) => (c.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || sortB(a, c)),
    }));
    const multi = allGroups.length > 1;
    body = (
      <RetroWindow title={`${me || "…"}'s Buddy List`} badge style={fullWin}>
        {/* menu bar (per mock) */}
        <div style={{ display: "flex", gap: 6, padding: "2px 8px", fontSize: 13, color: retro.inkSoft, borderBottom: `1px solid ${retro.hairline}`, background: "#faf8f3" }}>
          <span onClick={() => setStatusOpen(true)} style={{ padding: "9px 8px", cursor: "pointer" }}><u>M</u>y Signoff</span>
          <span onClick={() => { const el = document.getElementById("mob-add-buddy"); el?.focus(); }} style={{ padding: "9px 8px", cursor: "pointer" }}><u>P</u>eople</span>
          <span onClick={() => setHelpOpen(true)} style={{ padding: "9px 8px", cursor: "pointer" }}><u>H</u>elp</span>
        </div>
        {/* header: avatar · screenname · status · bell */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 6, background: retro.gradient, color: retro.gold, fontFamily: retro.fontBrand, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(me || "?").slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: "bold", color: retro.blue }}>{me} <span style={{ color: retro.goldDim }}>★</span></div>
            <div onClick={() => setStatusOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, padding: "5px 11px", background: "#fdfcf9", border: `1px solid ${retro.inputBorder}`, borderRadius: 3, fontSize: 13, cursor: "pointer", color: retro.inkSoft }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusDot(away ? "Away" : myStatus) }} /> {away ? "Away" : myStatus} ▾
            </div>
          </div>
          <button onClick={toggleBuddySounds} title="notification sounds" style={{ ...btnStyle, width: 52, height: 46, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, color: buddySounds ? retro.ink : retro.inkMuted }}>
            <span style={{ fontSize: 16 }}>{buddySounds ? "🔔" : "🔕"}</span>
            <span style={{ fontSize: 10 }}>{buddySounds ? "on" : "off"}</span>
          </button>
        </div>

        {away && <div style={{ padding: 8 }}><AwayBanner message={awayActive || "(away)"} onBack={() => setAwayStatus("")} /></div>}

        <div style={{ flex: 1, overflowY: "auto", background: retro.well, paddingBottom: 8 }}>
          {buddies.length === 0 && <div style={{ padding: "12px 14px", fontSize: 13, color: retro.inkMuted, fontStyle: "italic", fontFamily: retro.fontMsg }}>no buddies yet — add one below</div>}
          {buckets.map(({ g, items }) => {
            const on = items.filter((b) => b.status === "ONLINE").length;
            const isCol = collapsed[g];
            return (
              <div key={g}>
                <div onClick={() => toggleCollapse(g)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px 4px", cursor: "pointer" }}>
                  <span style={{ fontSize: 11, color: retro.inkSoft }}>{isCol ? "▸" : "▾"}</span>
                  <span style={{ fontSize: 14, fontWeight: "bold", color: retro.ink }}>{g}</span>
                  <span style={{ fontSize: 12, color: retro.inkMuted }}>({on}/{items.length})</span>
                </div>
                {!isCol && items.map((b) => (
                  <div key={b.screenname} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}><BuddyRow buddy={b} onClick={() => setDmTarget(b.screenname)} onStar={() => toggleFavorite(b.screenname)} /></div>
                    {multi && (
                      <select value={groupOf[b.screenname.toLowerCase()] || primary} onChange={(e) => moveToGroup(b.screenname, e.target.value)} onClick={(e) => e.stopPropagation()} style={{ ...inputStyle, height: 26, fontSize: 11, marginRight: 8, padding: "0 4px" }}>
                        {allGroups.map((gg) => <option key={gg} value={gg}>{gg}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          <div onClick={addGroup} style={{ padding: "10px 12px", fontSize: 13, color: retro.inkMuted, fontFamily: retro.fontMono, cursor: "pointer" }}>+ new group</div>
        </div>

        <div style={{ display: "flex", gap: 5, padding: 8, borderTop: `1px solid ${retro.hairline}` }}>
          <input id="mob-add-buddy" value={newBuddy} onChange={(e) => setNewBuddy(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBuddy()} placeholder="add buddy…" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 40, fontSize: 16 }} />
          <button onClick={addBuddy} style={{ ...btnStyle, height: 40, padding: "0 14px" }}>Add</button>
        </div>
      </RetroWindow>
    );
  } else if (tab === "channels" && ircView) {
    const msgs = ircMsgs[ircView] ?? [];
    body = (
      <RetroWindow title={`${findNetwork(ircConnected?.netId ?? "libera").label}: ${ircView}`} onBack={() => setIrcView(null)} style={fullWin}>
        <div style={{ margin: "8px 10px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}><MessageLog messages={msgs} me={ircConnected?.nick ?? me} height="100%" formatText={(t) => <IrcText text={t} />} /></div>
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
        <div style={{ margin: "8px 10px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}><MessageLog messages={roomMsgs} me={me} height="100%" /></div>
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
              {ircError && <div style={{ fontSize: 13, color: retro.red, fontFamily: retro.fontUI }}>{ircError}</div>}
              <button onClick={connectIrc} disabled={ircBusy || !ircNick.trim()} style={{ ...btnStyle, height: 42, color: retro.greenDeep, border: `2px solid ${retro.green}`, opacity: ircBusy ? 0.6 : 1 }}>{ircBusy ? "Connecting…" : `Connect to ${findNetwork(ircNetId).label}`}</button>
            </div>
          ) : (
            <div style={{ padding: "0 0 8px" }}>
              <div style={{ fontSize: 11, color: retro.inkMuted, padding: "0 12px 6px" }}>{net.label} · {ircConnected.nick}</div>
              {ircChannels.map((c) => (
                <div key={c} onClick={() => setIrcView(c)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${retro.hairline}`, color: retro.blue, fontWeight: "bold", fontSize: 15 }}>{c}</div>
              ))}
              {Object.keys(ircMsgs).filter((k) => !k.startsWith("#") && k !== "*server*").map((nick) => (
                <div key={nick} onClick={() => setIrcView(nick)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${retro.hairline}`, color: snColor(nick), fontWeight: "bold", fontSize: 15 }}>✉ {nick}</div>
              ))}
              <div style={{ display: "flex", gap: 5, padding: "8px 12px" }}>
                <input value={ircJoinInput} onChange={(e) => setIrcJoinInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && joinIrc(ircJoinInput)} placeholder="#channel" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 40, fontSize: 16 }} />
                <button onClick={() => joinIrc(ircJoinInput)} style={{ ...btnStyle, height: 40, padding: "0 12px" }}>Join</button>
                <button onClick={browseChannels} style={{ ...btnStyle, height: 40, padding: "0 12px" }}>Browse</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 12px 8px" }}>
                {net.suggested.map((c) => <span key={c} onClick={() => joinIrc(c)} style={chip}>{c}</span>)}
              </div>
            </div>
          )}

          {/* ── SIGNOFF rooms ────────────────────────────────── */}
          <div style={section}>SIGNOFF Rooms</div>
          {rooms.map((r) => (
            <div key={r.name} onClick={() => joinRoom(r.name)} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 54, padding: "4px 14px", cursor: "pointer", borderBottom: `1px solid ${retro.hairline}` }}>
              <span style={{ width: 26, textAlign: "center", fontSize: 15, color: retro.blue, fontFamily: retro.fontMono, fontWeight: "bold" }}>#</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: "bold", color: retro.blue, fontFamily: retro.fontMono }}>{r.name}</div>
                <div style={{ fontSize: 11.5, color: retro.inkMuted }}>public room</div>
              </div>
              <span style={{ fontSize: 12, color: retro.inkMuted, fontFamily: retro.fontMono }}>{r.participants?.length ?? 0}</span>
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
          <FormatToolbar format={format} onChange={setFormat} onSmiley={() => setAwayInput(awayInput + " :-)")} />
          <textarea value={awayInput} onChange={(e) => setAwayInput(e.target.value)} rows={4} placeholder="I am away from my computer right now." style={{ ...inputStyle, padding: 10, fontSize: 16, fontFamily: retro.fontMsg, resize: "none", height: "auto", color: format.color, fontWeight: format.bold ? "bold" : "normal", fontStyle: format.italic ? "italic" : "normal", textDecoration: format.underline ? "underline" : "none" }} />
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
        <div style={{ flex: 1, overflowY: "auto", background: retro.well, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* ── My Info ─────────────────────────────────────── */}
          <div style={{ background: "#fff", border: `1px solid ${retro.hairline}`, borderRadius: 6, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: retro.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>My Info</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 6, background: retro.gradient, color: retro.gold, fontFamily: retro.fontBrand, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(me || "?").slice(0, 2).toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: "bold", color: retro.blue }}>{me}</div>
                {!editingBio ? (
                  <div onClick={() => { setBioDraft(bio); setEditingBio(true); }} style={{ fontSize: 13, fontStyle: "italic", color: bio ? retro.inkSoft : retro.inkMuted, fontFamily: retro.fontMsg, cursor: "pointer" }}>{bio || "tap to add a profile line…"}</div>
                ) : (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <input value={bioDraft} maxLength={160} onChange={(e) => setBioDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveBio()} autoFocus placeholder="profile line" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 34, fontSize: 16 }} />
                    <button onClick={saveBio} style={{ ...btnStyle, height: 34, padding: "0 12px" }}>Save</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Sounds ──────────────────────────────────────── */}
          <div style={{ background: "#fff", border: `1px solid ${retro.hairline}`, borderRadius: 6, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: retro.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Sounds</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: retro.ink, marginBottom: 8 }}>
              <input type="checkbox" checked={buddySounds} onChange={toggleBuddySounds} /> Buddy sounds (message blips)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: retro.ink, marginBottom: 12 }}>
              <input type="checkbox" checked={doorSounds} onChange={toggleDoorSounds} /> Door sounds on sign on / off
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => sounds.doorOpen(true)} style={{ ...btnStyle, flex: 1, height: 40 }}>▶ door open</button>
              <button onClick={() => sounds.doorSlam(true)} style={{ ...btnStyle, flex: 1, height: 40 }}>▶ door slam</button>
            </div>
          </div>

          {/* ── Connection ──────────────────────────────────── */}
          <div style={{ background: "#fff", border: `1px solid ${retro.hairline}`, borderRadius: 6, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: retro.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Connection</div>
            <div style={{ fontSize: 12, color: retro.inkMuted, fontFamily: retro.fontMono, lineHeight: 1.5 }}>Signed on as <b style={{ color: retro.blue }}>{me}</b><br />Server: oscar.signoff.chat · TOC2<br />Messages route through the SIGNOFF gateway.</div>
          </div>

          <button onClick={() => { sounds.doorSlam(); signOut({ callbackUrl: "/login" }); }} style={{ ...btnStyle, height: 46, color: retro.redDeep, border: `2px solid ${retro.red}` }}>Sign Off</button>
        </div>
      </RetroWindow>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "buddies", label: "Buddies" },
    { key: "channels", label: "Channels" },
    { key: "away", label: "Away" },
    { key: "setup", label: "Setup" },
  ];
  const tabIcon = (key: Tab, active: boolean) => {
    const c = active ? retro.blue : "#4a4a52";
    if (key === "buddies") return (<svg width="22" height="19" viewBox="0 0 22 19" fill="none"><circle cx="7" cy="6" r="3.2" stroke={c} strokeWidth="1.6" /><path d="M2 17c0-3 2.2-5 5-5s5 2 5 5" stroke={c} strokeWidth="1.6" strokeLinecap="round" /><circle cx="15.5" cy="7" r="2.6" stroke={c} strokeWidth="1.5" /><path d="M14 12.3c2.8-.4 6 1.2 6 4.7" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></svg>);
    if (key === "channels") return (<span style={{ fontFamily: retro.fontBrand, fontSize: 22, lineHeight: "19px", color: c }}>#</span>);
    if (key === "away") return (<svg width="20" height="19" viewBox="0 0 20 19" fill="none"><rect x="2" y="2" width="16" height="15" rx="2" stroke={c} strokeWidth="1.5" /><path d="M6 7h8M6 10.5h8M6 14h5" stroke={c} strokeWidth="1.4" strokeLinecap="round" /></svg>);
    return (<svg width="20" height="18" viewBox="0 0 20 18" fill="none"><path d="M2 5h16M2 13h16" stroke={c} strokeWidth="1.6" strokeLinecap="round" /><circle cx="13" cy="5" r="2.4" fill={retro.chrome} stroke={c} strokeWidth="1.6" /><circle cx="7" cy="13" r="2.4" fill={retro.chrome} stroke={c} strokeWidth="1.6" /></svg>);
  };

  return (
    <div className="retro-desktop" style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top,0px)" }}>
      <div style={{ flex: 1, minHeight: 0, padding: 8, display: "flex" }}>{body}</div>

      {browseOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, background: retro.desktop, padding: 8, display: "flex" }} className="retro-desktop">
          <RetroWindow title={`Browse Channels — ${findNetwork(ircConnected?.netId ?? "libera").label}`} badge onClose={() => setBrowseOpen(false)} style={fullWin}>
            <div style={{ padding: 8, borderBottom: `1px solid ${retro.hairline}` }}>
              <input value={browseFilter} onChange={(e) => setBrowseFilter(e.target.value)} placeholder="search channels…" style={{ ...inputStyle, width: "100%", height: 40, fontSize: 16 }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", background: retro.well }}>
              {browseLoading && <div style={{ padding: 16, fontFamily: retro.fontMsg, fontStyle: "italic", color: retro.inkMuted }}>listing channels…</div>}
              {!browseLoading && browseResults.length === 0 && <div style={{ padding: 16, fontFamily: retro.fontMsg, fontStyle: "italic", color: retro.inkMuted }}>no channels returned</div>}
              {browseResults
                .filter((c) => { const q = browseFilter.toLowerCase(); return !q || c.channel.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q); })
                .slice(0, 300)
                .map((c) => (
                  <div key={c.channel} onClick={() => { joinIrc(c.channel); setBrowseOpen(false); }} style={{ padding: "8px 12px", borderBottom: `1px solid ${retro.hairline}`, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: retro.blue, fontWeight: "bold" }}>{c.channel}</span>
                      <span style={{ fontSize: 11, color: retro.inkMuted }}>{c.users}</span>
                    </div>
                    {c.topic && <div style={{ fontSize: 11.5, color: retro.inkSoft, fontFamily: retro.fontMsg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.topic}</div>}
                  </div>
                ))}
            </div>
          </RetroWindow>
        </div>
      )}

      {/* Status bottom-sheet (per mock) */}
      {statusOpen && (
        <div onClick={() => setStatusOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(25,30,60,0.45)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: retro.well, border: `1px solid ${retro.border}`, borderRadius: "12px 12px 0 0", boxShadow: "0 -10px 30px rgba(10,15,40,0.4)", paddingBottom: "calc(28px + env(safe-area-inset-bottom,0px))" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}><span style={{ width: 40, height: 4, borderRadius: 2, background: retro.inputBorder }} /></div>
            <div style={{ color: retro.ink, fontWeight: "bold", fontSize: 15, padding: "8px 16px", display: "flex", alignItems: "center" }}><span style={{ flex: 1 }}>My Status</span><span onClick={() => setStatusOpen(false)} style={{ color: retro.inkMuted, fontSize: 13, padding: "4px 6px", cursor: "pointer" }}>✕</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "6px 14px 4px" }}>
              {(["Online", "Away", "Invisible", "Offline"] as const).map((s) => (
                <div key={s} onClick={() => chooseStatus(s)} style={{ minHeight: 48, display: "flex", alignItems: "center", gap: 9, padding: "0 14px", background: "#fdfcf9", border: `1px solid ${((away ? "Away" : myStatus) === s) ? retro.blue : retro.inputBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 14, fontWeight: "bold", color: retro.inkSoft }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusDot(s), border: `1px solid ${retro.inkMuted}` }} /> {s}
                </div>
              ))}
            </div>
            <div onClick={toggleBuddySounds} style={{ margin: "8px 14px 0", minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", background: "#fdfcf9", border: `1px solid ${retro.inputBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 13, color: retro.inkSoft }}>
              <span style={{ width: 15, height: 15, background: "#fff", border: `1px solid ${retro.inkMuted}`, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold", color: retro.blue }}>{buddySounds ? "✓" : ""}</span>Sounds on
            </div>
          </div>
        </div>
      )}

      {/* Accept Message dialog (IM from a non-buddy) */}
      {pendingAccept && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(25,30,60,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 322, background: retro.well, border: `1px solid ${retro.border}`, borderRadius: 3, boxShadow: "0 20px 50px rgba(10,15,40,0.5)" }}>
            <div style={{ background: "#fdfcf9", color: retro.ink, fontWeight: "bold", fontSize: 15, padding: "10px 14px", display: "flex", alignItems: "center", borderBottom: `1px solid ${retro.hairline}`, borderRadius: "3px 3px 0 0" }}><span style={{ flex: 1 }}>Accept Message</span><span onClick={() => setPendingAccept(null)} style={{ color: retro.inkMuted, cursor: "pointer", padding: "2px 4px" }}>✕</span></div>
            <div style={{ padding: "16px 16px 14px", textAlign: "center", fontSize: 13, color: retro.inkSoft }}>
              <div>User</div>
              <div style={{ fontWeight: "bold", fontSize: 15, margin: "3px 0", color: snColor(pendingAccept.from) }}>&quot;{pendingAccept.from}&quot;</div>
              <div>has sent you a message. Would you like to accept it?</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "16px 0 6px" }}>
                <button onClick={() => { acceptedRef.current.add(pendingAccept.from.toLowerCase()); setDmTarget(pendingAccept.from); setTab("buddies"); setPendingAccept(null); }} style={{ ...btnStyle, minWidth: 98, height: 44, fontWeight: "bold", color: retro.greenDeep, border: `1px solid ${retro.green}` }}>Yes</button>
                <button onClick={() => setPendingAccept(null)} style={{ ...btnStyle, minWidth: 98, height: 44, fontWeight: "bold" }}>No</button>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 6 }}>
                <button onClick={() => { const f = pendingAccept.from; fetch(`/api/users/${encodeURIComponent(f)}/block`, { method: "POST" }).catch(() => {}); setDmByBuddy((p) => { const n = { ...p }; delete n[f]; return n; }); setPendingAccept(null); }} style={{ ...btnStyle, minWidth: 82, height: 38, fontSize: 12, color: retro.redDeep }}>Block…</button>
              </div>
              <div onClick={() => { try { localStorage.setItem("signoff_accept_dontask", "1"); } catch {} setPendingAccept(null); }} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 36, cursor: "pointer", fontSize: 12, marginTop: 10, color: retro.inkSoft }}>
                <span style={{ width: 15, height: 15, background: "#fff", border: `1px solid ${retro.inkMuted}`, borderRadius: 2 }} />Don&apos;t display this dialog again.
              </div>
              <div style={{ fontSize: 11, color: retro.inkMuted, textAlign: "left", marginTop: 8, lineHeight: 1.5 }}>SIGNOFF admins will never ask for your password or recovery phrase.</div>
            </div>
          </div>
        </div>
      )}

      {/* Help dialog (per mock, crypto topic omitted) */}
      {helpOpen && (
        <div onClick={() => setHelpOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(25,30,60,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: retro.well, border: `1px solid ${retro.border}`, borderRadius: 3, boxShadow: "0 20px 50px rgba(10,15,40,0.5)" }}>
            <div style={{ background: "#fdfcf9", color: retro.ink, fontWeight: "bold", fontSize: 15, padding: "10px 14px", display: "flex", alignItems: "center", borderBottom: `1px solid ${retro.hairline}`, borderRadius: "3px 3px 0 0" }}><span style={{ fontFamily: "Georgia,serif", marginRight: 8 }}>?</span><span style={{ flex: 1 }}>Help Topics</span><span onClick={() => setHelpOpen(false)} style={{ color: retro.inkMuted, cursor: "pointer", padding: "2px 4px" }}>✕</span></div>
            <div style={{ padding: 14, fontSize: 13, color: retro.inkSoft, lineHeight: 1.6 }}>
              <div style={{ background: "#fff", border: `1px solid ${retro.hairline}`, borderRadius: 3, padding: "4px 12px" }}>
                {[["Getting started", "Sign on, add buddies, send your first message."], ["Away messages", "Set an auto-response with %n, %d and %t."], ["Channels & IRC", "Join SIGNOFF rooms or real IRC networks like Libera."], ["Buddy list", "Group buddies, star favorites, set your status."]].map(([t, d], i, a) => (
                  <div key={t} style={{ padding: "8px 0", borderBottom: i < a.length - 1 ? `1px solid ${retro.hairline}` : "none" }}><span style={{ fontWeight: "bold", color: retro.blue }}>{t}</span><br /><span style={{ fontSize: 12, color: retro.inkMuted }}>{d}</span></div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: retro.inkMuted, textAlign: "center", fontFamily: retro.fontMono, marginTop: 10 }}>signoff.chat/help</div>
            </div>
          </div>
        </div>
      )}

      {/* Buddy Info dialog */}
      {infoFor && (
        <div onClick={() => setInfoFor(null)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(25,30,60,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 320, background: retro.well, border: `1px solid ${retro.border}`, borderRadius: 3, boxShadow: "0 20px 50px rgba(10,15,40,0.5)" }}>
            <div style={{ background: "#fdfcf9", color: retro.ink, fontWeight: "bold", fontSize: 15, padding: "10px 14px", display: "flex", alignItems: "center", borderBottom: `1px solid ${retro.hairline}`, borderRadius: "3px 3px 0 0" }}><span style={{ flex: 1 }}>Buddy Info</span><span onClick={() => setInfoFor(null)} style={{ color: retro.inkMuted, cursor: "pointer", padding: "2px 4px" }}>✕</span></div>
            <div style={{ padding: 14, fontSize: 13, color: retro.inkSoft }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 3, background: retro.gradient, color: retro.gold, fontFamily: retro.fontBrand, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{infoFor.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 16, color: snColor(infoFor) }}>{infoFor}</div>
                  <div style={{ fontSize: 12, color: retro.inkMuted }}>{buddies.find((b) => b.screenname.toLowerCase() === infoFor.toLowerCase())?.status === "ONLINE" ? "online" : "offline"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setNewBuddy(infoFor); addBuddy(); setInfoFor(null); }} style={{ ...btnStyle, flex: 1, height: 44, fontSize: 12, fontWeight: "bold" }}>Add Buddy</button>
                <button onClick={() => { fetch(`/api/users/${encodeURIComponent(infoFor)}/block`, { method: "POST" }).catch(() => {}); setInfoFor(null); }} style={{ ...btnStyle, flex: 1, height: 44, fontSize: 12, fontWeight: "bold", color: retro.redDeep }}>Block</button>
                <button onClick={() => setInfoFor(null)} style={{ ...btnStyle, flex: 1, height: 44, fontSize: 12, fontWeight: "bold", color: retro.blue }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div style={{ display: "flex", gap: 4, padding: "6px 8px calc(8px + env(safe-area-inset-bottom,0px))", background: retro.chrome, borderTop: `1px solid ${retro.border}`, borderRadius: "14px 14px 0 0", margin: "0 6px", boxShadow: "0 -6px 20px rgba(10,15,40,0.25)" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <div key={t.key} onClick={() => { setTab(t.key); if (t.key === "buddies") setDmTarget(null); if (t.key === "channels") { setRoom(null); roomRef.current = null; setIrcView(null); } }}
              style={{ flex: 1, minHeight: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", borderRadius: 8, background: active ? retro.selection : "transparent" }}>
              {tabIcon(t.key, active)}
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
