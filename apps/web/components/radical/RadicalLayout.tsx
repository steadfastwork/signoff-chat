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

// ---------------------------------------------------------------------------
// Channels screen
// ---------------------------------------------------------------------------

const CH_AVATAR_COLORS = ["amber","rose","sky","emerald","violet","orange"] as const;
function memberAvatarPalette(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  const key = CH_AVATAR_COLORS[h % CH_AVATAR_COLORS.length];
  return AVATAR_PALETTE[key] ?? AVATAR_PALETTE.amber;
}

function ChannelMembersPanel({ channel, onClose }: { channel: any; onClose: () => void }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setMembers([]);
    fetch(`/api/channels/${channel.name}/members`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setMembers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channel.name]);

  const online  = members.filter((m) => m.user.status === "ONLINE");
  const away    = members.filter((m) => m.user.status === "AWAY");
  const offline = members.filter((m) => m.user.status !== "ONLINE" && m.user.status !== "AWAY");

  const MemberRow = ({ m }: { m: any }) => {
    const { bg, fg } = memberAvatarPalette(m.userId);
    const statusColor = m.user.status === "ONLINE" ? "var(--green)"
      : m.user.status === "AWAY" ? "var(--away)" : "var(--snow5)";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: bg, color: fg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none",
          }}>
            {getInitials(m.user.screenname)}
          </div>
          <span style={{
            position: "absolute", bottom: -1, right: -1,
            width: 8, height: 8, borderRadius: "50%",
            background: statusColor, border: "2px solid var(--ink)",
          }} />
        </div>
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 500,
          color: m.user.status === "OFFLINE" || m.user.status === "IDLE" || m.user.status === "INVISIBLE"
            ? "var(--snow4)" : "var(--snow)",
          fontFamily: "var(--sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {m.user.screenname}
        </span>
        {m.user.isGoldMember && (
          <span style={{ fontSize: 10, color: "var(--amber)", flexShrink: 0 }}>★</span>
        )}
      </div>
    );
  };

  const SectionLabel = ({ label, count }: { label: string; count: number }) => (
    <div style={{
      fontSize: 9, fontWeight: 700, color: "var(--snow5)",
      fontFamily: "var(--sans)", textTransform: "uppercase",
      letterSpacing: "0.08em", padding: "12px 0 4px",
    }}>
      {label} — {count}
    </div>
  );

  return (
    <div style={{
      width: 280, flexShrink: 0,
      borderLeft: "1px solid var(--edge1)",
      display: "flex", flexDirection: "column",
      background: "var(--ink2)",
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div style={{
        padding: "16px 18px 12px",
        borderBottom: "1px solid var(--edge1)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--snow4)",
              cursor: "pointer", fontSize: 16, padding: "0 4px 0 0", lineHeight: 1,
            }}
          >‹</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--snow)", fontFamily: "var(--sans)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            #{channel.name}
          </span>
          <a
            href={`/channels/${channel.name}`}
            style={{
              fontSize: 11, color: "var(--amber)", fontFamily: "var(--sans)",
              fontWeight: 600, textDecoration: "none", flexShrink: 0,
            }}
          >
            Open →
          </a>
        </div>
        {channel.description && (
          <p style={{ margin: 0, fontSize: 11, color: "var(--snow4)", fontFamily: "var(--sans)", lineHeight: 1.4 }}>
            {channel.description}
          </p>
        )}
        <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--snow5)", fontFamily: "var(--sans)" }}>
          {channel.memberCount?.toLocaleString()} members
          {channel.type !== "PUBLIC" && (
            <span style={{ marginLeft: 6, border: "1px solid var(--edge2)", borderRadius: 3, padding: "1px 5px" }}>
              {channel.type === "INVITE_ONLY" ? "invite only" : "secret"}
            </span>
          )}
        </p>
      </div>

      {/* Member list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 20px" }}>
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--snow5)", fontFamily: "var(--sans)", padding: "20px 0" }}>Loading members…</p>
        ) : members.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--snow5)", fontFamily: "var(--sans)", padding: "20px 0", fontStyle: "italic" }}>No members found.</p>
        ) : (
          <>
            {online.length > 0 && (
              <>
                <SectionLabel label="Online" count={online.length} />
                {online.map((m) => <MemberRow key={m.userId} m={m} />)}
              </>
            )}
            {away.length > 0 && (
              <>
                <SectionLabel label="Away" count={away.length} />
                {away.map((m) => <MemberRow key={m.userId} m={m} />)}
              </>
            )}
            {offline.length > 0 && (
              <>
                <SectionLabel label="Offline" count={offline.length} />
                {offline.map((m) => <MemberRow key={m.userId} m={m} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChannelsScreen() {
  const [tab,           setTab]           = useState<"mine" | "discover">("mine");
  const [myChannels,    setMyChannels]    = useState<any[]>([]);
  const [discovered,    setDiscovered]    = useState<any[]>([]);
  const [loadingMine,   setLoadingMine]   = useState(true);
  const [loadingDisc,   setLoadingDisc]   = useState(false);
  const [query,         setQuery]         = useState("");
  const [discMode,      setDiscMode]      = useState<"featured" | "new" | "active">("featured");
  const [activeChannel, setActiveChannel] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/channels?mine=true")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setMyChannels(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingMine(false));
  }, []);

  useEffect(() => {
    if (tab !== "discover") return;
    setLoadingDisc(true);
    fetch(`/api/channels?mode=${discMode}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setDiscovered(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingDisc(false));
  }, [tab, discMode]);

  const filtered = myChannels.filter((c) =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.description?.toLowerCase().includes(query.toLowerCase())
  );

  const Card = ({ ch }: { ch: any }) => {
    const isActive = activeChannel?.id === ch.id;
    return (
      <div
        onClick={() => setActiveChannel(isActive ? null : ch)}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "12px 16px", cursor: "pointer",
          border: `1px solid ${isActive ? "rgba(232,150,26,.35)" : "var(--edge1)"}`,
          borderRadius: "var(--r)",
          background: isActive ? "var(--ambg)" : "var(--fog1)",
          marginBottom: 8,
          transition: "border-color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(232,150,26,.25)"; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = "var(--edge1)"; }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: isActive ? "rgba(232,150,26,.2)" : "var(--fog2)",
          color: isActive ? "var(--amber)" : "var(--snow3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 700, fontFamily: "var(--sans)",
        }}>#</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? "var(--amber)" : "var(--snow)", fontFamily: "var(--sans)", display: "flex", alignItems: "center", gap: 6 }}>
            #{ch.name}
            {ch.favoriteByMe && <span style={{ fontSize: 10, color: "var(--amber)" }}>★</span>}
            {ch.type !== "PUBLIC" && (
              <span style={{ fontSize: 9, color: "var(--snow4)", fontFamily: "var(--sans)", border: "1px solid var(--edge2)", borderRadius: 4, padding: "1px 5px" }}>
                {ch.type === "INVITE_ONLY" ? "invite only" : "secret"}
              </span>
            )}
          </div>
          {ch.description && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--snow4)", fontFamily: "var(--sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ch.description}
            </p>
          )}
          <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--snow5)", fontFamily: "var(--sans)" }}>
            {ch.memberCount?.toLocaleString()} members
            {ch.slowModeMinutes > 0 && ` · ${ch.slowModeMinutes}m slow`}
          </p>
        </div>
        <span style={{ fontSize: 12, color: isActive ? "var(--amber)" : "var(--snow5)", flexShrink: 0 }}>
          {isActive ? "×" : "›"}
        </span>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", background: "var(--ink)", overflow: "hidden" }}>
      {/* Channel list */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
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
              fontFamily: "var(--sans)", textDecoration: "none",
            }}
          >
            + Create
          </a>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 24px", gap: 4, marginBottom: 16, flexShrink: 0 }}>
          {(["mine", "discover"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setActiveChannel(null); }} style={{
              padding: "7px 16px", borderRadius: "var(--rp)",
              background: tab === t ? "var(--ambg)" : "transparent",
              border: `1px solid ${tab === t ? "rgba(232,150,26,.35)" : "var(--edge1)"}`,
              color: tab === t ? "var(--amber)" : "var(--snow4)",
              fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)", cursor: "pointer",
            }}>
              {t === "mine" ? "Your channels" : "Discover"}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 40px" }}>
          {tab === "mine" && (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your channels…"
                style={{
                  width: "100%", background: "var(--fog1)", border: "1px solid var(--edge1)",
                  borderRadius: "var(--rp)", padding: "8px 14px",
                  fontFamily: "var(--sans)", fontSize: 13, color: "var(--snow)",
                  outline: "none", boxSizing: "border-box", marginBottom: 14,
                }}
              />
              {loadingMine ? (
                <p style={{ fontSize: 12, color: "var(--snow5)", fontFamily: "var(--sans)" }}>Loading…</p>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <p style={{ fontSize: 14, fontStyle: "italic", color: "var(--snow5)", fontFamily: "var(--serif)", marginBottom: 16 }}>
                    {query ? "No channels match your search." : "You haven't joined any channels yet."}
                  </p>
                  {!query && <button onClick={() => setTab("discover")} style={{ fontSize: 12, color: "var(--amber)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--sans)" }}>explore channels →</button>}
                </div>
              ) : (
                filtered.map((ch) => <Card key={ch.id} ch={ch} />)
              )}
            </>
          )}

          {tab === "discover" && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {(["featured", "new", "active"] as const).map((m) => (
                  <button key={m} onClick={() => setDiscMode(m)} style={{
                    padding: "5px 12px", borderRadius: "var(--rp)",
                    background: discMode === m ? "var(--ambg)" : "transparent",
                    border: `1px solid ${discMode === m ? "rgba(232,150,26,.35)" : "var(--edge1)"}`,
                    color: discMode === m ? "var(--amber)" : "var(--snow4)",
                    fontSize: 11, fontWeight: 600, fontFamily: "var(--sans)", cursor: "pointer",
                  }}>
                    {m === "featured" ? "Featured" : m === "new" ? "Newest" : "Most active"}
                  </button>
                ))}
              </div>
              {loadingDisc ? (
                <p style={{ fontSize: 12, color: "var(--snow5)", fontFamily: "var(--sans)" }}>Loading…</p>
              ) : discovered.length === 0 ? (
                <p style={{ fontSize: 13, fontStyle: "italic", color: "var(--snow5)", fontFamily: "var(--serif)", padding: "32px 0", textAlign: "center" }}>No channels found.</p>
              ) : (
                discovered.map((ch) => <Card key={ch.id} ch={ch} />)
              )}
            </>
          )}
        </div>
      </div>

      {/* Members panel — slides in when a channel is selected */}
      {activeChannel && (
        <ChannelMembersPanel
          channel={activeChannel}
          onClose={() => setActiveChannel(null)}
        />
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
            {activeScreen === "channels" && <ChannelsScreen />}
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
  // Hide the global Navbar (root layout) while radical UX is active —
  // we render our own TopBar / MobileLayout header. Without this the
  // fixed Navbar overlaps the top of the layout on mobile and shows a
  // non-functional hamburger button on all screen sizes.
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "radical-hide-navbar";
    style.textContent = "nav.fixed.top-0.left-0.right-0 { display: none !important; }";
    document.head.appendChild(style);
    return () => document.getElementById("radical-hide-navbar")?.remove();
  }, []);

  return (
    <div className="radical-ux" style={{ height: "100vh", overflow: "hidden" }}>
      <RadicalLayoutProvider>
        <RadicalShell />
      </RadicalLayoutProvider>
    </div>
  );
}
