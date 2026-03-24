"use client";

import { useSearchParams } from "next/navigation";

// ---------------------------------------------------------------------------
// Suspended page — shown when isSuspended=true
// Minimal. No lengthy explanation. Same dark palette.
// ---------------------------------------------------------------------------

export function SuspendedContent() {
  const params    = useSearchParams();
  const untilStr  = params.get("until");
  const isPermanent = !untilStr;

  let untilDisplay: string | null = null;
  if (untilStr) {
    try {
      untilDisplay = new Date(untilStr).toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      });
    } catch {}
  }

  return (
    <main
      style={{
        minHeight:       "100vh",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        backgroundColor: "#0f0e0c",
        padding:         "24px",
        fontFamily:      "'DM Sans', system-ui, sans-serif",
        color:           "#e8e4d9",
      }}
    >
      <div
        style={{
          maxWidth:        420,
          width:           "100%",
          textAlign:       "center",
          display:         "flex",
          flexDirection:   "column",
          gap:             20,
        }}
      >
        {/* Status indicator */}
        <div
          style={{
            width:        48,
            height:       48,
            borderRadius: 24,
            backgroundColor: "#2c2820",
            border:       "1px solid #3a342c",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            fontSize:     22,
            margin:       "0 auto",
          }}
        >
          ⛔
        </div>

        <h1
          style={{
            fontFamily:  "'VT323', monospace",
            fontSize:    32,
            color:       "#f5c842",
            margin:      0,
            letterSpacing: 1,
          }}
        >
          ACCOUNT SUSPENDED
        </h1>

        <p style={{ color: "#7a7060", fontSize: 15, margin: 0, lineHeight: 1.5 }}>
          {isPermanent
            ? "Your account has been permanently suspended for violating our community guidelines."
            : `Your account is suspended until ${untilDisplay ?? "a future date"}.`}
        </p>

        {!isPermanent && (
          <p style={{ color: "#4a4438", fontSize: 13, margin: 0 }}>
            After this date your account will be automatically restored.
          </p>
        )}

        {/* Contact */}
        <div
          style={{
            borderTop:     "1px solid #2c2820",
            paddingTop:    20,
            marginTop:     4,
          }}
        >
          <p style={{ color: "#7a7060", fontSize: 13, margin: 0 }}>
            If you believe this is an error, contact us at{" "}
            <a
              href="mailto:appeals@signoffchat.com"
              style={{ color: "#f5c842", textDecoration: "none" }}
            >
              appeals@signoffchat.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
