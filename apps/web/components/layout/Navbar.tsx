"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { retro, btnStyle } from "@/components/retro/retro-components";

// Minimal retro top bar for the Online Messenger. The old feed/channels/boards +
// encryption chrome was removed in the strip.
export function Navbar(_props?: { boardsEnabled?: boolean }) {
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && !!session;

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: retro.chrome,
        borderBottom: `1px solid ${retro.border}`,
        fontFamily: retro.fontUI,
      }}
    >
      <Link href="/messenger" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
        <span style={{ fontFamily: retro.fontBrand, fontSize: 16, background: "#4356c0", color: retro.gold, padding: "1px 5px", borderRadius: 2, lineHeight: 1.2 }}>S/C</span>
        <span style={{ fontFamily: retro.fontBrand, fontSize: 22, color: retro.blue, letterSpacing: 1 }}>SIGNOFF.CHAT</span>
      </Link>

      {authed && (
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          <Link href="/messenger" style={{ fontSize: 13, color: retro.inkSoft, textDecoration: "none", padding: "4px 8px" }}>Messenger</Link>
          <Link href="/rooms" style={{ fontSize: 13, color: retro.inkSoft, textDecoration: "none", padding: "4px 8px" }}>Rooms</Link>
        </div>
      )}

      <span style={{ flex: 1 }} />

      {authed && (
        <>
          <span style={{ fontSize: 12, color: retro.inkSoft }}>{session.user.screenname}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ ...btnStyle, height: 30, padding: "0 12px" }}>
            Sign Off
          </button>
        </>
      )}
      {status === "unauthenticated" && (
        <Link href="/login" style={{ color: retro.blue, fontSize: 13, textDecoration: "underline" }}>
          Sign On
        </Link>
      )}
    </nav>
  );
}
