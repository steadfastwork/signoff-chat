"use client";

// ---------------------------------------------------------------------------
// RadicalFeedPage — stub for the RADICAL_UX feed experience.
// Full implementation (3-column layout, PostComposer, etc.) ships in the
// next phase. This placeholder lets us verify the flag gate works end-to-end.
// ---------------------------------------------------------------------------

export function RadicalFeedPage() {
  return (
    <div className="radical-ux" style={{ minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "64px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 32,
            color: "var(--amber)",
            opacity: 0.35,
            fontFamily: "var(--serif)",
          }}
        >
          ✦
        </span>
        <p
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 20,
            color: "var(--snow)",
            opacity: 0.5,
            margin: 0,
          }}
        >
          radical feed — coming soon
        </p>
        <p
          style={{
            fontFamily: "var(--sans)",
            fontSize: 13,
            color: "var(--snow4)",
            margin: 0,
          }}
        >
          RADICAL_UX is active for your account.
        </p>
      </div>
    </div>
  );
}
