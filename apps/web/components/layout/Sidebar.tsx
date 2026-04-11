"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import { playSound, unlockSounds, getSoundPack, setSoundPack } from "@/lib/sounds";
import { usePresence } from "@/components/PresenceProvider";
import { useSidebar } from "@/components/SidebarProvider";
import { Avatar } from "@/components/layout/Avatar";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { BuddyRequest, type BuddyRequestData } from "@/components/BuddyRequest";
import { BadgeList } from "@/components/badges/BadgeList";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuddyInGroup {
  userId: string;
  relationId: string;
  screenname: string;
  isGold: boolean;
  isOnline: boolean;
  isAway: boolean;
  awayMessage: string;
  currently: Record<string, string>;
  badges?: { id: string; badge: string; awardedAt: string }[];
}

interface BuddyGroup {
  id: string;
  name: string;
  order: number;
  memberIds: string[];
  buddies: BuddyInGroup[];
  totalCount: number;
}

interface BuddiesResponse {
  groups: BuddyGroup[];
  ungrouped: BuddyInGroup[];
  offlineBuddies: BuddyInGroup[];
}

interface Channel {
  id: string;
  name: string;
  type: "PUBLIC" | "INVITE_ONLY" | "SECRET";
}

interface Board {
  id: string;
  name: string;
  displayName: string;
  type: "PUBLIC" | "INVITE_ONLY" | "SECRET";
}

interface StatusChangePayload {
  userId: string;
  status: StatusValue;
  awayMessage: string | null;
  currently?: unknown;
}

interface BuddyAcceptedPayload {
  id: string;
  screenname: string;
  isGoldMember: boolean;
  status: StatusValue;
  awayMessage: string | null;
}

interface NewDMNotificationPayload {
  senderId: string;
  senderScreenname: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buddySection(s: StatusValue): "online" | "away" | "offline" {
  if (s === "ONLINE") return "online";
  if (s === "AWAY" || s === "IDLE") return "away";
  return "offline";
}

function sortOnline(a: BuddyInGroup, b: BuddyInGroup) {
  if (a.isAway !== b.isAway) return a.isAway ? 1 : -1;
  return a.screenname.localeCompare(b.screenname);
}

// Apply a status change to the buddy data without a full refetch.
// If the buddy moves online/offline, they are relocated between sections.
function applyStatusChange(
  prev: BuddiesResponse,
  p: { userId: string; status: string; awayMessage: string | null }
): BuddiesResponse {
  const effectiveStatus = p.status === "INVISIBLE" ? "OFFLINE" : p.status;
  const nowOnline = effectiveStatus !== "OFFLINE";
  const isAway =
    effectiveStatus === "AWAY" ||
    (p.awayMessage != null && p.awayMessage.length > 0);

  // Find the buddy in any section
  let existing: BuddyInGroup | undefined;
  let wasOnline = false;

  for (const g of prev.groups) {
    const b = g.buddies.find((b) => b.userId === p.userId);
    if (b) { existing = b; wasOnline = true; break; }
  }
  if (!existing) {
    const b = prev.ungrouped.find((b) => b.userId === p.userId);
    if (b) { existing = b; wasOnline = true; }
  }
  if (!existing) {
    existing = prev.offlineBuddies.find((b) => b.userId === p.userId);
  }
  if (!existing) return prev;

  const updated: BuddyInGroup = {
    ...existing,
    isOnline: nowOnline,
    isAway,
    awayMessage: p.awayMessage ? p.awayMessage.slice(0, 60) : "",
  };

  if (wasOnline === nowOnline) {
    // Same section — just update in place
    return {
      groups: prev.groups.map((g) => ({
        ...g,
        buddies: g.buddies.map((b) => (b.userId === p.userId ? updated : b)),
      })),
      ungrouped: prev.ungrouped.map((b) => (b.userId === p.userId ? updated : b)),
      offlineBuddies: prev.offlineBuddies.map((b) =>
        b.userId === p.userId ? updated : b
      ),
    };
  }

  if (!wasOnline && nowOnline) {
    // Offline → Online: put in the correct group(s) or ungrouped
    const targetGroupIds = new Set(
      prev.groups.filter((g) => g.memberIds.includes(p.userId)).map((g) => g.id)
    );
    const newOffline = prev.offlineBuddies.filter((b) => b.userId !== p.userId);
    const newGroups = prev.groups.map((g) => {
      if (!targetGroupIds.has(g.id)) return g;
      return { ...g, buddies: [...g.buddies, updated].sort(sortOnline) };
    });
    const newUngrouped =
      targetGroupIds.size === 0
        ? [...prev.ungrouped, updated].sort(sortOnline)
        : prev.ungrouped;
    return { groups: newGroups, ungrouped: newUngrouped, offlineBuddies: newOffline };
  }

  // Online → Offline: remove from groups/ungrouped, add to offline
  const newGroups = prev.groups.map((g) => ({
    ...g,
    buddies: g.buddies.filter((b) => b.userId !== p.userId),
  }));
  const newUngrouped = prev.ungrouped.filter((b) => b.userId !== p.userId);
  const newOffline = [...prev.offlineBuddies, updated].sort((a, b) =>
    a.screenname.localeCompare(b.screenname)
  );
  return { groups: newGroups, ungrouped: newUngrouped, offlineBuddies: newOffline };
}

// ---------------------------------------------------------------------------
// Status selector
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: StatusValue; label: string; color: string }[] = [
  { value: "ONLINE",    label: "Online",    color: "#22c55e" },
  { value: "AWAY",      label: "Away",      color: "#f59e0b" },
  { value: "IDLE",      label: "Idle",      color: "#6a6860" },
  { value: "INVISIBLE", label: "Invisible", color: "#6a6860" },
];

