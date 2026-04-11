"use client";

import { useState } from "react";
import {
  CURRENTLY_KEYS,
  CURRENTLY_META,
  CURRENTLY_MAX_CHARS,
  type CurrentlyData,
} from "@/lib/currently";

interface CurrentlyEditorProps {
  initial: CurrentlyData;
  onSave: (data: CurrentlyData) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function CurrentlyEditor({
  initial,
  onSave,
  onCancel,
  saving = false,
}: CurrentlyEditorProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const k of CURRENTLY_KEYS) init[k] = initial[k] ?? "";
    return init;
  });

  const set = (k: string, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v.slice(0, CURRENTLY_MAX_CHARS) }));

  const handleSave = () => {
    const data: CurrentlyData = {};
    for (const k of CURRENTLY_KEYS) {
      const v = values[k].trim();
      if (v) data[k] = v;
    }
    onSave(data);
  };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Heading */}
      <div
        className="px-3 pt-3 pb-2 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="text-[9px] uppercase tracking-widest font-mono"
          style={{ color: "var(--text-dim)" }}
        >
          currently
        </span>
      </div>

      {/* Fields */}
      <div className="px-3 py-2 space-y-1">
        {CURRENTLY_KEYS.map((k) => {
          const meta = CURRENTLY_META[k];
          const val = values[k];
          const over40 = val.length > 40;
          return (
            <div key={k} className="flex items-center gap-2">
              <span style={{ fontSize: 16, width: 20, textAlign: "center", flexShrink: 0 }}>
                {meta.emoji}
              </span>
              <input
                type="text"
                value={val}
                onChange={(e) => set(k, e.target.value)}
                placeholder={meta.placeholder}
                maxLength={CURRENTLY_MAX_CHARS}
                className="flex-1 bg-transparent outline-none text-[13px]"
                style={{
                  color: "var(--text)",
                  fontFamily: "var(--font-dm-sans)",
                  border: "none",
                }}
              />
              {over40 && (
                <span
                  className="text-[9px] font-mono flex-shrink-0 tabular-nums"
                  style={{ color: val.length >= CURRENTLY_MAX_CHARS ? "#ef4444" : "var(--text-dim)" }}
                >
                  {CURRENTLY_MAX_CHARS - val.length}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 px-3 py-2 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-mono px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
          style={{ background: "var(--amber)", color: "#fff8e6" }}
        >
          {saving ? "saving…" : "save"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs font-mono px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          cancel
        </button>
      </div>
    </div>
  );
}
