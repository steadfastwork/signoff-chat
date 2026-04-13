"use client";

import { useSession } from "next-auth/react";
import { useRadicalLayout } from "./RadicalLayoutContext";
import { AVATAR_PALETTE } from "./avatarPalette";
import { getInitials } from "@/lib/utils";

// ---------------------------------------------------------------------------
// TopBar — desktop only (hidden via CSS on mobile)
// ---------------------------------------------------------------------------

export function TopBar({ onlineCount = 0 }: { onlineCount?: number }) {
  const { data: session } = useSession();
  const { setComposerOpen, setComposerType } = useRadicalLayout();

  const openAway = () => { setComposerType("AWAY"); setComposerOpen(true); };
  const openNew  = () => { setComposerType("THOUGHT"); setComposerOpen(true); };

  const avatarColor  = session?.user?.avatarColor ?? "amber";
  const { bg, fg }   = AVATAR_PALETTE[avatarColor] ?? AVATAR_PALETTE.amber;
  const screenname   = session?.user?.screenname ?? "";

  return (
    <div
      className="radical-topbar"
      style={{
        height: 52,
        background: "rgba(10,8,6,.92)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--edge1)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 14,
        position: "sticky",
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Left — brand (matches sidebar width) */}
      <div style={{ width: 252, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, color: "var(--amber)" }}>
          Signoff
        </span>
        {onlineCount > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, color: "var(--snow4)", fontFamily: "var(--sans)",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
            {onlineCount.toLocaleString()} online
          </span>
        )}
      </div>

      {/* Center — search */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{
          maxWidth: 420, width: "100%", height: 32,
          background: "var(--fog1)", border: "1px solid var(--edge1)",
          borderRadius: "var(--rp)",
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 12px",
          color: "var(--snow4)",
          cursor: "text",
        }}>
          <span style={{ fontSize: 13 }}>🔍</span>
          <span style={{ flex: 1, fontSize: 12, fontFamily: "var(--sans)", color: "var(--snow4)" }}>
            Search people, posts, tags…
          </span>
          <span style={{ fontSize: 9, color: "var(--snow5)", fontFamily: "var(--sans)" }}>⌘K</span>
        </div>
      </div>

      {/* Right — actions + avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={openAway}
          style={{
            padding: "5px 12px", borderRadius: "var(--rp)",
            border: "1px solid var(--edge1)", background: "transparent",
            color: "var(--snow3)", fontSize: 11, fontWeight: 600,
            fontFamily: "var(--sans)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          ✦ Set away
        </button>

        <button
          onClick={openNew}
          style={{
            padding: "5px 12px", borderRadius: "var(--rp)",
            border: "1px solid rgba(232,150,26,.4)", background: "var(--ambg)",
            color: "var(--amber)", fontSize: 11, fontWeight: 700,
            fontFamily: "var(--sans)", cursor: "pointer",
          }}
        >
          + New post
        </button>

        {/* User avatar */}
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: bg, color: fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, fontFamily: "var(--sans)",
          userSelect: "none", cursor: "pointer", flexShrink: 0,
        }}>
          {getInitials(screenname)}
        </div>
      </div>
    </div>
  );
}
