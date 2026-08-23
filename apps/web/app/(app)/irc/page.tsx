"use client";

// Retro IRC client (PROMPTS #4) — connect to a real IRC network via the gateway,
// join channels, chat. Live via the gateway's `irc` / `irc-names` Pusher events.
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { soketiClient } from "@/lib/soketi";
import { gatewayUserChannel } from "@/lib/gatewayChannel";
import {
  RetroWindow,
  MessageLog,
  SendButton,
  btnStyle,
  inputStyle,
  retro,
  snColor,
  sounds,
  type RetroMessage,
} from "@/components/retro/retro-components";

// v1 preset network.
const NETWORK = "Libera.Chat";
const HOST = "irc.libera.chat";

export default function IrcPage() {
  const { data: session } = useSession();
  const me = session?.user?.screenname ?? "";
  const [nick, setNick] = useState("");
  const [saslPassword, setSaslPassword] = useState("");
  const [connected, setConnected] = useState(false);
  const [myNick, setMyNick] = useState("");
  const myNickRef = useRef("");
  const [channels, setChannels] = useState<string[]>([]);
  const [active, setActive] = useState("");
  const activeRef = useRef("");
  activeRef.current = active;
  const [byChannel, setByChannel] = useState<Record<string, RetroMessage[]>>({});
  const [names, setNames] = useState<Record<string, string[]>>({});
  const [channelInput, setChannelInput] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const push = (chan: string, m: RetroMessage) => setByChannel((prev) => ({ ...prev, [chan]: [...(prev[chan] ?? []), m] }));

  useEffect(() => {
    if (me) setNick((n) => n || me);
  }, [me]);

  useEffect(() => {
    if (!me || !soketiClient) return;
    const ch = soketiClient.subscribe(gatewayUserChannel(me));
    const onMsg = (m: { network: string; target: string; from: string; message: string; isPM: boolean }) => {
      push(m.target, { screenname: m.from, text: m.message, time: now() });
      if (m.from.toLowerCase() !== myNickRef.current.toLowerCase()) sounds.msgIn();
    };
    const onNames = (n: { channel: string; users: string[] }) => setNames((prev) => ({ ...prev, [n.channel]: n.users }));
    const onSys = (s: { text: string }) => push(activeRef.current || "*", { screenname: "system", text: "", time: now(), sys: `— ${s.text} —` });
    ch.bind("irc", onMsg);
    ch.bind("irc-names", onNames);
    ch.bind("irc-system", onSys);
    return () => {
      ch.unbind("irc", onMsg);
      ch.unbind("irc-names", onNames);
      ch.unbind("irc-system", onSys);
      soketiClient.unsubscribe(gatewayUserChannel(me));
    };
  }, [me]);

  async function connect() {
    if (!nick.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "connect", network: NETWORK, host: HOST, port: 6697, tls: true, nick: nick.trim(), saslPassword: saslPassword.trim() || undefined }) });
      const j = await res.json();
      if (!res.ok) {
        push("*", { screenname: "system", text: "", time: now(), sys: `— ${j.error || "connect failed"} —` });
      } else {
        setConnected(true);
        setMyNick(j.nick || nick.trim());
        myNickRef.current = j.nick || nick.trim();
        setActive("*");
        push("*", { screenname: "system", text: "", time: now(), sys: `— connected to ${NETWORK} as ${j.nick} —` });
        sounds.doorOpen();
      }
    } finally {
      setBusy(false);
    }
  }

  async function joinChannel(chan: string) {
    let c = chan.trim();
    if (!c) return;
    if (!c.startsWith("#")) c = "#" + c;
    await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", network: NETWORK, channel: c }) });
    setChannels((prev) => (prev.includes(c) ? prev : [...prev, c]));
    setActive(c);
    setChannelInput("");
  }

  async function send() {
    const body = text.trim();
    if (!body || !active || active === "*") return;
    setText("");
    push(active, { screenname: myNick, text: body, time: now() }); // IRC doesn't echo own msgs
    sounds.msgOut();
    fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send", network: NETWORK, target: active, message: body }) }).catch(() => {});
  }

  if (!connected) {
    return (
      <div className="retro-desktop" style={{ minHeight: "calc(100dvh - 52px)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 24 }}>
        <RetroWindow title="Connect to IRC" badge width={340}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: retro.fontMsg, fontSize: 13, color: retro.inkSoft }}>Network: <b>{NETWORK}</b> ({HOST})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: retro.fontMsg, fontStyle: "italic", fontSize: 13, color: retro.inkSoft }}>Nickname</span>
              <input value={nick} onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && connect()} style={{ ...inputStyle, height: 36, fontWeight: "bold", color: retro.blue }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: retro.fontMsg, fontStyle: "italic", fontSize: 13, color: retro.inkSoft }}>NickServ password <span style={{ color: retro.inkMuted }}>(optional — for registered channels)</span></span>
              <input type="password" value={saslPassword} onChange={(e) => setSaslPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && connect()} style={{ ...inputStyle, height: 36 }} />
            </div>
            <button onClick={connect} disabled={busy || !nick.trim()} style={{ ...btnStyle, height: 34, color: retro.greenDeep, border: `2px solid ${retro.green}`, opacity: busy ? 0.6 : 1 }}>{busy ? "Connecting…" : "Connect"}</button>
          </div>
        </RetroWindow>
      </div>
    );
  }

  const msgs = byChannel[active] ?? [];
  const chanNames = names[active] ?? [];

  return (
    <div className="retro-desktop" style={{ minHeight: "calc(100dvh - 52px)", display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 16, padding: 24, flexWrap: "wrap" }}>
      <RetroWindow title={`IRC — ${NETWORK}`} badge width={210}>
        <div style={{ padding: "6px 10px", borderBottom: `1px solid ${retro.hairline}`, fontSize: 11, color: retro.inkSoft, fontFamily: retro.fontUI }}>you are {myNick}</div>
        <div style={{ background: retro.well, minHeight: 240, maxHeight: 360, overflowY: "auto", padding: "4px 0" }}>
          <div onClick={() => setActive("*")} style={{ padding: "5px 12px", cursor: "pointer", fontFamily: retro.fontUI, fontSize: 13, background: active === "*" ? retro.selection : "transparent", color: retro.inkMuted }}>server</div>
          {channels.map((c) => (
            <div key={c} onClick={() => setActive(c)} style={{ padding: "5px 12px", cursor: "pointer", fontFamily: retro.fontUI, fontSize: 13, fontWeight: "bold", color: retro.blue, background: active === c ? retro.selection : "transparent" }}>{c}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, padding: 8, borderTop: `1px solid ${retro.hairline}` }}>
          <input value={channelInput} onChange={(e) => setChannelInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && joinChannel(channelInput)} placeholder="#channel" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 30, fontSize: 12 }} />
          <button onClick={() => joinChannel(channelInput)} style={{ ...btnStyle, height: 30, padding: "0 8px" }}>Join</button>
        </div>
      </RetroWindow>

      <RetroWindow title={active === "*" ? "Server" : `${NETWORK}: ${active}`} width={470}>
        <div style={{ display: "flex", gap: 8, padding: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}><MessageLog messages={msgs} me={myNick} height={320} /></div>
          {active.startsWith("#") && (
            <div style={{ width: 120, border: `1px solid ${retro.wellBorder}`, borderRadius: 2, background: retro.well, overflowY: "auto", height: 320, padding: "4px 0" }}>
              <div style={{ fontSize: 10.5, color: retro.inkMuted, fontFamily: retro.fontMono, padding: "2px 8px", borderBottom: `1px solid ${retro.hairline}` }}>{chanNames.length} here</div>
              {chanNames.map((u) => (
                <div key={u} style={{ padding: "2px 8px", fontSize: 12, fontFamily: retro.fontUI, color: u.toLowerCase() === myNick.toLowerCase() ? retro.ink : snColor(u), fontWeight: u.toLowerCase() === myNick.toLowerCase() ? "bold" : "normal" }}>{u}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 7, padding: "0 8px 8px" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={active.startsWith("#") ? `message ${active}…` : "join a channel to chat…"} disabled={!active.startsWith("#")} style={{ ...inputStyle, flex: 1, minWidth: 0, height: 38 }} />
          <SendButton onClick={send} />
        </div>
      </RetroWindow>
    </div>
  );
}
