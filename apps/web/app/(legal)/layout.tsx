import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        paddingTop: 52, // clear fixed navbar
        background: "var(--bg)",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        {/* Back link */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontFamily: "var(--font-ibm-plex-mono)",
            color: "var(--text-dim)",
            textDecoration: "none",
            marginBottom: 40,
          }}
          onMouseEnter={undefined}
        >
          ← signoff.chat
        </Link>

        {children}
      </div>
    </div>
  );
}
