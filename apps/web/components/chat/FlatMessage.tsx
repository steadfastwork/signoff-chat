"use client";

import { useMemo, useState } from "react";
import { getColorForUser, SELF_COLOR } from "@/lib/userColors";
import { DM_FONT_SIZES } from "@/lib/dmColors";
import type { ChatMessage } from "@/lib/chat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// FlatMessage
// ---------------------------------------------------------------------------

interface FlatMessageProps {
  msg: ChatMessage;
  isOwn: boolean;
  senderId: string;
  screenname: string;
  isGold: boolean;
  onThreadOpen?: (msgId: string) => void;
  /** When set (DM mode), own messages use this color instead of SELF_COLOR */
  myTextColor?: string;
}

export function FlatMessage({
  msg,
  isOwn,
  senderId,
  screenname,
  isGold,
  onThreadOpen,
  myTextColor,
}: FlatMessageProps) {
  const [hovered, setHovered] = useState(false);

  // DM color logic: stored textColor wins; own messages fall back to myTextColor/SELF_COLOR
  const resolvedColor = msg.textColor
    ? msg.textColor
    : isOwn
    ? (myTextColor ?? SELF_COLOR)
    : getColorForUser(senderId);
  const nameColor = resolvedColor;
  const textColor = resolvedColor;

  // Font size from stored fontSize field (DM feature), default 13px (channel style)
  const fsKey = msg.fontSize as keyof typeof DM_FONT_SIZES | undefined;
  const resolvedFontSize = fsKey && DM_FONT_SIZES[fsKey]
    ? DM_FONT_SIZES[fsKey].px
    : 13;

  const text = useMemo(() => stripHtml(msg.content), [msg.content]);
  const time = formatTime(msg.createdAt);
  const displayName = isGold ? `★ ${screenname}` : screenname;

  const hasGif = !!msg.gifUrl;
  const hasMedia = !!msg.mediaUrl;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: "0 4px",
        padding: "1px 16px",
        lineHeight: "1.5",
        fontFamily: "var(--font-dm-sans)",
        borderRadius: "3px",
        background: hovered ? "rgba(255,255,255,0.025)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      {/* Name — always visible on every message */}
      <span
        style={{
          color: nameColor,
          fontWeight: 600,
          fontSize: `${resolvedFontSize}px`,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {displayName}:
      </span>

      {/* Content */}
      <div
        style={{
          fontSize: `${resolvedFontSize}px`,
          color: textColor,
          wordBreak: "break-word",
          minWidth: 0,
        }}
      >
        {hasGif && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={msg.gifUrl!}
            alt={msg.gifTitle ?? "gif"}
            style={{
              maxHeight: "120px",
              borderRadius: "6px",
              display: "block",
              marginBottom: "2px",
            }}
          />
        )}
        {hasMedia && !hasGif && (
          msg.mediaType === "VIDEO" ? (
            <video
              src={msg.mediaUrl!}
              controls
              style={{
                maxHeight: "120px",
                borderRadius: "6px",
                display: "block",
                marginBottom: "2px",
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.mediaUrl!}
              alt="media"
              style={{
                maxHeight: "120px",
                borderRadius: "6px",
                display: "block",
                marginBottom: "2px",
              }}
            />
          )
        )}
        {text && <span>{text}</span>}

        {/* Thread: count badge (always shown) + reply button (hover when no thread yet) */}
        {onThreadOpen && (
          <div style={{ marginTop: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
            {msg.thread ? (
              <button
                onClick={() => onThreadOpen(msg.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "var(--amber)",
                  background: "rgba(200,134,10,0.08)",
                  border: "1px solid rgba(200,134,10,0.2)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  padding: "1px 6px",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(200,134,10,0.15)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(200,134,10,0.08)";
                }}
              >
                💬 {msg.thread.messageCount} {msg.thread.messageCount === 1 ? "reply" : "replies"}
                {msg.thread.lastReplyBy && (
                  <span style={{ color: "var(--text-dim)" }}>· {msg.thread.lastReplyBy}</span>
                )}
              </button>
            ) : (
              <button
                onClick={() => onThreadOpen(msg.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "var(--text-dim)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "1px 0",
                  opacity: hovered ? 1 : 0,
                  transition: "opacity 0.15s",
                  pointerEvents: hovered ? "auto" : "none",
                }}
              >
                💬 reply in thread
              </button>
            )}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span
        style={{
          fontSize: "10px",
          fontFamily: "monospace",
          color: "var(--text-dim)",
          flexShrink: 0,
          alignSelf: "flex-start",
          marginLeft: "4px",
          whiteSpace: "nowrap",
          paddingTop: "3px",
        }}
      >
        {time}
      </span>
    </div>
  );
}
