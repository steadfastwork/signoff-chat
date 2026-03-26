"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/activity": "Activity log",
  "/admin/users": "Users",
  "/admin/reports": "Reports",
  "/admin/safety": "Safety incidents",
  "/admin/channels": "Channels",
  "/admin/boards": "Boards",
  "/admin/invites": "Invite links",
  "/admin/flags": "Feature flags",
  "/admin/crons": "Cron jobs",
  "/admin/admins": "Admin access",
};

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "5px 12px",
        borderRadius: 4,
        fontSize: 13,
        fontFamily: "inherit",
        color: active ? "#c8860a" : "#8a7d6e",
        background: active ? "rgba(200,134,10,0.08)" : "transparent",
        textDecoration: "none",
        fontWeight: active ? 600 : 400,
        transition: "color 0.15s, background 0.15s",
      }}
    >
      {label}
    </Link>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          fontFamily: "IBM Plex Mono, monospace",
          letterSpacing: "0.08em",
          color: "#6b6456",
          padding: "0 12px",
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export default function AdminShell({
  adminRole,
  screenname,
  children,
}: {
  adminRole: string;
  screenname: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const currentTitle =
    Object.entries(PAGE_TITLES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => pathname === path || pathname.startsWith(path + "/"))?.[1] ?? "Admin";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0d0d0b" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          minWidth: 220,
          background: "#0a0a09",
          borderRight: "1px solid #1a1916",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          zIndex: 50,
          overflowY: "auto",
        }}
      >
        {/* Brand */}
        <div style={{ padding: "18px 16px 16px" }}>
          <div
            style={{
              fontFamily: "VT323, monospace",
              color: "#c8860a",
              fontSize: 18,
              letterSpacing: "0.12em",
            }}
          >
            SIGNOFF ADMIN
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 4px" }}>
          <NavSection label="Overview">
            <NavLink href="/admin" label="Dashboard" active={pathname === "/admin"} />
            <NavLink href="/admin/activity" label="Activity log" active={pathname.startsWith("/admin/activity")} />
          </NavSection>

          <NavSection label="Users">
            <NavLink href="/admin/users" label="All users" active={pathname === "/admin/users" && !new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("tab")} />
            <NavLink href="/admin/users?tab=suspended" label="Suspended" active={pathname === "/admin/users"} />
            <NavLink href="/admin/users?tab=new" label="New this week" active={false} />
          </NavSection>

          <NavSection label="Moderation">
            <NavLink href="/admin/reports" label="Reports" active={pathname.startsWith("/admin/reports")} />
            <NavLink href="/admin/safety" label="Safety" active={pathname.startsWith("/admin/safety")} />
          </NavSection>

          <NavSection label="Platform">
            <NavLink href="/admin/channels" label="Channels" active={pathname.startsWith("/admin/channels")} />
            <NavLink href="/admin/boards" label="Boards" active={pathname.startsWith("/admin/boards")} />
            <NavLink href="/admin/invites" label="Invites" active={pathname.startsWith("/admin/invites")} />
          </NavSection>

          <NavSection label="System">
            <NavLink href="/admin/flags" label="Feature flags" active={pathname.startsWith("/admin/flags")} />
            <NavLink href="/admin/crons" label="Cron jobs" active={pathname.startsWith("/admin/crons")} />
          </NavSection>

          {adminRole === "SUPER_ADMIN" && (
            <NavSection label="Access">
              <NavLink href="/admin/admins" label="Admin management" active={pathname.startsWith("/admin/admins")} />
            </NavSection>
          )}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #1a1916",
            fontSize: 12,
          }}
        >
          <div style={{ color: "#8a7d6e", marginBottom: 6, fontFamily: "IBM Plex Mono, monospace" }}>
            @{screenname}
          </div>
          <div style={{ marginBottom: 8 }}>
            {adminRole === "SUPER_ADMIN" ? (
              <span
                style={{
                  background: "rgba(200,134,10,0.15)",
                  color: "#c8860a",
                  border: "1px solid rgba(200,134,10,0.4)",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono, monospace",
                  letterSpacing: "0.06em",
                }}
              >
                SUPER ADMIN
              </span>
            ) : (
              <span
                style={{
                  color: "#8a7d6e",
                  border: "1px solid #2a2620",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono, monospace",
                  letterSpacing: "0.06em",
                }}
              >
                ADMIN
              </span>
            )}
          </div>
          <Link
            href="/feed"
            style={{
              color: "#6b6456",
              fontSize: 12,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ← Back to app
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, marginLeft: 220, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <header
          style={{
            height: 52,
            position: "fixed",
            top: 0,
            left: 220,
            right: 0,
            background: "#0d0d0b",
            borderBottom: "1px solid #1a1916",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            zIndex: 40,
          }}
        >
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 13,
              color: "#e8ddd0",
              fontWeight: 600,
            }}
          >
            {currentTitle}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#6b6456", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
              @{screenname}
            </span>
            {adminRole === "SUPER_ADMIN" ? (
              <span
                style={{
                  background: "rgba(200,134,10,0.15)",
                  color: "#c8860a",
                  border: "1px solid rgba(200,134,10,0.4)",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono, monospace",
                }}
              >
                SUPER ADMIN
              </span>
            ) : (
              <span
                style={{
                  color: "#8a7d6e",
                  border: "1px solid #2a2620",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono, monospace",
                }}
              >
                ADMIN
              </span>
            )}
          </div>
        </header>

        {/* Content */}
        <main style={{ paddingTop: 52, minHeight: "calc(100vh - 52px)", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
