"use client";

import { useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostType   = "AWAY" | "THOUGHT" | "QUOTE" | "PHOTO";
export type Visibility = "EVERYONE" | "BUDDIES" | "PRIVATE";

export interface PostData {
  postType:      PostType;
  awayMessage?:  string;
  bodyText?:     string;
  quoteText?:    string;
  quoteAttrib?:  string;
  imageUrl?:     string;
  imageCaption?: string;
  tags?:         string[];
  visibility:    Visibility;
}

interface PostComposerProps {
  isOpen:       boolean;
  onClose:      () => void;
  onPost:       (post: PostData) => void;
  mobile?:      boolean;
  defaultType?: PostType;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AWAY_EXAMPLES = [
  "out. back when i'm back.",
  "offline and enjoying it",
  "somewhere without wifi, hopefully",
  "reading an actual book",
  "at the record store, do not disturb",
] as const;

const TYPE_PILLS: { value: PostType; label: string }[] = [
  { value: "AWAY",    label: "✦ Away"    },
  { value: "THOUGHT", label: "✍ Thought" },
  { value: "QUOTE",   label: "❝ Quote"   },
  { value: "PHOTO",   label: "📷 Photo"  },
];

const VIS_PILLS: { value: Visibility; label: string }[] = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "BUDDIES",  label: "Buddies"  },
  { value: "PRIVATE",  label: "Private"  },
];

const POST_LABELS: Record<PostType, string> = {
  AWAY:    "Set away →",
  THOUGHT: "Post thought",
  QUOTE:   "Post quote",
  PHOTO:   "Post photo",
};

// ---------------------------------------------------------------------------
// Tag parser
// ---------------------------------------------------------------------------

function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, "").toLowerCase().trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// PostComposer
// ---------------------------------------------------------------------------

