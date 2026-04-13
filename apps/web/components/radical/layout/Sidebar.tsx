"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRadicalLayout, type BuddyData, type ActiveScreen } from "./RadicalLayoutContext";
import { AVATAR_PALETTE } from "./avatarPalette";
import { getInitials } from "@/lib/utils";
import { deriveAvatarColor } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarBuddy extends BuddyData {
  relationId?: string;
}

interface ApiGroup {
  id:         string;
  name:       string;
  order:      number;
  memberIds:  string[];
  buddies:    SidebarBuddy[];
  totalCount: number;
}

interface BuddyListData {
  groups:          ApiGroup[];
  ungrouped:       SidebarBuddy[];
  offlineBuddies:  SidebarBuddy[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLLAPSE_KEY = "signoff-group-collapse-state";

function loadCollapseState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveCollapseState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
  } catch {}
}

function mapApiBuddy(b: Record<string, unknown>): SidebarBuddy {
  const ac = deriveAvatarColor(String(b.userId ?? b.id ?? ""));
  return {
    userId:      String(b.userId ?? b.id ?? ""),
    relationId:  b.relationId ? String(b.relationId) : undefined,
    screenname:  String(b.screenname ?? ""),
    isGold:      Boolean(b.isGold),
    isOnline:    Boolean(b.isOnline),
    isAway:      Boolean(b.isAway),
    awayMessage: String(b.awayMessage ?? ""),
    currently:   (b.currently as { emoji: string; label: string }[]) ?? [],
    avatarColor: ac,
  };
}

// ---------------------------------------------------------------------------
// BuddyAvatar
// ---------------------------------------------------------------------------

