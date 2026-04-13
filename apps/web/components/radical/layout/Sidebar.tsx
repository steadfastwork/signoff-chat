"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRadicalLayout, type BuddyData } from "./RadicalLayoutContext";
import { AVATAR_PALETTE } from "./avatarPalette";
import { getInitials, formatTimestamp } from "@/lib/utils";
import { deriveAvatarColor } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Sidebar — desktop only (252px fixed, left panel)
// ---------------------------------------------------------------------------

interface SidebarBuddy extends BuddyData {
  relationId: string;
}

function BuddyAvatar({ screenname, avatarColor, size = 28, radius = 9, isOnline, isAway }: {
  screenname: string;
  avatarColor: string;
  size?: number;
  radius?: number;
  isOnline: boolean;
  isAway: boolean;
}) {
  const { bg, fg } = AVATAR_PALETTE[avatarColor] ?? AVATAR_PALETTE.amber;
  const dotColor = !isOnline ? "var(--snow5)" : isAway ? "var(--away)" : "var(--green)";

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: radius,
        background: bg, color: fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(size * 0.35), fontWeight: 700, fontFamily: "var(--sans)",
        userSelect: "none",
      }}>
        {getInitials(screenname)}
      </div>
      <span style={{
        position: "absolute", bottom: -1, right: -1,
        width: 7, height: 7, borderRadius: "50%",
        background: dotColor, border: "2px solid var(--ink2)",
      }} />
    </div>
  );
}

