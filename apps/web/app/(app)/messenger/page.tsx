"use client";

// Retro Messenger wired to the OSCAR backbone (Phase 3/4/5 slice):
//  - Buddy List with live presence (roster from the gateway, updated by `buddy`
//    Pusher events) + add-buddy
//  - Instant Message window: inbound via the gateway Pusher channel, send via
//    /api/im/send → gateway → open-oscar-server
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

export default function MessengerPage() {
  const { data: session } = useSession();
  const me = session?.user?.screenname ?? "";
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<RetroMessage[]>([]);
  const [buddies, setBuddies] = useState<RetroBuddy[]>([]);
  const [newBuddy, setNewBuddy] = useState("");
  const [away, setAway] = useState(false);
  const [awayMsg, setAwayMsg] = useState("");
  const [awayComposer, setAwayComposer] = useState(false);
  const meRef = useRef(me);
  meRef.current = me;

  async function setAwayStatus(message: string) {
    try {
      const res = await fetch("/api/away", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) });
      const j = await res.json().catch(() => ({}));
      setAway(!!j.away);
      setAwayComposer(false);
    } catch {
      /* ignore */
    }
  }

  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const toBuddy = (p: Presence): RetroBuddy => ({ screenname: p.name, status: p.online ? "ONLINE" : "OFFLINE" });

  const loadBuddies = useCallback(async () => {
    try {
      const r = await fetch("/api/buddies");
      const j = await r.json();
      setBuddies(((j.buddies as Presence[]) ?? []).map(toBuddy).sort(sortBuddies));
    } catch {
      /* ignore */
    }
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
      setMessages((m) => [...m, { screenname: data.from, text: data.message, time: now() }]);
      sounds.msgIn();
    };
    const onBuddy = (b: { name: string; online: boolean }) => {
      setBuddies((prev) => {
        const rest = prev.filter((x) => x.screenname.toLowerCase() !== b.name.toLowerCase());
        return [...rest, toBuddy(b)].sort(sortBuddies);
      });
      sounds[b.online ? "doorOpen" : "doorSlam"]();
    };
    const onSubErr = () => {
      setMessages((m) => [...m, { screenname: "system", text: "", time: now(), sys: "— couldn't connect to live messages; try refreshing —" }]);
    };
    channel.bind("im", onIM);
    channel.bind("buddy", onBuddy);
    channel.bind("pusher:subscription_error", onSubErr);
    const hb = setInterval(() => fetch("/api/im/heartbeat", { method: "POST" }).catch(() => {}), 4 * 60 * 1000);
    return () => {
      clearInterval(hb);
      channel.unbind("im", onIM);
      channel.unbind("buddy", onBuddy);
      channel.unbind("pusher:subscription_error", onSubErr);
      soketiClient.unsubscribe(channelName);
    };
  }, [me]);

  async function addBuddy() {
    const name = newBuddy.trim();
    if (!name) return;
    setNewBuddy("");
    try {
      await fetch("/api/buddies/add", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ names: [name] }) });
      setTimeout(loadBuddies, 1000);
    } catch {
      /* ignore */
    }
  }

  async function send() {
    const body = text.trim();
    if (!to.trim() || !body) return;
    setMessages((m) => [...m, { screenname: meRef.current, text: body, time: now() }]);
    setText("");
    sounds.msgOut();
    try {
      const res = await fetch("/api/im/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: to.trim(), message: body }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const note = res.status === 401 || res.status === 409 ? "your session expired — please sign in again" : j.error || "send failed";
        setMessages((m) => [...m, { screenname: "system", text: "", time: now(), sys: `— ${note} —` }]);
      }
    } catch {
      setMessages((m) => [...m, { screenname: "system", text: "", time: now(), sys: "— network error —" }]);
    }
  }

  const online = buddies.filter((b) => b.status === "ONLINE").length;

  return (
    <div className="retro-desktop" style={{ minHeight: "calc(100dvh - 52px)", display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 16, padding: 24, flexWrap: "wrap" }}>
      {/* Buddy List */}
      <RetroWindow title={`${me || "…"}'s Buddy List`} badge width={230}>
        {/* Away control */}
        <div style={{ padding: "6px 8px", borderBottom: `1px solid ${retro.hairline}` }}>
          {away ? (
            <AwayBanner message={awayMsg || "(away)"} onBack={() => setAwayStatus("")} />
          ) : awayComposer ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <textarea value={awayMsg} onChange={(e) => setAwayMsg(e.target.value)} placeholder="I am away from my computer right now." rows={2}
                style={{ ...inputStyle, padding: 6, fontFamily: retro.fontMsg, resize: "none", height: "auto" }} />
              <div style={{ fontSize: 10, color: retro.inkMuted, fontFamily: retro.fontMono }}>%n buddy · %d date · %t time</div>
              <div style={{ display: "flex", gap: 5 }}>
                <button onClick={() => setAwayStatus(awayMsg || "I am away right now.")} style={{ ...btnStyle, height: 28, padding: "0 10px", color: retro.amberDeep }}>Set Away</button>
                <button onClick={() => setAwayComposer(false)} style={{ ...btnStyle, height: 28, padding: "0 10px" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAwayComposer(true)} style={{ ...btnStyle, height: 26, padding: "0 10px", fontSize: 11, width: "100%" }}>I&apos;m Away…</button>
          )}
        </div>

        <div style={{ padding: "6px 10px", borderBottom: `1px solid ${retro.hairline}`, fontSize: 11, color: retro.inkSoft, fontFamily: retro.fontUI }}>
          Buddies ({online}/{buddies.length})
        </div>
        <div style={{ background: retro.well, minHeight: 300, maxHeight: 420, overflowY: "auto", padding: "4px 0" }}>
          {buddies.length === 0 && (
            <div style={{ padding: "10px 14px", fontSize: 12, color: retro.inkMuted, fontStyle: "italic", fontFamily: retro.fontMsg }}>
              no buddies yet — add one below
            </div>
          )}
          {buddies.map((b) => (
            <BuddyRow key={b.screenname} buddy={b} selected={to.toLowerCase() === b.screenname.toLowerCase()} onClick={() => setTo(b.screenname)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, padding: 8, borderTop: `1px solid ${retro.hairline}` }}>
          <input value={newBuddy} onChange={(e) => setNewBuddy(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBuddy()} placeholder="add buddy…" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 30, fontSize: 12 }} />
          <button onClick={addBuddy} style={{ ...btnStyle, height: 30, padding: "0 10px" }}>Add</button>
        </div>
      </RetroWindow>

      {/* Instant Message */}
      <RetroWindow title={to ? `${to} — Instant Message` : "Instant Message"} width={460}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${retro.hairline}`, background: "#faf8f3", fontFamily: retro.fontUI, fontSize: 12 }}>
          <span style={{ color: retro.inkSoft }}>To:</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="buddy screenname" style={{ ...inputStyle, flex: 1, height: 30, fontWeight: "bold", color: retro.blue }} />
        </div>
        <div style={{ margin: "8px 10px" }}>
          <MessageLog messages={messages} me={me} height={300} />
        </div>
        <div style={{ display: "flex", gap: 7, padding: "0 10px 10px" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={to ? `message ${to}…` : "pick a buddy…"} style={{ ...inputStyle, flex: 1, minWidth: 0, height: 38 }} />
          <SendButton onClick={send} />
        </div>
      </RetroWindow>
    </div>
  );
}

function sortBuddies(a: RetroBuddy, b: RetroBuddy): number {
  const rank = (s: RetroBuddy["status"]) => (s === "ONLINE" ? 0 : s === "AWAY" ? 1 : 2);
  return rank(a.status) - rank(b.status) || a.screenname.localeCompare(b.screenname);
}
