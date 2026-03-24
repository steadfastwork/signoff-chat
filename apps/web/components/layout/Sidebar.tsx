"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import { usePresence } from "@/components/PresenceProvider";
import { Avatar } from "@/components/layout/Avatar";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { BuddyRequest, type BuddyRequestData } from "@/components/BuddyRequest";

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

function BuddyRow({ buddy }: { buddy: Buddy }) {
  const section = buddySection(buddy.status);
  return (
    <Link
      href={`/dm/${buddy.id}`}
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
    </Link>
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

  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [requests, setRequests] = useState<BuddyRequestData[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [offlineExpanded, setOfflineExpanded] = useState(false);

  const buddiesRef = useRef<Buddy[]>([]);
  useEffect(() => { buddiesRef.current = buddies; }, [buddies]);

  // ---- Fetch data on mount ----
  useEffect(() => {
    if (!session?.user?.id) return;

    Promise.all([
      fetch("/api/buddies").then((r) => r.json()),
      fetch("/api/buddies/requests").then((r) => r.json()),
      fetch("/api/channels?mine=true").then((r) => r.json()),
      fetch("/api/boards?mine=true").then((r) => r.json()),
    ])
      .then(([buddyData, requestData, channelData, boardData]) => {
        setBuddies(Array.isArray(buddyData) ? buddyData : []);
        setRequests(Array.isArray(requestData) ? requestData : []);
        setChannels(Array.isArray(channelData) ? channelData : []);
        setBoards(Array.isArray(boardData) ? boardData : []);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // ---- Pusher subscriptions ----
  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;

    const presenceCh = pusherClient.subscribe(CHANNELS.presenceBuddies(uid));
    presenceCh.bind(EVENTS.STATUS_CHANGE, (p: StatusChangePayload) => {
      setBuddies((prev) =>
        prev.map((b) =>
          b.id === p.userId ? { ...b, status: p.status, awayMessage: p.awayMessage } : b
        )
      );
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

    return () => {
      pusherClient.unsubscribe(CHANNELS.presenceBuddies(uid));
      pusherClient.unsubscribe(CHANNELS.privateUser(uid));
    };
  }, [session?.user?.id]);

  // ---- Request handlers ----
  async function handleAccept(requesterId: string) {
    const res = await fetch(`/api/buddies/${requesterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) {
      const data = await res.json();
      setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
      if (data.buddy) setBuddies((prev) =>
        prev.some((b) => b.id === data.buddy.id) ? prev : [...prev, data.buddy]
      );
    }
  }

  async function handleDecline(requesterId: string) {
    await fetch(`/api/buddies/${requesterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
  }

  if (!session?.user?.id) return null;

  const online = buddies.filter((b) => buddySection(b.status) === "online");
  const away = buddies.filter((b) => buddySection(b.status) === "away");
  const offline = buddies.filter((b) => buddySection(b.status) === "offline");

  return (
    <aside
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
        <SectionHeader
          label="buddies"
          action="add buddy"
          actionHref="/u/me"
        />

        {/* Pending requests */}
        {requests.map((r) => (
          <BuddyRequest
            key={r.requesterId}
            request={r}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        ))}

        {/* Online */}
        {online.length > 0 && (
          <>
            <p
              className="px-3 pt-1 pb-0.5 text-[9px] font-mono uppercase tracking-[0.15em] select-none"
              style={{ color: "var(--text-dim)" }}
            >
              online ({online.length})
            </p>
            {online.map((b) => <BuddyRow key={b.id} buddy={b} />)}
          </>
        )}

        {/* Away */}
        {away.length > 0 && (
          <>
            <p
              className="px-3 pt-2 pb-0.5 text-[9px] font-mono uppercase tracking-[0.15em] select-none"
              style={{ color: "var(--text-dim)" }}
            >
              away ({away.length})
            </p>
            {away.map((b) => <BuddyRow key={b.id} buddy={b} />)}
          </>
        )}

        {/* Offline — collapsed */}
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
            {offlineExpanded && offline.map((b) => <BuddyRow key={b.id} buddy={b} />)}
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
