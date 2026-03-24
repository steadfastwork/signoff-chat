"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import {
  ChannelMessage,
  type ChannelMessageData,
} from "@/components/ChannelMessage";
import { InvitePanel } from "@/components/InvitePanel";
import { StatusDot, type StatusValue } from "@/components/StatusDot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelDetail {
  id: string;
  name: string;
  description: string | null;
  type: "PUBLIC" | "INVITE_ONLY" | "SECRET";
  slowModeMinutes: number;
  memberCap: number | null;
  creatorId: string;
  memberCount: number;
  isMember: boolean;
  myMembership: { joinedAt: string; lastMessageAt: string | null } | null;
  messages: ChannelMessageData[];
  members: {
    userId: string;
    joinedAt: string;
    user: {
      id: string;
      screenname: string;
      isGoldMember: boolean;
      status: StatusValue;
    };
  }[];
}

interface ThreadData {
  id: string;
  messageCount: number;
  messages: {
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; screenname: string; isGoldMember: boolean };
  }[];
}

interface ThreadState {
  messageId: string;
  parentContent: string;
  parentAuthor: string;
  thread: ThreadData | null;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Avatar helper (deterministic colour from id)
// ---------------------------------------------------------------------------

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  amber:   { bg: "#78350f", text: "#fcd34d" },
  rose:    { bg: "#881337", text: "#fda4af" },
  sky:     { bg: "#0c4a6e", text: "#7dd3fc" },
  emerald: { bg: "#064e3b", text: "#6ee7b7" },
  violet:  { bg: "#4c1d95", text: "#c4b5fd" },
  orange:  { bg: "#7c2d12", text: "#fdba74" },
};

function hashColor(id: string): string {
  const keys = Object.keys(AVATAR_COLORS);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return keys[h % keys.length];
}

// ---------------------------------------------------------------------------
// Slow mode countdown hook
// ---------------------------------------------------------------------------

