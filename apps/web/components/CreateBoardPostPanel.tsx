"use client";

import { useCallback, useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { RichTextEditor } from "@/components/RichTextEditor";
import { GiphyPicker, type GifResult } from "@/components/composer/GiphyPicker";
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

  // Media state
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO" | "GIF" | null>(null);
  const [showGiphy, setShowGiphy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("channelMedia", {
    onClientUploadComplete: (res) => {
      if (res[0]) {
        const file = res[0];
        setMediaUrl(file.url);
        setMediaType(file.type?.startsWith("video/") ? "VIDEO" : "IMAGE");
      }
    },
    onUploadError: (err) => setError(err.message),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await startUpload([files[0]]);
    e.target.value = "";
  };

  const handleGifSelect = (gif: GifResult) => {
    setMediaUrl(gif.url);
    setMediaType("GIF");
    setShowGiphy(false);
  };

  const closeGiphy = useCallback(() => setShowGiphy(false), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting || isUploading) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardName}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body || undefined,
          tag: tag.trim() || undefined,
          mediaUrl: mediaUrl ?? undefined,
          mediaType: mediaType ?? undefined,
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
          style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
        >
          New post
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-lg leading-none transition-colors"
          style={{ color: "var(--text-dim)" }}
        >
          ×
        </button>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
          title <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 140))}
          placeholder="What's this post about?"
          required
          className="w-full h-10 rounded-xl border px-3 text-sm outline-none bg-transparent"
          style={{ borderColor: "var(--border)", color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
        />
        <div className="flex justify-end">
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: title.length > 120 ? "var(--away)" : "var(--text-dim)" }}
          >
            {140 - title.length}
          </span>
        </div>
      </div>

      {/* Body — rich text */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
          body <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span>
        </label>
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--bg)" }}
        >
          <RichTextEditor
            value={body}
            onChange={setBody}
            placeholder="More context, thoughts, links…"
            maxChars={2000}
            variant="full"
            disabled={submitting}
            onPhotoClick={() => fileInputRef.current?.click()}
            onGifClick={() => setShowGiphy((v) => !v)}
          />
        </div>

        {/* Media preview */}
        {mediaUrl && (
          <div className="relative w-fit mt-1">
            {mediaType === "VIDEO" ? (
              <video src={mediaUrl} controls className="rounded-lg max-h-48 max-w-full" />
            ) : (
              <img src={mediaUrl} alt="attachment" className="rounded-lg max-h-48 max-w-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => { setMediaUrl(null); setMediaType(null); }}
              className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
            >
              ×
            </button>
          </div>
        )}

        {/* Giphy picker */}
        {showGiphy && (
          <div className="mt-1">
            <GiphyPicker onSelect={handleGifSelect} onClose={closeGiphy} />
          </div>
        )}

        {/* Upload status */}
        {isUploading && (
          <p className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
            uploading…
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          onChange={handleFileChange}
          disabled={submitting || isUploading}
        />
      </div>

      {/* Tag */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
          tag <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          value={tag}
          onChange={(e) =>
            setTag(e.target.value.toLowerCase().replace(/\s/g, "-").slice(0, 30))
          }
          placeholder="e.g. film-photography"
          className="w-full h-9 rounded-xl border px-3 text-xs font-mono outline-none bg-transparent"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        />
      </div>

      {error && (
        <p className="text-[11px] font-mono" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!title.trim() || submitting || isUploading}
        className="w-full h-10 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-40"
        style={{ background: "var(--teal)", color: "var(--bg)" }}
      >
        {submitting ? "posting…" : isUploading ? "uploading…" : "post to board"}
      </button>
    </form>
  );
}
