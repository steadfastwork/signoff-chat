"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: Props) {
  const [errorId, setErrorId] = useState<string>("");

  useEffect(() => {
    // Use Next.js server error digest if available, otherwise derive short ID
    if (error.digest) {
      setErrorId(error.digest.slice(0, 10).toUpperCase());
    } else {
      let h = 0;
      const str = error.message + Date.now();
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      }
      setErrorId(Math.abs(h).toString(16).toUpperCase().padStart(8, "0").slice(0, 8));
    }

    // Log to console for debugging — replace with real logger in production
    console.error("[error boundary]", error.digest ?? "", error.message, error);
  }, [error]);

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
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Glitch icon */}
        <div
          className="font-vt323"
          style={{
            fontSize: 72,
            color: "var(--amber)",
            lineHeight: 1,
            marginBottom: 20,
            opacity: 0.7,
          }}
        >
          :‑/
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-dm-serif, Georgia, serif)",
            fontSize: "clamp(24px, 5vw, 36px)",
            color: "var(--text)",
            margin: "0 0 12px",
          }}
        >
          something broke.
        </h1>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 15,
            color: "var(--text-muted)",
            marginBottom: 28,
          }}
        >
          it happens. try refreshing — if it keeps happening, let us know.
        </p>

        {/* Error ID */}
        {errorId && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "6px 12px",
              marginBottom: 28,
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 11,
              color: "var(--text-dim)",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>error id:</span>
            <span
              style={{
                color: "var(--amber)",
                userSelect: "all",
                letterSpacing: "0.1em",
              }}
            >
              {errorId}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{
              background: "var(--amber)",
              color: "#000",
              border: "none",
              borderRadius: 7,
              padding: "10px 24px",
              fontSize: 13,
              fontFamily: "var(--font-ibm-plex-mono)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            try again
          </button>
          <Link
            href="/feed"
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
            back to feed
          </Link>
        </div>

        {/* Report link */}
        <p
          style={{
            marginTop: 28,
            fontFamily: "var(--font-ibm-plex-mono)",
            fontSize: 11,
            color: "var(--text-dim)",
          }}
        >
          persistent?{" "}
          <a
            href={`mailto:bugs@signoffchat.com?subject=Error+${errorId}`}
            style={{ color: "var(--amber)", textDecoration: "none" }}
          >
            report it →
          </a>
        </p>
      </div>
    </div>
  );
}