function useSlowMode(slowModeMinutes: number, lastMessageAt: string | null) {
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState<string | null>(null);

  // Initialise from server-provided lastMessageAt
  useEffect(() => {
    if (slowModeMinutes <= 0 || !lastMessageAt) {
      setCooldownUntil(null);
      return;
    }
    const until = new Date(
      new Date(lastMessageAt).getTime() + slowModeMinutes * 60 * 1000
    );
    if (until > new Date()) {
      setCooldownUntil(until);
    }
  }, [slowModeMinutes, lastMessageAt]);

  // Tick
  useEffect(() => {
    if (!cooldownUntil) { setRemaining(null); return; }
    const tick = () => {
      const diff = cooldownUntil.getTime() - Date.now();
      if (diff <= 0) {
        setCooldownUntil(null);
        setRemaining(null);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setRemaining(m > 0 ? `${m}m ${s}s` : `${s}s`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const startCooldown = useCallback(() => {
    const until = new Date(Date.now() + slowModeMinutes * 60 * 1000);
    setCooldownUntil(until);
  }, [slowModeMinutes]);

  return { remaining, inCooldown: !!cooldownUntil, startCooldown };
}

// ---------------------------------------------------------------------------
// Thread sidebar
// ---------------------------------------------------------------------------

function ThreadSidebar({
  channelName,
  thread: ts,
  currentUserId,
  onClose,
  onReplyAdded,
}: {
  channelName: string;
  thread: ThreadState;
  currentUserId: string;
  onClose: () => void;
  onReplyAdded: (messageId: string, count: number) => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/channels/${channelName}/messages/${ts.messageId}/thread`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: reply.trim() }),
        }
      );
      if (res.ok) {
        setReply("");
        const newCount = (ts.thread?.messageCount ?? 0) + 1;
        onReplyAdded(ts.messageId, newCount);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full border-l"
      style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "#1a1a12" }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
        >
          Thread
        </span>
        <button
          onClick={onClose}
          className="text-lg leading-none"
          style={{ color: "#3a3a2a" }}
        >
          ×
        </button>
      </div>

      {/* Parent message */}
      <div
        className="px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "#1a1a12", background: "#111109" }}
      >
        <p
          className="text-[11px] font-mono mb-1"
          style={{ color: "#3a3a2a" }}
        >
          {ts.parentAuthor}
        </p>
        <p
          className="text-sm leading-snug"
          style={{ color: "#6b7280", fontFamily: "var(--font-dm-sans)" }}
        >
          {ts.parentContent}
        </p>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto py-2">
        {ts.loading && (
          <p
            className="text-xs font-mono text-center py-4 animate-pulse"
            style={{ color: "#2a2a1a" }}
          >
            loading…
          </p>
        )}
        {!ts.loading &&
          (ts.thread?.messages ?? []).map((m) => (
            <div key={m.id} className="px-4 py-1.5">
              <p
                className="text-[11px] font-mono font-semibold"
                style={{ color: "#6b7280" }}
              >
                {m.author.screenname}
                {m.author.isGoldMember && (
                  <span
                    className="ml-0.5 text-[9px]"
                    style={{ color: "#d4a017" }}
                  >
                    ★
                  </span>
                )}
              </p>
              <p
                className="text-[13px] leading-snug mt-0.5 break-words"
                style={{
                  color: "#6b7280",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                {m.content}
              </p>
            </div>
          ))}
        {!ts.loading && !ts.thread?.messages?.length && (
          <p
            className="text-xs font-mono text-center py-6"
            style={{ color: "#2a2a1a" }}
          >
            no replies yet
          </p>
        )}
      </div>

      {/* Reply input */}
      <div
        className="flex-shrink-0 px-3 py-3 border-t"
        style={{ borderColor: "#1a1a12" }}
      >
        <div className="flex gap-2 items-end">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, 512))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="reply in thread… (↵)"
            rows={2}
            className="flex-1 resize-none bg-transparent outline-none text-xs leading-snug"
            style={{
              color: "#9ca3af",
              fontFamily: "var(--font-dm-sans)",
            }}
          />
          <button
            onClick={send}
            disabled={!reply.trim() || sending}
            className="h-7 px-2.5 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
            style={{ background: "#c8860a", color: "#fff8e6" }}
          >
            {sending ? "…" : "reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Member list panel
// ---------------------------------------------------------------------------

function MemberPanel({
  members,
  currentUserId,
}: {
  members: ChannelDetail["members"];
  currentUserId: string;
}) {
  return (
    <div
      className="flex flex-col h-full border-l"
      style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
    >
      <div
        className="px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "#1a1a12" }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
        >
          Members ({members.length})
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {members.map((m) => {
          const colorKey = hashColor(m.user.id);
          const colors = AVATAR_COLORS[colorKey];
          const isMe = m.user.id === currentUserId;
          return (
            <div
              key={m.userId}
              className="flex items-center gap-2 px-3 py-1.5"
            >
              <div className="relative flex-shrink-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: colors.bg }}
                >
                  <span
                    className="text-[9px] font-bold font-mono"
                    style={{ color: colors.text }}
                  >
                    {m.user.screenname.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5">
                  <StatusDot status={m.user.status} size="sm" bg="#0a0a08" />
                </span>
              </div>
              <span
                className="text-xs"
                style={{
                  color: isMe ? "#c8860a" : "#6b7280",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                {m.user.screenname}
                {m.user.isGoldMember && (
                  <span
                    className="ml-0.5 text-[9px]"
                    style={{ color: "#d4a017" }}
                  >
                    ★
                  </span>
                )}
                {isMe && (
                  <span
                    className="ml-1 text-[10px] font-mono"
                    style={{ color: "#3a3a2a" }}
                  >
                    you
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main channel room page
// ---------------------------------------------------------------------------

export default function ChannelRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const channelName = params.channelName as string;

  const [channel, setChannel] = useState<ChannelDetail | null>(null);
  const [messages, setMessages] = useState<ChannelMessageData[]>([]);
  const [members, setMembers] = useState<ChannelDetail["members"]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [rightPanel, setRightPanel] = useState<
    "invite" | "members" | "thread" | null
  >(null);
  const [threadState, setThreadState] = useState<ThreadState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // Slow mode
  const slowModeMins = channel?.slowModeMinutes ?? 0;
  const lastMsgAt = channel?.myMembership?.lastMessageAt ?? null;
  const { remaining: cooldownStr, inCooldown, startCooldown } = useSlowMode(
    slowModeMins,
    lastMsgAt
  );

  // ---------------------------------------------------------------------------
  // Fetch channel data
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetch(`/api/channels/${channelName}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        const data: ChannelDetail = await res.json();
        setChannel(data);
        setMessages(data.messages ?? []);
        setMembers(data.members ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [channelName]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading) {
      messagesEndRef.current?.scrollIntoView();
    }
  }, [loading]);

  // ---------------------------------------------------------------------------
  // Pusher
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!channel) return;

    const ch = pusherClient.subscribe(CHANNELS.channelRoom(channel.name));

    ch.bind(EVENTS.CHANNEL_MESSAGE, (msg: ChannelMessageData) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Scroll to bottom if already near bottom
      if (atBottomRef.current) {
        setTimeout(
          () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          50
        );
      }
    });

    ch.bind(
      EVENTS.CHANNEL_THREAD_REPLY,
      (data: { messageId: string; threadId: string; reply: object }) => {
        // Update thread count on affected message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? {
                  ...m,
                  thread: m.thread
                    ? { ...m.thread, messageCount: m.thread.messageCount + 1 }
                    : { id: data.threadId, messageCount: 1 },
                }
              : m
          )
        );
        // If thread panel is open for this message, append reply
        setThreadState((prev) => {
          if (!prev || prev.messageId !== data.messageId) return prev;
          return {
            ...prev,
            thread: prev.thread
              ? {
                  ...prev.thread,
                  messageCount: prev.thread.messageCount + 1,
                  messages: [
                    ...prev.thread.messages,
                    data.reply as ThreadData["messages"][number],
                  ],
                }
              : null,
          };
        });
      }
    );

    ch.bind(
      EVENTS.CHANNEL_MEMBER_JOINED,
      (data: { userId: string; screenname: string }) => {
        setChannel((prev) =>
          prev ? { ...prev, memberCount: prev.memberCount + 1 } : prev
        );
        setMembers((prev) => {
          if (prev.some((m) => m.userId === data.userId)) return prev;
          return [
            ...prev,
            {
              userId: data.userId,
              joinedAt: new Date().toISOString(),
              user: {
                id: data.userId,
                screenname: data.screenname,
                isGoldMember: false,
                status: "ONLINE" as const,
              },
            },
          ];
        });
      }
    );

    ch.bind(
      EVENTS.CHANNEL_MEMBER_LEFT,
      (data: { userId: string }) => {
        setChannel((prev) =>
          prev ? { ...prev, memberCount: Math.max(0, prev.memberCount - 1) } : prev
        );
        setMembers((prev) => prev.filter((m) => m.userId !== data.userId));
      }
    );

    return () => {
      pusherClient.unsubscribe(CHANNELS.channelRoom(channel.name));
    };
  }, [channel?.name]);

  // ---------------------------------------------------------------------------
  // Scroll detection
  // ---------------------------------------------------------------------------

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distFromBottom < 60;
  };

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const sendMessage = async () => {
    if (!content.trim() || sending || inCooldown) return;
    setSending(true);
    setSendError(null);

    try {
      const res = await fetch(`/api/channels/${channelName}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setSendError(data.error ?? "slow down.");
        return;
      }
      if (!res.ok) {
        setSendError((await res.json()).error ?? "failed to send.");
        return;
      }

      setContent("");
      startCooldown();
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Join channel
  // ---------------------------------------------------------------------------

  const joinChannel = async () => {
    if (joining) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/channels/${channelName}/join`, {
        method: "POST",
      });
      if (res.ok) {
        // Reload full channel data
        const data = await fetch(`/api/channels/${channelName}`).then((r) =>
          r.json()
        );
        setChannel(data);
        setMessages(data.messages ?? []);
        setMembers(data.members ?? []);
      }
    } finally {
      setJoining(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Open thread
  // ---------------------------------------------------------------------------

  const openThread = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    setRightPanel("thread");
    setThreadState({
      messageId,
      parentContent: msg.content,
      parentAuthor: msg.author.screenname,
      thread: null,
      loading: true,
    });

    const res = await fetch(
      `/api/channels/${channelName}/messages/${messageId}/thread`
    );
    if (res.ok) {
      const data = await res.json();
      setThreadState((prev) =>
        prev?.messageId === messageId
          ? { ...prev, thread: data.thread, loading: false }
          : prev
      );
    } else {
      setThreadState((prev) =>
        prev ? { ...prev, loading: false } : prev
      );
    }
  };

  const handleThreadReplyAdded = (messageId: string, newCount: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              thread: m.thread
                ? { ...m.thread, messageCount: newCount }
                : { id: "", messageCount: newCount },
            }
          : m
      )
    );
  };

  // ---------------------------------------------------------------------------
  // Type badge
  // ---------------------------------------------------------------------------

  const typeBadge = useMemo(() => {
    if (!channel) return null;
    if (channel.type === "PUBLIC") return null;
    return (
      <span
        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
        style={{
          background:
            channel.type === "INVITE_ONLY"
              ? "rgba(251,191,36,0.08)"
              : "rgba(139,92,246,0.08)",
          color: channel.type === "INVITE_ONLY" ? "#f59e0b" : "#a78bfa",
          border: `1px solid ${
            channel.type === "INVITE_ONLY"
              ? "rgba(251,191,36,0.2)"
              : "rgba(139,92,246,0.2)"
          }`,
        }}
      >
        {channel.type === "INVITE_ONLY" ? "🔒 invite only" : "👁 secret"}
      </span>
    );
  }, [channel]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "#0d0d0b" }}
      >
        <p className="text-xs font-mono animate-pulse" style={{ color: "#2a2a1a" }}>
          loading…
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-3"
        style={{ background: "#0d0d0b" }}
      >
        <p className="text-sm" style={{ color: "#6b7280", fontFamily: "var(--font-dm-sans)" }}>
          channel not found.
        </p>
        <Link
          href="/channels"
          className="text-xs font-mono"
          style={{ color: "#c8860a" }}
        >
          ← browse channels
        </Link>
      </div>
    );
  }

  if (!channel) return null;

  // Non-member gate for INVITE_ONLY
  if (!channel.isMember && channel.type === "INVITE_ONLY") {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-4"
        style={{ background: "#0d0d0b" }}
      >
        <div className="text-center space-y-1">
          <p
            className="text-lg font-semibold"
            style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
          >
            #{channel.name}
          </p>
          {channel.description && (
            <p className="text-sm" style={{ color: "#6b7280" }}>
              {channel.description}
            </p>
          )}
          <p className="text-xs font-mono" style={{ color: "#3a3a2a" }}>
            🔒 invite only · {channel.memberCount} members
          </p>
        </div>
        <p className="text-sm" style={{ color: "#6b7280" }}>
          you need an invite link to join this channel.
        </p>
        <Link
          href="/channels"
          className="text-xs font-mono"
          style={{ color: "#c8860a" }}
        >
          ← browse channels
        </Link>
      </div>
    );
  }

  // Non-member join prompt for PUBLIC
  const canPost = channel.isMember && !!session?.user?.id;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#0d0d0b", fontFamily: "var(--font-dm-sans)" }}
    >
      {/* ---------------------------------------------------------------- */}
      {/* Main panel                                                        */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <div
          className="flex items-center gap-2.5 px-4 h-12 border-b flex-shrink-0"
          style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
        >
          <Link
            href="/channels"
            className="text-sm font-mono mr-1 flex-shrink-0"
            style={{ color: "#3a3a2a" }}
          >
            ←
          </Link>

          <span
            className="text-sm font-bold truncate"
            style={{ color: "#e5e7eb" }}
          >
            #{channel.name}
          </span>

          {typeBadge}

          <span
            className="text-[11px] font-mono ml-1"
            style={{ color: "#3a3a2a" }}
          >
            {channel.memberCount} member
            {channel.memberCount !== 1 ? "s" : ""}
          </span>

          {channel.slowModeMinutes > 0 && (
            <span
              className="text-[10px] font-mono hidden sm:inline"
              style={{ color: "#2a2a1a" }}
            >
              · 🕐 {channel.slowModeMinutes}m slow
            </span>
          )}

          <div className="flex-1" />

          {/* Members toggle */}
          <button
            onClick={() =>
              setRightPanel((p) => (p === "members" ? null : "members"))
            }
            className="h-7 px-2.5 rounded-lg text-[11px] font-mono transition-colors flex-shrink-0"
            style={{
              background:
                rightPanel === "members" ? "rgba(200,134,10,0.12)" : "transparent",
              color: rightPanel === "members" ? "#c8860a" : "#3a3a2a",
              border: `1px solid ${rightPanel === "members" ? "#c8860a33" : "transparent"}`,
            }}
          >
            members
          </button>

          {/* Invite button (INVITE_ONLY or SECRET only) */}
          {(channel.type === "INVITE_ONLY" || channel.type === "SECRET") &&
            channel.isMember && (
              <button
                onClick={() =>
                  setRightPanel((p) => (p === "invite" ? null : "invite"))
                }
                className="h-7 px-2.5 rounded-lg text-[11px] font-mono transition-all flex-shrink-0"
                style={{
                  background:
                    rightPanel === "invite"
                      ? "#c8860a"
                      : "rgba(200,134,10,0.12)",
                  color: rightPanel === "invite" ? "#fff8e6" : "#c8860a",
                }}
              >
                invite
              </button>
            )}
        </div>

        {/* Description bar */}
        {channel.description && (
          <div
            className="px-4 py-1.5 border-b flex-shrink-0"
            style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
          >
            <p className="text-xs truncate" style={{ color: "#3a3a2a" }}>
              {channel.description}
            </p>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto py-2"
          onScroll={handleScroll}
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm italic" style={{ color: "#2a2a1a" }}>
                no messages yet — say something!
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <ChannelMessage
              key={msg.id}
              message={msg}
              currentUserId={session?.user?.id}
              onThreadOpen={openThread}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div
          className="flex-shrink-0 border-t"
          style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
        >
          {canPost ? (
            <div className="px-3 py-3">
              <div className="flex items-end gap-2">
                {/* Avatar */}
                {session?.user?.id && (() => {
                  const colorKey = hashColor(session.user.id);
                  const colors = AVATAR_COLORS[colorKey];
                  return (
                    <div
                      className="w-[26px] h-[26px] rounded-lg flex items-center justify-center flex-shrink-0 mb-0.5"
                      style={{ background: colors.bg }}
                    >
                      <span
                        className="text-[9px] font-bold font-mono"
                        style={{ color: colors.text }}
                      >
                        {session.user.screenname.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  );
                })()}

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, 512))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={inCooldown}
                  placeholder={
                    inCooldown
                      ? `🕐 you can post again in ${cooldownStr}`
                      : `message #${channel.name}`
                  }
                  rows={1}
                  className="flex-1 resize-none bg-transparent outline-none text-sm leading-snug py-0.5 disabled:opacity-50"
                  style={{
                    color: "#d1d5db",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                />

                <button
                  onClick={sendMessage}
                  disabled={!content.trim() || sending || inCooldown}
                  className="flex-shrink-0 h-7 px-3 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-30"
                  style={{ background: "#c8860a", color: "#fff8e6" }}
                >
                  {sending ? "…" : "send"}
                </button>
              </div>

              {/* Slow mode note or error */}
              {(inCooldown || channel.slowModeMinutes > 0) && (
                <p
                  className="text-[10px] font-mono mt-1.5 ml-8"
                  style={{ color: inCooldown ? "#f59e0b" : "#2a2a1a" }}
                >
                  {inCooldown
                    ? `🕐 you can post again in ${cooldownStr}`
                    : `🕐 slow mode — ${channel.slowModeMinutes}m between messages`}
                </p>
              )}

              {sendError && (
                <p
                  className="text-[11px] font-mono mt-1 ml-8"
                  style={{ color: "#ef4444" }}
                >
                  {sendError}
                </p>
              )}
            </div>
          ) : !session ? (
            <div className="px-4 py-3 text-center">
              <Link
                href="/login"
                className="text-sm font-mono"
                style={{ color: "#c8860a" }}
              >
                sign in to join the conversation →
              </Link>
            </div>
          ) : (
            <div className="px-4 py-3 text-center">
              <button
                onClick={joinChannel}
                disabled={joining}
                className="text-sm font-mono px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ background: "#c8860a", color: "#fff8e6" }}
              >
                {joining ? "joining…" : `join #${channel.name}`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Right panel                                                        */}
      {/* ---------------------------------------------------------------- */}
      {rightPanel && (
        <div
          className="w-72 flex-shrink-0 overflow-hidden"
          style={{ background: "#0a0a08" }}
        >
          {rightPanel === "members" && (
            <MemberPanel
              members={members}
              currentUserId={session?.user?.id ?? ""}
            />
          )}
          {rightPanel === "invite" &&
            (channel.type === "INVITE_ONLY" || channel.type === "SECRET") && (
              <div className="h-full overflow-y-auto">
                <InvitePanel
                  channelName={channel.name}
                  channelType={channel.type}
                />
              </div>
            )}
          {rightPanel === "thread" && threadState && (
            <ThreadSidebar
              channelName={channelName}
              thread={threadState}
              currentUserId={session?.user?.id ?? ""}
              onClose={() => {
                setRightPanel(null);
                setThreadState(null);
              }}
              onReplyAdded={handleThreadReplyAdded}
            />
          )}
        </div>
      )}
    </div>
  );
}
