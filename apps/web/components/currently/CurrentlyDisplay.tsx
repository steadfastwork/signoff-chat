"use client";

import {
  CURRENTLY_KEYS,
  CURRENTLY_META,
  filledFields,
  hasCurrently,
  type CurrentlyData,
} from "@/lib/currently";

// ---------------------------------------------------------------------------
// Compact pill — used in sidebar, away cards, member lists
// ---------------------------------------------------------------------------

function Pill({ emoji, value }: { emoji: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 rounded-full flex-shrink-0"
      style={{
        height: 20,
        fontSize: 10,
        color: "var(--text-dim)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        whiteSpace: "nowrap",
        maxWidth: 140,
      }}
    >
      <span style={{ fontSize: 10 }}>{emoji}</span>
      <span
        className="truncate"
        style={{ maxWidth: 110, color: "var(--text-muted)" }}
      >
        {value}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Full grid cell — used on profile pages
// ---------------------------------------------------------------------------

function FullCell({
  currentlyKey,
  value,
  editable,
  onEdit,
}: {
  currentlyKey: (typeof CURRENTLY_KEYS)[number];
  value: string | undefined;
  editable: boolean;
  onEdit?: () => void;
}) {
  const meta = CURRENTLY_META[currentlyKey];
  const isEmpty = !value;

  if (isEmpty && !editable) return null;

  return (
    <div
      className="rounded-lg p-[9px_10px] flex flex-col gap-1"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        cursor: editable ? "pointer" : "default",
        minHeight: 56,
      }}
      onClick={editable ? onEdit : undefined}
    >
      <span
        className="uppercase tracking-wider"
        style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--font-dm-sans)" }}
      >
        {meta.label}
      </span>
      {value ? (
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 15 }}>{meta.emoji}</span>
          <span
            className="leading-snug"
            style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
          >
            {value}
          </span>
        </div>
      ) : (
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-dm-sans)" }}>
          + add
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CurrentlyDisplayProps {
  currently: CurrentlyData;
  size: "compact" | "full";
  maxCompact?: number;
  editable?: boolean;
  onEdit?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CurrentlyDisplay({
  currently,
  size,
  maxCompact = 3,
  editable = false,
  onEdit,
}: CurrentlyDisplayProps) {
  if (!hasCurrently(currently) && !editable) return null;

  // ── compact ──────────────────────────────────────────────────────────────
  if (size === "compact") {
    const filled = filledFields(currently);
    if (filled.length === 0) return null;
    const shown = filled.slice(0, maxCompact);
    const extra = filled.length - shown.length;
    return (
      <div className="flex flex-wrap gap-1 mt-0.5">
        {shown.map(([k, v]) => (
          <Pill key={k} emoji={CURRENTLY_META[k].emoji} value={v} />
        ))}
        {extra > 0 && (
          <span
            className="text-[9px] font-mono self-center"
            style={{ color: "var(--text-dim)" }}
          >
            +{extra}
          </span>
        )}
      </div>
    );
  }

  // ── full grid ─────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-3 gap-2">
      {CURRENTLY_KEYS.map((k) => (
        <FullCell
          key={k}
          currentlyKey={k}
          value={currently[k]}
          editable={editable}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
