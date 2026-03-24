"use client";

// ---------------------------------------------------------------------------
// Shared skeleton card — used by Feed, Channel message list, Board post list
// Uses CSS variables so it respects dark/light theme automatically.
// ---------------------------------------------------------------------------

const SHIMMER_CSS = `
  @keyframes skeleton-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  .skeleton-shimmer {
    background: linear-gradient(
      90deg,
      var(--card) 25%,
      var(--border) 50%,
      var(--card) 75%
    );
    background-size: 800px 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }
`;

function SkimBar({ w = "100%", h = 12 }: { w?: string | number; h?: number }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width: w,
        height: h,
        borderRadius: 4,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Feed / post-style skeleton
// ---------------------------------------------------------------------------

export function FeedSkeletonCard() {
  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          {/* Avatar */}
          <div
            className="skeleton-shimmer"
            style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <SkimBar w={120} h={11} />
            <SkimBar w="100%" h={11} />
            <SkimBar w="72%" h={11} />
            {/* Action row */}
            <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
              <SkimBar w={48} h={9} />
              <SkimBar w={48} h={9} />
              <SkimBar w={40} h={9} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Channel message skeleton
// ---------------------------------------------------------------------------

export function MessageSkeletonCard() {
  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        {/* Avatar */}
        <div
          className="skeleton-shimmer"
          style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SkimBar w={80} h={10} />
            <SkimBar w={44} h={8} />
          </div>
          <SkimBar w="85%" h={11} />
          <SkimBar w="55%" h={11} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Board post skeleton
// ---------------------------------------------------------------------------

export function BoardPostSkeletonCard() {
  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 9,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SkimBar w={56} h={9} />
          <SkimBar w={36} h={9} />
        </div>
        <SkimBar w="60%" h={14} />
        <SkimBar w="90%" h={11} />
        <SkimBar w="75%" h={11} />
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          <SkimBar w={44} h={9} />
          <SkimBar w={52} h={9} />
        </div>
      </div>
    </>
  );
}
