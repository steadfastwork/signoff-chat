"use client";

import { useState } from "react";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { RichTextContent } from "@/components/RichTextContent";
import { formatTimestamp } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelMessageData {
  id: string;
  content: string;
  isEncrypted?: boolean;
  encryptedContent?: string | null;
  iv?: string | null;
  keyVersion?: number | null;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "GIF" | null;
  gifId?: string | null;
  gifUrl?: string | null;
  gifTitle?: string | null;
  createdAt: string;
  author: {
    id: string;
    screenname: string;
    isGoldMember: boolean;
    status: StatusValue;
  };
  thread: { id: string; messageCount: number; lastReplyBy?: string | null } | null;
}

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
// ChannelMessage
// ---------------------------------------------------------------------------

interface ChannelMessageProps {
  message: ChannelMessageData;
  currentUserId?: string;
  onThreadOpen?: (messageId: string) => void;
}

export function ChannelMessage({
  message,
  currentUserId,
  onThreadOpen,
}: ChannelMessageProps) {
  const [hovered, setHovered] = useState(false);

  const isOwn = message.author.id === currentUserId;
  const colorKey = hashColor(message.author.id);
  const colors = AVATAR_COLORS[colorKey];

  const initials = message.author.screenname.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex gap-2.5 px-4 py-1.5 group relative"
      style={{
        background: hovered ? "rgba(255,255,255,0.02)" : "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <div className="relative">
          <div
            className="w-[26px] h-[26px] rounded-lg flex items-center justify-center"
            style={{ background: colors.bg }}
          >
            <span
              className="text-[9px] font-bold font-mono"
              style={{ color: colors.text }}
            >
              {initials}
            </span>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5">
            <StatusDot status={message.author.status} size="sm" bg="var(--bg)" />
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + timestamp */}
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[13px] font-semibold leading-none"
            style={{
              color: isOwn ? "var(--amber)" : "var(--text-muted)",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            {message.author.screenname}
            {message.author.isGoldMember && (
              <span className="ml-0.5 text-[9px]" style={{ color: "#d4a017" }}>
                ★
              </span>
            )}
          </span>
          <span
            className="text-[10px] font-mono"
            style={{ color: "var(--text-dim)" }}
          >
            {formatTimestamp(message.createdAt)}
          </span>
        </div>

        {/* Message text */}
        {message.content && message.content !== "[encrypted]" && (
          <div
            className="text-[13px] leading-snug mt-0.5"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
          >
            <RichTextContent html={message.content} />
          </div>
        )}
        {message.content === "[encrypted]" && (
          <div className="text-[13px] leading-snug mt-0.5" style={{ color: "var(--text-dim)" }}>
            🔒 encrypted message
          </div>
        )}

        {/* Media attachment */}
        {message.mediaUrl && message.mediaType === "IMAGE" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.mediaUrl}
            alt="attachment"
            className="mt-1 rounded-lg max-w-[320px] max-h-[240px] object-cover cursor-pointer"
            onClick={() => window.open(message.mediaUrl!, "_blank")}
          />
        )}
        {message.mediaUrl && message.mediaType === "VIDEO" && (
          <video
            src={message.mediaUrl}
            controls
            className="mt-1 rounded-lg max-w-[320px]"
          />
        )}
        {message.mediaUrl && message.mediaType === "GIF" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.mediaUrl}
            alt="GIF"
            className="mt-1 rounded-lg max-w-[320px]"
          />
        )}

        {/* Thread indicator */}
        {message.thread && message.thread.messageCount > 0 && (
          <button
            onClick={() => onThreadOpen?.(message.id)}
            className="mt-1 flex items-center gap-1 text-[11px] font-mono transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--amber)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-dim)")
            }
          >
            <span>💬</span>
            <span>
              {message.thread.messageCount}{" "}
              {message.thread.messageCount === 1 ? "reply" : "replies"}
            </span>
          </button>
        )}
      </div>

      {/* Hover actions */}
      {hovered && (
        <div
          className="absolute right-3 top-1 flex items-center gap-0.5 rounded-lg px-1 py-0.5 border"
          style={{
            background: "var(--bg)",
            borderColor: "var(--border)",
          }}
        >
          <button
            onClick={() => onThreadOpen?.(message.id)}
            title="Reply in thread"
            className="w-6 h-6 flex items-center justify-center rounded text-[11px] transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--amber)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-dim)")
            }
          >
            💬
          </button>
          <button
            onClick={() => {
              const text = message.content.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
              navigator.clipboard.writeText(text);
            }}
            title="Copy message"
            className="w-6 h-6 flex items-center justify-center rounded text-[11px] transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-dim)")
            }
          >
            ⎘
          </button>
        </div>
      )}
    </div>
  );
}