function BuddyRow({ buddy, onClick }: { buddy: SidebarBuddy; onClick: () => void }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setTooltipVisible(true), 400);
  };
  const hideTooltip = () => {
    clearTimeout(timeoutRef.current);
    setTooltipVisible(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px", cursor: "pointer", position: "relative",
        borderRadius: 8,
      }}
      className="sidebar-buddy-row"
    >
      <BuddyAvatar
        screenname={buddy.screenname}
        avatarColor={buddy.avatarColor}
        isOnline={buddy.isOnline}
        isAway={buddy.isAway}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            fontSize: 12, fontWeight: 500, color: "var(--snow2)",
            fontFamily: "var(--sans)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {buddy.screenname}
          </span>
          {buddy.isGold && (
            <span style={{ fontSize: 9, color: "var(--amber)", flexShrink: 0 }}>★</span>
          )}
        </div>
        {buddy.awayMessage && (
          <p style={{
            margin: 0, fontSize: 10, fontStyle: "italic",
            color: "var(--snow4)", fontFamily: "var(--sans)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {buddy.awayMessage}
          </p>
        )}
      </div>

      {/* Hover tooltip */}
      {tooltipVisible && buddy.awayMessage && (
        <div style={{
          position: "absolute",
          left: "calc(100% + 8px)",
          top: 0,
          zIndex: 200,
          background: "var(--ink3)",
          border: "1px solid var(--edge2)",
          borderRadius: 10,
          padding: "12px 14px",
          maxWidth: 220,
          boxShadow: "0 16px 48px rgba(0,0,0,.7)",
          pointerEvents: "none",
        }}>
          <p style={{
            fontFamily: "var(--serif)", fontStyle: "italic",
            fontSize: 14, color: "var(--snow)", margin: "0 0 8px",
            lineHeight: 1.45,
          }}>
            {buddy.awayMessage}
          </p>
          {buddy.currently.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {buddy.currently.map((c, i) => (
                <span key={i} style={{
                  fontSize: 10, color: "var(--snow4)", fontFamily: "var(--sans)",
                }}>
                  {c.emoji} {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const { setActiveBuddy, setComposerOpen, setComposerType } = useRadicalLayout();

  const [buddies, setBuddies]     = useState<SidebarBuddy[]>([]);
  const [awayMsg, setAwayMsg]     = useState("");
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch("/api/buddies")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const all: SidebarBuddy[] = [];
        // Flatten groups + ungrouped
        const addBuddies = (arr: any[]) => {
          for (const b of arr) {
            const ac = deriveAvatarColor(b.userId);
            all.push({
              userId: b.userId,
              relationId: b.relationId ?? b.userId,
              screenname: b.screenname,
              isGold: b.isGold,
              isOnline: b.isOnline,
              isAway: b.isAway,
              awayMessage: b.awayMessage ?? "",
              currently: b.currently ?? [],
              avatarColor: ac,
            });
          }
        };
        for (const g of (data.groups ?? [])) addBuddies(g.buddies ?? []);
        addBuddies(data.ungrouped ?? []);
        addBuddies(data.offlineBuddies ?? []);
        setBuddies(all);
      })
      .finally(() => setLoading(false));
  }, []);

  // Also fetch current user's own away message
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/away-feed?userId=${session.user.id}&limit=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const msg = data?.feed?.[0]?.awayMessage ?? "";
        setAwayMsg(msg);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  const onlineBuddies  = buddies.filter((b) =>  b.isOnline && !b.isAway);
  const awayBuddies    = buddies.filter((b) =>  b.isOnline &&  b.isAway);
  const offlineBuddies = buddies.filter((b) => !b.isOnline);

  const openBuddy = (buddy: SidebarBuddy) => setActiveBuddy(buddy);

  const avatarColor = session?.user?.avatarColor ?? "amber";
  const { bg, fg } = AVATAR_PALETTE[avatarColor] ?? AVATAR_PALETTE.amber;
  const screenname = session?.user?.screenname ?? "";

  const SectionLabel = ({ label }: { label: string }) => (
    <div style={{
      padding: "8px 14px 4px",
      fontSize: 9, fontWeight: 700, fontFamily: "var(--sans)",
      color: "var(--snow5)", textTransform: "uppercase", letterSpacing: "0.08em",
    }}>
      {label}
    </div>
  );

  return (
    <div style={{
      width: 252, flexShrink: 0,
      background: "var(--ink2)",
      borderRight: "1px solid var(--edge1)",
      display: "flex", flexDirection: "column",
      height: "100%", overflow: "hidden",
    }}>
      {/* Your status block */}
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--edge1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: bg, color: fg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, fontFamily: "var(--sans)",
              userSelect: "none",
            }}>
              {getInitials(screenname)}
            </div>
            <span style={{
              position: "absolute", bottom: -1, right: -1,
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--green)", border: "2px solid var(--ink2)",
            }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--snow)", fontFamily: "var(--sans)" }}>
              {screenname}
            </div>
            {session?.user?.isGoldMember && (
              <div style={{ fontSize: 9, color: "var(--amber)", fontFamily: "var(--sans)", fontWeight: 700 }}>
                ★ Gold
              </div>
            )}
          </div>
        </div>

        {/* Away card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setComposerType("AWAY"); setComposerOpen(true); }}
          onKeyDown={(e) => e.key === "Enter" && (setComposerType("AWAY"), setComposerOpen(true))}
          style={{
            background: "var(--ambg2)",
            border: "1px solid rgba(232,150,26,.15)",
            borderRadius: "var(--r)",
            padding: "9px 11px",
            cursor: "pointer",
          }}
        >
          <p style={{
            fontFamily: "var(--serif)", fontSize: 13, fontStyle: "italic",
            color: awayMsg ? "var(--snow)" : "var(--snow4)",
            margin: "0 0 4px", lineHeight: 1.4,
          }}>
            {awayMsg || "not set"}
          </p>
          <span style={{
            fontSize: 9, color: "var(--snow4)", fontFamily: "var(--sans)",
          }}>
            click to update ✦
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ padding: 8, borderBottom: "1px solid var(--edge1)" }}>
        {[
          { label: "Feed",     icon: "⊞", key: "⌘1" },
          { label: "Talk",     icon: "💬", key: "⌘2" },
          { label: "Discover", icon: "✦",  key: "⌘3" },
          { label: "You",      icon: "◎",  key: "⌘4" },
        ].map((item, i) => (
          <div
            key={item.label}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "8px 10px", borderRadius: 10, cursor: "pointer",
              background: i === 0 ? "var(--ambg)" : "transparent",
            }}
          >
            <span style={{ fontSize: 14, opacity: i === 0 ? 1 : 0.5 }}>{item.icon}</span>
            <span style={{
              fontSize: 13, fontWeight: 500, fontFamily: "var(--sans)",
              color: i === 0 ? "var(--amber)" : "var(--snow3)",
              flex: 1,
            }}>
              {item.label}
            </span>
            <span style={{
              fontSize: 9, color: "var(--snow5)", fontFamily: "var(--sans)",
              opacity: 0, transition: "opacity 0.15s",
            }} className="nav-shortcut">
              {item.key}
            </span>
          </div>
        ))}
      </div>

      {/* Buddy list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "16px 14px", fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)" }}>
            Loading…
          </div>
        ) : (
          <>
            {onlineBuddies.length > 0 && (
              <>
                <SectionLabel label={`Online now · ${onlineBuddies.length}`} />
                {onlineBuddies.map((b) => (
                  <BuddyRow key={b.userId} buddy={b} onClick={() => openBuddy(b)} />
                ))}
              </>
            )}
            {awayBuddies.length > 0 && (
              <>
                <SectionLabel label={`Away · ${awayBuddies.length}`} />
                {awayBuddies.map((b) => (
                  <BuddyRow key={b.userId} buddy={b} onClick={() => openBuddy(b)} />
                ))}
              </>
            )}
            {offlineBuddies.length > 0 && (
              <>
                <SectionLabel label="Offline" />
                {offlineBuddies.map((b) => (
                  <BuddyRow key={b.userId} buddy={b} onClick={() => openBuddy(b)} />
                ))}
              </>
            )}
            {buddies.length === 0 && (
              <div style={{ padding: "16px 14px", fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)" }}>
                No buddies yet
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid var(--edge1)",
        padding: "8px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 10, color: "var(--snow4)", fontFamily: "var(--sans)" }}>
          {buddies.length} buddies · {onlineBuddies.length + awayBuddies.length} online
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{
            width: 24, height: 24, borderRadius: 6,
            background: "transparent", border: "1px solid var(--edge1)",
            color: "var(--snow4)", fontSize: 12, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} title="Settings">⚙</button>
          <button style={{
            width: 24, height: 24, borderRadius: 6,
            background: "transparent", border: "1px solid var(--edge1)",
            color: "var(--snow4)", fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} title="Add buddy">＋</button>
        </div>
      </div>
    </div>
  );
}
