"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import type { Post } from "./PostCard";

export function NewPostForm({ onPost }: { onPost?: (post: Post) => void }) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX = 512;

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "failed to post."); return; }
      onPost?.(await res.json());
      setContent("");
      textareaRef.current?.focus();
    } catch {
      setError("network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-b border-green-950 p-4 bg-black">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-green-600 font-mono text-sm mt-2 flex-shrink-0">
          {session.user.screenname}&gt;
        </span>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="what's on your mind? (⌘+enter to post)"
          maxLength={MAX}
          rows={3}
          className="flex-1 bg-transparent border border-green-950 focus:border-green-700 outline-none text-green-200 text-sm font-mono placeholder-green-900 p-2 resize-none"
        />
      </div>
      <div className="flex items-center justify-between ml-16">
        <span className={`font-mono text-xs ${content.length > MAX * 0.9 ? "text-yellow-600" : "text-green-900"}`}>
          {content.length}/{MAX}
        </span>
        {error && <span className="text-red-600 text-xs font-mono">{error}</span>}
        <button
          type="submit"
          disabled={!content.trim() || submitting}
          className="font-mono text-sm text-green-700 hover:text-green-400 border border-green-900 hover:border-green-700 px-3 py-1 transition-colors disabled:opacity-30"
        >
          {submitting ? "[posting...]" : "[post]"}
        </button>
      </div>
    </form>
  );
}
