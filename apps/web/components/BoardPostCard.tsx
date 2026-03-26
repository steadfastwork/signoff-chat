"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatTimestamp } from "@/lib/utils";
import { RichTextContent } from "@/components/RichTextContent";

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
    isModerator?: boolean;
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
  canDelete?: boolean;
  onDelete?: (postId: string) => void;
}

export function BoardPostCard({ post: initial, boardName, canDelete, onDelete }: BoardPostCardProps) {
  const [post, setPost] = useState(initial);
  const [nudging, setNudging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (deleting || !window.confirm("Remove this post?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/boards/${boardName}/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) onDelete?.(post.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
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
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
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
              color: "var(--amber)",
              border: "1px solid rgba(200,134,10,0.2)",
            }}
          >
            ✦ founding
          </span>
        )}

        {post.author.isModerator && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(139,92,246,0.08)",
              color: "#a78bfa",
              border: "1px solid rgba(139,92,246,0.2)",
            }}
          >
            mod
          </span>
        )}

        {post.isArchived && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded ml-1"
            style={{
              background: "rgba(107,114,128,0.08)",
              color: "var(--text-muted)",
              border: "1px solid rgba(107,114,128,0.15)",
            }}
          >
            📦 archived
          </span>
        )}

        <span className="ml-auto text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
          {formatTimestamp(post.createdAt)}
        </span>
      </div>

      {/* Title */}
      <Link href={`/boards/${boardName}/posts/${post.id}`}>
        <h3
          className="font-semibold leading-snug mb-1.5 hover:underline decoration-dotted"
          style={{
            fontSize: "14px",
            color: "var(--text)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {post.title}
        </h3>
      </Link>

      {/* Body preview */}
      {post.body && (
        <div
          className="text-sm leading-relaxed mb-3"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
        >
          <RichTextContent html={post.body} clamp />
        </div>
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
          style={{ color: post.nudgedByMe ? "var(--teal)" : "var(--text-dim)" }}
        >
          👋 nudge ({post.nudgeCount})
        </button>

        <Link
          href={`/boards/${boardName}/posts/${post.id}#comments`}
          className="text-[11px] font-mono"
          style={{ color: "var(--text-dim)" }}
        >
          💬 {post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}
        </Link>

        <button
          onClick={toggleSave}
          disabled={saving}
          className="text-[11px] font-mono transition-colors disabled:opacity-50"
          style={{ color: post.savedByMe ? "var(--amber)" : "var(--text-dim)" }}
        >
          🔖 {post.savedByMe ? "saved" : "save"}
        </button>

        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-[11px] font-mono transition-colors disabled:opacity-50"
            style={{ color: "var(--text-dim)" }}
            title="Remove post"
          >
            {deleting ? "…" : "🗑 remove"}
          </button>
        )}

        {/* Tag — pushed to right */}
        {post.tag && (
          <span className="ml-auto">
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
            >
              {post.tag}
            </span>
          </span>
        )}
      </div>
    </article>
  );
}
