"use client";

// Retro IRC client (PROMPTS #4) — connect to a real IRC network via the gateway,
// join channels, chat. Live via the gateway's `irc` / `irc-names` Pusher events.
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { soketiClient } from "@/lib/soketi";
import { gatewayUserChannel } from "@/lib/gatewayChannel";
import { IRC_NETWORKS, findNetwork } from "@/lib/ircNetworks";
import { IRC_PALETTE, withMircColor } from "@/lib/irc-format";
import { IrcText } from "@/components/retro/irc-text";
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

const renderIrc = (t: string) => <IrcText text={t} />;

// v1 preset network.

export default function IrcPage() {
  const { data: session } = useSession();
  const me = session?.user?.screenname ?? "";
  const [netId, setNetId] = useState(IRC_NETWORKS[0].id);
  const net = findNetwork(netId);
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
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseResults, setBrowseResults] = useState<{ channel: string; users: number; topic: string }[]>([]);
  const [browseFilter, setBrowseFilter] = useState("");
  const [browseLoading, setBrowseLoading] = useState(false);
  // User's own text color (mIRC code), persisted. null = default ink.
  const [color, setColor] = useState<number | null>(null);
  useEffect(() => {
    try { const v = localStorage.getItem("signoff_irc_color"); if (v) setColor(parseInt(v, 10)); } catch {}
  }, []);
  function pickColor(code: number | null) {
    setColor(code);
    try { code == null ? localStorage.removeItem("signoff_irc_color") : localStorage.setItem("signoff_irc_color", String(code)); } catch {}
  }

  async function browse() {
    setBrowseOpen(true); setBrowseLoading(true); setBrowseResults([]);
    try {
      const j = await (await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "list", network: net.label }) })).json();
      setBrowseResults(Array.isArray(j.channels) ? j.channels : []);
    } catch {} finally { setBrowseLoading(false); }
  }

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
      const res = await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "connect", network: net.label, host: net.host, port: 6697, tls: true, nick: nick.trim(), saslPassword: saslPassword.trim() || undefined }) });
      const j = await res.json();
      if (!res.ok) {
        push("*", { screenname: "system", text: "", time: now(), sys: `— ${j.error || "connect failed"} —` });
      } else {
        setConnected(true);
        setMyNick(j.nick || nick.trim());
        myNickRef.current = j.nick || nick.trim();
        setActive("*");
        push("*", { screenname: "system", text: "", time: now(), sys: `— connected to ${net.label} as ${j.nick} —` });
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
    await fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", network: net.label, channel: c }) });
    setChannels((prev) => (prev.includes(c) ? prev : [...prev, c]));
    setActive(c);
    setChannelInput("");
  }

  const api = (payload: Record<string, unknown>) =>
    fetch("/api/irc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, network: net.label }) }).catch(() => {});
  const sys = (chan: string, t: string) => push(chan, { screenname: "sys", text: "", time: now(), sys: `— ${t} —` });

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    sounds.msgOut();

    // Slash-commands — full IRC access. Anything not special-cased goes raw, so
    // every server command works (/whois, /mode, /kick, /topic, /list, …).
    if (body.startsWith("/") && !body.startsWith("//")) {
      const sp = body.indexOf(" ");
      const cmd = (sp === -1 ? body.slice(1) : body.slice(1, sp)).toLowerCase();
      const arg = sp === -1 ? "" : body.slice(sp + 1).trim();
      const soh = String.fromCharCode(1);
      switch (cmd) {
        case "me":
          if (active.startsWith("#") || !active.startsWith("*")) { push(active, { screenname: myNick, text: `* ${myNick} ${arg}`, time: now() }); await api({ action: "raw", line: `PRIVMSG ${active} :${soh}ACTION ${arg}${soh}` }); }
          return;
        case "msg": case "query": {
          const s2 = arg.indexOf(" "); const to = s2 === -1 ? arg : arg.slice(0, s2); const m = s2 === -1 ? "" : arg.slice(s2 + 1);
          if (!to) { sys(active || "*", "usage: /msg <nick> <message>"); return; }
          push(to, { screenname: myNick, text: m, time: now() }); setChannels((p) => (p.includes(to) ? p : [...p, to])); setActive(to);
          if (m) await api({ action: "send", target: to, message: m });
          return;
        }
        case "join": case "j": if (arg) await joinChannel(arg.replace(/^#?/, "#")); return;
        case "part": case "leave": { const c = arg || active; await api({ action: "part", channel: c }); setChannels((p) => p.filter((x) => x !== c)); if (active === c) setActive("*"); return; }
        case "nick": if (arg) await api({ action: "raw", line: `NICK ${arg}` }); return;
        case "topic": await api({ action: "raw", line: `TOPIC ${active}${arg ? ` :${arg}` : ""}` }); return;
        case "raw": case "quote": if (arg) await api({ action: "raw", line: arg }); return;
        default:
          // Pass through as a raw IRC command (uppercased verb).
          await api({ action: "raw", line: `${cmd.toUpperCase()}${arg ? ` ${arg}` : ""}` });
          if (active) sys(active, `sent: /${cmd} ${arg}`.trim());
          return;
      }
    }

    if (!active || active === "*") return;
    const msg = body.startsWith("//") ? body.slice(1) : body; // // escapes a leading slash
    push(active, { screenname: myNick, text: withMircColor(msg, color), time: now() }); // IRC doesn't echo own msgs
    await api({ action: "send", target: active, message: withMircColor(msg, color) });
  }

  if (!connected) {
    return (
      <div className="retro-desktop" style={{ minHeight: "calc(100dvh - 52px)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 24 }}>
        <RetroWindow title="Connect to IRC" badge width={340}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: retro.fontMsg, fontStyle: "italic", fontSize: 13, color: retro.inkSoft }}>Network</span>
              <select value={netId} onChange={(e) => setNetId(e.target.value)} style={{ ...inputStyle, height: 36 }}>
                {IRC_NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </div>
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
      <RetroWindow title={`IRC — ${net.label}`} badge width={210}>
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
          <button onClick={browse} style={{ ...btnStyle, height: 30, padding: "0 8px" }}>Browse</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "0 8px 8px" }}>
          {net.suggested.map((c) => (
            <span key={c} onClick={() => joinChannel(c)} style={{ fontSize: 11, color: retro.blue, border: `1px solid ${retro.inputBorder}`, borderRadius: 12, padding: "3px 8px", cursor: "pointer", background: "#fff" }}>{c}</span>
          ))}
        </div>
      </RetroWindow>

      <RetroWindow title={active === "*" ? "Server" : `${net.label}: ${active}`} width={470}>
        <div style={{ display: "flex", gap: 8, padding: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}><MessageLog messages={msgs} me={myNick} height={320} formatText={renderIrc} /></div>
          {active.startsWith("#") && (
            <div style={{ width: 120, border: `1px solid ${retro.wellBorder}`, borderRadius: 2, background: retro.well, overflowY: "auto", height: 320, padding: "4px 0" }}>
              <div style={{ fontSize: 10.5, color: retro.inkMuted, fontFamily: retro.fontMono, padding: "2px 8px", borderBottom: `1px solid ${retro.hairline}` }}>{chanNames.length} here</div>
              {chanNames.map((u) => (
                <div key={u} style={{ padding: "2px 8px", fontSize: 12, fontFamily: retro.fontUI, color: u.toLowerCase() === myNick.toLowerCase() ? retro.ink : snColor(u), fontWeight: u.toLowerCase() === myNick.toLowerCase() ? "bold" : "normal" }}>{u}</div>
              ))}
            </div>
          )}
        </div>
        {/* Color picker — your outgoing text color (mIRC), remembered. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px 6px" }}>
          <span style={{ fontSize: 11, color: retro.inkMuted, fontFamily: retro.fontUI }}>color:</span>
          <span onClick={() => pickColor(null)} title="default" style={{ width: 18, height: 18, borderRadius: 3, background: "#fff", border: `2px solid ${color == null ? retro.blue : retro.inputBorder}`, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: retro.inkMuted }}>✕</span>
          {IRC_PALETTE.map((c) => (
            <span key={c.code} onClick={() => pickColor(c.code)} title={c.label} style={{ width: 18, height: 18, borderRadius: 3, background: c.hex, border: `2px solid ${color === c.code ? retro.blue : "rgba(0,0,0,0.2)"}`, cursor: "pointer" }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 7, padding: "0 8px 8px" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={active.startsWith("#") ? `message ${active}…  (/help-style commands work)` : "type a /command, or /join #channel…"} style={{ ...inputStyle, flex: 1, minWidth: 0, height: 38, color: color != null ? (IRC_PALETTE.find((p) => p.code === color)?.hex ?? undefined) : undefined }} />
          <SendButton onClick={send} />
        </div>
      </RetroWindow>

      {browseOpen && (
        <div onClick={() => setBrowseOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(20,25,50,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()}>
            <RetroWindow title={`Browse Channels — ${net.label}`} badge onClose={() => setBrowseOpen(false)} width={480} style={{ maxHeight: "80vh" }}>
              <div style={{ padding: 8, borderBottom: `1px solid ${retro.hairline}` }}>
                <input value={browseFilter} onChange={(e) => setBrowseFilter(e.target.value)} placeholder="search channels…" style={{ ...inputStyle, width: "100%", height: 34 }} />
              </div>
              <div style={{ overflowY: "auto", maxHeight: "60vh", background: retro.well }}>
                {browseLoading && <div style={{ padding: 16, fontStyle: "italic", color: retro.inkMuted, fontFamily: retro.fontMsg }}>listing channels…</div>}
                {!browseLoading && browseResults.length === 0 && <div style={{ padding: 16, fontStyle: "italic", color: retro.inkMuted, fontFamily: retro.fontMsg }}>no channels returned</div>}
                {browseResults
                  .filter((c) => { const q = browseFilter.toLowerCase(); return !q || c.channel.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q); })
                  .slice(0, 300)
                  .map((c) => (
                    <div key={c.channel} onClick={() => { joinChannel(c.channel); setBrowseOpen(false); }} style={{ padding: "6px 12px", borderBottom: `1px solid ${retro.hairline}`, cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: retro.blue, fontWeight: "bold" }}>{c.channel}</span><span style={{ fontSize: 11, color: retro.inkMuted }}>{c.users}</span></div>
                      {c.topic && <div style={{ fontSize: 11.5, color: retro.inkSoft, fontFamily: retro.fontMsg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.topic}</div>}
                    </div>
                  ))}
              </div>
            </RetroWindow>
          </div>
        </div>
      )}
    </div>
  );
}
