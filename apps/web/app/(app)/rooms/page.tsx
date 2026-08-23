"use client";

// Retro Chat Rooms (PROMPTS.md #7) over OSCAR public chat (exchange 5).
// Lists rooms, joins by name, and shows a live Chat Room window driven by the
// gateway's `chat` / `chat-roster` Pusher events.
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

type PublicRoom = { name: string; participants?: string[] };

export default function RoomsPage() {
  const { data: session } = useSession();
  const me = session?.user?.screenname ?? "";
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [roomName, setRoomName] = useState("");
  const [joined, setJoined] = useState<{ roomId: number; name: string } | null>(null);
  const joinedRef = useRef<number | null>(null);
  const [messages, setMessages] = useState<RetroMessage[]>([]);
  const [whoHere, setWhoHere] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  useEffect(() => {
    fetch("/api/chat/rooms")
      .then((r) => r.json())
      .then((j) => setRooms(Array.isArray(j.rooms) ? j.rooms : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!me || !soketiClient) return;
    const ch = soketiClient.subscribe(gatewayUserChannel(me));
    const onChat = (m: { roomId: number; from: string; message: string }) => {
      if (m.roomId !== joinedRef.current) return;
      setMessages((prev) => [...prev, { screenname: m.from, text: m.message, time: now() }]);
      if (m.from.toLowerCase() !== me.toLowerCase()) sounds.msgIn();
    };
    const onRoster = (r: { roomId: number; users: string[] }) => {
      if (r.roomId !== joinedRef.current) return;
      setWhoHere(r.users);
    };
    ch.bind("chat", onChat);
    ch.bind("chat-roster", onRoster);
    return () => {
      ch.unbind("chat", onChat);
      ch.unbind("chat-roster", onRoster);
      soketiClient.unsubscribe(gatewayUserChannel(me));
    };
  }, [me]);

  async function join(name: string) {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/chat/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: n }) });
      const j = await res.json();
      if (!res.ok) {
        setMessages([{ screenname: "system", text: "", time: now(), sys: `— ${j.error || "could not join"} —` }]);
      } else {
        joinedRef.current = j.roomId;
        setJoined({ roomId: j.roomId, name: j.room });
        setMessages([{ screenname: "system", text: "", time: now(), sys: `— you have entered "${j.room}" —` }]);
        setWhoHere([]);
        setRoomName("");
        sounds.doorOpen();
      }
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!joined) return;
    const id = joined.roomId;
    joinedRef.current = null;
    setJoined(null);
    setMessages([]);
    setWhoHere([]);
    fetch("/api/chat/leave", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId: id }) }).catch(() => {});
    sounds.doorSlam();
  }

  async function send() {
    const body = text.trim();
    if (!body || !joined) return;
    setText("");
    // OSCAR echoes chat messages back to the sender via CHAT_IN, so don't
    // optimistically append here (avoids duplicates).
    fetch("/api/chat/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId: joined.roomId, message: body }) }).catch(() => {});
    sounds.msgOut();
  }

  return (
    <div className="retro-desktop" style={{ minHeight: "calc(100dvh - 52px)", display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 16, padding: 24, flexWrap: "wrap" }}>
      {/* Room list */}
      <RetroWindow title="Chat Rooms" badge width={240}>
        <div style={{ background: retro.well, minHeight: 260, maxHeight: 380, overflowY: "auto", padding: "4px 0" }}>
          {rooms.length === 0 && <div style={{ padding: "10px 14px", fontSize: 12, color: retro.inkMuted, fontStyle: "italic", fontFamily: retro.fontMsg }}>no public rooms yet — start one below</div>}
          {rooms.map((r) => (
            <div key={r.name} onClick={() => join(r.name)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", cursor: "pointer", fontFamily: retro.fontUI, fontSize: 13, background: joined?.name === r.name ? retro.selection : "transparent" }}>
              <span style={{ color: retro.blue, fontWeight: "bold" }}># {r.name}</span>
              <span style={{ fontSize: 11, color: retro.inkMuted }}>{r.participants?.length ?? 0}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, padding: 8, borderTop: `1px solid ${retro.hairline}` }}>
          <input value={roomName} onChange={(e) => setRoomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join(roomName)} placeholder="room name…" style={{ ...inputStyle, flex: 1, minWidth: 0, height: 30, fontSize: 12 }} />
          <button onClick={() => join(roomName)} disabled={busy} style={{ ...btnStyle, height: 30, padding: "0 10px" }}>Join</button>
        </div>
      </RetroWindow>

      {/* Chat Room window */}
      <RetroWindow title={joined ? `Chat Room: ${joined.name}` : "Chat Room"} width={470} onClose={joined ? leave : undefined}>
        <div style={{ display: "flex", gap: 8, padding: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <MessageLog messages={messages} me={me} height={300} />
          </div>
          {/* who's here */}
          <div style={{ width: 120, border: `1px solid ${retro.wellBorder}`, borderRadius: 2, background: retro.well, overflowY: "auto", height: 300, padding: "4px 0" }}>
            <div style={{ fontSize: 10.5, color: retro.inkMuted, fontFamily: retro.fontMono, padding: "2px 8px", borderBottom: `1px solid ${retro.hairline}` }}>{whoHere.length} here</div>
            {whoHere.map((u) => (
              <div key={u} style={{ padding: "2px 8px", fontSize: 12, fontFamily: retro.fontUI, fontWeight: u.toLowerCase() === me.toLowerCase() ? "bold" : "normal", color: u.toLowerCase() === me.toLowerCase() ? retro.ink : snColor(u), background: u.toLowerCase() === me.toLowerCase() ? retro.selection : "transparent" }}>{u}</div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, padding: "0 8px 8px" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={joined ? `say something in ${joined.name}…` : "join a room first…"} disabled={!joined} style={{ ...inputStyle, flex: 1, minWidth: 0, height: 38 }} />
          <SendButton onClick={send} />
        </div>
      </RetroWindow>
    </div>
  );
}
