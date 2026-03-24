import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div
      style={{
        paddingTop: 52,
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "52px 24px 24px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        {/* 404 in VT323 */}
        <div
          className="font-vt323"
          style={{
            fontSize: 96,
            color: "var(--amber)",
            lineHeight: 1,
            marginBottom: 4,
            opacity: 0.25,
            letterSpacing: "0.05em",
          }}
        >
          404
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-dm-serif, Georgia, serif)",
            fontSize: "clamp(22px, 4vw, 32px)",
            color: "var(--text)",
            margin: "0 0 12px",
          }}
        >
          this page signed off.
        </h1>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 14,
            color: "var(--text-muted)",
            lineHeight: 1.65,
            marginBottom: 32,
          }}
        >
          it may have moved, been deleted, or never existed.
          <br />
          check the address and try again.
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/feed"
            style={{
              background: "var(--amber)",
              color: "#000",
              borderRadius: 7,
              padding: "10px 24px",
              fontSize: 13,
              fontFamily: "var(--font-ibm-plex-mono)",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            back to feed
          </Link>
          <Link
            href="/"
            style={{
              background: "transparent",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              borderRadius: 7,
              padding: "10px 24px",
              fontSize: 13,
              fontFamily: "var(--font-ibm-plex-mono)",
              textDecoration: "none",
            }}
          >
            home
          </Link>
        </div>
      </div>
    </div>
  );
}
