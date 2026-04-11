"use client";

import React from "react";
import { AVATAR_COLORS, type MessageGroup as TMessageGroup, type ChatMessage } from "@/lib/chat";

// ---------------------------------------------------------------------------
// Bubble border-radius per position
// ---------------------------------------------------------------------------

type Position = "only" | "first" | "middle" | "last";

function bubbleRadius(isOwn: boolean, position: Position): string {
  if (isOwn) {
    switch (position) {
      case "only":   return "18px 18px 18px 18px";
      case "first":  return "18px 4px 18px 18px";
      case "middle": return "4px 4px 18px 18px";
      case "last":   return "18px 18px 4px 18px";
    }
  } else {
    switch (position) {
      case "only":   return "18px 18px 18px 18px";
      case "first":  return "4px 18px 18px 18px";
      case "middle": return "4px 18px 18px 4px";
      case "last":   return "18px 18px 18px 4px";
    }
  }
}

function getPosition(index: number, total: number): Position {
  if (total === 1) return "only";
  if (index === 0) return "first";
  if (index === total - 1) return "last";
  return "middle";
}

// ---------------------------------------------------------------------------
// Single bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  msg,
  isOwn,
  position,
  onThreadOpen,
}: {
  msg: ChatMessage;
  isOwn: boolean;
  position: Position;
  onThreadOpen?: (msgId: string) => void;
}) {
  const radius = bubbleRadius(isOwn, position);
  const hasText = msg.content.trim().length > 0;
  const hasGif = !!msg.gifUrl;
  const hasMedia = !!msg.mediaUrl;

  return (
    <div
      className={`max-w-[75%] min-w-[2.5rem] ${isOwn ? "ml-auto" : ""}`}
      style={{ borderRadius: radius, overflow: "hidden" }}
    >
      {/* GIF */}
      {hasGif && (
        <div
          className="relative"
          style={{
            borderRadius: radius,
            overflow: "hidden",
            background: "var(--msg-other-bg)",
          }}
        >
          <img
            src={msg.gifUrl!}
            alt={msg.gifTitle ?? "GIF"}
            className="block max-w-full max-h-48 object-contain"
            style={{ display: "block" }}
          />
          {msg.gifTitle && (
            <span
              className="absolute bottom-1 right-1 text-[9px] font-mono px-1 rounded"
              style={{ background: "rgba(0,0,0,0.55)", color: "#9ca3af" }}
            >
              GIF
            </span>
          )}
        </div>
      )}

      {/* Image/Video media */}
      {hasMedia && !hasGif && (
        <div
          className="relative"
          style={{ borderRadius: radius, overflow: "hidden", background: "var(--msg-other-bg)" }}
        >
          {msg.mediaType === "VIDEO" ? (
            <video
              src={msg.mediaUrl!}
              controls
              className="block max-w-full max-h-48"
              style={{ display: "block" }}
            />
          ) : (
            <img
              src={msg.mediaUrl!}
              alt="media"
              className="block max-w-full max-h-64 object-contain"
              style={{ display: "block" }}
            />
          )}
        </div>
      )}

      {/* Text content */}
      {hasText && (
        <div
          className="px-3 py-2 text-sm leading-relaxed"
          style={{
            borderRadius: hasGif || hasMedia ? "0" : radius,
            background: isOwn ? "var(--msg-own-bg)" : "var(--msg-other-bg)",
            border: `1px solid ${isOwn ? "var(--msg-own-border)" : "var(--msg-other-border)"}`,
            color: "var(--text)",
            wordBreak: "break-word",
          }}
          dangerouslySetInnerHTML={{ __html: msg.content }}
        />
      )}

      {/* Encrypted indicator */}
      {msg.isEncrypted && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono"
          style={{ color: "var(--text-muted)", background: isOwn ? "var(--msg-meta-bg)" : "var(--msg-other-meta-bg)" }}
        >
          <span>🔒</span>
          <span>encrypted</span>
        </div>
      )}

      {/* Thread reply indicator */}
      {msg.thread && (
        <button
          onClick={() => onThreadOpen?.(msg.id)}
          className="flex items-center gap-1 px-3 py-1 text-[11px] font-mono w-full text-left hover:opacity-80 transition-opacity"
          style={{
            background: isOwn ? "var(--msg-meta-bg)" : "var(--msg-other-meta-bg)",
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span>💬</span>
          <span>
            {msg.thread.messageCount} {msg.thread.messageCount === 1 ? "reply" : "replies"}
            {msg.thread.lastReplyBy && ` · last by ${msg.thread.lastReplyBy}`}
          </span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageGroup component
// ---------------------------------------------------------------------------

interface MessageGroupProps {
  group: TMessageGroup;
  onReact?: (msgId: string, emoji: string) => void;
  onThreadOpen?: (msgId: string) => void;
}

export function MessageGroup({ group, onThreadOpen }: MessageGroupProps) {
  const colorKey = group.avatarColor;
  const colors = AVATAR_COLORS[colorKey] ?? AVATAR_COLORS.amber;
  const total = group.messages.length;

  return (
    <div
      className={`flex gap-2 px-4 py-0.5 group ${group.isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar — anchored to bottom of group */}
      <div className="flex flex-col justify-end flex-shrink-0 w-8">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono select-none"
          style={
            group.isOwn
              ? { background: "linear-gradient(135deg, #f0c040, #c8860a)", color: "#fff8e6" }
              : { background: colors.bg, color: colors.text }
          }
          title={group.screenname}
        >
          {group.avatarText}
        </div>
      </div>

      {/* Messages + header */}
      <div className={`flex flex-col gap-0.5 min-w-0 ${group.isOwn ? "items-end" : "items-start"}`}>
        {/* Header: screenname + timestamp */}
        <div
          className={`flex items-baseline gap-2 px-1 mb-0.5 ${group.isOwn ? "flex-row-reverse" : "flex-row"}`}
        >
          <span
            className="text-xs font-mono font-semibold"
            style={{ color: group.isGold ? "var(--amber)" : "var(--text-muted)" }}
          >
            {group.isGold ? `★ ${group.screenname}` : group.screenname}
          </span>
          <span className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }}>
            {group.timestamp}
          </span>
        </div>

        {/* Bubbles */}
        {group.messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={group.isOwn}
            position={getPosition(i, total)}
            onThreadOpen={onThreadOpen}
          />
        ))}
      </div>
    </div>
  );
}
