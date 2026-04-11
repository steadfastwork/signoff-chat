"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { RichTextContent } from "@/components/RichTextContent";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { formatTimestamp } from "@/lib/utils";
import { CurrentlyDisplay } from "@/components/currently/CurrentlyDisplay";
import { parseCurrently, type CurrentlyData } from "@/lib/currently";
import { BadgeList } from "@/components/badges/BadgeList";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostAuthor {
  id: string;
  screenname: string;
  isGoldMember: boolean;
  status: StatusValue;
  awayMessage: string | null;
  currently?: CurrentlyData | null;
  badges?: { id: string; badge: string; awardedAt: string }[];
}

interface ReplyPreview {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; screenname: string; isGoldMember: boolean };
}

export interface FeedPost {
  id: string;
  content: string;
  createdAt: string;
  privacy: "PUBLIC" | "BUDDIES_ONLY";
  isAwayMessage: boolean;
  // Legacy single-media (kept for old posts)
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "GIF" | null;
  // Multi-media arrays (new)
  mediaUrls?: string[];
  gifUrls?: string[];
  gifIds?: string[];
  author: PostAuthor;
  _count: { replies: number; nudges: number };
  nudgedByMe: boolean;
  replies: ReplyPreview[];
}

// Keep the old Post type alias so other files that import it don't break
export type Post = FeedPost;

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

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Reply composer (inline)
// ---------------------------------------------------------------------------

