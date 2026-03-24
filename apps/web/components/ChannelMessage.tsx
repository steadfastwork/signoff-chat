"use client";

import { useState } from "react";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { formatTimestamp } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelMessageData {
  id: string;
  content: string;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "GIF" | null;
  createdAt: string;
  author: {
    id: string;
    screenname: string;
    isGoldMember: boolean;
    status: StatusValue;
  };
  thread: { id: string; messageCount: number } | null;
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
            <StatusDot status={message.author.status} size="sm" bg="#0d0d0b" />
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
              color: isOwn ? "#c8860a" : "#9ca3af",
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
            style={{ color: "#2a2a1a" }}
          >
            {formatTimestamp(message.createdAt)}
          </span>
        </div>

        {/* Message text */}
        <p
          className="text-[13px] leading-snug mt-0.5 break-words whitespace-pre-wrap"
          style={{ color: "#6b7280", fontFamily: "var(--font-dm-sans)" }}
        >
          {message.content}
        </p>

        {/* Thread indicator */}
        {message.thread && message.thread.messageCount > 0 && (
          <button
            onClick={() => onThreadOpen?.(message.id)}
            className="mt-1 flex items-center gap-1 text-[11px] font-mono transition-colors"
            style={{ color: "#3a3a2a" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#c8860a")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "#3a3a2a")
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
            background: "#0d0d0b",
            borderColor: "#1e1e14",
          }}
        >
          <button
            onClick={() => onThreadOpen?.(message.id)}
            title="Reply in thread"
            className="w-6 h-6 flex items-center justify-center rounded text-[11px] transition-colors"
            style={{ color: "#3a3a2a" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#c8860a")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "#3a3a2a")
            }
          >
            💬
          </button>
          <button
            onClick={() =>
              navigator.clipboard.writeText(message.content)
            }
            title="Copy message"
            className="w-6 h-6 flex items-center justify-center rounded text-[11px] transition-colors"
            style={{ color: "#3a3a2a" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#9ca3af")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "#3a3a2a")
            }
          >
            ⎘
          </button>
        </div>
      )}
    </div>
  );
}
