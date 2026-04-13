"use client";

// ---------------------------------------------------------------------------
// TagFilterBar — horizontal scrolling filter pill row
// ---------------------------------------------------------------------------

interface TagCount {
  tag:   string;
  count: number;
}

interface TagFilterBarProps {
  activeTag:    string | null;
  tags:         TagCount[];
  onTagSelect:  (tag: string | null) => void;
}

// Static type filter definitions
const TYPE_PILLS = [
  { value: "all",     label: "All" },
  { value: "away",    label: "✦ Away" },
  { value: "thought", label: "✍ Thoughts" },
  { value: "quote",   label: "❝ Quotes" },
  { value: "photo",   label: "📷 Photos" },
] as const;

export function TagFilterBar({ activeTag, tags, onTagSelect }: TagFilterBarProps) {
  const active = activeTag ?? "all";

  const pillStyle = (isActive: boolean): React.CSSProperties => ({
    display:        "inline-flex",
    alignItems:     "center",
    gap:            4,
    height:         "var(--tag-pill-h)",
    padding:        "0 11px",
    borderRadius:   "var(--rp)",
    border:         isActive ? "1px solid rgba(232,150,26,.35)" : "1px solid var(--edge1)",
    background:     isActive ? "var(--ambg)" : "var(--fog1)",
    color:          isActive ? "var(--amber)" : "var(--snow4)",
    fontSize:       "var(--tag-pill-text)",
    fontWeight:     600,
    fontFamily:     "var(--sans)",
    whiteSpace:     "nowrap",
    flexShrink:     0,
    cursor:         "pointer",
    transition:     "background 0.15s, border-color 0.15s, color 0.15s",
    userSelect:     "none",
  });

  const badgeStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize:     9,
    fontWeight:   700,
    background:   isActive ? "rgba(232,150,26,.2)" : "var(--fog2)",
    color:        isActive ? "var(--amber)" : "var(--snow4)",
    borderRadius: "var(--rp)",
    padding:      "1px 5px",
    marginLeft:   2,
    fontFamily:   "var(--sans)",
  });

  return (
    <div style={{
      display:         "flex",
      gap:             7,
      overflowX:       "auto",
      scrollbarWidth:  "none",
      padding:         "10px 0",
      WebkitOverflowScrolling: "touch",
    } as React.CSSProperties}>

      {/* Static type pills */}
      {TYPE_PILLS.map(({ value, label }) => {
        const isActive = active === value;
        const count = value === "all"
          ? undefined
          : tags.reduce((s, t) => s + t.count, 0) || undefined;

        return (
          <button
            key={value}
            onClick={() => onTagSelect(value === "all" ? null : value)}
            style={pillStyle(isActive)}
          >
            {label}
            {count !== undefined && (
              <span style={badgeStyle(isActive)}>{count}</span>
            )}
          </button>
        );
      })}

      {/* Dynamic hashtag pills, sorted by count descending */}
      {[...tags].sort((a, b) => b.count - a.count).map(({ tag, count }) => {
        const isActive = active === tag;
        return (
          <button
            key={tag}
            onClick={() => onTagSelect(tag)}
            style={pillStyle(isActive)}
          >
            #{tag}
            <span style={badgeStyle(isActive)}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
