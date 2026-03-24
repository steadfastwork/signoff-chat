"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BoardType = "PUBLIC" | "INVITE_ONLY" | "SECRET";

const TYPE_OPTIONS: {
  type: BoardType;
  badge?: string;
  label: string;
  desc: string;
}[] = [
  {
    type: "PUBLIC",
    label: "Public",
    desc: "Anyone can find and join.",
  },
  {
    type: "INVITE_ONLY",
    badge: "🔒",
    label: "Invite only",
    desc: "Findable in search. Joining requires an invite.",
  },
  {
    type: "SECRET",
    badge: "👁",
    label: "Secret",
    desc: "Hidden from search. Invite only.",
  },
];

interface CreateBoardPanelProps {
  onClose: () => void;
}

export function CreateBoardPanel({ onClose }: CreateBoardPanelProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [vibeStatement, setVibeStatement] = useState("");
  const [type, setType] = useState<BoardType>("PUBLIC");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (v: string) => {
    setName(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !displayName.trim() || !vibeStatement.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, displayName, vibeStatement, type }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "failed to create board.");
        return;
      }
      const board = await res.json();
      onClose();
      router.push(`/boards/${board.name}`);
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
          Create a board
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

      {/* Board name (slug) */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          board name
        </label>
        <input
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="analog-photography"
          maxLength={40}
          required
          className="w-full h-10 rounded-xl border px-3 text-sm font-mono outline-none"
          style={{ background: "#111109", borderColor: "#1e1e14", color: "#d1d5db" }}
        />
        <p className="text-[10px] font-mono" style={{ color: "#2a2a1a" }}>
          slug format · lowercase · hyphens · 3–40 chars
        </p>
      </div>

      {/* Display name */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          display name
        </label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Analog Photography"
          maxLength={60}
          required
          className="w-full h-10 rounded-xl border px-3 text-sm outline-none"
          style={{
            background: "#111109",
            borderColor: "#1e1e14",
            color: "#d1d5db",
            fontFamily: "var(--font-dm-sans)",
          }}
        />
      </div>

      {/* Vibe statement */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          vibe statement
        </label>
        <textarea
          value={vibeStatement}
          onChange={(e) => setVibeStatement(e.target.value.slice(0, 200))}
          placeholder={`One or two sentences. Who is this for?\ne.g. "for people who think waiting for film to develop is part of the point."`}
          rows={3}
          required
          className="w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none"
          style={{
            background: "#111109",
            borderColor: "#1e1e14",
            color: "#d1d5db",
            fontFamily: "var(--font-dm-sans)",
          }}
        />
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-mono leading-relaxed" style={{ color: "#2a2a1a" }}>
            This replaces a rules list. Write the vibe and the right people find it.
          </p>
          <span
            className="text-[10px] font-mono flex-shrink-0 tabular-nums"
            style={{
              color: vibeStatement.length > 180 ? "#f59e0b" : "#2a2a1a",
            }}
          >
            {200 - vibeStatement.length}
          </span>
        </div>
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
          visibility
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
                  borderColor: active ? "#2dd4bf44" : "#1e1e14",
                  background: active ? "rgba(45,212,191,0.05)" : "#111109",
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors"
                  style={{
                    borderColor: active ? "#2dd4bf" : "#3a3a2a",
                    background: active ? "#2dd4bf" : "transparent",
                  }}
                />
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: active ? "#2dd4bf" : "#9ca3af",
                      fontFamily: "var(--font-dm-sans)",
                    }}
                  >
                    {opt.badge && <span className="mr-1">{opt.badge}</span>}
                    {opt.label}
                  </p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "#3a3a2a" }}>
                    {opt.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Founding member note */}
      <div
        className="rounded-xl px-3 py-2.5 border"
        style={{ borderColor: "#c8860a22", background: "rgba(200,134,10,0.04)" }}
      >
        <p
          className="text-[11px] font-mono leading-relaxed"
          style={{ color: "#c8860a99" }}
        >
          ✦ the first 50 members get a founding member badge on all their posts
          in this board. creates investment from the start.
        </p>
      </div>

      {error && (
        <p className="text-[11px] font-mono" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!name || name.length < 3 || !displayName.trim() || !vibeStatement.trim() || submitting}
        className="w-full h-10 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-40"
        style={{ background: "#2dd4bf", color: "#0d0d0b" }}
      >
        {submitting ? "creating…" : "create board"}
      </button>
    </form>
  );
}
