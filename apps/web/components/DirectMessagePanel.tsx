"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS } from "@/lib/pusher";
import { formatTimestamp } from "@/lib/utils";
import { playSound, unlockSounds } from "@/lib/sounds";

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
    // Mark as read immediately when panel opens
    localStorage.setItem(`dm_last_read_${otherUser.id}`, new Date().toISOString());

    fetch(`/api/messages/${otherUser.id}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMessages(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [otherUser.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const ch = pusherClient.subscribe(CHANNELS.dm(session.user.id, otherUser.id));
    ch.bind("new-dm", (msg: DM) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        // Only play sound for incoming messages (not your own)
        if (msg.author.id !== session?.user?.id) playSound("message");
        return [...prev, msg];
      });
      // Keep "last read" fresh while panel is open so the sidebar badge stays clear
      localStorage.setItem(`dm_last_read_${otherUser.id}`, new Date().toISOString());
    });
    return () => pusherClient.unsubscribe(CHANNELS.dm(session.user.id, otherUser.id));
  }, [session?.user?.id, otherUser.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !session) return;
    unlockSounds(); // ensure context is unlocked on every send gesture
    const content = input.trim();
    setSending(true);
    setInput("");

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimistic: DM = {
      id: tempId,
      content,
      createdAt: new Date().toISOString(),
      author: {
        id: session.user.id,
        screenname: session.user.screenname,
        isGoldMember: session.user.isGoldMember ?? false,
      },
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/messages/${otherUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const saved: DM = await res.json();
        // Replace optimistic with real message
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? saved : m))
        );
      } else {
        // Remove optimistic on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: "var(--font-dm-sans)", background: "var(--bg)" }}
    >
      {/* Header */}
      <div
        className="border-b px-4 py-3 flex-shrink-0 flex items-center justify-between"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {otherUser.screenname}
            {otherUser.isGoldMember && (
              <span className="ml-1 text-xs" style={{ color: "#d4a017" }}>★</span>
            )}
          </p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-dim)" }}>
            direct message
          </p>
        </div>
        <Link
          href={`/u/${otherUser.screenname}`}
          className="text-[11px] font-mono px-2 py-1 rounded-lg border transition-all"
          style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--teal)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--teal)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
          }}
        >
          view profile
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {loading && (
          <p
            className="text-sm text-center animate-pulse mt-4"
            style={{ color: "var(--text-dim)" }}
          >
            loading…
          </p>
        )}
        {!loading && messages.length === 0 && (
          <p
            className="text-sm text-center mt-4 font-mono"
            style={{ color: "var(--text-dim)" }}
          >
            no messages yet. say hi!
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.author.id === session?.user?.id;
          const isOptimistic = msg.id.startsWith("temp-");
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
            >
              {!isMe && (
                <span
                  className="text-[10px] font-mono px-1"
                  style={{ color: "var(--text-dim)" }}
                >
                  {msg.author.screenname}
                </span>
              )}
              <div
                className="max-w-[75%] px-3 py-2 rounded-xl text-sm"
                style={
                  isMe
                    ? {
                        background: "var(--teal)",
                        color: "var(--bg)",
                        opacity: isOptimistic ? 0.6 : 1,
                      }
                    : {
                        background: "var(--surface)",
                        color: "var(--text)",
                        border: "1px solid var(--border)",
                      }
                }
              >
                {msg.content}
              </div>
              <span
                className="text-[10px] font-mono px-1"
                style={{ color: "var(--text-dim)" }}
              >
                {formatTimestamp(msg.createdAt)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {session && (
        <form
          onSubmit={handleSend}
          className="border-t flex items-center gap-2 px-3 py-2 flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`message ${otherUser.screenname}…`}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{
              color: "var(--text)",
              fontFamily: "var(--font-dm-sans)",
            }}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
            style={{
              background: "var(--teal)",
              color: "var(--bg)",
              fontWeight: 600,
            }}
          >
            send
          </button>
        </form>
      )}
    </div>
  );
}