function ReplyComposer({
  postId,
  onReply,
}: {
  postId: string;
  onReply: (reply: ReplyPreview) => void;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        onReply(await res.json());
        setContent("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex gap-2 mt-3">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 256))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="reply… (↵)"
        className="flex-1 bg-transparent border-b outline-none text-xs py-1"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-muted)",
          fontFamily: "var(--font-dm-sans)",
        }}
      />
      <button
        onClick={submit}
        disabled={!content.trim() || submitting}
        className="text-[11px] font-mono px-2 rounded transition-colors disabled:opacity-30"
        style={{ color: "var(--amber)" }}
      >
        {submitting ? "…" : "send"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostCard
// ---------------------------------------------------------------------------

export function PostCard({
  post: initial,
  currentUserId,
}: {
  post: FeedPost;
  currentUserId?: string;
}) {
  const [post, setPost] = useState(initial);
  const [nudging, setNudging] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [allReplies, setAllReplies] = useState<ReplyPreview[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const colorKey = hashColor(post.author.id);
  const colors = AVATAR_COLORS[colorKey];

  const toggleNudge = async () => {
    if (nudging) return;
    setNudging(true);
    // Optimistic update
    setPost((p) => ({
      ...p,
      nudgedByMe: !p.nudgedByMe,
      _count: {
        ...p._count,
        nudges: p._count.nudges + (p.nudgedByMe ? -1 : 1),
      },
    }));
    try {
      const res = await fetch(`/api/posts/${post.id}/nudge`, { method: "POST" });
      if (res.ok) {
        const { nudgedByMe, count } = await res.json();
        setPost((p) => ({
          ...p,
          nudgedByMe,
          _count: { ...p._count, nudges: count },
        }));
      }
    } catch {
      // Roll back optimistic update on error
      setPost((p) => ({
        ...p,
        nudgedByMe: !p.nudgedByMe,
        _count: {
          ...p._count,
          nudges: p._count.nudges + (p.nudgedByMe ? -1 : 1),
        },
      }));
    } finally {
      setNudging(false);
    }
  };

  const toggleReplies = async () => {
    if (!showReplies && allReplies === null) {
      setLoadingReplies(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/replies`);
        if (res.ok) setAllReplies(await res.json());
      } finally {
        setLoadingReplies(false);
      }
    }
    setShowReplies((v) => !v);
  };

  const handleNewReply = (reply: ReplyPreview) => {
    setAllReplies((prev) => (prev ? [...prev, reply] : [reply]));
    setPost((p) => ({
      ...p,
      _count: { ...p._count, replies: p._count.replies + 1 },
    }));
  };

  const displayedReplies =
    showReplies && allReplies !== null
      ? allReplies
      : (post.replies ?? []).slice(0, 2);

  return (
    <article
      className="px-4 py-3.5 border-b"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      {/* Header row */}
      <div className="flex gap-2.5">
        {/* Avatar */}
        <Link href={`/u/${post.author.screenname}`} className="flex-shrink-0">
          <div className="relative">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: colors.bg }}
            >
              <span
                className="text-[11px] font-bold font-mono"
                style={{ color: colors.text }}
              >
                {getInitials(post.author.screenname)}
              </span>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status={post.author.status} size="sm" bg="var(--bg)" />
            </span>
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name + badges + timestamp */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/u/${post.author.screenname}`}
              className="text-sm font-semibold hover:underline"
              style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
            >
              {post.author.screenname}
            </Link>

            {post.author.isGoldMember && (
              <span className="text-[10px]" style={{ color: "#d4a017" }}>★</span>
            )}

            {post.author.badges && post.author.badges.length > 0 && (
              <BadgeList badges={post.author.badges as any} size="sm" />
            )}

            {post.isAwayMessage && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  color: "#f59e0b",
                  border: "1px solid rgba(245,158,11,0.25)",
                }}
              >
                away msg
              </span>
            )}

            {post.privacy === "BUDDIES_ONLY" && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(139,92,246,0.12)",
                  color: "#a78bfa",
                  border: "1px solid rgba(139,92,246,0.25)",
                }}
              >
                buddies
              </span>
            )}

            <span
              className="text-[11px] font-mono ml-auto flex-shrink-0"
              style={{ color: "var(--text-dim)" }}
            >
              {formatTimestamp(post.createdAt)}
            </span>
          </div>

          {/* Currently pills — shown on away message cards */}
          {post.isAwayMessage && post.author.currently && (
            <CurrentlyDisplay
              currently={parseCurrently(post.author.currently)}
              size="compact"
              maxCompact={3}
            />
          )}

          {/* Post content */}
          <div
            className="mt-1 text-sm"
            style={{
              color: post.isAwayMessage ? "var(--away)" : "var(--text-muted)",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            <RichTextContent html={post.content} />
          </div>

          {/* Media — new array format */}
          {((post.mediaUrls?.length ?? 0) > 0 || (post.gifUrls?.length ?? 0) > 0) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(post.mediaUrls ?? []).map((url, i) => (
                <div key={`media-${i}`} className="rounded-xl overflow-hidden max-w-[280px]">
                  {url.match(/\.(mp4|webm|ogg)(\?|$)/i) ? (
                    <video src={url} controls className="w-full h-auto rounded-xl" />
                  ) : (
                    <Image src={url} alt="attachment" width={280} height={200} className="w-full h-auto object-cover" unoptimized />
                  )}
                </div>
              ))}
              {(post.gifUrls ?? []).map((url, i) => (
                <div key={`gif-${i}`} className="rounded-xl overflow-hidden max-w-[280px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="gif" className="w-full h-auto rounded-xl" loading="lazy" />
                </div>
              ))}
            </div>
          )}

          {/* Media — legacy single-media fallback */}
          {!(post.mediaUrls?.length) && !(post.gifUrls?.length) && post.mediaUrl && post.mediaType === "IMAGE" && (
            <div className="mt-2 rounded-xl overflow-hidden max-w-sm">
              <Image src={post.mediaUrl} alt="post media" width={400} height={300} className="w-full h-auto object-cover" unoptimized />
            </div>
          )}
          {!(post.mediaUrls?.length) && !(post.gifUrls?.length) && post.mediaUrl && post.mediaType === "VIDEO" && (
            <video src={post.mediaUrl} controls className="mt-2 rounded-xl max-w-sm w-full" />
          )}
          {!(post.mediaUrls?.length) && !(post.gifUrls?.length) && post.mediaUrl && post.mediaType === "GIF" && (
            <div className="mt-2 rounded-xl overflow-hidden max-w-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.mediaUrl} alt="gif" className="w-full h-auto rounded-xl" loading="lazy" />
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-3 mt-2">
            {/* Nudge */}
            <button
              onClick={toggleNudge}
              disabled={nudging}
              className="flex items-center gap-1 text-[11px] font-mono transition-colors disabled:opacity-50"
              style={{
                color: post.nudgedByMe ? "var(--amber)" : "var(--text-dim)",
              }}
            >
              <span className="text-[13px]">⚡</span>
              <span>{post._count.nudges}</span>
            </button>

            {/* Replies */}
            <button
              onClick={toggleReplies}
              className="text-[11px] font-mono transition-colors"
              style={{ color: showReplies ? "var(--text-muted)" : "var(--text-dim)" }}
            >
              {loadingReplies
                ? "…"
                : `${post._count.replies} repl${post._count.replies !== 1 ? "ies" : "y"}`}
            </button>
          </div>

          {/* Reply previews */}
          {(displayedReplies.length > 0 || showReplies) && (
            <div
              className="mt-2.5 pl-3 border-l space-y-1.5"
              style={{ borderColor: "var(--border)" }}
            >
              {displayedReplies.map((r) => (
                <div key={r.id}>
                  <span
                    className="text-xs font-semibold mr-1.5"
                    style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
                  >
                    {r.author.screenname}
                    {r.author.isGoldMember && (
                      <span className="ml-0.5 text-[9px]" style={{ color: "#d4a017" }}>★</span>
                    )}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
                  >
                    <RichTextContent html={r.content} />
                  </span>
                </div>
              ))}

              {!showReplies && post._count.replies > 2 && (
                <button
                  onClick={toggleReplies}
                  className="text-[11px] font-mono"
                  style={{ color: "var(--text-dim)" }}
                >
                  +{post._count.replies - 2} more
                </button>
              )}

              {showReplies && (
                <ReplyComposer postId={post.id} onReply={handleNewReply} />
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
