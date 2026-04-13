"use client";

// ---------------------------------------------------------------------------
// FeedEmptyState — shown when a filtered feed has no results
// ---------------------------------------------------------------------------

interface FeedEmptyStateProps {
  activeTag: string | null;
}

export function FeedEmptyState({ activeTag }: FeedEmptyStateProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "48px 24px",
      textAlign: "center",
    }}>
      <span style={{ fontSize: 36, opacity: 0.35, marginBottom: 14 }}>✦</span>

      <p style={{
        fontFamily:  "var(--serif)",
        fontSize:    16,
        fontStyle:   "italic",
        color:       "var(--snow4)",
        margin:      "0 0 8px",
      }}>
        Nothing here yet
      </p>

      <p style={{
        fontFamily: "var(--sans)",
        fontSize:   12,
        color:      "var(--snow5)",
        margin:     0,
      }}>
        {activeTag
          ? `None of your people have posted with this tag`
          : "No posts to show — add some friends first"}
      </p>
    </div>
  );
}
