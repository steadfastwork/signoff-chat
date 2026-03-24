"use client";

import { useRef, useState } from "react";
import type { BoardPostData } from "./BoardPostCard";

interface CreateBoardPostPanelProps {
  boardName: string;
  onPost: (post: BoardPostData) => void;
  onClose: () => void;
}

export function CreateBoardPostPanel({
  boardName,
  onPost,
  onClose,
}: CreateBoardPostPanelProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value.slice(0, 2000));
    if (bodyRef.current) {
      bodyRef.current.style.height = "auto";
      bodyRef.current.style.height = `${bodyRef.current.scrollHeight}px`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardName}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim() || undefined,
          tag: tag.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "failed to post.");
        return;
      }
      onPost(await res.json());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
        >
          New post
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-lg leading-none"
          style={{ color: "#3a3a2a" }}
        >
          ×
        </button>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          title <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 140))}
          placeholder="What's this post about?"
          required
          className="w-full h-10 rounded-xl border px-3 text-sm outline-none"
          style={{
            background: "#111109",
            borderColor: "#1e1e14",
            color: "#e5e7eb",
            fontFamily: "var(--font-dm-sans)",
          }}
        />
        <div className="flex justify-end">
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: title.length > 120 ? "#f59e0b" : "#2a2a1a" }}
          >
            {140 - title.length}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          body <span style={{ color: "#2a2a1a" }}>(optional)</span>
        </label>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={handleBodyChange}
          placeholder="More context, thoughts, links…"
          rows={4}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
          style={{
            background: "#111109",
            borderColor: "#1e1e14",
            color: "#d1d5db",
            fontFamily: "var(--font-dm-sans)",
            minHeight: "96px",
          }}
        />
        <div className="flex justify-end">
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: body.length > 1800 ? "#f59e0b" : "#2a2a1a" }}
          >
            {2000 - body.length}
          </span>
        </div>
      </div>

      {/* Media placeholder */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled
          title="Photo upload coming soon"
          className="h-9 px-3 rounded-lg text-xs font-mono border transition-colors opacity-30 cursor-not-allowed"
          style={{ color: "#6b7280", borderColor: "#1e1e14" }}
        >
          📷 Photo
        </button>
        <button
          type="button"
          disabled
          title="Video upload coming soon"
          className="h-9 px-3 rounded-lg text-xs font-mono border transition-colors opacity-30 cursor-not-allowed"
          style={{ color: "#6b7280", borderColor: "#1e1e14" }}
        >
          🎬 Video
        </button>
      </div>

      {/* Tag */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          tag <span style={{ color: "#2a2a1a" }}>(optional, one tag)</span>
        </label>
        <input
          value={tag}
          onChange={(e) =>
            setTag(e.target.value.toLowerCase().replace(/\s/g, "-").slice(0, 30))
          }
          placeholder="e.g. film-photography"
          className="w-full h-9 rounded-xl border px-3 text-xs font-mono outline-none"
          style={{ background: "#111109", borderColor: "#1e1e14", color: "#9ca3af" }}
        />
      </div>

      {error && (
        <p className="text-[11px] font-mono" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!title.trim() || submitting}
        className="w-full h-10 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-40"
        style={{ background: "#2dd4bf", color: "#0d0d0b" }}
      >
        {submitting ? "posting…" : "post to board"}
      </button>
    </form>
  );
}
