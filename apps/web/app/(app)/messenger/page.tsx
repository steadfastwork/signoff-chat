"use client";

// Minimal retro Messenger wired to the OSCAR backbone (Phase 3/5 slice):
//  - subscribes to the gateway's Pusher relay channel for inbound IMs
//  - sends via /api/im/send → gateway → open-oscar-server
// A fuller buddy-list-driven experience (PROMPTS #4/#5) builds on this.
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { soketiClient } from "@/lib/soketi";
import { gatewayUserChannel } from "@/lib/gatewayChannel";
import {
  RetroWindow,
  MessageLog,
  SendButton,
  inputStyle,
  retro,
  sounds,
  type RetroMessage,
} from "@/components/retro/retro-components";

export default function MessengerPage() {
  const { data: session } = useSession();
  const me = session?.user?.screenname ?? "";
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<RetroMessage[]>([]);
  const meRef = useRef(me);
  meRef.current = me;

  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  useEffect(() => {
    if (!me || !soketiClient) return;
    const channelName = gatewayUserChannel(me);
    const channel = soketiClient.subscribe(channelName);
    const onIM = (data: { from: string; message: string }) => {
      setMessages((m) => [...m, { screenname: data.from, text: data.message, time: now() }]);
      sounds.msgIn();
    };
    const onSubErr = () => {
      setMessages((m) => [...m, { screenname: "system", text: "", time: now(), sys: "— couldn't connect to live messages; try refreshing —" }]);
    };
    channel.bind("im", onIM);
    channel.bind("pusher:subscription_error", onSubErr);

    // Keep the gateway's OSCAR session alive while this window is open.
    const hb = setInterval(() => {
      fetch("/api/im/heartbeat", { method: "POST" }).catch(() => {});
    }, 4 * 60 * 1000);

    return () => {
      clearInterval(hb);
      channel.unbind("im", onIM);
      channel.unbind("pusher:subscription_error", onSubErr);
      soketiClient.unsubscribe(channelName);
    };
  }, [me]);

  async function send() {
    const body = text.trim();
    if (!to.trim() || !body) return;
    setMessages((m) => [...m, { screenname: meRef.current, text: body, time: now() }]);
    setText("");
    sounds.msgOut();
    try {
      const res = await fetch("/api/im/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: to.trim(), message: body }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const needsLogin = res.status === 401 || res.status === 409;
        const note = needsLogin ? "your session expired — please sign in again" : j.error || "send failed";
        setMessages((m) => [...m, { screenname: "system", text: "", time: now(), sys: `— ${note} —` }]);
      }
    } catch {
      setMessages((m) => [...m, { screenname: "system", text: "network error", time: now(), sys: "— network error —" }]);
    }
  }

  return (
    <div className="retro-desktop" style={{ minHeight: "calc(100dvh - 52px)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 24 }}>
      <RetroWindow title={to ? `${to} — Instant Message` : "Instant Message"} badge width={460}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${retro.hairline}`, background: "#faf8f3", fontFamily: retro.fontUI, fontSize: 12 }}>
          <span style={{ color: retro.inkSoft }}>To:</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="buddy screenname"
            style={{ ...inputStyle, flex: 1, height: 30, fontWeight: "bold", color: retro.blue }}
          />
          <span style={{ color: retro.inkMuted, fontSize: 11 }}>you are {me || "…"}</span>
        </div>

        <div style={{ margin: "8px 10px" }}>
          <MessageLog messages={messages} me={me} height={300} />
        </div>

        <div style={{ display: "flex", gap: 7, padding: "0 10px 10px" }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={to ? `message ${to}…` : "pick a buddy above…"}
            style={{ ...inputStyle, flex: 1, minWidth: 0, height: 38 }}
          />
          <SendButton onClick={send} />
        </div>
      </RetroWindow>
    </div>
  );
}
