"use client";

// Retro Messenger — an AIM-style multi-window DESKTOP.
//  - Buddy List window (live presence from the gateway + `buddy` Pusher events).
//  - A separate, DRAGGABLE Instant Message window per conversation; click a buddy
//    (or receive an IM) to open/raise their window. Windows stack by z-order and
//    move by their titlebar. Send → /api/im/send → gateway → open-oscar-server.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { soketiClient } from "@/lib/soketi";
import { gatewayUserChannel } from "@/lib/gatewayChannel";
import {
  RetroWindow,
  BuddyRow,
  MessageLog,
  SendButton,
  AwayBanner,
  btnStyle,
  inputStyle,
  retro,
  sounds,
  type RetroBuddy,
  type RetroMessage,
} from "@/components/retro/retro-components";

type Presence = { name: string; online: boolean };
type Win = { id: string; kind: "buddies" | "im"; buddy?: string; x: number; y: number; z: number };

export default function MessengerPage() {
  const { data: session } = useSession();
  const me = session?.user?.screenname ?? "";
  const meRef = useRef(me);
  meRef.current = me;

  const [buddies, setBuddies] = useState<RetroBuddy[]>([]);
  const [newBuddy, setNewBuddy] = useState("");
  const [away, setAway] = useState(false);
  const [awayMsg, setAwayMsg] = useState("");
  const [awayComposer, setAwayComposer] = useState(false);

  // Per-conversation message logs + compose drafts, keyed by lowercased buddy.
  const [dm, setDm] = useState<Record<string, RetroMessage[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Window manager.
  const [wins, setWins] = useState<Win[]>([{ id: "buddies", kind: "buddies", x: 24, y: 24, z: 1 }]);
  const zRef = useRef(2);
  const nextZ = () => (zRef.current += 1);
  const deskRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; gx: number; gy: number; left: number; top: number } | null>(null);

  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const toBuddy = (p: Presence): RetroBuddy => ({ screenname: p.name, status: p.online ? "ONLINE" : "OFFLINE" });

  const focusWin = useCallback((id: string) => {
    const z = nextZ();
    setWins((ws) => ws.map((w) => (w.id === id ? { ...w, z } : w)));
  }, []);

  const openIM = useCallback((buddy: string) => {
    const key = buddy.toLowerCase();
    const id = `im:${key}`;
    setWins((ws) => {
      const existing = ws.find((w) => w.id === id);
      const z = nextZ();
      if (existing) return ws.map((w) => (w.id === id ? { ...w, z } : w));
      const n = ws.filter((w) => w.kind === "im").length;
      return [...ws, { id, kind: "im", buddy, x: 300 + (n % 6) * 30, y: 48 + (n % 6) * 30, z }];
    });
  }, []);

  const closeWin = (id: string) => setWins((ws) => ws.filter((w) => w.id !== id));

  // Drag by titlebar (positions are relative to the desktop container).
  function startDrag(e: React.MouseEvent, w: Win) {
    const rect = deskRef.current?.getBoundingClientRect();
    if (!rect) return;
    focusWin(w.id);
    dragRef.current = { id: w.id, gx: e.clientX - rect.left - w.x, gy: e.clientY - rect.top - w.y, left: rect.left, top: rect.top };
    e.preventDefault();
  }
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const x = Math.max(0, e.clientX - d.left - d.gx);
      const y = Math.max(0, e.clientY - d.top - d.gy);
      setWins((ws) => ws.map((w) => (w.id === d.id ? { ...w, x, y } : w)));
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const loadBuddies = useCallback(async () => {
    try {
      const r = await fetch("/api/buddies");
      const j = await r.json();
      setBuddies(((j.buddies as Presence[]) ?? []).map(toBuddy).sort(sortBuddies));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!me) return;
    loadBuddies();
    const poll = setInterval(loadBuddies, 30000);
    return () => clearInterval(poll);
  }, [me, loadBuddies]);

  useEffect(() => {
    if (!me || !soketiClient) return;
    const channelName = gatewayUserChannel(me);
    const channel = soketiClient.subscribe(channelName);
    const onIM = (data: { from: string; message: string }) => {
      const key = data.from.toLowerCase();
      setDm((p) => ({ ...p, [key]: [...(p[key] ?? []), { screenname: data.from, text: data.message, time: now() }] }));
      openIM(data.from); // AIM opens/raises a window on an incoming message
      sounds.msgIn();
    };
    const onBuddy = (b: { name: string; online: boolean }) => {
      setBuddies((prev) => [...prev.filter((x) => x.screenname.toLowerCase() !== b.name.toLowerCase()), toBuddy(b)].sort(sortBuddies));
      sounds[b.online ? "doorOpen" : "doorSlam"]();
    };
    channel.bind("im", onIM);
    channel.bind("buddy", onBuddy);
    const hb = setInterval(() => fetch("/api/im/heartbeat", { method: "POST" }).catch(() => {}), 4 * 60 * 1000);
    return () => {
      clearInterval(hb);
      channel.unbind("im", onIM);
      channel.unbind("buddy", onBuddy);
      soketiClient.unsubscribe(channelName);
    };
  }, [me, openIM]);

  async function setAwayStatus(message: string) {
    try {
      const res = await fetch("/api/away", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) });
      const j = await res.json().catch(() => ({}));
      setAway(!!j.away);
      setAwayComposer(false);
    } catch { /* ignore */ }
  }

  async function addBuddy() {
    const name = newBuddy.trim();
    if (!name) return;
    setNewBuddy("");
    try {
      await fetch("/api/buddies/add", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ names: [name] }) });
      setTimeout(loadBuddies, 1000);
    } catch { /* ignore */ }
  }

  async function send(buddy: string) {
    const key = buddy.toLowerCase();
    const body = (drafts[key] ?? "").trim();
    if (!buddy.trim() || !body) return;
    setDm((p) => ({ ...p, [key]: [...(p[key] ?? []), { screenname: meRef.current, text: body, time: now() }] }));
    setDrafts((d) => ({ ...d, [key]: "" }));
    sounds.msgOut();
    try {
      const res = await fetch("/api/im/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: buddy.trim(), message: body }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const note = res.status === 401 || res.status === 409 ? "your session expired — please sign in again" : j.error || "send failed";
        setDm((p) => ({ ...p, [key]: [...(p[key] ?? []), { screenname: "system", text: "", time: now(), sys: `— ${note} —` }] }));
      }
    } catch {
      setDm((p) => ({ ...p, [key]: [...(p[key] ?? []), { screenname: "system", text: "", time: now(), sys: "— network error —" }] }));
    }
  }

  function newIM() {
    const name = (typeof window !== "undefined" ? window.prompt("Send an IM to which screen name?") : "")?.trim();
    if (name) openIM(name);
  }

  const online = buddies.filter((b) => b.status === "ONLINE").length;

  return (
    <div ref={deskRef} className="retro-desktop" style={{ position: "relative", minHeight: "calc(100dvh - 52px)", overflow: "hidden" }}>
      {wins.map((w) =>
        w.kind === "buddies" ? (
          <RetroWindow
            key={w.id}
            title={`${me || "…"}'s Buddy List`}
            badge
            width={240}
            onTitleMouseDown={(e) => startDrag(e, w)}
            onFocus={() => focusWin(w.id)}
            style={{ position: "absolute", left: w.x, top: w.y, zIndex: w.z }}
          >
            <div style={{ padding: "6px 8px", borderBottom: `1px solid ${retro.hairline}` }}>
              {away ? (
                <AwayBanner message={awayMsg || "(away)"} onBack={() => setAwayStatus("")} />
              ) : awayComposer ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <textarea value={awayMsg} onChange={(e) => setAwayMsg(e.target.value)} placeholder="I am away from my computer right now." rows={2} style={{ ...inputStyle, padding: 6, fontFamily: retro.fontMsg, resize: "none", height: "auto" }} />
                  <div style={{ fontSize: 10, color: retro.inkMuted, fontFamily: retro.fontMono }}>%n buddy · %d date · %t time</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => setAwayStatus(awayMsg || "I am away right now.")} style={{ ...btnStyle, height: 28, padding: "0 10px", color: retro.amberDeep }}>Set Away</button>
                    <button onClick={() => setAwayComposer(false)} style={{ ...btnStyle, height: 28, padding: "0 10px" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 5 }}>
                  <button onClick={() => setAwayComposer(true)} style={{ ...btnStyle, height: 26, padding: "0 10px", fontSize: 11, flex: 1 }}>I&apos;m Away…</button>
                  <button onClick={newIM} style={{ ...btnStyle, height: 26, padding: "0 10px", fontSize: 11, flex: 1 }}>＋ New IM</button>
                </div>
              )}
            </div>
            <div style={{ padding: "6px 10px", borderBottom: `1px solid ${retro.hairline}`, fontSize: 11, color: retro.inkSoft }}>Buddies ({online}/{buddies.length})</div>
            <div style={{ background: retro.well, minHeight: 280, maxHeight: 420, overflowY: "auto", padding: "4px 0" }}>
              {buddies.length === 0 && <div style={{ padding: "10px 14px", fontSize: 12, color: retro.inkMuted, fontStyle: "italic", fontFamily: retro.fontMsg }}>no buddies yet — add one below</div>}
              {buddies.map((b) => <BuddyRow key={b.screenname} buddy={b} onClick={() => openIM(b.screenname)} />)}
            </div>
            <div style={{ display: "flex", gap: 5, padding: 8, borderTop: `1px solid ${retro.hairline}` }}>
              <input value={newBuddy} onChange={(e) => setNewBuddy(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBuddy()} placeholder="add buddy…" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 30, fontSize: 12 }} />
              <button onClick={addBuddy} style={{ ...btnStyle, height: 30, padding: "0 10px" }}>Add</button>
            </div>
          </RetroWindow>
        ) : (
          <RetroWindow
            key={w.id}
            title={`${w.buddy} — Instant Message`}
            width={440}
            onClose={() => closeWin(w.id)}
            onTitleMouseDown={(e) => startDrag(e, w)}
            onFocus={() => focusWin(w.id)}
            style={{ position: "absolute", left: w.x, top: w.y, zIndex: w.z }}
          >
            <div style={{ margin: "8px 10px" }}>
              <MessageLog messages={dm[w.buddy!.toLowerCase()] ?? []} me={me} height={280} />
            </div>
            <div style={{ display: "flex", gap: 7, padding: "0 10px 10px" }}>
              <input
                value={drafts[w.buddy!.toLowerCase()] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [w.buddy!.toLowerCase()]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && send(w.buddy!)}
                placeholder={`message ${w.buddy}…`}
                style={{ ...inputStyle, flex: 1, minWidth: 0, height: 38 }}
              />
              <SendButton onClick={() => send(w.buddy!)} />
            </div>
          </RetroWindow>
        ),
      )}
    </div>
  );
}

function sortBuddies(a: RetroBuddy, b: RetroBuddy): number {
  const rank = (s: RetroBuddy["status"]) => (s === "ONLINE" ? 0 : s === "AWAY" ? 1 : 2);
  return rank(a.status) - rank(b.status) || a.screenname.localeCompare(b.screenname);
}
