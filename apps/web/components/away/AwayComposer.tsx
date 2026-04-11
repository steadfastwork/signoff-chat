"use client";

import { useState } from "react";
import { CURRENTLY_KEYS, CURRENTLY_META, CURRENTLY_MAX_CHARS, type CurrentlyData } from "@/lib/currently";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Visibility = "PUBLIC" | "BUDDIES" | "PRIVATE";

interface AwayComposerProps {
  initialMessage?: string;
  initialCurrently?: CurrentlyData;
  initialVisibility?: Visibility;
  onSave(msg: string, currently: CurrentlyData, visibility: Visibility): Promise<void>;
  onCancel?(): void;
  compact?: boolean;
}

const VISIBILITY_LABELS: Record<Visibility, { label: string; hint: string }> = {
  PUBLIC:  { label: "everyone",     hint: "anyone on signoffchat can see this" },
  BUDDIES: { label: "buddies only", hint: "only your accepted buddies see this" },
  PRIVATE: { label: "private",      hint: "only you see this · still sets your status to away" },
};

const AWAY_MAX = 140;

// ---------------------------------------------------------------------------
// AwayComposer
// ---------------------------------------------------------------------------

export function AwayComposer({
  initialMessage = "",
  initialCurrently = {},
  initialVisibility = "PUBLIC",
  onSave,
  onCancel,
  compact = false,
}: AwayComposerProps) {
  const [message, setMessage] = useState(initialMessage);
  const [currently, setCurrently] = useState<CurrentlyData>(() => {
    const base: CurrentlyData = {};
    for (const k of CURRENTLY_KEYS) {
      base[k] = initialCurrently[k] ?? "";
    }
    return base;
  });
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!message.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(message.trim(), currently, visibility);
    } finally {
      setSaving(false);
    }
  };

  if (compact) {
    // Sidebar compact mode — just message + visibility dropdown + save
    return (
      <div className="space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, AWAY_MAX))}
          placeholder={"what are you up to?"}
          rows={2}
          className="w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none italic"
          style={{
            background: "#111109",
            borderColor: "#1e1e14",
            color: "#d1d5db",
            fontFamily: "var(--font-dm-sans)",
            fontSize: 13,
          }}
          onFocus={(e) => (e.target.style.borderColor = "#c8860a44")}
          onBlur={(e) => (e.target.style.borderColor = "#1e1e14")}
        />
        <div className="flex items-center gap-2">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
            className="flex-1 h-8 rounded-lg border text-xs font-mono outline-none px-2"
            style={{
              background: "#111109",
              borderColor: "#1e1e14",
              color: "#6b7280",
            }}
          >
            <option value="PUBLIC">everyone</option>
            <option value="BUDDIES">buddies only</option>
            <option value="PRIVATE">private</option>
          </select>
          <button
            onClick={handleSave}
            disabled={!message.trim() || saving}
            className="h-8 px-4 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-40"
            style={{ background: "#c8860a", color: "#fff8e6" }}
          >
            {saving ? "…" : "set"}
          </button>
        </div>
      </div>
    );
  }

  // Full mode
  return (
    <div className="space-y-4">
      {/* Main textarea */}
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, AWAY_MAX))}
          placeholder={"what are you up to?\nwhere are you going?\nwhat does right now feel like?\nsomething's better than nothing."}
          rows={4}
          autoFocus
          className="w-full rounded-xl border px-4 py-3 resize-none outline-none italic"
          style={{
            background: "transparent",
            borderColor: "#1e1e14",
            color: "var(--text)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: 18,
            lineHeight: 1.55,
          }}
          onFocus={(e) => (e.target.style.borderColor = "#c8860a44")}
          onBlur={(e) => (e.target.style.borderColor = "#1e1e14")}
        />
        {message.length >= 100 && (
          <span
            className="absolute bottom-3 right-3 text-[10px] font-mono tabular-nums pointer-events-none"
            style={{ color: message.length >= 130 ? "#f59e0b" : "#3a3a2a" }}
          >
            {AWAY_MAX - message.length}
          </span>
        )}
      </div>

      {/* Currently fields */}
      <div className="space-y-1.5">
        {CURRENTLY_KEYS.map((key) => {
          const meta = CURRENTLY_META[key];
          const val = currently[key] ?? "";
          return (
            <div key={key} className="flex items-center gap-2.5">
              <span className="text-sm w-5 text-center flex-shrink-0">{meta.emoji}</span>
              <div className="relative flex-1">
                <input
                  value={val}
                  onChange={(e) =>
                    setCurrently((prev) => ({
                      ...prev,
                      [key]: e.target.value.slice(0, CURRENTLY_MAX_CHARS),
                    }))
                  }
                  placeholder={meta.placeholder}
                  className="w-full py-1.5 border-b text-sm outline-none bg-transparent pr-8"
                  style={{
                    borderColor: "#1e1e14",
                    color: "#d1d5db",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#c8860a44")}
                  onBlur={(e) => (e.target.style.borderColor = "#1e1e14")}
                />
                {val.length > 40 && (
                  <span
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-mono tabular-nums pointer-events-none"
                    style={{ color: val.length >= CURRENTLY_MAX_CHARS ? "#f59e0b" : "#3a3a2a" }}
                  >
                    {CURRENTLY_MAX_CHARS - val.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visibility selector */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          {(["PUBLIC", "BUDDIES", "PRIVATE"] as Visibility[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className="h-7 px-3 rounded-full text-[11px] font-mono transition-all"
              style={{
                background: visibility === v ? "#c8860a22" : "transparent",
                color: visibility === v ? "#c8860a" : "var(--text-dim)",
                border: `1px solid ${visibility === v ? "#c8860a33" : "var(--border)"}`,
              }}
            >
              {VISIBILITY_LABELS[v].label}
            </button>
          ))}
        </div>
        <p
          className="text-[10px] font-mono"
          style={{ color: "var(--text-dim)" }}
        >
          {VISIBILITY_LABELS[visibility].hint}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-xs font-mono"
              style={{ color: "var(--text-dim)" }}
            >
              cancel
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!message.trim() || saving}
          className="h-9 px-5 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-40"
          style={{ background: "#c8860a", color: "#fff8e6" }}
        >
          {saving ? "setting…" : "set away message"}
        </button>
      </div>
    </div>
  );
}
