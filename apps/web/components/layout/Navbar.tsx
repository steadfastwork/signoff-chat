"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";
import { usePresence } from "@/components/PresenceProvider";
import { Avatar } from "@/components/layout/Avatar";
import { pusherClient } from "@/lib/pusher";
import { EncryptionBadge } from "@/components/EncryptionBadge";

// ---------------------------------------------------------------------------
// Encrypted pill — shows Pusher connection state
// ---------------------------------------------------------------------------

function EncryptedPill() {
  const [connState, setConnState] = useState<string>("connecting");

  useEffect(() => {
    const p = pusherClient;
    setConnState(p.connection.state);

    const onChange = (state: { current: string }) => setConnState(state.current);
    p.connection.bind("state_change", onChange);
    return () => { p.connection.unbind("state_change", onChange); };
  }, []);

  const connected = connState === "connected";

  return (
    <span
      className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border select-none"
      style={
        connected
          ? {
              background: "var(--enc-bg, #0a1f0a)",
              borderColor: "var(--enc-border, #14532d)",
              color: "var(--enc-text, #4ade80)",
            }
          : {
              background: "var(--bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          background: connected ? "#22c55e" : "var(--text-dim)",
          animation: connected ? "status-glow 2s ease-in-out infinite" : undefined,
        }}
      />
      {connected ? "encrypted" : "reconnecting…"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Nav tab
// ---------------------------------------------------------------------------

interface NavTabProps {
  href: string;
  label: string;
  active: boolean;
  accent?: "amber" | "teal";
}

function NavTab({ href, label, active, accent = "amber" }: NavTabProps) {
  const color = accent === "teal" ? "var(--teal)" : "var(--amber)";

  return (
    <Link
      href={href}
      className="relative h-full flex items-center px-3 text-sm font-medium transition-colors"
      style={{
        color: active ? color : "var(--text-muted)",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
          style={{ background: color }}
        />
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { updateStatus } = usePresence();
  const [notifCount, setNotifCount] = useState(0);

  // Load + poll notification count — no Pusher subscription here so we don't
  // conflict with the Sidebar's private-channel subscription.
  useEffect(() => {
    if (status !== "authenticated") return;
    const load = () => {
      fetch("/api/buddies/requests")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setNotifCount(Array.isArray(data) ? data.length : 0))
        .catch(() => {});
    };
    load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(load, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [status]);

  const handleSignOff = async () => {
    await updateStatus("OFFLINE");
    signOut({ callbackUrl: "/login" });
  };

  const isAuthenticated = status === "authenticated" && !!session;

  // Active tab detection
  const feedActive = pathname.startsWith("/feed");
  const channelsActive = pathname.startsWith("/channels");
  const boardsActive = pathname.startsWith("/boards");
  const notifsActive = pathname.startsWith("/notifications");

  return (
    <>
      {/* Enc pill CSS vars by theme */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --enc-bg: #0a1f0a; --enc-border: #14532d; --enc-text: #4ade80; }
        [data-theme="light"] { --enc-bg: #f0fdf4; --enc-border: #bbf7d0; --enc-text: #15803d; }
      ` }} />

      <nav
        className="fixed top-0 left-0 right-0 z-50 h-[52px] border-b"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="h-full flex items-center px-4 gap-1">
          {/* Logo */}
          <Link href="/" className="mr-3 flex-shrink-0">
            <span
              className="font-vt323 tracking-wider select-none"
              style={{ fontSize: 26, color: "var(--amber)", lineHeight: 1 }}
            >
              SIGNOFF.CHAT
            </span>
          </Link>

          {/* Center tabs — only when authenticated */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center h-full gap-1">
              <NavTab href="/feed" label="Feed" active={feedActive} accent="amber" />
              <NavTab href="/channels" label="Channels" active={channelsActive} accent="amber" />
              <NavTab href="/boards" label="Boards" active={boardsActive} accent="teal" />
            </div>
          )}

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <EncryptionBadge />
            <EncryptedPill />

            {/* Notifications bell */}
            {isAuthenticated && (
              <Link
                href="/notifications"
                onClick={() => setNotifCount(0)}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{
                  color: notifsActive ? "var(--amber)" : "var(--text-muted)",
                  background: notifsActive ? "var(--amber-tint)" : "transparent",
                }}
                title="Notifications"
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background = "var(--card)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.background =
                    notifsActive ? "var(--amber-tint)" : "transparent")
                }
              >
                <span className="text-sm">🔔</span>
                {notifCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold px-1"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </Link>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors"
              style={{
                color: "var(--text-muted)",
                background: "transparent",
              }}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "var(--card)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
              }
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {/* Loading */}
            {status === "loading" && (
              <div
                className="w-8 h-8 rounded-lg animate-pulse"
                style={{ background: "var(--border)" }}
              />
            )}

            {/* Authenticated avatar */}
            {isAuthenticated && (
              <Link href={`/u/${session.user.screenname}`}>
                <Avatar
                  screenname={session.user.screenname}
                  size="sm"
                  isGoldMember={session.user.isGoldMember}
                  bg="var(--surface)"
                />
              </Link>
            )}

            {/* Sign off */}
            {isAuthenticated && (
              <button
                onClick={handleSignOff}
                className="hidden md:block text-xs font-mono transition-colors px-2 py-1 rounded"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)")
                }
              >
                sign off
              </button>
            )}

            {/* Unauthenticated */}
            {status === "unauthenticated" && (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-xs font-mono transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  log in
                </Link>
                <Link
                  href="/register"
                  className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: "var(--amber)",
                    color: "#fff8e6",
                    fontWeight: 600,
                  }}
                >
                  sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
