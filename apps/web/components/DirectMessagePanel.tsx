"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS } from "@/lib/pusher";
import { formatTimestamp } from "@/lib/utils";

interface MessageSender {
  id: string;
  screenname: string;
  isGoldMember: boolean;
}

interface DM {
  id: string;
  content: string;
  createdAt: string;
  author: MessageSender;
}

interface DMUser {
  id: string;
  screenname: string;
  isGoldMember: boolean;
}

export function DirectMessagePanel({ otherUser }: { otherUser: DMUser }) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/messages/${otherUser.id}`)
      .then((r) => r.json())
      .then((data) => { setMessages(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [otherUser.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const ch = pusherClient.subscribe(CHANNELS.dm(session.user.id, otherUser.id));
    ch.bind("new-dm", (msg: DM) => {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    });
    return () => pusherClient.unsubscribe(CHANNELS.dm(session.user.id, otherUser.id));
  }, [session?.user?.id, otherUser.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !session) return;
    setSending(true);
    try {
      await fetch(`/api/messages/${otherUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input }),
      });
      setInput("");
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full font-mono">
      <div className="border-b border-green-950 p-3 bg-black">
        <p className="text-green-300 text-sm font-bold">
          {otherUser.screenname}
          {otherUser.isGoldMember && <span className="ml-1 text-xs" style={{ color: "#d4a017" }}>★</span>}
        </p>
        <p className="text-green-800 text-xs">direct message</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {loading && <p className="text-green-800 text-sm text-center animate-pulse">loading...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-green-900 text-sm text-center italic">no messages yet.</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.author.id === session?.user?.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className={`max-w-xs px-3 py-2 text-sm border ${isMe ? "border-green-800 bg-green-950 text-green-200" : "border-green-950 bg-black text-green-300"}`}>
                {msg.content}
              </div>
              <span className="text-green-900 text-xs mt-0.5">{formatTimestamp(msg.createdAt)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {session && (
        <form onSubmit={handleSend} className="border-t border-green-950 p-3 flex gap-2 bg-black">
          <span className="text-green-700 text-sm self-center">&gt;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`message ${otherUser.screenname}...`}
            className="flex-1 bg-transparent outline-none text-green-200 text-sm placeholder-green-900"
            disabled={sending}
          />
          <button type="submit" disabled={!input.trim() || sending} className="text-green-700 hover:text-green-400 text-sm disabled:opacity-30">
            [send]
          </button>
        </form>
      )}
    </div>
  );
}
