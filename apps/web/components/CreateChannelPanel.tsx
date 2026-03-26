"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ChannelType = "PUBLIC" | "INVITE_ONLY" | "SECRET";
type ChannelCategory =
  | "GAMING" | "MUSIC" | "ART" | "TECH" | "SPORTS"
  | "POLITICS" | "HUMOR" | "LIFESTYLE" | "STUDY"
  | "SUPPORT" | "NSFW" | "OTHER";

const CATEGORY_OPTIONS: { value: ChannelCategory; label: string }[] = [
  { value: "GAMING",    label: "gaming" },
  { value: "MUSIC",     label: "music" },
  { value: "ART",       label: "art" },
  { value: "TECH",      label: "tech" },
  { value: "SPORTS",    label: "sports" },
  { value: "POLITICS",  label: "politics" },
  { value: "HUMOR",     label: "humor" },
  { value: "LIFESTYLE", label: "lifestyle" },
  { value: "STUDY",     label: "study" },
  { value: "SUPPORT",   label: "support" },
  { value: "OTHER",     label: "other" },
];

const TYPE_OPTIONS: {
  type: ChannelType;
  label: string;
  badge?: string;
  desc: string;
}[] = [
  {
    type: "PUBLIC",
    label: "Public",
    desc: "Anyone can find and join. Up to 500 members.",
  },
  {
    type: "INVITE_ONLY",
    label: "Invite only",
    badge: "🔒",
    desc: "Visible in search. Joining requires an invite link.",
  },
  {
    type: "SECRET",
    label: "Secret",
    badge: "👁",
    desc: "Hidden from search. Only discoverable via invite.",
  },
];

interface CreateChannelPanelProps {
  onClose: () => void;
}

export function CreateChannelPanel({ onClose }: CreateChannelPanelProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("PUBLIC");
  const [slowMode, setSlowMode] = useState(10);
  const [memberCap, setMemberCap] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ChannelCategory | "">("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (v: string) => {
    // Auto-lowercase, allow only a-z 0-9 and hyphens
    setName(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  const addTag = (raw: string) => {
    const t = raw.toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          slowModeMinutes: slowMode,
          memberCap: type === "PUBLIC" && memberCap !== "" ? Number(memberCap) : undefined,
          description: description.trim() || undefined,
          category: category || undefined,
          tags: tags.length ? tags : undefined,
        }),
      });

      if (!res.ok) {
        setError((await res.json()).error ?? "failed to create channel.");
        return;
      }

      const channel = await res.json();
      onClose();
      router.push(`/channels/${channel.name}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
        >
          Create a channel
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

      {/* Channel name */}
      <div className="space-y-1.5">
        <label
          className="text-xs font-mono"
          style={{ color: "#6b7280" }}
        >
          channel name
        </label>
        <div
          className="flex items-center gap-1 rounded-xl border px-3 h-10"
          style={{ borderColor: "#1e1e14", background: "#111109" }}
        >
          <span className="text-sm font-mono" style={{ color: "#3a3a2a" }}>
            #
          </span>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="my-channel"
            maxLength={32}
            required
            className="flex-1 bg-transparent outline-none text-sm font-mono"
            style={{ color: "#d1d5db" }}
          />
        </div>
        <p className="text-[10px] font-mono" style={{ color: "#2a2a1a" }}>
          lowercase · letters, numbers, hyphens · 3–32 chars
        </p>
      </div>

      {/* Type cards */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          type
        </label>
        <div className="flex flex-col gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => setType(opt.type)}
                className="flex items-start gap-2.5 text-left rounded-xl border px-3 py-2.5 transition-all"
                style={{
                  borderColor: active ? "#c8860a66" : "#1e1e14",
                  background: active ? "rgba(200,134,10,0.06)" : "#111109",
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors"
                  style={{
                    borderColor: active ? "#c8860a" : "#3a3a2a",
                    background: active ? "#c8860a" : "transparent",
                  }}
                />
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: active ? "#c8860a" : "#9ca3af",
                      fontFamily: "var(--font-dm-sans)",
                    }}
                  >
                    {opt.badge && (
                      <span className="mr-1">{opt.badge}</span>
                    )}
                    {opt.label}
                  </p>
                  <p
                    className="text-[11px] font-mono mt-0.5"
                    style={{ color: "#3a3a2a" }}
                  >
                    {opt.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slow mode */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          slow mode
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={slowMode}
            onChange={(e) => setSlowMode(Number(e.target.value))}
            className="flex-1 accent-amber-500"
          />
          <span
            className="w-12 text-right text-sm font-mono tabular-nums"
            style={{ color: "#9ca3af" }}
          >
            {slowMode === 0 ? "off" : `${slowMode}m`}
          </span>
        </div>
        <p className="text-[10px] font-mono" style={{ color: "#2a2a1a" }}>
          0 = off · 10 = recommended · 60 = max
        </p>
      </div>

      {/* Member cap (PUBLIC only) */}
      {type === "PUBLIC" && (
        <div className="space-y-1.5">
          <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
            member cap{" "}
            <span style={{ color: "#2a2a1a" }}>(optional, max 500)</span>
          </label>
          <input
            type="number"
            min={2}
            max={500}
            placeholder="500"
            value={memberCap}
            onChange={(e) =>
              setMemberCap(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full h-10 rounded-xl border px-3 text-sm font-mono outline-none"
            style={{
              borderColor: "#1e1e14",
              background: "#111109",
              color: "#9ca3af",
            }}
          />
        </div>
      )}

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          description{" "}
          <span style={{ color: "#2a2a1a" }}>(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 200))}
          placeholder="what's this channel about?"
          rows={2}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
          style={{
            borderColor: "#1e1e14",
            background: "#111109",
            color: "#9ca3af",
            fontFamily: "var(--font-dm-sans)",
          }}
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          category{" "}
          <span style={{ color: "#2a2a1a" }}>(optional)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((opt) => {
            const active = category === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCategory(active ? "" : opt.value)}
                className="text-[11px] font-mono px-2 py-1 rounded-lg border transition-all"
                style={{
                  borderColor: active ? "#c8860a" : "#1e1e14",
                  background: active ? "rgba(200,134,10,0.1)" : "#111109",
                  color: active ? "#c8860a" : "#4b5563",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          tags{" "}
          <span style={{ color: "#2a2a1a" }}>(optional · up to 5)</span>
        </label>
        <div
          className="flex items-center flex-wrap gap-1.5 rounded-xl border px-3 py-2 min-h-[40px]"
          style={{ borderColor: "#1e1e14", background: "#111109" }}
        >
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border"
              style={{ borderColor: "#2a2a1a", color: "#9ca3af" }}
            >
              {t}
              <button
                type="button"
                onClick={() => setTags(tags.filter((x) => x !== t))}
                className="opacity-50 hover:opacity-100 transition-opacity leading-none"
              >
                ×
              </button>
            </span>
          ))}
          {tags.length < 5 && (
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " " || e.key === ",") && tagInput) {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              onBlur={() => tagInput && addTag(tagInput)}
              placeholder={tags.length === 0 ? "add tags… (enter to add)" : ""}
              className="flex-1 bg-transparent outline-none text-[11px] font-mono min-w-[80px]"
              style={{ color: "#9ca3af" }}
            />
          )}
        </div>
      </div>

      {error && (
        <p className="text-[11px] font-mono" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!name.trim() || name.length < 3 || submitting}
        className="w-full h-10 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-40"
        style={{ background: "#c8860a", color: "#fff8e6" }}
      >
        {submitting ? "creating…" : "create channel"}
      </button>
    </form>
  );
}
