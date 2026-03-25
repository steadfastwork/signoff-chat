"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import { playSound, unlockSounds } from "@/lib/sounds";
import { usePresence } from "@/components/PresenceProvider";
import { Avatar } from "@/components/layout/Avatar";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { BuddyRequest, type BuddyRequestData } from "@/components/BuddyRequest";

// ---------------------------------------------------------------------------
// Buddy list group types
// ---------------------------------------------------------------------------

interface BuddyGroupList {
  id: string;
  name: string;
  position: number;
  buddyIds: string[];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Buddy {
  id: string;
  screenname: string;
  isGoldMember: boolean;
  awayMessage: string | null;
  status: StatusValue;
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
              height: 32,
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
// Section header
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
        style={{ color: accent === "teal" ? "var(--teal-dark, #0f766e)" : "var(--text-dim)" }}
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
// Buddy row
// ---------------------------------------------------------------------------

function BuddyRow({ buddy, unreadCount, onClear }: { buddy: Buddy; unreadCount?: number; onClear?: () => void }) {
  const section = buddySection(buddy.status);
  return (
    <Link
      href={`/dm/${buddy.id}`}
      onClick={onClear}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg mx-1 group transition-colors"
      style={{ color: "inherit" }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background = "var(--card)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")
      }
    >
      <Avatar
        screenname={buddy.screenname}
        size="sm"
        isGoldMember={buddy.isGoldMember}
        status={buddy.status}
        bg="var(--surface)"
      />
      <div className="flex-1 min-w-0">
        <p
          className="truncate text-[13px] font-medium leading-tight"
          style={{
            fontFamily: "var(--font-dm-sans)",
            color:
              section === "online"
                ? "var(--text)"
                : section === "away"
                ? "var(--text-muted)"
                : "var(--text-dim)",
          }}
        >
          {buddy.screenname}
          {buddy.isGoldMember && (
            <span className="ml-0.5 text-[10px]" style={{ color: "#d4a017" }}>★</span>
          )}
        </p>
        {buddy.awayMessage && section !== "offline" && (
          <p
            className="truncate text-[11px] italic leading-tight mt-0.5"
            style={{ color: "var(--text-dim)", fontFamily: "var(--font-dm-sans)" }}
          >
            {buddy.awayMessage}
          </p>
        )}
      </div>
      {!!unreadCount && (
        <span
          className="flex-shrink-0 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold px-1"
          style={{ background: "#ef4444", color: "#fff" }}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// BuddyRow with remove button (for list view)
// ---------------------------------------------------------------------------

function BuddyRowWithRemove({ buddy, onRemove, unreadCount, onClear }: { buddy: Buddy; onRemove: () => void; unreadCount?: number; onClear?: () => void }) {
  const section = buddySection(buddy.status);
  return (
    <div className="flex items-center mx-1 rounded-lg group transition-colors relative"
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--card)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      <Link
        href={`/dm/${buddy.id}`}
        onClick={onClear}
        className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0"
        style={{ color: "inherit" }}
      >
        <Avatar
          screenname={buddy.screenname}
          size="sm"
          isGoldMember={buddy.isGoldMember}
          status={buddy.status}
          bg="var(--surface)"
        />
        <div className="flex-1 min-w-0">
          <p
            className="truncate text-[13px] font-medium leading-tight"
            style={{
              fontFamily: "var(--font-dm-sans)",
              color:
                section === "online"
                  ? "var(--text)"
                  : section === "away"
                  ? "var(--text-muted)"
                  : "var(--text-dim)",
            }}
          >
            {buddy.screenname}
            {buddy.isGoldMember && (
              <span className="ml-0.5 text-[10px]" style={{ color: "#d4a017" }}>★</span>
            )}
          </p>
        </div>
        {!!unreadCount && (
          <span
            className="flex-shrink-0 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold px-1"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
      {/* Remove from list button */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 pr-2 text-[11px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--text-dim)" }}
        title="remove from list"
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)")
        }
      >
        ×
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
      <span className="truncate text-[13px] font-medium" style={{ fontFamily: "var(--font-dm-sans)" }}>
        {board.displayName}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar() {
  const { data: session } = useSession();
  const { status: userStatus } = usePresence();
  const pathname = usePathname();

  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [requests, setRequests] = useState<BuddyRequestData[]>([]);
  const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [offlineExpanded, setOfflineExpanded] = useState(false);

  // ---- Buddy lists state ----
  const [buddyLists, setBuddyLists] = useState<BuddyGroupList[]>([]);
  const [listView, setListView] = useState(false);
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingToBuddyListId, setAddingToBuddyListId] = useState<string | null>(null);
  const [newListInput, setNewListInput] = useState("");
  const [showNewListInput, setShowNewListInput] = useState(false);

  const buddiesRef = useRef<Buddy[]>([]);
  useEffect(() => { buddiesRef.current = buddies; }, [buddies]);

  const prevUnreadRef = useRef<Record<string, number>>({});

  // ---- Fetch data on mount ----
  useEffect(() => {
    if (!session?.user?.id) return;

    Promise.all([
      fetch("/api/buddies").then((r) => r.json()),
      fetch("/api/buddies/requests").then((r) => r.json()),
      fetch("/api/channels?mine=true").then((r) => r.json()),
      fetch("/api/boards?mine=true").then((r) => r.json()),
      fetch("/api/buddy-lists").then((r) => r.json()),
    ])
      .then(([buddyData, requestData, channelData, boardData, listData]) => {
        setBuddies(Array.isArray(buddyData) ? buddyData : []);
        setRequests(Array.isArray(requestData) ? requestData : []);
        setChannels(Array.isArray(channelData) ? channelData : []);
        setBoards(Array.isArray(boardData) ? boardData : []);
        if (Array.isArray(listData)) {
          setBuddyLists(listData);
          // Default all lists to expanded
          const expanded: Record<string, boolean> = {};
          listData.forEach((l: BuddyGroupList) => { expanded[l.id] = true; });
          setExpandedLists(expanded);
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // ---- Clear unread badge when navigating into a DM ----
  useEffect(() => {
    const match = pathname?.match(/^\/dm\/(.+)$/);
    if (match) {
      const buddyId = match[1];
      localStorage.setItem(`dm_last_read_${buddyId}`, new Date().toISOString());
      setUnreadDMs((prev) => {
        if (!prev[buddyId]) return prev;
        const next = { ...prev };
        delete next[buddyId];
        return next;
      });
    }
  }, [pathname]);

  // ---- Poll for unread DMs (localStorage-based, reliable without Pusher) ----
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    const checkUnread = () => {
      // Collect all known lastRead timestamps from localStorage and send
      // them as query params so the server can count precisely
      const params = new URLSearchParams();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("dm_last_read_")) {
          const partnerId = key.slice("dm_last_read_".length);
          params.set(`since_${partnerId}`, localStorage.getItem(key)!);
        }
      }

      fetch(`/api/messages/unread?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: Array<{ partnerId: string; unreadCount: number; latestMessageAt: string }>) => {
          if (!Array.isArray(data)) return;
          const newUnread: Record<string, number> = {};
          let hasNewMessages = false;
          for (const item of data) {
            const currentPath = window.location.pathname;
            if (currentPath === `/dm/${item.partnerId}`) {
              localStorage.setItem(`dm_last_read_${item.partnerId}`, new Date().toISOString());
              continue;
            }
            if (item.unreadCount > 0) {
              newUnread[item.partnerId] = item.unreadCount;
              const prev = prevUnreadRef.current[item.partnerId] ?? 0;
              if (item.unreadCount > prev) hasNewMessages = true;
            }
          }
          if (hasNewMessages) playSound("message");
          prevUnreadRef.current = newUnread;
          setUnreadDMs(newUnread);
        })
        .catch(() => {});
    };

    checkUnread();
    const onVisible = () => { if (document.visibilityState === "visible") checkUnread(); };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(checkUnread, 5_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [session?.user?.id]);

  // ---- Re-fetch pending requests when tab regains focus (Pusher fallback) ----
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
      setBuddies((prev) => {
        const existing = prev.find((b) => b.id === p.userId);
        // Play sound when a buddy comes online from a non-online state
        if (existing && existing.status !== "ONLINE" && p.status === "ONLINE") {
          playSound("buddy-online");
        }
        return prev.map((b) =>
          b.id === p.userId ? { ...b, status: p.status, awayMessage: p.awayMessage } : b
        );
      });
    });

    const privateCh = pusherClient.subscribe(CHANNELS.privateUser(uid));
    privateCh.bind(EVENTS.BUDDY_REQUEST, (p: BuddyRequestData) => {
      setRequests((prev) =>
        prev.some((r) => r.requesterId === p.requesterId) ? prev : [p, ...prev]
      );
    });
    privateCh.bind(EVENTS.BUDDY_ACCEPTED, (p: BuddyAcceptedPayload) => {
      setBuddies((prev) =>
        prev.some((b) => b.id === p.id) ? prev : [...prev, p]
      );
    });
    privateCh.bind(EVENTS.NEW_DM, (p: NewDMNotificationPayload) => {
      const currentPath = window.location.pathname;
      if (currentPath !== `/dm/${p.senderId}`) {
        playSound("message");
      }
      // Only increment badge if the DM panel for this sender isn't currently open
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
    // Always remove from UI immediately — if API returns 404 the request was
    // already handled on the notifications page.
    setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
    const res = await fetch(`/api/buddies/${requesterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.buddy) setBuddies((prev) =>
        prev.some((b) => b.id === data.buddy.id) ? prev : [...prev, data.buddy]
      );
    }
  }

  async function handleDecline(requesterId: string) {
    // Always remove from UI immediately.
    setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
    await fetch(`/api/buddies/${requesterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
  }

  // ---- Buddy list handlers ----
  async function createList() {
    const name = newListInput.trim().slice(0, 32);
    if (!name) return;
    const res = await fetch("/api/buddy-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const list = await res.json();
      setBuddyLists((prev) => [...prev, list]);
      setExpandedLists((prev) => ({ ...prev, [list.id]: true }));
      setNewListInput("");
      setShowNewListInput(false);
    }
  }

  async function renameList(listId: string) {
    const name = renameValue.trim().slice(0, 32);
    if (!name) { setRenamingListId(null); return; }
    const res = await fetch(`/api/buddy-lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setBuddyLists((prev) => prev.map((l) => l.id === listId ? { ...l, name } : l));
    }
    setRenamingListId(null);
  }

  async function deleteList(listId: string) {
    if (!window.confirm("Delete this list?")) return;
    const res = await fetch(`/api/buddy-lists/${listId}`, { method: "DELETE" });
    if (res.ok) setBuddyLists((prev) => prev.filter((l) => l.id !== listId));
  }

  async function addToList(listId: string, buddyId: string) {
    const res = await fetch(`/api/buddy-lists/${listId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buddyId }),
    });
    if (res.ok) {
      setBuddyLists((prev) =>
        prev.map((l) =>
          l.id === listId && !l.buddyIds.includes(buddyId)
            ? { ...l, buddyIds: [...l.buddyIds, buddyId] }
            : l
        )
      );
    }
    setAddingToBuddyListId(null);
  }

  async function removeFromList(listId: string, buddyId: string) {
    const res = await fetch(`/api/buddy-lists/${listId}/members/${buddyId}`, { method: "DELETE" });
    if (res.ok) {
      setBuddyLists((prev) =>
        prev.map((l) =>
          l.id === listId ? { ...l, buddyIds: l.buddyIds.filter((id) => id !== buddyId) } : l
        )
      );
    }
  }

  if (!session?.user?.id) return null;

  const online = buddies.filter((b) => buddySection(b.status) === "online");
  const away = buddies.filter((b) => buddySection(b.status) === "away");
  const offline = buddies.filter((b) => buddySection(b.status) === "offline");

  return (
    <aside
      onClick={() => unlockSounds()}
      className="fixed top-[52px] left-0 bottom-0 z-40 hidden md:flex flex-col border-r overflow-y-auto scrollbar-none"
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
          <Avatar
            screenname={session.user.screenname}
            size="md"
            isGoldMember={session.user.isGoldMember}
            status={userStatus}
            bg="var(--surface)"
          />
          <div className="flex-1 min-w-0">
            <Link
              href={`/u/${session.user.screenname}`}
              className="text-sm font-semibold leading-tight block truncate transition-colors"
              style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
            >
              {session.user.screenname}
              {session.user.isGoldMember && (
                <span className="ml-1 text-[10px]" style={{ color: "#d4a017" }}>★</span>
              )}
            </Link>
            <p className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
              {userStatus.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Status selector */}
        <SidebarStatusSelector />
      </div>

      {/* ---- Buddy list ---- */}
      <div>
        {/* Header row with view toggle */}
        <div className="flex items-center justify-between px-3 pt-4 pb-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-mono uppercase tracking-[0.15em] select-none"
              style={{ color: "var(--text-dim)" }}
            >
              buddies
            </span>
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
          <div className="flex items-center gap-1.5">
            {/* View toggle pills */}
            <div
              className="flex items-center rounded-md overflow-hidden border"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                onClick={() => setListView(false)}
                className="px-1.5 py-0.5 text-[9px] font-mono transition-colors"
                style={{
                  background: !listView ? "var(--amber-tint)" : "transparent",
                  color: !listView ? "var(--amber)" : "var(--text-dim)",
                }}
              >
                status
              </button>
              <button
                onClick={() => setListView(true)}
                className="px-1.5 py-0.5 text-[9px] font-mono transition-colors"
                style={{
                  background: listView ? "var(--amber-tint)" : "transparent",
                  color: listView ? "var(--amber)" : "var(--text-dim)",
                }}
              >
                lists
              </button>
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

        {/* ---- Status view ---- */}
        {!listView && (
          <>
            {online.length > 0 && (
              <>
                <p
                  className="px-3 pt-1 pb-0.5 text-[9px] font-mono uppercase tracking-[0.15em] select-none"
                  style={{ color: "var(--text-dim)" }}
                >
                  online ({online.length})
                </p>
                {online.map((b) => <BuddyRow key={b.id} buddy={b} unreadCount={unreadDMs[b.id]} onClear={() => setUnreadDMs((p) => { const n = { ...p }; delete n[b.id]; return n; })} />)}
              </>
            )}
            {away.length > 0 && (
              <>
                <p
                  className="px-3 pt-2 pb-0.5 text-[9px] font-mono uppercase tracking-[0.15em] select-none"
                  style={{ color: "var(--text-dim)" }}
                >
                  away ({away.length})
                </p>
                {away.map((b) => <BuddyRow key={b.id} buddy={b} unreadCount={unreadDMs[b.id]} onClear={() => setUnreadDMs((p) => { const n = { ...p }; delete n[b.id]; return n; })} />)}
              </>
            )}
            {offline.length > 0 && (
              <>
                <button
                  onClick={() => setOfflineExpanded((v) => !v)}
                  className="w-full px-3 pt-2 pb-0.5 text-left text-[9px] font-mono uppercase tracking-[0.15em] select-none transition-colors"
                  style={{ color: "var(--text-dim)" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)")
                  }
                >
                  {offlineExpanded ? "▾" : "▸"} offline ({offline.length})
                </button>
                {offlineExpanded && offline.map((b) => <BuddyRow key={b.id} buddy={b} unreadCount={unreadDMs[b.id]} onClear={() => setUnreadDMs((p) => { const n = { ...p }; delete n[b.id]; return n; })} />)}
              </>
            )}
            {buddies.length === 0 && requests.length === 0 && (
              <p
                className="px-3 py-2 text-[12px] italic"
                style={{ color: "var(--text-dim)", fontFamily: "var(--font-dm-sans)" }}
              >
                no buddies yet.
              </p>
            )}
          </>
        )}

        {/* ---- List view ---- */}
        {listView && (
          <div className="pb-1">
            {buddyLists.map((list) => {
              const listBuddies = buddies.filter((b) => list.buddyIds.includes(b.id));
              const expanded = expandedLists[list.id] ?? true;
              const notInList = buddies.filter((b) => !list.buddyIds.includes(b.id));
              return (
                <div key={list.id} className="mt-1">
                  {/* List header */}
                  <div
                    className="flex items-center gap-1 px-3 py-1 group"
                    style={{ minHeight: 24 }}
                  >
                    {/* Collapse toggle */}
                    <button
                      onClick={() =>
                        setExpandedLists((prev) => ({ ...prev, [list.id]: !prev[list.id] }))
                      }
                      className="text-[9px] font-mono flex-shrink-0 transition-colors"
                      style={{ color: "var(--text-dim)", width: 10 }}
                    >
                      {expanded ? "▾" : "▸"}
                    </button>

                    {/* List name / rename input */}
                    {renamingListId === list.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value.slice(0, 32))}
                        onBlur={() => renameList(list.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameList(list.id);
                          if (e.key === "Escape") setRenamingListId(null);
                        }}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[11px] font-mono border-b"
                        style={{ color: "var(--text)", borderColor: "var(--amber)" }}
                      />
                    ) : (
                      <span
                        className="flex-1 min-w-0 truncate text-[10px] font-mono uppercase tracking-[0.1em] select-none"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {list.name}
                        <span className="opacity-60 ml-1">({listBuddies.length})</span>
                      </span>
                    )}

                    {/* Actions (show on group hover) */}
                    {renamingListId !== list.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {/* Add buddy to list */}
                        <button
                          onClick={() =>
                            setAddingToBuddyListId(
                              addingToBuddyListId === list.id ? null : list.id
                            )
                          }
                          className="text-[10px] font-mono transition-colors"
                          style={{ color: "var(--text-dim)" }}
                          title="add buddy to list"
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color = "var(--amber)")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)")
                          }
                        >
                          +
                        </button>
                        {/* Rename */}
                        <button
                          onClick={() => {
                            setRenamingListId(list.id);
                            setRenameValue(list.name);
                          }}
                          className="text-[10px] font-mono transition-colors"
                          style={{ color: "var(--text-dim)" }}
                          title="rename list"
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)")
                          }
                        >
                          ✎
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => deleteList(list.id)}
                          className="text-[10px] font-mono transition-colors"
                          style={{ color: "var(--text-dim)" }}
                          title="delete list"
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)")
                          }
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Buddy picker for adding to list */}
                  {addingToBuddyListId === list.id && notInList.length > 0 && (
                    <div
                      className="mx-3 mb-1 rounded-lg border overflow-hidden"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    >
                      {notInList.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => addToList(list.id, b.id)}
                          className="w-full flex items-center gap-2 px-2 py-1 text-left transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.background = "var(--card)")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                          }
                        >
                          <StatusDot status={b.status} size="sm" bg="var(--surface)" />
                          <span className="truncate text-[12px]" style={{ fontFamily: "var(--font-dm-sans)" }}>
                            {b.screenname}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {addingToBuddyListId === list.id && notInList.length === 0 && (
                    <p
                      className="px-4 pb-1 text-[11px] italic"
                      style={{ color: "var(--text-dim)" }}
                    >
                      all buddies added
                    </p>
                  )}

                  {/* Buddy rows */}
                  {expanded && (
                    <>
                      {listBuddies.length === 0 ? (
                        <p
                          className="px-4 pb-1 text-[11px] italic"
                          style={{ color: "var(--text-dim)" }}
                        >
                          empty — hover to add buddies
                        </p>
                      ) : (
                        listBuddies.map((b) => (
                          <BuddyRowWithRemove
                            key={b.id}
                            buddy={b}
                            onRemove={() => removeFromList(list.id, b.id)}
                            unreadCount={unreadDMs[b.id]}
                            onClear={() => setUnreadDMs((p) => { const n = { ...p }; delete n[b.id]; return n; })}
                          />
                        ))
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* New list controls */}
            <div className="px-3 mt-2">
              {showNewListInput ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newListInput}
                    onChange={(e) => setNewListInput(e.target.value.slice(0, 32))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createList();
                      if (e.key === "Escape") { setShowNewListInput(false); setNewListInput(""); }
                    }}
                    placeholder="list name…"
                    className="flex-1 min-w-0 bg-transparent outline-none text-[11px] font-mono border-b"
                    style={{ color: "var(--text)", borderColor: "var(--border)" }}
                  />
                  <button
                    onClick={createList}
                    className="text-[10px] font-mono flex-shrink-0 transition-colors"
                    style={{ color: "var(--amber)" }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => { setShowNewListInput(false); setNewListInput(""); }}
                    className="text-[10px] font-mono flex-shrink-0 transition-colors"
                    style={{ color: "var(--text-dim)" }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewListInput(true)}
                  className="text-[10px] font-mono transition-colors"
                  style={{ color: "var(--text-dim)" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "var(--amber)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)")
                  }
                >
                  + new list
                </button>
              )}
            </div>

            {buddies.length === 0 && (
              <p
                className="px-3 py-2 text-[12px] italic"
                style={{ color: "var(--text-dim)", fontFamily: "var(--font-dm-sans)" }}
              >
                no buddies yet.
              </p>
            )}
          </div>
        )}
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
      {boards.length > 0 && (
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
  );
}
