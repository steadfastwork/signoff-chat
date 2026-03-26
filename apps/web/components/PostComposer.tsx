"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useUploadThing } from "@/lib/uploadthing";
import { RichTextEditor } from "@/components/RichTextEditor";
import { GiphyPicker, type GifResult } from "@/components/composer/GiphyPicker";
import { MediaAttachments, type PendingMedia } from "@/components/composer/MediaAttachments";
import type { FeedPost } from "./PostCard";

interface PostComposerProps {
  onPost: (post: FeedPost) => void;
}

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

export function PostComposer({ onPost }: PostComposerProps) {
  const { data: session } = useSession();

  const [content, setContent]           = useState("");
  const [privacy, setPrivacy]           = useState<"PUBLIC" | "BUDDIES_ONLY">("PUBLIC");
  const [isAwayMessage, setIsAwayMessage] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Pending media
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [pendingGifs, setPendingGifs]   = useState<GifResult[]>([]);
  const [showGiphy, setShowGiphy]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UploadThing — postMedia endpoint
  const { startUpload, isUploading } = useUploadThing("postMedia", {
    onClientUploadComplete: (res) => {
      const newMedia: PendingMedia[] = res.map((f) => ({
        url: f.url,
        type: f.type?.startsWith("video/") ? "VIDEO" : "IMAGE",
      }));
      setPendingMedia((prev) => [...prev, ...newMedia]);
    },
    onUploadError: (err) => setError(err.message),
  });

  // Electron focus shortcut
  useEffect(() => {
    const handler = () => {
      document.querySelector<HTMLElement>(".rich-editor .ProseMirror")?.focus();
    };
    window.addEventListener("electron:focus-composer", handler);
    return () => window.removeEventListener("electron:focus-composer", handler);
  }, []);

  if (!session?.user) return null;

  const MAX = isAwayMessage ? 140 : 512;
  const colorKey = session.user.avatarColor ?? "amber";
  const colors = AVATAR_COLORS[colorKey] ?? AVATAR_COLORS.amber;
  const hasAttachments = pendingMedia.length > 0 || pendingGifs.length > 0;
  const isDisabled = submitting || isUploading;

  const handleGifSelect = (gif: GifResult) => {
    setPendingGifs((prev) => [...prev, gif]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await startUpload(Array.from(files));
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if ((!content.trim() && !hasAttachments) || isDisabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          privacy,
          isAwayMessage,
          mediaUrls: pendingMedia.map((m) => m.url),
          gifUrls:   pendingGifs.map((g) => g.url),
          gifIds:    pendingGifs.map((g) => g.id),
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "failed to post.");
        return;
      }
      onPost(await res.json());
      setContent("");
      setPendingMedia([]);
      setPendingGifs([]);
    } catch {
      setError("network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeGiphy = useCallback(() => setShowGiphy(false), []);

  return (
    <div
      className="border-b"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      <div className="p-3">
        <div className="flex gap-2.5">
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
            style={{ background: colors.bg }}
          >
            <span className="text-[11px] font-bold font-mono" style={{ color: colors.text }}>
              {getInitials(session.user.screenname)}
            </span>
          </div>

          {/* Editor area */}
          <div
            className="flex-1 rounded-xl border overflow-hidden"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg)",
              color: isAwayMessage ? "var(--away)" : "var(--text)",
            }}
          >
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder={
                isAwayMessage
                  ? "set your away message… (140 chars)"
                  : "what's on your mind? (⌘↵ to post)"
              }
              maxChars={MAX}
              variant="compact"
              onSubmit={handleSubmit}
              disabled={isDisabled}
              onPhotoClick={() => fileInputRef.current?.click()}
              onGifClick={() => setShowGiphy((v) => !v)}
            />
          </div>
        </div>

        {/* Media attachments preview */}
        {hasAttachments && (
          <div className="mt-2">
            <MediaAttachments
              media={pendingMedia}
              gifs={pendingGifs}
              onRemoveMedia={(i) => setPendingMedia((prev) => prev.filter((_, idx) => idx !== i))}
              onRemoveGif={(i) => setPendingGifs((prev) => prev.filter((_, idx) => idx !== i))}
            />
          </div>
        )}

        {/* Giphy picker (relative container for positioning) */}
        {showGiphy && (
          <div className="relative mt-1">
            <GiphyPicker onSelect={handleGifSelect} onClose={closeGiphy} />
          </div>
        )}

        {/* Toolbar */}
        <div
          className="flex items-center justify-between mt-2 pt-2 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Left — media upload */}
          <div className="flex items-center gap-1">
            <label
              className="h-[34px] px-2.5 rounded-lg text-xs font-mono transition-colors cursor-pointer flex items-center gap-1"
              style={{
                background: isUploading ? "rgba(200,134,10,0.12)" : "transparent",
                color: isUploading ? "var(--amber)" : "var(--text-muted)",
                border: "1px solid transparent",
              }}
              title="Attach image or video"
            >
              <span>📎</span>
              <span>{isUploading ? "uploading…" : "photo"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="sr-only"
                onChange={handleFileChange}
                disabled={isDisabled}
              />
            </label>
          </div>

          {/* Right — controls */}
          <div className="flex items-center gap-1">
            {/* Away message toggle */}
            <button
              type="button"
              onClick={() => setIsAwayMessage((v) => !v)}
              title="Away message"
              className="h-[34px] px-2.5 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: isAwayMessage ? "rgba(245,158,11,0.15)" : "transparent",
                color: isAwayMessage ? "var(--away)" : "var(--text-dim)",
                border: isAwayMessage ? "1px solid rgba(245,158,11,0.4)" : "1px solid transparent",
              }}
            >
              away
            </button>

            {/* Privacy toggle */}
            <button
              type="button"
              onClick={() =>
                setPrivacy((v) => v === "PUBLIC" ? "BUDDIES_ONLY" : "PUBLIC")
              }
              title={privacy === "PUBLIC" ? "Visible to everyone" : "Buddies only"}
              className="h-[34px] px-2.5 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: privacy === "BUDDIES_ONLY" ? "rgba(139,92,246,0.15)" : "transparent",
                color: privacy === "BUDDIES_ONLY" ? "#a78bfa" : "var(--text-dim)",
                border: privacy === "BUDDIES_ONLY" ? "1px solid rgba(139,92,246,0.4)" : "1px solid transparent",
              }}
            >
              {privacy === "PUBLIC" ? "public" : "buddies"}
            </button>

            {/* Send */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={(!content.trim() && !hasAttachments) || isDisabled}
              className="h-[34px] px-3.5 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-30"
              style={{ background: isDisabled ? "var(--amber-hover)" : "var(--amber)", color: "#fff8e6" }}
            >
              {submitting ? "posting…" : isUploading ? "uploading…" : "post"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-1.5 text-[11px] font-mono" style={{ color: "var(--error, #ef4444)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