function BuddyAvatar({ screenname, avatarColor, size = 26, radius = 8, isOnline, isAway }: {
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
        width: 6, height: 6, borderRadius: "50%",
        background: dotColor, border: "2px solid var(--ink2)",
      }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContextMenu
// ---------------------------------------------------------------------------

interface ContextMenuProps {
  buddy:     SidebarBuddy;
  groups:    ApiGroup[];
  x:         number;
  y:         number;
  onClose:   () => void;
  onRefresh: () => void;
}

function ContextMenu({ buddy, groups, x, y, onClose, onRefresh }: ContextMenuProps) {
  const [subOpen, setSubOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);

  const moveToGroup = async (groupId: string, action: "add" | "remove") => {
    onClose();
    await fetch(`/api/buddies/groups/${groupId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buddyId: buddy.userId, action }),
    });
    onRefresh();
  };

  // Which groups is this buddy currently in?
  const currentGroupIds = new Set(
    groups.filter((g) => g.memberIds.includes(buddy.userId)).map((g) => g.id)
  );

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
    zIndex: 500,
    background: "var(--ink3)",
    border: "1px solid var(--edge2)",
    borderRadius: 10,
    padding: "4px 0",
    minWidth: 160,
    boxShadow: "0 16px 40px rgba(0,0,0,.7)",
    fontFamily: "var(--sans)",
  };

  const itemStyle: React.CSSProperties = {
    padding: "7px 14px",
    fontSize: 12,
    color: "var(--snow2)",
    cursor: "pointer",
    userSelect: "none",
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    background: "var(--edge1)",
    margin: "3px 0",
  };

  return (
    <div ref={ref} style={menuStyle}>
      <div style={{ padding: "4px 14px 6px", fontSize: 10, color: "var(--snow5)", borderBottom: "1px solid var(--edge1)", marginBottom: 3 }}>
        {buddy.screenname}
      </div>

      {groups.length > 0 && (
        <div
          style={{ ...itemStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}
          onMouseEnter={() => setSubOpen(true)}
          onMouseLeave={() => setSubOpen(false)}
        >
          <span>Move to group</span>
          <span style={{ opacity: 0.5, fontSize: 10 }}>▶</span>

          {subOpen && (
            <div style={{
              position: "absolute",
              left: "100%",
              top: 0,
              background: "var(--ink3)",
              border: "1px solid var(--edge2)",
              borderRadius: 10,
              padding: "4px 0",
              minWidth: 140,
              boxShadow: "0 16px 40px rgba(0,0,0,.7)",
            }}>
              {groups.map((g) => (
                <div
                  key={g.id}
                  style={{
                    ...itemStyle,
                    color: currentGroupIds.has(g.id) ? "var(--amber)" : "var(--snow2)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                  onClick={() => moveToGroup(g.id, currentGroupIds.has(g.id) ? "remove" : "add")}
                >
                  <span>{g.name}</span>
                  {currentGroupIds.has(g.id) && <span style={{ fontSize: 10 }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentGroupIds.size > 0 && (
        <>
          <div style={dividerStyle} />
          {Array.from(currentGroupIds).map((gid) => {
            const g = groups.find((x) => x.id === gid);
            if (!g) return null;
            return (
              <div
                key={gid}
                style={{ ...itemStyle, color: "var(--snow4)" }}
                onClick={() => moveToGroup(gid, "remove")}
              >
                Remove from {g.name}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BuddyRow
// ---------------------------------------------------------------------------

function BuddyRow({ buddy, groups, onClick, onRefresh }: {
  buddy:     SidebarBuddy;
  groups:    ApiGroup[];
  onClick:   () => void;
  onRefresh: () => void;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const showTooltip = () => { timeoutRef.current = setTimeout(() => setTooltipVisible(true), 400); };
  const hideTooltip = () => { clearTimeout(timeoutRef.current); setTooltipVisible(false); };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onContextMenu={handleContextMenu}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 12px", cursor: "pointer", position: "relative",
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
            {buddy.isGold && <span style={{ fontSize: 9, color: "var(--amber)", flexShrink: 0 }}>★</span>}
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
        {tooltipVisible && (buddy.awayMessage || buddy.currently.length > 0) && (
          <div style={{
            position: "fixed",
            left: "264px",
            zIndex: 300,
            background: "var(--ink3)",
            border: "1px solid var(--edge2)",
            borderRadius: 10,
            padding: "12px 14px",
            maxWidth: 220,
            boxShadow: "0 16px 48px rgba(0,0,0,.7)",
            pointerEvents: "none",
          }}>
            {buddy.awayMessage && (
              <p style={{
                fontFamily: "var(--serif)", fontStyle: "italic",
                fontSize: 14, color: "var(--snow)", margin: "0 0 8px", lineHeight: 1.45,
              }}>
                {buddy.awayMessage}
              </p>
            )}
            {buddy.currently.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {buddy.currently.map((c, i) => (
                  <span key={i} style={{ fontSize: 10, color: "var(--snow4)", fontFamily: "var(--sans)" }}>
                    {c.emoji} {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {ctxMenu && (
        <ContextMenu
          buddy={buddy}
          groups={groups}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// GroupSection
// ---------------------------------------------------------------------------

function GroupSection({ group, groups, allBuddies, collapsed, onToggle, onOpenBuddy, onRefresh, onAddBuddy }: {
  group:       { id: string; name: string; buddies: SidebarBuddy[]; totalCount: number };
  groups:      ApiGroup[];
  allBuddies:  SidebarBuddy[];
  collapsed:   boolean;
  onToggle:    () => void;
  onOpenBuddy: (b: SidebarBuddy) => void;
  onRefresh:   () => void;
  onAddBuddy:  (groupId: string, buddyId: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const onlineCount = group.buddies.length;

  return (
    <div>
      <div
        style={{
          display: "flex", alignItems: "center",
          padding: "6px 10px 3px",
          cursor: "pointer", userSelect: "none",
        }}
        onClick={onToggle}
      >
        <span style={{ fontSize: 9, color: "var(--snow5)", marginRight: 5, transition: "transform 0.15s", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
        <span style={{
          fontSize: 9, fontWeight: 700, fontFamily: "var(--sans)",
          color: "var(--snow4)", textTransform: "uppercase", letterSpacing: "0.07em",
          flex: 1,
        }}>
          {group.name}
        </span>
        <span style={{ fontSize: 9, color: "var(--snow5)", fontFamily: "var(--sans)", marginRight: 6 }}>
          {onlineCount}/{group.totalCount}
        </span>
        <span
          style={{
            fontSize: 13, color: "var(--snow5)", cursor: "pointer", lineHeight: 1,
            opacity: 0,
            transition: "opacity 0.1s",
          }}
          className="group-add-btn"
          onClick={(e) => { e.stopPropagation(); setAddOpen((v) => !v); }}
          title={`Add buddy to ${group.name}`}
        >
          ＋
        </span>
      </div>

      {!collapsed && (
        <>
          {group.buddies.map((b) => (
            <BuddyRow key={b.userId} buddy={b} groups={groups} onClick={() => onOpenBuddy(b)} onRefresh={onRefresh} />
          ))}
          {group.buddies.length === 0 && (
            <div style={{ padding: "4px 24px 6px", fontSize: 10, color: "var(--snow5)", fontFamily: "var(--sans)", fontStyle: "italic" }}>
              no one online
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar() {
  const { data: session } = useSession();
  const { setActiveBuddy, setComposerOpen, setComposerType, activeScreen, setActiveScreen } = useRadicalLayout();

  const [data,       setData]       = useState<BuddyListData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [awayMsg,    setAwayMsg]    = useState("");
  const [collapsed,  setCollapsed]  = useState<Record<string, boolean>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupActive, setNewGroupActive] = useState(false);
  const newGroupRef = useRef<HTMLInputElement>(null);

  // Load collapse state from localStorage
  useEffect(() => {
    setCollapsed(loadCollapseState());
  }, []);

  const fetchBuddies = useCallback(() => {
    fetch("/api/buddies")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        const map = (arr: Record<string, unknown>[]) => arr.map(mapApiBuddy);
        setData({
          groups:         (d.groups ?? []).map((g: Record<string, unknown>) => ({
            id:         g.id,
            name:       g.name,
            order:      g.order ?? 0,
            memberIds:  (g.memberIds as string[]) ?? [],
            buddies:    map((g.buddies ?? []) as Record<string, unknown>[]),
            totalCount: Number(g.totalCount ?? 0),
          })),
          ungrouped:      map(d.ungrouped ?? []),
          offlineBuddies: map(d.offlineBuddies ?? []),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBuddies(); }, [fetchBuddies]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/away-feed?userId=${session.user.id}&limit=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setAwayMsg(d?.feed?.[0]?.awayMessage ?? ""))
      .catch(() => {});
  }, [session?.user?.id]);

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveCollapseState(next);
      return next;
    });
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setCreatingGroup(true);
    await fetch("/api/buddies/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewGroupName("");
    setNewGroupActive(false);
    setCreatingGroup(false);
    fetchBuddies();
  };

  const openBuddy = (buddy: SidebarBuddy) => setActiveBuddy(buddy);

  const avatarColor = session?.user?.avatarColor ?? "amber";
  const { bg, fg } = AVATAR_PALETTE[avatarColor] ?? AVATAR_PALETTE.amber;
  const screenname = session?.user?.screenname ?? "";

  const groups = data?.groups ?? [];
  const ungrouped = data?.ungrouped ?? [];
  const offlineBuddies = data?.offlineBuddies ?? [];
  const totalOnline = groups.reduce((n, g) => n + g.buddies.length, 0) + ungrouped.filter((b) => b.isOnline).length;
  const totalBuddies = groups.reduce((n, g) => n + g.totalCount, 0) + ungrouped.length + offlineBuddies.length;

  const OFFLINE_ID = "__offline__";
  const UNGROUPED_ID = "__ungrouped__";

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
              fontSize: 13, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none",
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
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--snow)", fontFamily: "var(--sans)" }}>{screenname}</div>
            {session?.user?.isGoldMember && (
              <div style={{ fontSize: 9, color: "var(--amber)", fontFamily: "var(--sans)", fontWeight: 700 }}>★ Gold</div>
            )}
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => { setComposerType("AWAY"); setComposerOpen(true); }}
          onKeyDown={(e) => e.key === "Enter" && (setComposerType("AWAY"), setComposerOpen(true))}
          style={{
            background: "var(--ambg2)", border: "1px solid rgba(232,150,26,.15)",
            borderRadius: "var(--r)", padding: "9px 11px", cursor: "pointer",
          }}
        >
          <p style={{
            fontFamily: "var(--serif)", fontSize: 13, fontStyle: "italic",
            color: awayMsg ? "var(--snow)" : "var(--snow4)",
            margin: "0 0 4px", lineHeight: 1.4,
          }}>
            {awayMsg || "not set"}
          </p>
          <span style={{ fontSize: 9, color: "var(--snow4)", fontFamily: "var(--sans)" }}>
            click to update ✦
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ padding: 8, borderBottom: "1px solid var(--edge1)" }}>
        {([
          { label: "Feed",     icon: "⊞", screen: "feed"     as ActiveScreen, href: null },
          { label: "Talk",     icon: "💬", screen: "talk"     as ActiveScreen, href: null },
          { label: "Channels", icon: "#",  screen: "feed"     as ActiveScreen, href: "/channels" },
          { label: "Discover", icon: "✦",  screen: "discover" as ActiveScreen, href: null },
          { label: "You",      icon: "◎",  screen: "you"      as ActiveScreen, href: null },
        ] as const).map((item) => {
          const isActive = !item.href && activeScreen === item.screen;
          return (
            <div
              key={item.label}
              role="button"
              tabIndex={0}
              onClick={() => item.href ? (window.location.href = item.href) : setActiveScreen(item.screen)}
              onKeyDown={(e) => e.key === "Enter" && (item.href ? (window.location.href = item.href) : setActiveScreen(item.screen))}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                background: isActive ? "var(--ambg)" : "transparent",
              }}
            >
              <span style={{ fontSize: 14, opacity: isActive ? 1 : 0.5 }}>{item.icon}</span>
              <span style={{
                fontSize: 13, fontWeight: 500, fontFamily: "var(--sans)",
                color: isActive ? "var(--amber)" : "var(--snow3)", flex: 1,
              }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Buddy list — grouped */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "16px 14px", fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)" }}>
            Loading…
          </div>
        ) : (
          <>
            {/* Named groups */}
            {groups.map((g) => (
              <GroupSection
                key={g.id}
                group={g}
                groups={groups}
                allBuddies={[...ungrouped, ...offlineBuddies]}
                collapsed={!!collapsed[g.id]}
                onToggle={() => toggleGroup(g.id)}
                onOpenBuddy={openBuddy}
                onRefresh={fetchBuddies}
                onAddBuddy={() => {}}
              />
            ))}

            {/* Ungrouped online */}
            {ungrouped.length > 0 && (
              <div>
                <div
                  style={{ display: "flex", alignItems: "center", padding: "6px 10px 3px", cursor: "pointer", userSelect: "none" }}
                  onClick={() => toggleGroup(UNGROUPED_ID)}
                >
                  <span style={{ fontSize: 9, color: "var(--snow5)", marginRight: 5, display: "inline-block", transform: collapsed[UNGROUPED_ID] ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▼</span>
                  <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--sans)", color: "var(--snow4)", textTransform: "uppercase", letterSpacing: "0.07em", flex: 1 }}>
                    Online
                  </span>
                  <span style={{ fontSize: 9, color: "var(--snow5)", fontFamily: "var(--sans)" }}>{ungrouped.length}</span>
                </div>
                {!collapsed[UNGROUPED_ID] && ungrouped.map((b) => (
                  <BuddyRow key={b.userId} buddy={b} groups={groups} onClick={() => openBuddy(b)} onRefresh={fetchBuddies} />
                ))}
              </div>
            )}

            {/* Offline */}
            {offlineBuddies.length > 0 && (
              <div>
                <div
                  style={{ display: "flex", alignItems: "center", padding: "6px 10px 3px", cursor: "pointer", userSelect: "none" }}
                  onClick={() => toggleGroup(OFFLINE_ID)}
                >
                  <span style={{ fontSize: 9, color: "var(--snow5)", marginRight: 5, display: "inline-block", transform: collapsed[OFFLINE_ID] ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▼</span>
                  <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--sans)", color: "var(--snow5)", textTransform: "uppercase", letterSpacing: "0.07em", flex: 1 }}>
                    Offline
                  </span>
                  <span style={{ fontSize: 9, color: "var(--snow5)", fontFamily: "var(--sans)" }}>{offlineBuddies.length}</span>
                </div>
                {!collapsed[OFFLINE_ID] && offlineBuddies.map((b) => (
                  <BuddyRow key={b.userId} buddy={b} groups={groups} onClick={() => openBuddy(b)} onRefresh={fetchBuddies} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {totalBuddies === 0 && (
              <div style={{ padding: "16px 14px", fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)" }}>
                No buddies yet
              </div>
            )}

            {/* New group input */}
            <div style={{ padding: "10px 12px 4px" }}>
              {newGroupActive ? (
                <input
                  ref={newGroupRef}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createGroup();
                    if (e.key === "Escape") { setNewGroupName(""); setNewGroupActive(false); }
                  }}
                  onBlur={() => { if (!newGroupName) setNewGroupActive(false); }}
                  placeholder="Group name…"
                  autoFocus
                  disabled={creatingGroup}
                  style={{
                    width: "100%", background: "var(--ink)", border: "1px solid var(--edge2)",
                    borderRadius: 8, padding: "5px 10px", fontSize: 12,
                    color: "var(--snow)", fontFamily: "var(--sans)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <button
                  onClick={() => setNewGroupActive(true)}
                  style={{
                    width: "100%", background: "transparent",
                    border: "1px dashed var(--edge2)", borderRadius: 8,
                    padding: "6px 10px", fontSize: 11, cursor: "pointer",
                    color: "var(--snow5)", fontFamily: "var(--sans)",
                    textAlign: "left",
                  }}
                >
                  ＋ New group
                </button>
              )}
            </div>
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
          {totalBuddies} buddies · {totalOnline} online
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
