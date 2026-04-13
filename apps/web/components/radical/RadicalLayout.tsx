"use client";

// ---------------------------------------------------------------------------
// RadicalLayout — root of the RADICAL_UX experience.
//
// Uses a JS media query (not pure CSS) to switch between desktop and mobile
// layouts, avoiding hydration mismatches during SSR.
//
// The .radical-ux class scopes all token.css variables to this subtree.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { TopBar } from "./layout/TopBar";
import { Sidebar } from "./layout/Sidebar";
import { MainFeed } from "./layout/MainFeed";
import { ChatOverlay } from "./layout/RightPanel";
import { MobileLayout } from "./layout/MobileLayout";
import { PostComposer } from "./PostComposer";
import { RadicalLayoutProvider, useRadicalLayout } from "./layout/RadicalLayoutContext";
import { AVATAR_PALETTE } from "./layout/avatarPalette";
import { getInitials } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Desktop placeholder screens
// ---------------------------------------------------------------------------

function TalkScreen() {
  const { setActiveBuddy } = useRadicalLayout();
  const [buddies, setBuddies] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/buddies")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const all: any[] = [];
        for (const g of (data.groups ?? [])) {
          for (const b of (g.buddies ?? [])) all.push(b);
        }
        for (const b of (data.ungrouped ?? [])) all.push(b);
        for (const b of (data.offlineBuddies ?? [])) all.push(b);
        setBuddies(all);
      })
      .catch(() => {});
  }, []);

  const filtered = search.trim()
    ? buddies.filter((b) => b.screenname.toLowerCase().includes(search.toLowerCase()))
    : buddies;

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--ink)", overflowY: "auto" }}>
      <div style={{ padding: "20px 24px 12px" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations…"
          style={{
            width: "100%", background: "var(--fog1)", border: "1px solid var(--edge1)",
            borderRadius: "var(--rp)", padding: "9px 16px",
            fontFamily: "var(--sans)", fontSize: 14, color: "var(--snow)", outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        {filtered.map((b: any) => {
          const { bg, fg } = AVATAR_PALETTE[b.avatarColor ?? "amber"] ?? AVATAR_PALETTE.amber;
          return (
            <div
              key={b.userId}
              role="button"
              tabIndex={0}
              onClick={() => setActiveBuddy(b)}
              onKeyDown={(e) => e.key === "Enter" && setActiveBuddy(b)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 24px", cursor: "pointer",
                borderBottom: "1px solid var(--edge1)",
              }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: bg, color: fg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none",
                }}>
                  {getInitials(b.screenname)}
                </div>
                <span style={{
                  position: "absolute", bottom: -1, right: -1,
                  width: 9, height: 9, borderRadius: "50%",
                  background: !b.isOnline ? "var(--snow5)" : b.isAway ? "var(--away)" : "var(--green)",
                  border: "2px solid var(--ink)",
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--snow)", fontFamily: "var(--sans)" }}>
                  {b.screenname}
                  {b.isGold && <span style={{ fontSize: 10, color: "var(--amber)", marginLeft: 5 }}>★</span>}
                </div>
                {b.awayMessage && (
                  <p style={{
                    margin: "2px 0 0", fontSize: 12, fontStyle: "italic",
                    color: "var(--snow4)", fontFamily: "var(--serif)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {b.awayMessage}
                  </p>
                )}
              </div>
              <span style={{
                fontSize: 11, color: !b.isOnline ? "var(--snow5)" : "var(--green)",
                fontFamily: "var(--sans)",
              }}>
                {!b.isOnline ? "offline" : b.isAway ? "away" : "online"}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--snow5)", fontFamily: "var(--sans)" }}>
              {search ? "No results" : "No conversations yet"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelsScreen() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/channels?mine=true")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setChannels(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--ink)", overflowY: "auto" }}>
      <div style={{ padding: "20px 24px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 700, color: "var(--snow)", margin: 0 }}>Channels</h2>
          <p style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--snow5)", margin: "2px 0 0" }}>real-time chatrooms</p>
        </div>
        <a
          href="/channels"
          style={{
            padding: "6px 14px", borderRadius: "var(--rp)",
            background: "var(--ambg)", border: "1px solid rgba(232,150,26,.35)",
            color: "var(--amber)", fontSize: 11, fontWeight: 700,
            fontFamily: "var(--sans)", cursor: "pointer", textDecoration: "none",
          }}
        >
          + Explore
        </a>
      </div>

      {loading ? (
        <div style={{ padding: "32px 24px", fontSize: 12, color: "var(--snow5)", fontFamily: "var(--sans)" }}>Loading…</div>
      ) : channels.length === 0 ? (
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 15, fontStyle: "italic", color: "var(--snow5)", fontFamily: "var(--serif)", marginBottom: 20 }}>
            You haven't joined any channels yet.
          </p>
          <a
            href="/channels"
            style={{
              padding: "9px 20px", borderRadius: "var(--rp)",
              background: "var(--ambg)", border: "1px solid rgba(232,150,26,.35)",
              color: "var(--amber)", fontSize: 12, fontWeight: 700,
              fontFamily: "var(--sans)", textDecoration: "none",
            }}
          >
            Explore channels →
          </a>
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          {channels.map((ch) => (
            <a
              key={ch.id}
              href={`/channels/${ch.name}`}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 24px", cursor: "pointer",
                borderBottom: "1px solid var(--edge1)", textDecoration: "none",
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: "var(--fog2)", color: "var(--snow3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, fontFamily: "var(--sans)", flexShrink: 0,
              }}>
                #
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--snow)", fontFamily: "var(--sans)" }}>
                  #{ch.name}
                  {ch.favoriteByMe && <span style={{ fontSize: 10, color: "var(--amber)", marginLeft: 6 }}>★</span>}
                </div>
                {ch.description && (
                  <p style={{
                    margin: "2px 0 0", fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {ch.description}
                  </p>
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)", flexShrink: 0 }}>
                {ch.memberCount.toLocaleString()} ›
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoverScreen() {
  return (
    <div style={{
      flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
      background: "var(--ink)", alignItems: "center", justifyContent: "center",
      gap: 16, padding: 40,
    }}>
      <div style={{ fontSize: 56, opacity: 0.15 }}>🔍</div>
      <h2 style={{
        fontFamily: "var(--serif)", fontStyle: "italic",
        fontSize: 24, color: "var(--snow3)", margin: 0, fontWeight: 400,
      }}>
        Discover people
      </h2>
      <p style={{
        fontFamily: "var(--sans)", fontSize: 14, color: "var(--snow5)",
        textAlign: "center", maxWidth: 320, lineHeight: 1.6, margin: 0,
      }}>
        Coming soon — find people by what they&rsquo;re currently listening to,
        reading, or thinking about.
      </p>
    </div>
  );
}

function YouScreen() {
  const { data: session } = useSession();
  const { setComposerOpen, setComposerType } = useRadicalLayout();
  const [awayMsg, setAwayMsg] = useState("");

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/away-feed?userId=${session.user.id}&limit=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setAwayMsg(data?.feed?.[0]?.awayMessage ?? ""))
      .catch(() => {});
  }, [session?.user?.id]);

  const avatarColor = session?.user?.avatarColor ?? "amber";
  const { bg, fg } = AVATAR_PALETTE[avatarColor] ?? AVATAR_PALETTE.amber;
  const screenname = session?.user?.screenname ?? "";

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "var(--ink)", padding: "32px 32px 80px" }}>
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: bg, color: fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none", flexShrink: 0,
        }}>
          {getInitials(screenname)}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--snow)", fontFamily: "var(--sans)" }}>
            {screenname}
          </div>
          {session?.user?.isGoldMember && (
            <div style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--sans)", fontWeight: 700, marginTop: 3 }}>
              ✦ Gold Member
            </div>
          )}
        </div>
      </div>

      {/* Away message card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setComposerType("AWAY"); setComposerOpen(true); }}
        onKeyDown={(e) => e.key === "Enter" && (setComposerType("AWAY"), setComposerOpen(true))}
        style={{
          background: "var(--ambg2)", border: "1px solid rgba(232,150,26,.2)",
          borderRadius: "var(--r2)", padding: "16px 18px",
          cursor: "pointer", marginBottom: 20,
        }}
      >
        <p style={{
          fontFamily: "var(--serif)", fontStyle: "italic",
          fontSize: 17, color: awayMsg ? "var(--snow)" : "var(--snow4)",
          margin: "0 0 8px", lineHeight: 1.4,
        }}>
          {awayMsg || "no away message set"}
        </p>
        <span style={{ fontSize: 10, color: "var(--amber)", fontFamily: "var(--sans)", fontWeight: 600 }}>
          ✦ Click to update away message
        </span>
      </div>

      {/* Settings section */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--snow5)", fontFamily: "var(--sans)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Settings
        </div>

        {[
          { label: "Gold membership",     hint: "Manage subscription",     action: () => window.location.href = "/upgrade" },
          { label: "Encryption keys",     hint: "Backup & restore",         action: () => window.location.href = "/settings/backup" },
          { label: "Edit profile",        hint: "Update bio, avatar color", action: () => window.location.href = "/u/" + screenname + "/edit" },
        ].map((item) => (
          <div
            key={item.label}
            role="button"
            tabIndex={0}
            onClick={item.action}
            onKeyDown={(e) => e.key === "Enter" && item.action()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "13px 16px", borderRadius: "var(--r)",
              background: "var(--fog1)", border: "1px solid var(--edge1)",
              cursor: "pointer", marginBottom: 4,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--snow)", fontFamily: "var(--sans)" }}>{item.label}</div>
              <div style={{ fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)", marginTop: 2 }}>{item.hint}</div>
            </div>
            <span style={{ color: "var(--snow5)", fontSize: 14 }}>›</span>
          </div>
        ))}

        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: "var(--r)",
              background: "transparent", border: "1px solid var(--edge2)",
              color: "var(--snow4)", fontFamily: "var(--sans)", fontSize: 13,
              cursor: "pointer", textAlign: "left",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner shell — needs access to context
// ---------------------------------------------------------------------------

function RadicalShell() {
  const {
    activeBuddy,
    composerOpen, setComposerOpen,
    composerType,
    activeScreen,
  } = useRadicalLayout();

  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (isDesktop === null) return null;

  return (
    <>
      {isDesktop ? (
        <div style={{
          display: "flex", flexDirection: "column",
          height: "100vh", overflow: "hidden",
          background: "var(--ink)",
        }}>
          <TopBar />
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <Sidebar />

            {/* Main content — switches based on activeScreen */}
            {activeScreen === "feed"     && <MainFeed />}
            {activeScreen === "talk"     && <TalkScreen />}
            {activeScreen === "discover" && <DiscoverScreen />}
            {activeScreen === "you"      && <YouScreen />}

            {/* Full-screen chat overlay — slides over the content area */}
            <ChatOverlay />
          </div>
        </div>
      ) : (
        <MobileLayout />
      )}

      {isDesktop && (
        <PostComposer
          isOpen={composerOpen}
          onClose={() => setComposerOpen(false)}
          onPost={async (postData) => {
            await fetch("/api/posts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(postData),
            });
            setComposerOpen(false);
          }}
          mobile={false}
          defaultType={composerType}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// RadicalLayout — exported root
// ---------------------------------------------------------------------------

export function RadicalLayout() {
  return (
    <div className="radical-ux" style={{ height: "100vh", overflow: "hidden" }}>
      <RadicalLayoutProvider>
        <RadicalShell />
      </RadicalLayoutProvider>
    </div>
  );
}
