"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { FeedPost } from "./PostCard";

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  amber:   { bg: "#78350f", text: "#fcd34d" },
  rose:    { bg: "#881337", text: "#fda4af" },
  sky:     { bg: "#0c4a6e", text: "#7dd3fc" },
  emerald: { bg: "#064e3b", text: "#6ee7b7" },
  violet:  { bg: "#4c1d95", text: "#c4b5fd" },
  orange:  { bg: "#7c2d12", text: "#fdba74" },
};

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

interface PostComposerProps {
  onPost: (post: FeedPost) => void;
}

export function PostComposer({ onPost }: PostComposerProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState<"PUBLIC" | "BUDDIES_ONLY">("PUBLIC");
  const [isAwayMessage, setIsAwayMessage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Electron Cmd+Shift+N / Cmd+N → focus the composer
  useEffect(() => {
    const handler = () => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("electron:focus-composer", handler);
    return () => window.removeEventListener("electron:focus-composer", handler);
  }, []);

  if (!session?.user) return null;

  const MAX = isAwayMessage ? 140 : 512;
  const remaining = MAX - content.length;
  const colorKey = session.user.avatarColor ?? "amber";
  const colors = AVATAR_COLORS[colorKey] ?? AVATAR_COLORS.amber;

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, privacy, isAwayMessage }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "failed to post.");
        return;
      }
      onPost(await res.json());
      setContent("");
      setIsAwayMessage(false);
      textareaRef.current?.focus();
    } catch {
      setError("network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleSubmit();
    }
  };

  return (
    <div
      className="border-b"
      style={{ borderColor: "#1a1a14", background: "#0a0a08" }}
    >
      <div className="p-3">
        <div className="flex gap-2.5">
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
            style={{ background: colors.bg }}
          >
            <span
              className="text-[11px] font-bold font-mono"
              style={{ color: colors.text }}
            >
              {getInitials(session.user.screenname)}
            </span>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              const val = e.target.value;
              if (val.length <= MAX) setContent(val);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isAwayMessage
                ? "set your away message... (140)"
                : "what's on your mind? (⌘↵ to post)"
            }
            rows={3}
            className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed placeholder-[#2a2a20]"
            style={{
              color: isAwayMessage ? "#f59e0b" : "#d1d5db",
              fontFamily: "var(--font-dm-sans)",
            }}
          />
        </div>

        {/* Toolbar */}
        <div
          className="flex items-center justify-between mt-2 pt-2 border-t"
          style={{ borderColor: "#1a1a14" }}
        >
          {/* Left — char counter */}
          <span
            className="text-[11px] font-mono tabular-nums"
            style={{
              color:
                remaining <= 20
                  ? "#ef4444"
                  : remaining <= 60
                  ? "#f59e0b"
                  : "#3a3a2a",
            }}
          >
            {remaining}
          </span>

          {/* Right — controls */}
          <div className="flex items-center gap-1">
            {/* Away message toggle */}
            <button
              type="button"
              onClick={() => {
                setIsAwayMessage((v) => !v);
                if (content.length > 140) setContent(content.slice(0, 140));
              }}
              title="Away message"
              className="h-[34px] px-2.5 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: isAwayMessage ? "rgba(245,158,11,0.15)" : "transparent",
                color: isAwayMessage ? "#f59e0b" : "#3a3a2a",
                border: isAwayMessage ? "1px solid rgba(245,158,11,0.4)" : "1px solid transparent",
              }}
            >
              away
            </button>

            {/* Privacy toggle */}
            <button
              type="button"
              onClick={() =>
                setPrivacy((v) =>
                  v === "PUBLIC" ? "BUDDIES_ONLY" : "PUBLIC"
                )
              }
              title={privacy === "PUBLIC" ? "Visible to everyone" : "Buddies only"}
              className="h-[34px] px-2.5 rounded-lg text-xs font-mono transition-colors"
              style={{
                background:
                  privacy === "BUDDIES_ONLY"
                    ? "rgba(139,92,246,0.15)"
                    : "transparent",
                color:
                  privacy === "BUDDIES_ONLY" ? "#a78bfa" : "#3a3a2a",
                border:
                  privacy === "BUDDIES_ONLY"
                    ? "1px solid rgba(139,92,246,0.4)"
                    : "1px solid transparent",
              }}
            >
              {privacy === "PUBLIC" ? "public" : "buddies"}
            </button>

            {/* Send */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!content.trim() || submitting}
              className="h-[34px] px-3.5 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-30"
              style={{
                background: submitting ? "#92400e" : "#c8860a",
                color: "#fff8e6",
              }}
            >
              {submitting ? "posting…" : "post"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-1.5 text-[11px] font-mono" style={{ color: "#ef4444" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
