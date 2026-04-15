"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { incrementElectronUnread } from "@/lib/electronUnread";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import { playSound } from "@/lib/sounds";
import {
  ChannelMessage,
  type ChannelMessageData,
} from "@/components/ChannelMessage";
import { FlatMessageGroup } from "@/components/chat/FlatMessageGroup";
import { TimeSeparator as TimeSeparatorComp } from "@/components/chat/TimeSeparator";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { AwayBanner } from "@/components/chat/AwayBanner";
import { groupMessages, type ChatMessage } from "@/lib/chat";
import { InvitePanel } from "@/components/InvitePanel";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichTextContent } from "@/components/RichTextContent";
import { useUploadThing } from "@/lib/uploadthing";
import { GiphyPicker, type GifResult } from "@/components/composer/GiphyPicker";
import { MediaAttachments, type PendingMedia } from "@/components/composer/MediaAttachments";
import {
  generateSessionKey,
  encryptSessionKeyForMember,
  decryptSessionKey,
  encryptWithSessionKey,
  decryptWithSessionKey,
  fromBase64,
  toBase64,
} from "@/lib/crypto/index";
import { getCachedSecretKey } from "@/lib/crypto/localKey";
import { cacheSessionKey, getCachedSessionKey } from "@/lib/crypto/channelKeyCache";

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
  canManage: boolean;
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
  onReplyAdded: (messageId: string, count: number, reply: ThreadData["messages"][number], threadId: string) => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reply || sending) return;
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
        const data = await res.json();
        setReply("");
        const newCount = (ts.thread?.messageCount ?? 0) + 1;
        onReplyAdded(ts.messageId, newCount, data.reply, data.threadId);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full border-l"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
        >
          Thread
        </span>
        <button
          onClick={onClose}
          className="text-lg leading-none"
          style={{ color: "var(--text-dim)" }}
        >
          ×
        </button>
      </div>

      {/* Parent message */}
      <div
        className="px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <p
          className="text-[11px] font-mono mb-1"
          style={{ color: "var(--text-dim)" }}
        >
          {ts.parentAuthor}
        </p>
        <div
          className="text-sm leading-snug"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
        >
          <RichTextContent html={ts.parentContent} />
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto py-2">
        {ts.loading && (
          <p
            className="text-xs font-mono text-center py-4 animate-pulse"
            style={{ color: "var(--text-dim)" }}
          >
            loading…
          </p>
        )}
        {!ts.loading &&
          (ts.thread?.messages ?? []).map((m) => (
            <div key={m.id} className="px-4 py-1.5">
              <p
                className="text-[11px] font-mono font-semibold"
                style={{ color: "var(--text-muted)" }}
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
              <div
                className="text-[13px] leading-snug mt-0.5 break-words"
                style={{
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                <RichTextContent html={m.content} />
              </div>
            </div>
          ))}
        {!ts.loading && !ts.thread?.messages?.length && (
          <p
            className="text-xs font-mono text-center py-6"
            style={{ color: "var(--text-dim)" }}
          >
            no replies yet
          </p>
        )}
      </div>

      {/* Reply input */}
      <div
        className="flex-shrink-0 px-3 py-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex gap-2 items-end">
          <div className="flex-1 rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <RichTextEditor
              value={reply}
              onChange={setReply}
              placeholder="reply in thread… (↵)"
              maxChars={512}
              variant="compact"
              onSubmit={send}
              disabled={sending}
            />
          </div>
          <button
            onClick={send}
            disabled={!reply || sending}
            className="h-7 px-2.5 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
            style={{ background: "var(--amber)", color: "#fff8e6" }}
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
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      <div
        className="px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
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
                  <StatusDot status={m.user.status} size="sm" bg="var(--bg)" />
                </span>
              </div>
              <span
                className="text-xs"
                style={{
                  color: isMe ? "var(--amber)" : "var(--text-muted)",
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
                    style={{ color: "var(--text-dim)" }}
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
  const [mobileText, setMobileText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Media upload
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [pendingGifs, setPendingGifs]   = useState<GifResult[]>([]);
  const [showGiphy, setShowGiphy]       = useState(false);
  const channelFileInputRef = useRef<HTMLInputElement>(null);
  const { startUpload: startChannelUpload, isUploading: isChannelUploading } = useUploadThing("channelMedia", {
    onClientUploadComplete: (res) => {
      const newMedia: PendingMedia[] = res.map((f) => ({
        url: f.url,
        type: f.type?.startsWith("video/") ? "VIDEO" : "IMAGE",
      }));
      setPendingMedia((prev) => [...prev, ...newMedia]);
    },
    onUploadError: (err) => setSendError(err.message),
  });

  // Encryption
  const channelIdRef = useRef<string | null>(null);
  const activeKeyVersionRef = useRef<number | null>(null);
  const encryptionReadyRef = useRef(false);

  const [rightPanel, setRightPanel] = useState<
    "invite" | "members" | "thread" | null
  >(null);
  const [threadState, setThreadState] = useState<ThreadState | null>(null);

  // Away banners
  const [awayMembers, setAwayMembers] = useState<
    { userId: string; screenname: string; isGold: boolean; awayMessage: string; setAt: string | null }[]
  >([]);

  // Typing indicator state
  const [typers, setTypers] = useState<Record<string, string>>({}); // userId → screenname
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isTypingRef = useRef(false);
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "N new ↓" pill
  const [unreadBelow, setUnreadBelow] = useState(0);

  // Electron: close thread/members panel on Escape shortcut
  useEffect(() => {
    const handler = () => setRightPanel(null);
    window.addEventListener("electron:close-panel", handler);
    return () => window.removeEventListener("electron:close-panel", handler);
  }, []);

  // Electron: cache messages + badge unread count
  useEffect(() => {
    if (typeof window === "undefined" || !("electronAPI" in window)) return;
    if (!channelName || messages.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eAPI = (window as any).electronAPI;
    // Persist the current message list to local DB
    messages.slice(0, 50).forEach((msg) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eAPI.db.saveMessage({
        id:               msg.id,
        channelId:        channelName,
        senderId:         msg.author?.id ?? "",
        screenname:       msg.author?.screenname ?? "",
        decryptedContent: msg.content ?? null,
        encryptedContent: null,
        iv:               null,
        gifUrl:           msg.gifUrl   ?? null,
        gifTitle:         msg.gifTitle ?? null,
        createdAt:        msg.createdAt,
        isThread:         false,
        parentMessageId:  null,
        localOnly:        false,
        cachedAt:         new Date().toISOString(),
      }).catch(() => {});
    });
  // Only run when the message list is first populated (not on every new message)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, messages.length > 0]);

  // ── Away members (for AwayBanner) ─────────────────────────────────────────
  useEffect(() => {
    if (!channelName) return;
    fetch(`/api/channels/${channelName}/members?away=true`)
      .then((r) => r.ok ? r.json() : [])
      .then(setAwayMembers)
      .catch(() => {});
  }, [channelName]);

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

  // ---------------------------------------------------------------------------
  // Decrypt helper — synchronous, uses in-memory session key cache
  // ---------------------------------------------------------------------------

  const decryptMsg = useCallback(
    (msg: ChannelMessageData, chanId: string): ChannelMessageData => {
      if (
        !msg.isEncrypted ||
        !msg.encryptedContent ||
        !msg.iv ||
        msg.keyVersion == null
      ) {
        return msg;
      }
      const sk = session?.user?.id ? getCachedSecretKey(session.user.id) : null;
      if (!sk) return { ...msg, content: "🔒 [unlock encryption to read]" };
      const sessionKey = getCachedSessionKey(chanId, msg.keyVersion);
      if (!sessionKey) return { ...msg, content: "🔒 [key not available]" };
      try {
        const plain = decryptWithSessionKey(
          fromBase64(msg.encryptedContent),
          fromBase64(msg.iv),
          sessionKey
        );
        return { ...msg, content: plain };
      } catch {
        return { ...msg, content: "🔒 [decryption failed]" };
      }
    },
    [session?.user?.id]
  );

  // ---------------------------------------------------------------------------
  // Fetch channel data
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetch(`/api/channels/${channelName}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        const data: ChannelDetail & {
          activeKey?: { keyVersion: number; myEncryptedKey: string } | null;
        } = await res.json();

        // Wire up encryption if we have a key and the user's secret key is cached
        channelIdRef.current = data.id;
        if (data.activeKey && session?.user?.id) {
          const sk = getCachedSecretKey(session.user.id);
          if (sk) {
            try {
              const sessionKey = decryptSessionKey(data.activeKey.myEncryptedKey, sk);
              cacheSessionKey(data.id, data.activeKey.keyVersion, sessionKey);
              activeKeyVersionRef.current = data.activeKey.keyVersion;
              encryptionReadyRef.current = true;
            } catch {
              // Decryption failed — carry on without encryption
            }
          }
        }

        setChannel(data);
        // Decrypt messages immediately using cached session key
        setMessages((data.messages ?? []).map((m) => decryptMsg(m, data.id)));
        setMembers(data.members ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const chanId = channelIdRef.current ?? channel.id;
      const decrypted = decryptMsg(msg, chanId);
      if (msg.author?.id !== session?.user?.id) playSound("message_received");
      setMessages((prev) => {
        if (prev.some((m) => m.id === decrypted.id)) return prev;
        return [...prev, decrypted];
      });
      // Cache to local DB
      if (typeof window !== "undefined" && "electronAPI" in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).electronAPI.db.saveMessage({
          id:               msg.id,
          channelId:        channel!.name,
          senderId:         msg.author?.id ?? "",
          screenname:       msg.author?.screenname ?? "",
          decryptedContent: msg.content ?? null,
          encryptedContent: null,
          iv:               null,
          createdAt:        msg.createdAt,
          isThread:         false,
          parentMessageId:  null,
          localOnly:        false,
          cachedAt:         new Date().toISOString(),
        }).catch(() => {});
      }
      // Increment dock badge if the window is not focused
      if (document.hidden) incrementElectronUnread();
      // Scroll to bottom or show pill
      if (atBottomRef.current) {
        setTimeout(
          () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          50
        );
      } else if (msg.author?.id !== session?.user?.id) {
        setUnreadBelow((n) => n + 1);
      }
    });

    ch.bind(
      EVENTS.CHANNEL_THREAD_REPLY,
      (data: { messageId: string; threadId: string; reply: object }) => {
        // Update thread count badge on affected message
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
        // If thread panel is open for this message, append reply (dedup by id)
        setThreadState((prev) => {
          if (!prev || prev.messageId !== data.messageId) return prev;
          const newReply = data.reply as ThreadData["messages"][number];
          // Already added optimistically by sender — skip if we have it
          if (prev.thread?.messages?.some((m) => m.id === newReply.id)) return prev;
          return {
            ...prev,
            thread: prev.thread
              ? {
                  ...prev.thread,
                  messageCount: prev.thread.messageCount + 1,
                  messages: [...prev.thread.messages, newReply],
                }
              : {
                  id: data.threadId,
                  messageCount: 1,
                  messages: [newReply],
                },
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

    ch.bind(EVENTS.TYPING, (data: { userId: string; screenname: string }) => {
      if (data.userId === session?.user?.id) return;
      setTypers((prev) => ({ ...prev, [data.userId]: data.screenname }));
      // Auto-clear after 4s if no follow-up event
      if (typingTimeoutsRef.current[data.userId]) {
        clearTimeout(typingTimeoutsRef.current[data.userId]);
      }
      typingTimeoutsRef.current[data.userId] = setTimeout(() => {
        setTypers((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }, 4000);
    });

    ch.bind(EVENTS.STOPPED_TYPING, (data: { userId: string }) => {
      if (typingTimeoutsRef.current[data.userId]) {
        clearTimeout(typingTimeoutsRef.current[data.userId]);
      }
      setTypers((prev) => {
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    });

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
    if (atBottomRef.current) setUnreadBelow(0);
  };

  // ---------------------------------------------------------------------------
  // Convert ChannelMessageData → ChatMessage for grouping
  // ---------------------------------------------------------------------------

  const toChatMessage = useCallback((m: ChannelMessageData): ChatMessage => ({
    id: m.id,
    senderId: m.author.id,
    screenname: m.author.screenname,
    isGold: m.author.isGoldMember,
    content: m.content,
    gifId: m.gifId ?? null,
    gifUrl: m.gifUrl ?? null,
    gifTitle: m.gifTitle ?? null,
    mediaUrl: m.mediaUrl ?? null,
    mediaType: m.mediaType ?? null,
    createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date(m.createdAt).toISOString(),
    isEncrypted: m.isEncrypted,
    thread: m.thread ?? null,
  }), []);

  // ---------------------------------------------------------------------------
  // Emit typing events
  // ---------------------------------------------------------------------------

  const emitTyping = useCallback(() => {
    if (!channel) return;
    const ch = pusherClient.channel(CHANNELS.channelRoom(channel.name));
    if (!ch) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      ch.trigger(EVENTS.TYPING, {
        userId: session?.user?.id,
        screenname: session?.user?.screenname,
      });
    }
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      ch.trigger(EVENTS.STOPPED_TYPING, { userId: session?.user?.id });
    }, 3000);
  }, [channel, session?.user?.id, session?.user?.screenname]);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const sendMessage = async () => {
    const hasMedia = pendingMedia.length > 0 || pendingGifs.length > 0;
    if ((!content && !hasMedia) || sending || inCooldown) return;
    setSending(true);
    setSendError(null);

    const plaintext = content;
    let body: Record<string, unknown> = { content: plaintext };

    // Encrypt if we have an active session key
    if (
      encryptionReadyRef.current &&
      channelIdRef.current &&
      activeKeyVersionRef.current != null &&
      session?.user?.id
    ) {
      const sk = getCachedSecretKey(session.user.id);
      const sessionKey = sk
        ? getCachedSessionKey(channelIdRef.current, activeKeyVersionRef.current)
        : null;

      if (sessionKey) {
        const { ciphertext, iv } = encryptWithSessionKey(plaintext, sessionKey);
        body = {
          isEncrypted: true,
          encryptedContent: toBase64(ciphertext),
          iv: toBase64(iv),
          keyVersion: activeKeyVersionRef.current,
        };
      } else if (sk) {
        // No key yet — create one for this channel
        try {
          const membersRes = await fetch(
            `/api/channels/${channelName}/key?members=1`
          );
          if (membersRes.ok) {
            const { members: keyMembers } = await membersRes.json() as {
              members: Array<{ userId: string; mlkemPublicKey: string }>;
            };
            if (keyMembers.length > 0) {
              const sessionKey = generateSessionKey();
              const encryptedKeys: Record<string, string> = {};
              for (const m of keyMembers) {
                encryptedKeys[m.userId] = encryptSessionKeyForMember(
                  sessionKey,
                  fromBase64(m.mlkemPublicKey)
                );
              }
              const keyRes = await fetch(`/api/channels/${channelName}/key`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ encryptedKeys }),
              });
              if (keyRes.ok) {
                const { keyVersion } = await keyRes.json() as { keyVersion: number };
                cacheSessionKey(channelIdRef.current!, keyVersion, sessionKey);
                activeKeyVersionRef.current = keyVersion;
                const { ciphertext, iv } = encryptWithSessionKey(plaintext, sessionKey);
                body = {
                  isEncrypted: true,
                  encryptedContent: toBase64(ciphertext),
                  iv: toBase64(iv),
                  keyVersion,
                };
              }
            }
          }
        } catch {
          // Fall back to plaintext if key creation fails
          body = { content: plaintext };
        }
      }
    }

    try {
      const res = await fetch(`/api/channels/${channelName}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

      // Immediately show the sent message without waiting for Pusher
      const saved: ChannelMessageData = await res.json();
      const chanId = channelIdRef.current ?? channel!.id;
      const displayed = decryptMsg(saved, chanId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === displayed.id)) return prev;
        return [...prev, displayed];
      });

      setContent("");
      setMobileText("");

      // Attach first media item (channel API supports single mediaUrl)
      if (pendingMedia.length > 0) {
        const media = pendingMedia[0];
        await fetch(`/api/channels/${channelName}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "", mediaUrl: media.url, mediaType: media.type }),
        });
      }
      for (const gif of pendingGifs) {
        await fetch(`/api/channels/${channelName}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "", gifId: gif.id, gifUrl: gif.url, gifTitle: gif.title }),
        });
      }
      setPendingMedia([]);
      setPendingGifs([]);

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
        setMessages((data.messages ?? []).map((m: ChannelMessageData) => decryptMsg(m, data.id)));
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

  const handleThreadReplyAdded = (messageId: string, _newCount: number, newReply: ThreadData["messages"][number], threadId: string) => {
    // Pusher handles the setMessages count update for all viewers including sender.
    // Here we only need to add the reply to the open thread panel immediately.
    setThreadState((prev) => {
      if (!prev || prev.messageId !== messageId) return prev;
      return {
        ...prev,
        thread: prev.thread
          ? {
              ...prev.thread,
              messageCount: prev.thread.messageCount + 1,
              messages: [...prev.thread.messages, newReply],
            }
          : {
              id: threadId,
              messageCount: 1,
              messages: [newReply],
            },
      };
    });
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
        style={{ background: "var(--bg)" }}
      >
        <p className="text-xs font-mono animate-pulse" style={{ color: "var(--text-dim)" }}>
          loading…
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-3"
        style={{ background: "var(--bg)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
          channel not found.
        </p>
        <Link
          href="/channels"
          className="text-xs font-mono"
          style={{ color: "var(--amber)" }}
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
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center space-y-1">
          <p
            className="text-lg font-semibold"
            style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
          >
            #{channel.name}
          </p>
          {channel.description && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {channel.description}
            </p>
          )}
          <p className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
            🔒 invite only · {channel.memberCount} members
          </p>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          you need an invite link to join this channel.
        </p>
        <Link
          href="/channels"
          className="text-xs font-mono"
          style={{ color: "var(--amber)" }}
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
      className="relative flex overflow-hidden"
      style={{
        background: "var(--bg)",
        fontFamily: "var(--font-dm-sans)",
        height: "var(--chat-h, calc(100dvh - 52px - var(--tab-bar-h)))",
      }}
    >
      {/* ---------------------------------------------------------------- */}
      {/* Main panel                                                        */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <div
          className="flex items-center gap-2.5 px-4 h-12 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--bg)" }}
        >
          <Link
            href="/channels"
            className="text-sm font-mono mr-1 flex-shrink-0"
            style={{ color: "var(--text-dim)" }}
          >
            ←
          </Link>

          <span
            className="text-sm font-bold truncate"
            style={{ color: "var(--text)" }}
          >
            #{channel.name}
          </span>

          {typeBadge}

          <span
            className="text-[11px] font-mono ml-1"
            style={{ color: "var(--text-dim)" }}
          >
            {channel.memberCount}
            <span className="hidden sm:inline"> member{channel.memberCount !== 1 ? "s" : ""}</span>
          </span>

          {channel.slowModeMinutes > 0 && (
            <span
              className="text-[10px] font-mono hidden sm:inline"
              style={{ color: "var(--text-dim)" }}
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
                rightPanel === "members" ? "var(--amber-tint)" : "transparent",
              color: rightPanel === "members" ? "var(--amber)" : "var(--text-dim)",
              border: `1px solid ${rightPanel === "members" ? "rgba(200,134,10,0.2)" : "transparent"}`,
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
                      ? "var(--amber)"
                      : "var(--amber-tint)",
                  color: rightPanel === "invite" ? "#fff8e6" : "var(--amber)",
                }}
              >
                invite
              </button>
            )}

          {/* Settings (creator/admin only) */}
          {channel.canManage && (
            <Link
              href={`/channels/${channel.name}/settings`}
              className="h-7 w-7 sm:w-auto sm:px-2.5 rounded-lg text-[11px] font-mono flex items-center justify-center gap-1 flex-shrink-0 transition-all"
              style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--amber)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)")}
            >
              ⚙<span className="hidden sm:inline"> settings</span>
            </Link>
          )}
        </div>

        {/* Description bar */}
        {channel.description && (
          <div
            className="px-4 py-1.5 border-b flex-shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          >
            <p className="text-xs truncate" style={{ color: "var(--text-dim)" }}>
              {channel.description}
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={messagesContainerRef}
            className="h-full overflow-y-auto py-2"
            onScroll={handleScroll}
          >
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>
                  no messages yet — say something!
                </p>
              </div>
            )}
            {session?.user?.id && (() => {
              const grouped = groupMessages(
                messages.map(toChatMessage),
                session.user.id
              );
              return grouped.map((item, i) =>
                item.type === "separator" ? (
                  <TimeSeparatorComp key={`sep-${i}`} item={item} />
                ) : (
                  <FlatMessageGroup key={item.messages[0].id} group={item} onThreadOpen={openThread} />
                )
              );
            })()}
            {!session?.user?.id && messages.map((msg) => (
              <ChannelMessage
                key={msg.id}
                message={msg}
                currentUserId={undefined}
                onThreadOpen={openThread}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* "N new ↓" pill */}
          {unreadBelow > 0 && (
            <button
              onClick={() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                setUnreadBelow(0);
              }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: "var(--amber)",
                color: "#fff8e6",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              {unreadBelow} new ↓
            </button>
          )}
        </div>

        {/* Away banners */}
        {awayMembers.length > 0 && (
          <div className="border-b" style={{ borderColor: "var(--border)" }}>
            {awayMembers.map((m) => (
              <AwayBanner
                key={m.userId}
                userId={m.userId}
                screenname={m.screenname}
                awayMessage={m.awayMessage}
                setAt={m.setAt ?? undefined}
              />
            ))}
          </div>
        )}

        {/* Typing indicator */}
        <TypingIndicator typers={Object.values(typers)} />

        {/* Input bar */}
        <div
          className="flex-shrink-0 border-t"
          style={{ borderColor: "var(--border)", background: "var(--bg)" }}
        >
          {canPost ? (
            <div className="px-3 py-3">
              {/* Shared hidden file input */}
              <input
                ref={channelFileInputRef}
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files?.length) return;
                  await startChannelUpload(Array.from(files));
                  e.target.value = "";
                }}
              />

              {/* Giphy picker — shared between mobile + desktop */}
              {showGiphy && (
                <div className="mb-2 max-w-xs">
                  <GiphyPicker
                    onSelect={(gif) => { setPendingGifs((prev) => [...prev, gif]); setShowGiphy(false); }}
                    onClose={() => setShowGiphy(false)}
                  />
                </div>
              )}

              {/* ── Mobile pill input (< md) ── */}
              <div className="flex md:hidden items-center gap-2">
                {session?.user?.id && (() => {
                  const colorKey = hashColor(session.user.id);
                  const colors = AVATAR_COLORS[colorKey];
                  return (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: colors.bg }}
                    >
                      <span className="text-[9px] font-bold font-mono" style={{ color: colors.text }}>
                        {session.user.screenname.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  );
                })()}
                <textarea
                  rows={1}
                  value={mobileText}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Mobile browsers may insert \n instead of firing onKeyDown
                    if (v.includes("\n")) {
                      const trimmed = v.replace(/\n/g, "").trim();
                      setMobileText(trimmed);
                      setContent(trimmed ? `<p>${trimmed}</p>` : "");
                      if (trimmed) sendMessage();
                      return;
                    }
                    setMobileText(v);
                    setContent(v ? `<p>${v}</p>` : "");
                    if (v) emitTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  enterKeyHint="send"
                  placeholder={inCooldown ? `cooldown ${cooldownStr}` : `message #${channel.name}`}
                  disabled={inCooldown || sending || isChannelUploading}
                  className="flex-1 resize-none rounded-full border px-4 py-2 text-sm outline-none"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                    fontSize: 16,
                    lineHeight: 1.4,
                    maxHeight: 96,
                    overflowY: "auto",
                  }}
                />
                <button
                  type="button"
                  onClick={() => channelFileInputRef.current?.click()}
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base transition-opacity disabled:opacity-30"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  disabled={inCooldown || sending}
                >
                  📷
                </button>
                <button
                  type="button"
                  onClick={() => setShowGiphy((v) => !v)}
                  className="flex-shrink-0 h-8 px-2 rounded-full flex items-center justify-center text-[11px] font-mono font-bold transition-colors disabled:opacity-30"
                  style={{
                    background: showGiphy ? "rgba(200,134,10,0.15)" : "var(--surface)",
                    border: "1px solid var(--border)",
                    color: showGiphy ? "var(--amber)" : "var(--text-dim)",
                  }}
                  disabled={inCooldown || sending}
                >
                  GIF
                </button>
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={(!content && pendingMedia.length === 0 && pendingGifs.length === 0) || sending || inCooldown || isChannelUploading}
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all disabled:opacity-30"
                  style={{ background: "var(--amber)", color: "#fff8e6" }}
                >
                  ↑
                </button>
              </div>

              {/* ── Desktop rich editor (≥ md) ── */}
              <div className="hidden md:flex items-end gap-2">
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

                <div className="flex-1 min-w-0">
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                    <RichTextEditor
                      value={content}
                      onChange={(v) => { setContent(v); if (v) emitTyping(); }}
                      placeholder={
                        inCooldown
                          ? `🕐 you can post again in ${cooldownStr}`
                          : `message #${channel.name}`
                      }
                      maxChars={512}
                      variant="compact"
                      onSubmit={sendMessage}
                      disabled={inCooldown || sending || isChannelUploading}
                      onPhotoClick={() => channelFileInputRef.current?.click()}
                      onGifClick={() => setShowGiphy((v) => !v)}
                    />
                  </div>
                  {/* Media preview */}
                  {(pendingMedia.length > 0 || pendingGifs.length > 0) && (
                    <div className="mt-1">
                      <MediaAttachments
                        media={pendingMedia}
                        gifs={pendingGifs}
                        onRemoveMedia={(i) => setPendingMedia((prev) => prev.filter((_, idx) => idx !== i))}
                        onRemoveGif={(i) => setPendingGifs((prev) => prev.filter((_, idx) => idx !== i))}
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={sendMessage}
                  disabled={(!content && pendingMedia.length === 0 && pendingGifs.length === 0) || sending || inCooldown || isChannelUploading}
                  className="flex-shrink-0 h-7 px-3 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-30"
                  style={{ background: "var(--amber)", color: "#fff8e6" }}
                >
                  {isChannelUploading ? "uploading…" : sending ? "…" : "send"}
                </button>
              </div>

              {/* Slow mode note or error */}
              {(inCooldown || channel.slowModeMinutes > 0) && (
                <p
                  className="text-[10px] font-mono mt-1.5 ml-8"
                  style={{ color: inCooldown ? "var(--away)" : "var(--text-dim)" }}
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
                style={{ color: "var(--amber)" }}
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
                style={{ background: "var(--amber)", color: "#fff8e6" }}
              >
                {joining ? "joining…" : `join #${channel.name}`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Right panel — sidebar on desktop, full-screen overlay on mobile   */}
      {/* ---------------------------------------------------------------- */}
      {rightPanel && (
        <div
          className="absolute inset-0 md:relative md:inset-auto md:w-72 md:flex-shrink-0 overflow-hidden z-20"
          style={{ background: "var(--bg)" }}
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