export function PostComposer({
  isOpen, onClose, onPost, mobile = false, defaultType = "AWAY",
}: PostComposerProps) {
  const [type,        setType]        = useState<PostType>(defaultType);
  const [awayText,    setAwayText]    = useState("");
  const [bodyText,    setBodyText]    = useState("");
  const [quoteText,   setQuoteText]   = useState("");
  const [quoteAttrib, setQuoteAttrib] = useState("");
  const [imageUrl,    setImageUrl]    = useState<string | null>(null);
  const [caption,     setCaption]     = useState("");
  const [tagsRaw,     setTagsRaw]     = useState("");
  const [visibility,  setVisibility]  = useState<Visibility>("EVERYONE");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("postMedia", {
    onClientUploadComplete: (files) => {
      if (files[0]?.url) setImageUrl(files[0].url);
    },
    onUploadError: () => {/* swallow — parent can handle via onPost failure */},
  });

  if (!isOpen) return null;

  // ── Validation ────────────────────────────────────────────────
  function canPost(): boolean {
    switch (type) {
      case "AWAY":    return awayText.trim().length > 0 && awayText.length <= 140;
      case "THOUGHT": return bodyText.trim().length > 0;
      case "QUOTE":   return quoteText.trim().length > 0;
      case "PHOTO":   return imageUrl !== null;
    }
  }

  // ── Submit ────────────────────────────────────────────────────
  function handlePost() {
    if (!canPost()) return;
    const tags = parseTags(tagsRaw);
    const data: PostData = { postType: type, visibility, tags };

    switch (type) {
      case "AWAY":    data.awayMessage = awayText.trim();            break;
      case "THOUGHT": data.bodyText    = bodyText.trim();            break;
      case "QUOTE":
        data.quoteText   = quoteText.trim();
        data.quoteAttrib = quoteAttrib.trim() || undefined;
        break;
      case "PHOTO":
        data.imageUrl    = imageUrl!;
        data.imageCaption = caption.trim() || undefined;
        break;
    }

    onPost(data);
    // Reset state
    setAwayText(""); setBodyText(""); setQuoteText(""); setQuoteAttrib("");
    setImageUrl(null); setCaption(""); setTagsRaw("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) startUpload(files);
    e.target.value = "";
  }

  // ── Shared styles ─────────────────────────────────────────────
  const panel: React.CSSProperties = {
    background: "var(--ink2)",
    border:     "1px solid var(--edge1)",
    borderRadius: mobile ? "24px 24px 0 0" : "var(--r3)",
    overflow:   "hidden",
    display:    "flex",
    flexDirection: "column",
    maxHeight:  mobile ? "92dvh" : "85dvh",
    width:      mobile ? "100%" : 540,
    maxWidth:   mobile ? "100%" : "calc(100vw - 2rem)",
  };

  const inputBase: React.CSSProperties = {
    width:      "100%",
    background: "transparent",
    border:     "none",
    outline:    "none",
    resize:     "none",
    color:      "var(--snow)",
    fontFamily: "var(--serif)",
    caretColor: "var(--amber)",
  };

  // ── Type switcher ─────────────────────────────────────────────
  const TypeSwitcher = (
    <div style={{
      display: "flex", gap: 6,
      padding: "14px 20px",
      borderBottom: "1px solid var(--edge1)",
    }}>
      {TYPE_PILLS.map(({ value, label }) => {
        const active = type === value;
        return (
          <button
            key={value}
            onClick={() => setType(value)}
            style={{
              padding: "5px 12px", borderRadius: "var(--rp)",
              border: active ? "1px solid rgba(232,150,26,.35)" : "1px solid var(--edge1)",
              background: active ? "var(--ambg)" : "transparent",
              color: active ? "var(--amber)" : "var(--snow4)",
              fontSize: 11, fontWeight: 600, fontFamily: "var(--sans)",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  // ── AWAY editor ───────────────────────────────────────────────
  const AwayEditor = (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ padding: "20px 22px 0" }}>
        <textarea
          rows={3}
          value={awayText}
          onChange={(e) => setAwayText(e.target.value)}
          placeholder="what are you up to right now?"
          maxLength={140}
          style={{
            ...inputBase,
            fontSize: 28, fontStyle: "italic",
            color: "var(--amber)",
            caretColor: "var(--amber)",
            lineHeight: 1.35,
          }}
        />
      </div>

      {/* Example messages */}
      <div style={{ marginTop: 6 }}>
        {AWAY_EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => { setAwayText(ex); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "9px 22px",
              borderTop: "1px solid var(--edge1)",
              background: "transparent", border: "none",
              borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "var(--edge1)",
              cursor: "pointer",
              fontFamily: "var(--serif)", fontSize: 13, fontStyle: "italic",
              color: "var(--snow4)",
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );

  // ── THOUGHT editor ────────────────────────────────────────────
  const ThoughtEditor = (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
      <textarea
        rows={7}
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder="What's on your mind? Write as much as you like."
        style={{
          ...inputBase,
          fontSize: 18, lineHeight: 1.6,
          minHeight: 160,
        }}
      />
      <div style={{ borderTop: "1px solid var(--edge1)", paddingTop: 12, marginTop: 4 }}>
        <input
          type="text"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="#add tags to help people find this"
          style={{
            ...inputBase,
            fontSize: 13,
            color: "var(--amber)",
          }}
        />
      </div>
    </div>
  );

  // ── QUOTE editor ──────────────────────────────────────────────
  const QuoteEditor = (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
      {/* Decorative mark */}
      <div style={{
        fontFamily: "var(--serif)", fontSize: 72,
        color: "rgba(167,139,250,.2)", lineHeight: 0.7,
        marginBottom: 8, userSelect: "none",
      }}>"</div>

      <textarea
        rows={4}
        value={quoteText}
        onChange={(e) => setQuoteText(e.target.value)}
        placeholder="The quote that stopped you..."
        style={{
          ...inputBase,
          fontSize: 20, fontStyle: "italic",
          borderLeft: "3px solid var(--lav)",
          paddingLeft: 14,
          lineHeight: 1.5,
          minHeight: 80,
        }}
      />

      <div style={{ borderTop: "1px solid var(--edge1)", paddingTop: 14, marginTop: 12 }}>
        <input
          type="text"
          value={quoteAttrib}
          onChange={(e) => setQuoteAttrib(e.target.value)}
          placeholder="— Who said it (optional)"
          style={{
            ...inputBase,
            fontSize: 14,
            color: "var(--snow3)",
          }}
        />
      </div>
    </div>
  );

  // ── PHOTO editor ──────────────────────────────────────────────
  const PhotoEditor = (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {imageUrl ? (
        /* Preview */
        <div style={{ position: "relative", marginBottom: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Upload preview"
            style={{ width: "100%", borderRadius: "var(--r)", maxHeight: 320, objectFit: "cover" }}
          />
          <button
            onClick={() => setImageUrl(null)}
            style={{
              position: "absolute", top: 8, right: 8,
              width: 26, height: 26, borderRadius: "50%",
              background: "rgba(0,0,0,.6)", border: "none",
              color: "#fff", fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>
      ) : (
        /* Upload zone */
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          style={{
            border: "2px dashed var(--edge2)",
            borderRadius: "var(--r2)",
            minHeight: 160,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 8, cursor: "pointer",
            opacity: isUploading ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: 40 }}>📷</span>
          <span style={{ fontSize: 15, color: "var(--snow2)", fontFamily: "var(--sans)", fontWeight: 500 }}>
            {isUploading ? "Uploading…" : "Tap to add a photo"}
          </span>
          <span style={{ fontSize: 12, color: "var(--snow4)", fontFamily: "var(--sans)" }}>
            JPG, PNG, GIF · up to 10MB
          </span>
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--edge1)", paddingTop: 12, marginTop: 4 }}>
        <textarea
          rows={2}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption… (optional)"
          style={{ ...inputBase, fontSize: 14, lineHeight: 1.5 }}
        />
      </div>
    </div>
  );

  // ── Footer ────────────────────────────────────────────────────
  const remaining = 140 - awayText.length;

  const Footer = (
    <div style={{
      borderTop: "1px solid var(--edge1)",
      padding: "12px 20px",
      display: "flex", alignItems: "center", gap: 10,
      flexWrap: "wrap",
    }}>
      {/* Visibility */}
      <div style={{ display: "flex", gap: 5 }}>
        {VIS_PILLS.map(({ value, label }) => {
          const active = visibility === value;
          return (
            <button
              key={value}
              onClick={() => setVisibility(value)}
              style={{
                padding: "4px 10px", borderRadius: "var(--rp)",
                border: active ? "1px solid rgba(232,150,26,.35)" : "1px solid var(--edge1)",
                background: active ? "var(--ambg2)" : "transparent",
                color: active ? "var(--amber)" : "var(--snow4)",
                fontSize: 10, fontWeight: 600, fontFamily: "var(--sans)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Char count (AWAY only) */}
      {type === "AWAY" && (
        <span style={{
          fontSize: 11, fontFamily: "var(--sans)", fontWeight: 600,
          color: remaining < 20 ? "var(--amber)" : "var(--snow4)",
        }}>
          {remaining}
        </span>
      )}

      {/* Post button */}
      <button
        onClick={handlePost}
        disabled={!canPost() || isUploading}
        style={{
          padding: "7px 16px", borderRadius: "var(--rp)",
          background: canPost() && !isUploading ? "var(--amber)" : "var(--snow5)",
          border: "none",
          color: canPost() && !isUploading ? "#fff" : "var(--snow4)",
          fontSize: 12, fontWeight: 700, fontFamily: "var(--sans)",
          cursor: canPost() && !isUploading ? "pointer" : "default",
          transition: "background 0.15s",
        }}
      >
        {POST_LABELS[type]}
      </button>
    </div>
  );

  // ── Shell: mobile bottom sheet vs desktop modal ───────────────
  const content = (
    <div style={panel}>
      {TypeSwitcher}
      {type === "AWAY"    && AwayEditor}
      {type === "THOUGHT" && ThoughtEditor}
      {type === "QUOTE"   && QuoteEditor}
      {type === "PHOTO"   && PhotoEditor}
      {Footer}
    </div>
  );

  if (mobile) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
        {/* Backdrop */}
        <div
          style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)" }}
          onClick={onClose}
        />
        {/* Bottom sheet */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          zIndex: 1,
        }}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 1rem",
    }}>
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)" }}
        onClick={onClose}
      />
      {/* Modal */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {content}
      </div>
    </div>
  );
}
