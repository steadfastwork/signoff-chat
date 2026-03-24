"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatTimestamp } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardPostData {
  id: string;
  title: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "GIF" | null;
  tag: string | null;
  isArchived: boolean;
  nudgeCount: number;
  commentCount: number;
  createdAt: string;
  nudgedByMe: boolean;
  savedByMe: boolean;
  author: {
    id: string;
    screenname: string;
    isGoldMember: boolean;
    isFoundingMember: boolean;
  };
}

// ---------------------------------------------------------------------------
// Shared avatar helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  amber:   { bg: "#78350f", text: "#fcd34d" },
  rose:    { bg: "#881337", text: "#fda4af" },
  sky:     { bg: "#0c4a6e", text: "#7dd3fc" },
  emerald: { bg: "#064e3b", text: "#6ee7b7" },
  violet:  { bg: "#4c1d95", text: "#c4b5fd" },
  orange:  { bg: "#7c2d12", text: "#fdba74" },
};

function hashColor(id: string) {
  const keys = Object.keys(AVATAR_COLORS);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return keys[h % keys.length];
}

// ---------------------------------------------------------------------------
// BoardPostCard
// ---------------------------------------------------------------------------

interface BoardPostCardProps {
  post: BoardPostData;
  boardName: string;
}

export function BoardPostCard({ post: initial, boardName }: BoardPostCardProps) {
  const [post, setPost] = useState(initial);
  const [nudging, setNudging] = useState(false);
  const [saving, setSaving] = useState(false);

  const colorKey = hashColor(post.author.id);
  const colors = AVATAR_COLORS[colorKey];

  const toggleNudge = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (nudging) return;
    setNudging(true);
    // Optimistic
    setPost((p) => ({
      ...p,
      nudgedByMe: !p.nudgedByMe,
      nudgeCount: p.nudgeCount + (p.nudgedByMe ? -1 : 1),
    }));
    try {
      const res = await fetch(
        `/api/boards/${boardName}/posts/${post.id}/nudge`,
        { method: "POST" }
      );
      if (res.ok) {
        const { nudgedByMe, nudgeCount } = await res.json();
        setPost((p) => ({ ...p, nudgedByMe, nudgeCount }));
      }
    } catch {
      // Roll back
      setPost((p) => ({
        ...p,
        nudgedByMe: !p.nudgedByMe,
        nudgeCount: p.nudgeCount + (p.nudgedByMe ? -1 : 1),
      }));
    } finally {
      setNudging(false);
    }
  };

  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setPost((p) => ({ ...p, savedByMe: !p.savedByMe }));
    try {
      const res = await fetch(
        `/api/boards/${boardName}/posts/${post.id}/save`,
        { method: "POST" }
      );
      if (res.ok) {
        const { savedByMe } = await res.json();
        setPost((p) => ({ ...p, savedByMe }));
      }
    } catch {
      setPost((p) => ({ ...p, savedByMe: !p.savedByMe }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className="rounded-2xl border p-4"
      style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
    >
      {/* Author row */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-[26px] h-[26px] rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: colors.bg }}
        >
          <span className="text-[9px] font-bold font-mono" style={{ color: colors.text }}>
            {post.author.screenname.slice(0, 2).toUpperCase()}
          </span>
        </div>

        <span
          className="text-xs font-semibold"
          style={{ color: "#9ca3af", fontFamily: "var(--font-dm-sans)" }}
        >
          {post.author.screenname}
          {post.author.isGoldMember && (
            <span className="ml-0.5 text-[9px]" style={{ color: "#d4a017" }}>★</span>
          )}
        </span>

        {post.author.isFoundingMember && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(200,134,10,0.08)",
              color: "#c8860a",
              border: "1px solid rgba(200,134,10,0.2)",
            }}
          >
            ✦ founding
          </span>
        )}

        {post.isArchived && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded ml-1"
            style={{
              background: "rgba(107,114,128,0.08)",
              color: "#4b5563",
              border: "1px solid rgba(107,114,128,0.15)",
            }}
          >
            📦 archived
          </span>
        )}

        <span className="ml-auto text-[11px] font-mono" style={{ color: "#2a2a1a" }}>
          {formatTimestamp(post.createdAt)}
        </span>
      </div>

      {/* Title */}
      <Link href={`/boards/${boardName}/posts/${post.id}`}>
        <h3
          className="font-semibold leading-snug mb-1.5 hover:underline decoration-dotted"
          style={{
            fontSize: "14px",
            color: "#e5e7eb",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {post.title}
        </h3>
      </Link>

      {/* Body preview */}
      {post.body && (
        <p
          className="text-sm leading-relaxed mb-3 line-clamp-2"
          style={{ color: "#6b7280", fontFamily: "var(--font-dm-sans)" }}
        >
          {post.body}
          {post.body.length > 120 && (
            <Link
              href={`/boards/${boardName}/posts/${post.id}`}
              className="ml-1 font-medium hover:underline"
              style={{ color: "#6b7280" }}
            >
              read more
            </Link>
          )}
        </p>
      )}

      {/* Media */}
      {post.mediaUrl && post.mediaType === "IMAGE" && (
        <div className="rounded-[10px] overflow-hidden mb-3">
          <Image
            src={post.mediaUrl}
            alt="post media"
            width={600}
            height={400}
            className="w-full h-auto object-cover"
            unoptimized
          />
        </div>
      )}
      {post.mediaUrl && post.mediaType === "VIDEO" && (
        <video
          src={post.mediaUrl}
          controls
          className="rounded-[10px] w-full mb-3"
        />
      )}

      {/* Footer: tag + actions */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {/* Actions */}
        <button
          onClick={toggleNudge}
          disabled={nudging}
          className="text-[11px] font-mono transition-colors disabled:opacity-50"
          style={{ color: post.nudgedByMe ? "#2dd4bf" : "#3a3a2a" }}
        >
          👋 nudge ({post.nudgeCount})
        </button>

        <Link
          href={`/boards/${boardName}/posts/${post.id}#comments`}
          className="text-[11px] font-mono"
          style={{ color: "#3a3a2a" }}
        >
          💬 {post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}
        </Link>

        <button
          onClick={toggleSave}
          disabled={saving}
          className="text-[11px] font-mono transition-colors disabled:opacity-50"
          style={{ color: post.savedByMe ? "#c8860a" : "#3a3a2a" }}
        >
          🔖 {post.savedByMe ? "saved" : "save"}
        </button>

        {/* Tag — pushed to right */}
        {post.tag && (
          <span className="ml-auto">
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
              style={{ color: "#4b5563", borderColor: "#1e1e14" }}
            >
              {post.tag}
            </span>
          </span>
        )}
      </div>
    </article>
  );
}
