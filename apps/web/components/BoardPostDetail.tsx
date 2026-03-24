"use client";

import { useState } from "react";
import Image from "next/image";
import { formatTimestamp } from "@/lib/utils";
import type { BoardPostData } from "./BoardPostCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  nudgeCount: number;
  nudgedByMe: boolean;
  parentCommentId: string | null;
  author: {
    id: string;
    screenname: string;
    isGoldMember: boolean;
    isFoundingMember: boolean;
  };
  replies?: Comment[];
}

// ---------------------------------------------------------------------------
// Avatar helper
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

function Avatar({ userId, screenname }: { userId: string; screenname: string }) {
  const colors = AVATAR_COLORS[hashColor(userId)];
  return (
    <div
      className="w-[26px] h-[26px] rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: colors.bg }}
    >
      <span className="text-[9px] font-bold font-mono" style={{ color: colors.text }}>
        {screenname.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

function AuthorLine({
  author,
  createdAt,
  isOwn,
}: {
  author: Comment["author"];
  createdAt: string;
  isOwn?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className="text-xs font-semibold"
        style={{
          color: isOwn ? "#c8860a" : "#9ca3af",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {author.screenname}
        {author.isGoldMember && (
          <span className="ml-0.5 text-[9px]" style={{ color: "#d4a017" }}>★</span>
        )}
      </span>
      {author.isFoundingMember && (
        <span
          className="text-[9px] font-mono px-1 py-0.5 rounded"
          style={{
            background: "rgba(200,134,10,0.08)",
            color: "#c8860a",
            border: "1px solid rgba(200,134,10,0.2)",
          }}
        >
          ✦
        </span>
      )}
      <span className="text-[10px] font-mono" style={{ color: "#2a2a1a" }}>
        {formatTimestamp(createdAt)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment row (supports nesting = 1 level)
// ---------------------------------------------------------------------------

function CommentRow({
  comment,
  boardName,
  postId,
  currentUserId,
  onNudge,
  onReply,
  isReply = false,
}: {
  comment: Comment;
  boardName: string;
  postId: string;
  currentUserId?: string;
  onNudge: (commentId: string) => void;
  onReply?: (commentId: string, body: string) => void;
  isReply?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const submitReply = async () => {
    if (!replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      onReply?.(comment.id, replyText.trim());
      setReplyText("");
      setReplying(false);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className={isReply ? "ml-8 mt-2" : ""}>
      {isReply && (
        <div
          className="w-px h-4 mb-1 ml-3"
          style={{ background: "#1e1e14" }}
        />
      )}
      <div
        className={`flex gap-2 ${isReply ? "pl-3 border-l" : ""}`}
        style={isReply ? { borderColor: "#1e1e14" } : {}}
      >
        <Avatar userId={comment.author.id} screenname={comment.author.screenname} />
        <div className="flex-1 min-w-0">
          <AuthorLine
            author={comment.author}
            createdAt={comment.createdAt}
            isOwn={comment.author.id === currentUserId}
          />
          <p
            className="text-sm leading-relaxed mt-0.5 break-words"
            style={{ color: "#6b7280", fontFamily: "var(--font-dm-sans)" }}
          >
            {comment.body}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => onNudge(comment.id)}
              className="text-[11px] font-mono transition-colors"
              style={{ color: comment.nudgedByMe ? "#2dd4bf" : "#3a3a2a" }}
            >
              👋 {comment.nudgeCount}
            </button>
            {!isReply && currentUserId && onReply && (
              <button
                onClick={() => setReplying((v) => !v)}
                className="text-[11px] font-mono"
                style={{ color: "#3a3a2a" }}
              >
                reply
              </button>
            )}
          </div>

          {replying && (
            <div className="flex gap-2 mt-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value.slice(0, 512))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitReply();
                  }
                }}
                placeholder="reply… (↵)"
                className="flex-1 h-7 rounded-lg border px-2 text-xs outline-none"
                style={{
                  background: "#111109",
                  borderColor: "#1e1e14",
                  color: "#9ca3af",
                  fontFamily: "var(--font-dm-sans)",
                }}
              />
              <button
                onClick={submitReply}
                disabled={!replyText.trim() || sendingReply}
                className="h-7 px-2.5 rounded-lg text-xs font-mono disabled:opacity-40"
                style={{ background: "#2dd4bf", color: "#0d0d0b" }}
              >
                {sendingReply ? "…" : "send"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies?.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          boardName={boardName}
          postId={postId}
          currentUserId={currentUserId}
          onNudge={onNudge}
          isReply
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BoardPostDetail
// ---------------------------------------------------------------------------

interface BoardPostDetailProps {
  post: BoardPostData;
  boardName: string;
  currentUserId?: string;
}

export function BoardPostDetail({
  post: initial,
  boardName,
  currentUserId,
}: BoardPostDetailProps) {
  const [post, setPost] = useState(initial);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const colorKey = hashColor(post.author.id);
  const colors = AVATAR_COLORS[colorKey];

  // Load comments
  const loadComments = async () => {
    if (commentsLoaded) return;
    setLoadingComments(true);
    try {
      const res = await fetch(
        `/api/boards/${boardName}/posts/${post.id}/comments`
      );
      if (res.ok) {
        setComments(await res.json());
        setCommentsLoaded(true);
      }
    } finally {
      setLoadingComments(false);
    }
  };

  // Nudge post
  const nudgePost = async () => {
    setPost((p) => ({
      ...p,
      nudgedByMe: !p.nudgedByMe,
      nudgeCount: p.nudgeCount + (p.nudgedByMe ? -1 : 1),
    }));
    const res = await fetch(
      `/api/boards/${boardName}/posts/${post.id}/nudge`,
      { method: "POST" }
    );
    if (res.ok) {
      const { nudgedByMe, nudgeCount } = await res.json();
      setPost((p) => ({ ...p, nudgedByMe, nudgeCount }));
    }
  };

  // Nudge comment
  const nudgeComment = async (commentId: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            nudgedByMe: !c.nudgedByMe,
            nudgeCount: c.nudgeCount + (c.nudgedByMe ? -1 : 1),
          };
        }
        return {
          ...c,
          replies: c.replies?.map((r) =>
            r.id === commentId
              ? {
                  ...r,
                  nudgedByMe: !r.nudgedByMe,
                  nudgeCount: r.nudgeCount + (r.nudgedByMe ? -1 : 1),
                }
              : r
          ),
        };
      })
    );
    const res = await fetch(
      `/api/boards/${boardName}/posts/${post.id}/comments/${commentId}/nudge`,
      { method: "POST" }
    );
    if (res.ok) {
      const { nudgedByMe, nudgeCount } = await res.json();
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) return { ...c, nudgedByMe, nudgeCount };
          return {
            ...c,
            replies: c.replies?.map((r) =>
              r.id === commentId ? { ...r, nudgedByMe, nudgeCount } : r
            ),
          };
        })
      );
    }
  };

  // Submit top-level comment
  const submitComment = async () => {
    if (!commentBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/boards/${boardName}/posts/${post.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: commentBody.trim() }),
        }
      );
      if (res.ok) {
        const newComment: Comment = await res.json();
        setComments((prev) => [...prev, { ...newComment, replies: [] }]);
        setPost((p) => ({ ...p, commentCount: p.commentCount + 1 }));
        setCommentBody("");
        if (!commentsLoaded) setCommentsLoaded(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Reply to a comment
  const handleReply = async (parentId: string, body: string) => {
    const res = await fetch(
      `/api/boards/${boardName}/posts/${post.id}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentCommentId: parentId }),
      }
    );
    if (res.ok) {
      const reply: Comment = await res.json();
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies ?? []), reply] }
            : c
        )
      );
      setPost((p) => ({ ...p, commentCount: p.commentCount + 1 }));
    }
  };

  // Auto-load comments
  if (!commentsLoaded && !loadingComments) {
    void loadComments();
  }

  return (
    <div>
      {/* Author */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-[26px] h-[26px] rounded-lg flex items-center justify-center"
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
        <span className="ml-auto text-[11px] font-mono" style={{ color: "#2a2a1a" }}>
          {formatTimestamp(post.createdAt)}
        </span>
      </div>

      {/* Title */}
      <h1
        className="font-bold leading-tight mb-3"
        style={{ fontSize: "18px", color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
      >
        {post.title}
      </h1>

      {/* Body */}
      {post.body && (
        <p
          className="text-sm leading-relaxed mb-4 whitespace-pre-wrap"
          style={{ color: "#9ca3af", fontFamily: "var(--font-dm-sans)" }}
        >
          {post.body}
        </p>
      )}

      {/* Media */}
      {post.mediaUrl && post.mediaType === "IMAGE" && (
        <div className="rounded-[10px] overflow-hidden mb-4">
          <Image
            src={post.mediaUrl}
            alt="post media"
            width={800}
            height={600}
            className="w-full h-auto"
            unoptimized
          />
        </div>
      )}
      {post.mediaUrl && post.mediaType === "VIDEO" && (
        <video src={post.mediaUrl} controls className="rounded-[10px] w-full mb-4" />
      )}

      {/* Tag */}
      {post.tag && (
        <div className="mb-4">
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
            style={{ color: "#4b5563", borderColor: "#1e1e14" }}
          >
            {post.tag}
          </span>
        </div>
      )}

      {/* Nudge */}
      <div className="flex items-center gap-4 py-3 border-y mb-6" style={{ borderColor: "#1a1a12" }}>
        <button
          onClick={nudgePost}
          className="flex items-center gap-1.5 text-sm font-mono transition-colors"
          style={{ color: post.nudgedByMe ? "#2dd4bf" : "#3a3a2a" }}
        >
          <span>👋</span>
          <span>{post.nudgeCount} nudge{post.nudgeCount !== 1 ? "s" : ""}</span>
        </button>
        <span className="text-[11px] font-mono" style={{ color: "#2a2a1a" }}>
          💬 {post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Comments */}
      <section id="comments">
        <h2
          className="text-xs font-mono uppercase tracking-widest mb-4"
          style={{ color: "#3a3a2a" }}
        >
          comments
        </h2>

        {loadingComments && (
          <p className="text-xs font-mono animate-pulse mb-4" style={{ color: "#2a2a1a" }}>
            loading…
          </p>
        )}

        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              boardName={boardName}
              postId={post.id}
              currentUserId={currentUserId}
              onNudge={nudgeComment}
              onReply={currentUserId ? handleReply : undefined}
            />
          ))}
        </div>

        {comments.length === 0 && !loadingComments && (
          <p className="text-sm italic mb-4" style={{ color: "#2a2a1a", fontFamily: "var(--font-dm-sans)" }}>
            no comments yet.
          </p>
        )}

        {/* Comment composer */}
        {currentUserId && (
          <div className="mt-6 flex gap-2 items-start">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value.slice(0, 512))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submitComment();
                }
              }}
              placeholder="add a comment… (⌘↵)"
              rows={3}
              className="flex-1 rounded-xl border px-3 py-2 text-sm resize-none outline-none"
              style={{
                background: "#111109",
                borderColor: "#1e1e14",
                color: "#d1d5db",
                fontFamily: "var(--font-dm-sans)",
              }}
            />
            <button
              onClick={submitComment}
              disabled={!commentBody.trim() || submitting}
              className="h-9 px-3.5 rounded-xl text-sm font-mono font-bold mt-0.5 transition-all disabled:opacity-40"
              style={{ background: "#2dd4bf", color: "#0d0d0b" }}
            >
              {submitting ? "…" : "comment"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