function SidebarStatusSelector() {
  const { status, updateStatus } = usePresence();
  const [pending, setPending] = useState<StatusValue | null>(null);

  const handle = async (next: StatusValue) => {
    if (next === status || pending) return;
    setPending(next);
    await updateStatus(next);
    setPending(null);
  };

  return (
    <div className="grid grid-cols-2 gap-1">
      {STATUS_OPTIONS.map(({ value, label, color }) => {
        const active = status === value;
        return (
          <button
            key={value}
            onClick={() => handle(value)}
            disabled={!!pending}
            className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-2 border transition-all"
            style={{
              minHeight: 44,
              background: active ? "var(--amber-tint)" : "transparent",
              borderColor: active ? "var(--amber)" : "var(--border)",
              color: active ? "var(--amber)" : "var(--text-muted)",
              opacity: pending === value ? 0.5 : 1,
              cursor: pending ? "not-allowed" : "pointer",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 12,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sound toggle
// ---------------------------------------------------------------------------

function SoundToggle() {
  const [muted, setMuted] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return getSoundPack() === "off";
  });

  const toggle = () => {
    if (muted) {
      const last = (localStorage.getItem("sc-sound-pack-last") ?? "classic") as Parameters<typeof setSoundPack>[0];
      setSoundPack(last);
      setMuted(false);
    } else {
      const current = getSoundPack();
      if (current !== "off") localStorage.setItem("sc-sound-pack-last", current);
      setSoundPack("off");
      setMuted(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-2 border transition-all w-full mt-1"
      style={{
        height: 28,
        background: "transparent",
        borderColor: "var(--border)",
        color: muted ? "var(--text-dim)" : "var(--text-muted)",
        fontFamily: "var(--font-dm-sans)",
        fontSize: 11,
      }}
      title={muted ? "unmute sounds" : "mute sounds"}
    >
      <span>{muted ? "🔇" : "🔔"}</span>
      {muted ? "sounds off" : "sounds on"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader (channels / boards / etc.)
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  accent = "amber",
  action,
  actionHref,
}: {
  label: string;
  accent?: "amber" | "teal";
  action?: string;
  actionHref?: string;
}) {
  const color = accent === "teal" ? "var(--teal)" : "var(--amber)";
  return (
    <div className="flex items-center justify-between px-3 pt-4 pb-1.5">
      <span
        className="text-[10px] font-mono uppercase tracking-[0.15em] select-none"
        style={{
          color:
            accent === "teal" ? "var(--teal-dark, #0f766e)" : "var(--text-dim)",
        }}
      >
        {label}
      </span>
      {action && actionHref && (
        <Link
          href={actionHref}
          className="text-[11px] font-mono transition-colors"
          style={{ color: "var(--text-muted)" }}
          title={action}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = color)
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")
          }
        >
          +
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AIM group header — arrow + name + online/total count
// ---------------------------------------------------------------------------

function AimGroupHeader({
  name,
  onlineCount,
  totalCount,
  collapsed,
  onToggle,
  isOffline = false,
  onRename,
  onDelete,
  onAddBuddy,
}: {
  name: string;
  onlineCount: number;
  totalCount: number;
  collapsed: boolean;
  onToggle: () => void;
  isOffline?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
  onAddBuddy?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1.5 select-none cursor-pointer group"
      style={{ height: 28, padding: "0 14px" }}
      onClick={onToggle}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background =
          "rgba(255,255,255,.02)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "transparent")
      }
    >
      {/* Collapse arrow */}
      <span
        style={{
          fontSize: 9,
          color: "var(--text-dim)",
          flexShrink: 0,
          display: "inline-block",
          transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
          transition: "transform .15s",
          fontFamily: "monospace",
        }}
      >
        ▶
      </span>

      {/* Group name */}
      <span
        className="flex-1 min-w-0 truncate"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          letterSpacing: ".02em",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {name}
      </span>

      {/* Count */}
      {!isOffline ? (
        <span style={{ fontSize: 10, flexShrink: 0 }}>
          <span style={{ color: "var(--amber)" }}>{onlineCount}</span>
          <span style={{ color: "var(--text-dim)" }}>/{totalCount}</span>
        </span>
      ) : (
        <span style={{ fontSize: 10, color: "var(--text-dim)", flexShrink: 0 }}>
          {totalCount}
        </span>
      )}

      {/* Management buttons — hover only, not for special sections */}
      {(onRename || onDelete || onAddBuddy) && (
        <div
          className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {onAddBuddy && (
            <button
              onClick={onAddBuddy}
              className="text-[10px] font-mono px-0.5 transition-colors"
              style={{ color: "var(--text-dim)" }}
              title="add buddy to group"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color =
                  "var(--amber)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-dim)")
              }
            >
              +
            </button>
          )}
          {onRename && (
            <button
              onClick={onRename}
              className="text-[10px] font-mono px-0.5 transition-colors"
              style={{ color: "var(--text-dim)" }}
              title="rename group"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-muted)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-dim)")
              }
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-[10px] font-mono px-0.5 transition-colors"
              style={{ color: "var(--text-dim)" }}
              title="delete group"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-dim)")
              }
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AIM buddy row — no avatar, status dot + name + away snippet
// ---------------------------------------------------------------------------

function AimBuddyRow({
  buddy,
  unreadCount,
  onClearUnread,
  onCtxMenu,
  isOffline = false,
}: {
  buddy: BuddyInGroup;
  unreadCount?: number;
  onClearUnread?: () => void;
  onCtxMenu: (e: React.MouseEvent) => void;
  isOffline?: boolean;
}) {
  const dotColor = isOffline
    ? "#3a3a34"
    : buddy.isAway
    ? "#f59e0b"
    : "#22c55e";

  return (
    <div
      className="flex items-center gap-2 cursor-pointer group"
      style={{ minHeight: 28, padding: "5px 14px 5px 26px" }}
      onContextMenu={(e) => {
        e.preventDefault();
        onCtxMenu(e);
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background =
          "rgba(255,255,255,.03)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "transparent")
      }
    >
      {/* Status dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
          display: "inline-block",
        }}
      />

      {/* Name → profile */}
      <Link
        href={`/u/${buddy.screenname}`}
        className="flex-1 min-w-0 leading-none"
        style={{ color: "inherit", textDecoration: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {buddy.screenname}
        </span>
        {buddy.isGold && (
          <span style={{ color: "var(--amber)", fontSize: 10, marginLeft: 2 }}>
            ★
          </span>
        )}
      </Link>

      {buddy.badges && buddy.badges.length > 0 && (
        <BadgeList badges={buddy.badges as any} size="sm" />
      )}

      {/* Unread badge */}
      {!!unreadCount && (
        <span
          className="flex-shrink-0 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold px-1"
          style={{ background: "#ef4444", color: "#fff" }}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}

      {/* DM button — hover only */}
      <Link
        href={`/dm/${buddy.userId}`}
        onClick={(e) => {
          e.stopPropagation();
          onClearUnread?.();
        }}
        title={`message ${buddy.screenname}`}
        className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[14px]"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.color = "var(--amber)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.color =
            "var(--text-muted)")
        }
      >
        💬
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

function BuddyContextMenu({
  buddy,
  x,
  y,
  listId,
  listName,
  onClose,
  onRemoved,
  onRemovedFromList,
}: {
  buddy: BuddyInGroup;
  x: number;
  y: number;
  listId?: string;
  listName?: string;
  onClose: () => void;
  onRemoved: (userId: string) => void;
  onRemovedFromList?: (userId: string, listId: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("keydown", keyHandler);
    }, 0);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  const removeBuddy = async () => {
    onClose();
    if (!window.confirm(`Remove ${buddy.screenname} from your buddy list?`)) return;
    const res = await fetch(`/api/buddies/${buddy.relationId}`, { method: "DELETE" });
    if (res.ok) onRemoved(buddy.userId);
  };

  const removeFromList = async () => {
    if (!listId) return;
    onClose();
    const res = await fetch(`/api/buddy-lists/${listId}/members/${buddy.userId}`, { method: "DELETE" });
    if (res.ok) onRemovedFromList?.(buddy.userId, listId);
  };

  // Clamp to viewport
  const left = Math.min(x, window.innerWidth - 160);
  const top = Math.min(y, window.innerHeight - 120);

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 9999,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "4px 0",
        minWidth: 150,
        boxShadow: "0 4px 16px rgba(0,0,0,.4)",
      }}
    >
      <Link
        href={`/dm/${buddy.userId}`}
        onClick={onClose}
        className="block px-3 py-1.5 text-[12px] transition-colors"
        style={{
          color: "var(--text-muted)",
          fontFamily: "var(--font-dm-sans)",
          textDecoration: "none",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.background =
            "var(--card)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.background =
            "transparent")
        }
      >
        Message {buddy.screenname}
      </Link>
      <Link
        href={`/u/${buddy.screenname}`}
        onClick={onClose}
        className="block px-3 py-1.5 text-[12px] transition-colors"
        style={{
          color: "var(--text-muted)",
          fontFamily: "var(--font-dm-sans)",
          textDecoration: "none",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.background =
            "var(--card)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.background =
            "transparent")
        }
      >
        View profile
      </Link>
      {listId && (
        <>
          <div style={{ height: 1, background: "var(--border)", margin: "3px 0" }} />
          <button
            onClick={removeFromList}
            className="block w-full text-left px-3 py-1.5 text-[12px] transition-colors"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "var(--card)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
            }
          >
            Remove from {listName ?? "list"}
          </button>
        </>
      )}
      <div
        style={{ height: 1, background: "var(--border)", margin: "3px 0" }}
      />
      <button
        onClick={removeBuddy}
        className="block w-full text-left px-3 py-1.5 text-[12px] transition-colors"
        style={{ color: "#ef4444", fontFamily: "var(--font-dm-sans)" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background =
            "var(--card)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background =
            "transparent")
        }
      >
        Remove buddy
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channel row
// ---------------------------------------------------------------------------

function ChannelRow({ channel }: { channel: Channel }) {
  const prefix =
    channel.type === "INVITE_ONLY" ? "🔒" : channel.type === "SECRET" ? "👁" : "#";
  const color =
    channel.type === "INVITE_ONLY"
      ? "var(--amber)"
      : channel.type === "SECRET"
      ? "var(--teal)"
      : "var(--text-muted)";

  return (
    <Link
      href={`/channels/${channel.name}`}
      className="flex items-center gap-1.5 px-3 py-1 rounded-lg mx-1 text-[13px] font-mono transition-colors"
      style={{ color }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background = "var(--card)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
      }
    >
      <span className="text-[11px] flex-shrink-0">{prefix}</span>
      <span className="truncate">{channel.name}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Board row
// ---------------------------------------------------------------------------

function BoardRow({ board }: { board: Board }) {
  const initial = board.displayName.charAt(0).toUpperCase();

  return (
    <Link
      href={`/boards/${board.name}`}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg mx-1 transition-colors"
      style={{ color: "var(--teal)" }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background = "var(--card)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
      }
    >
      <div
        className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
        style={{ background: "var(--teal-tint)", color: "var(--teal)" }}
      >
        {initial}
      </div>
      <span
        className="truncate text-[13px] font-medium"
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        {board.displayName}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar({ boardsEnabled = false }: { boardsEnabled?: boolean }) {
  const { data: session } = useSession();
  const { status: userStatus } = usePresence();
  const { isOpen, close } = useSidebar();
  const pathname = usePathname();

  // Close drawer on navigation (mobile)
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      close();
    }
  }, [pathname, close]);

  // ---- Core data ----
  const [buddyData, setBuddyData] = useState<BuddiesResponse | null>(null);
  const [requests, setRequests] = useState<BuddyRequestData[]>([]);
  const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);

  // ---- Collapse state (localStorage) ----
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof localStorage === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("sc-aim-collapsed") ?? "{}");
    } catch {
      return {};
    }
  });
  const [offlineCollapsed, setOfflineCollapsed] = useState(() => {
    if (typeof localStorage === "undefined") return true;
    const v = localStorage.getItem("sc-aim-offline-collapsed");
    return v === null ? true : v === "1";
  });

  // ---- Group management state ----
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingToBuddyListId, setAddingToBuddyListId] = useState<string | null>(null);
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListInput, setNewListInput] = useState("");

  // ---- Context menu ----
  const [ctxMenu, setCtxMenu] = useState<{
    buddy: BuddyInGroup;
    x: number;
    y: number;
    listId?: string;
    listName?: string;
  } | null>(null);

  const prevUnreadRef = useRef<Record<string, number>>({});

  // ---- Fetch buddies ----
  const fetchBuddies = async () => {
    const res = await fetch("/api/buddies");
    if (res.ok) setBuddyData(await res.json());
  };

  // ---- Fetch data on mount ----
  useEffect(() => {
    if (!session?.user?.id) return;

    Promise.all([
      fetch("/api/buddies").then((r) => r.json()),
      fetch("/api/buddies/requests").then((r) => r.json()),
      fetch("/api/channels?mine=true").then((r) => r.json()),
      boardsEnabled
        ? fetch("/api/boards?mine=true").then((r) => r.json())
        : Promise.resolve([]),
    ])
      .then(([buddyRes, requestData, channelData, boardData]) => {
        setBuddyData(buddyRes);
        setRequests(Array.isArray(requestData) ? requestData : []);
        setChannels(Array.isArray(channelData) ? channelData : []);
        setBoards(Array.isArray(boardData) ? boardData : []);
      })
      .catch(() => {});
  }, [session?.user?.id, boardsEnabled]);

  // ---- Clear unread badge when navigating into a DM ----
  useEffect(() => {
    const match = pathname?.match(/^\/dm\/(.+)$/);
    if (match) {
      const buddyId = match[1];
      localStorage.setItem(`dm_last_read_${buddyId}`, new Date().toISOString());
      fetch(`/api/messages/${buddyId}/read`, { method: "POST" }).catch(() => {});
      setUnreadDMs((prev) => {
        if (!prev[buddyId]) return prev;
        const next = { ...prev };
        delete next[buddyId];
        return next;
      });
    }
  }, [pathname]);

  // ---- Poll for unread DMs ----
  useEffect(() => {
    if (!session?.user?.id) return;

    const checkUnread = () => {
      fetch("/api/messages/unread")
        .then((r) => (r.ok ? r.json() : []))
        .then(
          (
            data: Array<{
              partnerId: string;
              unreadCount: number;
              latestMessageAt: string;
            }>
          ) => {
            if (!Array.isArray(data)) return;
            const newUnread: Record<string, number> = {};
            let hasNewMessages = false;
            for (const item of data) {
              if (window.location.pathname === `/dm/${item.partnerId}`) continue;
              if (item.unreadCount > 0) {
                newUnread[item.partnerId] = item.unreadCount;
                const prev = prevUnreadRef.current[item.partnerId] ?? 0;
                if (item.unreadCount > prev) hasNewMessages = true;
              }
            }
            if (hasNewMessages) playSound("message_received");
            prevUnreadRef.current = newUnread;
            setUnreadDMs(newUnread);
          }
        )
        .catch(() => {});
    };

    checkUnread();
    const onVisible = () => {
      if (document.visibilityState === "visible") checkUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(checkUnread, 5_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [session?.user?.id]);

  // ---- Re-fetch pending requests when tab regains focus ----
  useEffect(() => {
    if (!session?.user?.id) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetch("/api/buddies/requests")
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) setRequests(data);
          })
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [session?.user?.id]);

  // ---- Pusher subscriptions ----
  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;

    const presenceCh = pusherClient.subscribe(CHANNELS.presenceBuddies(uid));
    presenceCh.bind(EVENTS.STATUS_CHANGE, (p: StatusChangePayload) => {
      setBuddyData((prev) => {
        if (!prev) return prev;
        // Play sound when buddy comes online
        const wasInOffline = prev.offlineBuddies.some((b) => b.userId === p.userId);
        const effectiveStatus = p.status === "INVISIBLE" ? "OFFLINE" : p.status;
        if (wasInOffline && effectiveStatus !== "OFFLINE") {
          playSound("buddy_online");
        }
        return applyStatusChange(prev, { userId: p.userId, status: p.status, awayMessage: p.awayMessage });
      });
    });

    const privateCh = pusherClient.subscribe(CHANNELS.privateUser(uid));
    privateCh.bind(EVENTS.BUDDY_REQUEST, (p: BuddyRequestData) => {
      setRequests((prev) =>
        prev.some((r) => r.requesterId === p.requesterId) ? prev : [p, ...prev]
      );
    });
    privateCh.bind(EVENTS.BUDDY_ACCEPTED, () => {
      fetchBuddies();
    });
    privateCh.bind(EVENTS.NEW_DM, (p: NewDMNotificationPayload) => {
      const currentPath = window.location.pathname;
      if (currentPath !== `/dm/${p.senderId}`) {
        playSound("message_received");
      }
      setUnreadDMs((prev) => {
        if (currentPath === `/dm/${p.senderId}`) return prev;
        return { ...prev, [p.senderId]: (prev[p.senderId] ?? 0) + 1 };
      });
    });

    return () => {
      pusherClient.unsubscribe(CHANNELS.presenceBuddies(uid));
      pusherClient.unsubscribe(CHANNELS.privateUser(uid));
    };
  }, [session?.user?.id]);

  // ---- Request handlers ----
  async function handleAccept(requesterId: string) {
    setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
    const res = await fetch(`/api/buddies/${requesterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) fetchBuddies();
  }

  async function handleDecline(requesterId: string) {
    setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
    await fetch(`/api/buddies/${requesterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
  }

  // ---- Group management ----
  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("sc-aim-collapsed", JSON.stringify(next));
      return next;
    });
  };

  const toggleOffline = () => {
    setOfflineCollapsed((v) => {
      localStorage.setItem("sc-aim-offline-collapsed", !v ? "1" : "0");
      return !v;
    });
  };

  async function createGroup() {
    const name = newListInput.trim().slice(0, 32);
    if (!name) return;
    const res = await fetch("/api/buddy-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setNewListInput("");
      setShowNewListInput(false);
      fetchBuddies();
    }
  }

  async function renameGroup(listId: string) {
    const name = renameValue.trim().slice(0, 32);
    if (!name) { setRenamingGroupId(null); return; }
    const res = await fetch(`/api/buddy-lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setBuddyData((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.map((g) =>
                g.id === listId ? { ...g, name } : g
              ),
            }
          : prev
      );
    }
    setRenamingGroupId(null);
  }

  async function deleteGroup(listId: string) {
    if (!window.confirm("Delete this group?")) return;
    const res = await fetch(`/api/buddy-lists/${listId}`, { method: "DELETE" });
    if (res.ok) fetchBuddies();
  }

  async function addToGroup(listId: string, buddyId: string) {
    const res = await fetch(`/api/buddy-lists/${listId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buddyId }),
    });
    if (res.ok) {
      setAddingToBuddyListId(null);
      fetchBuddies();
    }
  }

  const handleBuddyRemoved = (userId: string) => {
    setBuddyData((prev) => {
      if (!prev) return prev;
      return {
        groups: prev.groups.map((g) => ({
          ...g,
          buddies: g.buddies.filter((b) => b.userId !== userId),
          memberIds: g.memberIds.filter((id) => id !== userId),
        })),
        ungrouped: prev.ungrouped.filter((b) => b.userId !== userId),
        offlineBuddies: prev.offlineBuddies.filter((b) => b.userId !== userId),
      };
    });
  };

  if (!session?.user?.id) return null;

  // All buddies flat (for the "add to group" picker)
  const allBuddies = [
    ...(buddyData?.groups.flatMap((g) => g.buddies) ?? []),
    ...(buddyData?.ungrouped ?? []),
    ...(buddyData?.offlineBuddies ?? []),
  ];

  const clearUnread = (userId: string) =>
    setUnreadDMs((p) => {
      const n = { ...p };
      delete n[userId];
      return n;
    });

  const totalOnline =
    (buddyData?.groups.flatMap((g) => g.buddies).length ?? 0) +
    (buddyData?.ungrouped.length ?? 0);
  const totalBuddies =
    totalOnline + (buddyData?.offlineBuddies.length ?? 0);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-black/60"
          style={{ top: 52 }}
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        onClick={() => unlockSounds()}
        className={`fixed top-[52px] left-0 bottom-0 z-40 flex flex-col border-r overflow-y-auto scrollbar-none transition-transform duration-200 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        style={{
          width: 220,
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* ---- Profile mini-card ---- */}
        <div
          className="px-3 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <Link href={`/u/${session.user.screenname}`}>
              <Avatar
                screenname={session.user.screenname}
                size="md"
                isGoldMember={session.user.isGoldMember}
                status={userStatus}
                bg="var(--surface)"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                href={`/u/${session.user.screenname}`}
                className="text-sm font-semibold leading-tight block truncate transition-colors"
                style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
              >
                {session.user.screenname}
                {session.user.isGoldMember && (
                  <span className="ml-1 text-[10px]" style={{ color: "#d4a017" }}>
                    ★
                  </span>
                )}
              </Link>
              <p className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
                {userStatus.toLowerCase()}
              </p>
            </div>
          </div>

          <SidebarStatusSelector />
          <SoundToggle />
        </div>

        {/* ---- Buddy list ---- */}
        <div>
          {/* Header row */}
          <div className="flex items-center justify-between px-3 pt-4 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-mono uppercase tracking-[0.15em] select-none"
                style={{ color: "var(--text-dim)" }}
              >
                buddies
              </span>
              {/* Summary count */}
              {buddyData && (
                <span className="text-[9px] font-mono" style={{ color: "var(--text-dim)" }}>
                  <span style={{ color: "var(--amber)" }}>{totalOnline}</span>
                  <span>/{totalBuddies}</span>
                </span>
              )}
              {requests.length > 0 && (
                <Link
                  href="/notifications"
                  className="min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold px-1"
                  style={{ background: "#ef4444", color: "#fff" }}
                  title={`${requests.length} pending buddy request${requests.length !== 1 ? "s" : ""}`}
                >
                  {requests.length > 9 ? "9+" : requests.length}
                </Link>
              )}
            </div>
            <Link
              href="/find-buddies"
              className="text-[11px] font-mono transition-colors"
              style={{ color: "var(--text-muted)" }}
              title="add buddy"
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "var(--amber)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")
              }
            >
              +
            </Link>
          </div>

          {/* Pending requests */}
          {requests.map((r) => (
            <BuddyRequest
              key={r.requesterId}
              request={r}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))}

          {/* ---- AIM Groups ---- */}
          {buddyData?.groups.map((group) => {
            const collapsed = collapsedGroups[group.id] ?? false;
            const notInGroup = allBuddies.filter(
              (b) => !group.memberIds.includes(b.userId)
            );
            return (
              <div key={group.id}>
                {/* Rename input OR group header */}
                {renamingGroupId === group.id ? (
                  <div
                    className="flex items-center gap-1 px-3 py-1"
                    style={{ height: 28 }}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value.slice(0, 32))}
                      onBlur={() => renameGroup(group.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameGroup(group.id);
                        if (e.key === "Escape") setRenamingGroupId(null);
                      }}
                      className="flex-1 min-w-0 bg-transparent outline-none text-[11px] font-mono border-b"
                      style={{ color: "var(--text)", borderColor: "var(--amber)" }}
                    />
                  </div>
                ) : (
                  <AimGroupHeader
                    name={group.name}
                    onlineCount={group.buddies.length}
                    totalCount={group.totalCount}
                    collapsed={collapsed}
                    onToggle={() => toggleGroup(group.id)}
                    onRename={() => {
                      setRenamingGroupId(group.id);
                      setRenameValue(group.name);
                    }}
                    onDelete={() => deleteGroup(group.id)}
                    onAddBuddy={() =>
                      setAddingToBuddyListId(
                        addingToBuddyListId === group.id ? null : group.id
                      )
                    }
                  />
                )}

                {/* Buddy picker */}
                {addingToBuddyListId === group.id && (
                  <div
                    className="mx-3 mb-1 rounded-lg border overflow-hidden"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    {notInGroup.length > 0 ? (
                      notInGroup.map((b) => (
                        <button
                          key={b.userId}
                          onClick={() => addToGroup(group.id, b.userId)}
                          className="w-full flex items-center gap-2 px-2 py-1 text-left transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.background =
                              "var(--card)")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.background =
                              "transparent")
                          }
                        >
                          <StatusDot
                            status={
                              b.isOnline ? (b.isAway ? "AWAY" : "ONLINE") : "OFFLINE"
                            }
                            size="sm"
                            bg="var(--surface)"
                          />
                          <span
                            className="truncate text-[12px]"
                            style={{ fontFamily: "var(--font-dm-sans)" }}
                          >
                            {b.screenname}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p
                        className="px-2 py-1 text-[11px] italic"
                        style={{ color: "var(--text-dim)" }}
                      >
                        all buddies added
                      </p>
                    )}
                  </div>
                )}

                {/* Buddy rows */}
                {!collapsed &&
                  group.buddies.map((b) => (
                    <AimBuddyRow
                      key={b.userId}
                      buddy={b}
                      unreadCount={unreadDMs[b.userId]}
                      onClearUnread={() => clearUnread(b.userId)}
                      onCtxMenu={(e) =>
                        setCtxMenu({ buddy: b, x: e.clientX, y: e.clientY, listId: group.id, listName: group.name })
                      }
                    />
                  ))}
              </div>
            );
          })}

          {/* ---- Ungrouped online buddies ---- */}
          {buddyData && buddyData.ungrouped.length > 0 && (
            <div>
              <AimGroupHeader
                name="Buddies"
                onlineCount={buddyData.ungrouped.length}
                totalCount={buddyData.ungrouped.length}
                collapsed={collapsedGroups["__ungrouped__"] ?? false}
                onToggle={() => toggleGroup("__ungrouped__")}
              />
              {!(collapsedGroups["__ungrouped__"] ?? false) &&
                buddyData.ungrouped.map((b) => (
                  <AimBuddyRow
                    key={b.userId}
                    buddy={b}
                    unreadCount={unreadDMs[b.userId]}
                    onClearUnread={() => clearUnread(b.userId)}
                    onCtxMenu={(e) =>
                      setCtxMenu({ buddy: b, x: e.clientX, y: e.clientY })
                    }
                  />
                ))}
            </div>
          )}

          {/* Empty state */}
          {buddyData &&
            buddyData.groups.length === 0 &&
            buddyData.ungrouped.length === 0 &&
            buddyData.offlineBuddies.length === 0 &&
            requests.length === 0 && (
              <p
                className="px-3 py-2 text-[12px] italic"
                style={{ color: "var(--text-dim)", fontFamily: "var(--font-dm-sans)" }}
              >
                no buddies yet.
              </p>
            )}

          {/* New group input */}
          <div className="px-3 mt-1 mb-1">
            {showNewListInput ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newListInput}
                  onChange={(e) => setNewListInput(e.target.value.slice(0, 32))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createGroup();
                    if (e.key === "Escape") {
                      setShowNewListInput(false);
                      setNewListInput("");
                    }
                  }}
                  placeholder="group name…"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[11px] font-mono border-b"
                  style={{ color: "var(--text)", borderColor: "var(--border)" }}
                />
                <button
                  onClick={createGroup}
                  className="text-[10px] font-mono flex-shrink-0"
                  style={{ color: "var(--amber)" }}
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setShowNewListInput(false);
                    setNewListInput("");
                  }}
                  className="text-[10px] font-mono flex-shrink-0"
                  style={{ color: "var(--text-dim)" }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewListInput(true)}
                className="text-[9px] font-mono transition-colors"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)")
                }
              >
                + new group
              </button>
            )}
          </div>

          {/* ---- Offline section ---- */}
          {buddyData && buddyData.offlineBuddies.length > 0 && (
            <div style={{ opacity: 0.45 }}>
              <div
                style={{
                  height: 1,
                  background: "var(--border)",
                  margin: "4px 0",
                }}
              />
              <AimGroupHeader
                name="Offline"
                onlineCount={0}
                totalCount={buddyData.offlineBuddies.length}
                collapsed={offlineCollapsed}
                onToggle={toggleOffline}
                isOffline
              />
              {!offlineCollapsed &&
                buddyData.offlineBuddies.map((b) => (
                  <AimBuddyRow
                    key={b.userId}
                    buddy={b}
                    unreadCount={unreadDMs[b.userId]}
                    onClearUnread={() => clearUnread(b.userId)}
                    onCtxMenu={(e) =>
                      setCtxMenu({ buddy: b, x: e.clientX, y: e.clientY })
                    }
                    isOffline
                  />
                ))}
            </div>
          )}
        </div>

        {/* ---- Discover ---- */}
        <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
          <Link
            href="/discover"
            className="flex items-center gap-2 text-[11px] font-mono transition-colors rounded-lg px-2 py-1.5"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--amber)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-dim)")
            }
          >
            <span>✦</span>
            <span>discover</span>
          </Link>
        </div>

        {/* ---- Channels ---- */}
        {channels.length > 0 && (
          <div>
            <SectionHeader
              label="channels"
              action="create channel"
              actionHref="/channels"
            />
            {channels.map((ch) => (
              <ChannelRow key={ch.id} channel={ch} />
            ))}
          </div>
        )}

        {/* ---- Boards ---- */}
        {boardsEnabled && boards.length > 0 && (
          <div className="pb-4">
            <SectionHeader
              label="boards"
              accent="teal"
              action="create board"
              actionHref="/boards"
            />
            {boards.map((b) => (
              <BoardRow key={b.id} board={b} />
            ))}
          </div>
        )}
      </aside>

      {/* Context menu */}
      {ctxMenu && (
        <BuddyContextMenu
          buddy={ctxMenu.buddy}
          x={ctxMenu.x}
          y={ctxMenu.y}
          listId={ctxMenu.listId}
          listName={ctxMenu.listName}
          onClose={() => setCtxMenu(null)}
          onRemoved={(userId) => {
            setCtxMenu(null);
            handleBuddyRemoved(userId);
          }}
          onRemovedFromList={(userId, listId) => {
            setCtxMenu(null);
            setBuddyData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                groups: prev.groups.map((g) =>
                  g.id === listId
                    ? { ...g, buddies: g.buddies.filter((b) => b.userId !== userId), memberIds: g.memberIds.filter((id) => id !== userId) }
                    : g
                ),
              };
            });
          }}
        />
      )}
    </>
  );
}
