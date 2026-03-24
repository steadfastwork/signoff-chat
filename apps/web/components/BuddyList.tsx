"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { BuddyRequest, type BuddyRequestData } from "@/components/BuddyRequest";
import { getInitials } from "@/lib/utils";

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

interface StatusChangePayload {
  userId: string;
  screenname: string;
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

function sectionOf(status: StatusValue): "online" | "away" | "offline" {
  if (status === "ONLINE") return "online";
  if (status === "AWAY" || status === "IDLE") return "away";
  return "offline";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({
  label,
  count,
  collapsible,
  expanded,
  onToggle,
}: {
  label: string;
  count: number;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const inner = (
    <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.15em] select-none">
      {collapsible && (
        <span className="text-[8px]">{expanded ? "▾" : "▸"}</span>
      )}
      <span>{label}</span>
      <span className="opacity-60">({count})</span>
    </span>
  );

  if (collapsible) {
    return (
      <button
        onClick={onToggle}
        className="w-full px-3 py-1 text-left text-green-800 hover:text-green-600 transition-colors"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="px-3 py-1 text-green-800">{inner}</div>
  );
}

function BuddyRow({ buddy }: { buddy: Buddy }) {
  return (
    <Link
      href={`/dm/${buddy.id}`}
      className="flex items-center gap-2.5 px-2.5 h-12 hover:bg-green-950/40 transition-colors group"
    >
      {/* Avatar with status dot */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-green-900 flex items-center justify-center">
          <span className="text-[11px] font-bold text-green-300 font-mono">
            {getInitials(buddy.screenname)}
          </span>
        </div>
        <span className="absolute -bottom-0.5 -right-0.5">
          <StatusDot status={buddy.status} size="sm" bg="#000" />
        </span>
      </div>

      {/* Name + away message */}
      <div className="flex-1 min-w-0">
        <p
          className="truncate text-xs font-mono leading-tight group-hover:text-green-100 transition-colors"
          style={{
            color:
              sectionOf(buddy.status) === "online"
                ? "#86efac"
                : sectionOf(buddy.status) === "away"
                ? "#d1d5db"
                : "#4b5563",
          }}
        >
          {buddy.screenname}
          {buddy.isGoldMember && (
            <span className="ml-0.5 text-[10px]" style={{ color: "#d4a017" }}>
              ★
            </span>
          )}
        </p>
        {buddy.awayMessage && sectionOf(buddy.status) !== "offline" && (
          <p className="text-[10px] font-mono text-green-800 truncate italic leading-tight mt-0.5">
            {buddy.awayMessage}
          </p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BuddyList() {
  const { data: session } = useSession();
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [requests, setRequests] = useState<BuddyRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineExpanded, setOfflineExpanded] = useState(false);

  // Keep a ref to avoid stale closures in Pusher handlers
  const buddiesRef = useRef<Buddy[]>([]);
  useEffect(() => { buddiesRef.current = buddies; }, [buddies]);

  // ---- Initial fetch -------------------------------------------------------
  useEffect(() => {
    Promise.all([
      fetch("/api/buddies").then((r) => r.json()),
      fetch("/api/buddies/requests").then((r) => r.json()),
    ])
      .then(([buddyData, requestData]) => {
        setBuddies(Array.isArray(buddyData) ? buddyData : []);
        setRequests(Array.isArray(requestData) ? requestData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ---- Pusher subscriptions -----------------------------------------------
  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    // 1. presence-buddies-{userId}: real-time status changes from buddies
    const presenceCh = pusherClient.subscribe(CHANNELS.presenceBuddies(userId));
    presenceCh.bind(EVENTS.STATUS_CHANGE, (payload: StatusChangePayload) => {
      setBuddies((prev) =>
        prev.map((b) =>
          b.id === payload.userId
            ? { ...b, status: payload.status, awayMessage: payload.awayMessage }
            : b
        )
      );
    });

    // 2. private-user-{userId}: incoming requests and acceptances
    const privateCh = pusherClient.subscribe(CHANNELS.privateUser(userId));

    privateCh.bind(EVENTS.BUDDY_REQUEST, (payload: BuddyRequestData) => {
      // Only add if not already in the list
      setRequests((prev) =>
        prev.some((r) => r.requesterId === payload.requesterId)
          ? prev
          : [payload, ...prev]
      );
    });

    privateCh.bind(EVENTS.BUDDY_ACCEPTED, (payload: BuddyAcceptedPayload) => {
      // Add the new buddy if not already present
      setBuddies((prev) =>
        prev.some((b) => b.id === payload.id)
          ? prev
          : [...prev, { ...payload }]
      );
    });

    return () => {
      pusherClient.unsubscribe(CHANNELS.presenceBuddies(userId));
      pusherClient.unsubscribe(CHANNELS.privateUser(userId));
    };
  }, [session?.user?.id]);

  // ---- Request handlers ---------------------------------------------------
  async function handleAccept(requesterId: string) {
    const res = await fetch(`/api/buddies/${requesterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) {
      const data = await res.json();
      setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
      if (data.buddy) {
        setBuddies((prev) =>
          prev.some((b) => b.id === data.buddy.id) ? prev : [...prev, data.buddy]
        );
      }
    }
  }

  async function handleDecline(requesterId: string) {
    const res = await fetch(`/api/buddies/${requesterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
    }
  }

  // ---- Derived state -------------------------------------------------------
  const online = buddies.filter((b) => sectionOf(b.status) === "online");
  const away = buddies.filter((b) => sectionOf(b.status) === "away");
  const offline = buddies.filter((b) => sectionOf(b.status) === "offline");

  // ---- Render --------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-4 text-green-800 font-mono text-xs animate-pulse">
        loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col text-xs select-none">
      {/* Header */}
      <div className="px-3 py-2 border-b border-green-950 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-green-700">
          buddy list
        </span>
        <span className="font-mono text-[10px] text-green-900">
          {buddies.length}
        </span>
      </div>

      {/* Pending requests */}
      {requests.length > 0 && (
        <div className="border-b border-green-950 pb-1 pt-0.5">
          <div className="px-3 py-1 text-[9px] font-mono uppercase tracking-[0.15em] text-green-700">
            requests ({requests.length})
          </div>
          {requests.map((r) => (
            <BuddyRequest
              key={r.requesterId}
              request={r}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {buddies.length === 0 && requests.length === 0 && (
        <p className="px-3 py-4 font-mono text-[11px] text-green-900 italic">
          no buddies yet.
        </p>
      )}

      {/* Online */}
      {online.length > 0 && (
        <div className="border-b border-green-950/50 pb-0.5">
          <SectionLabel label="online" count={online.length} />
          {online.map((b) => (
            <BuddyRow key={b.id} buddy={b} />
          ))}
        </div>
      )}

      {/* Away / Idle */}
      {away.length > 0 && (
        <div className="border-b border-green-950/50 pb-0.5">
          <SectionLabel label="away" count={away.length} />
          {away.map((b) => (
            <BuddyRow key={b.id} buddy={b} />
          ))}
        </div>
      )}

      {/* Offline — collapsed by default */}
      {offline.length > 0 && (
        <div className="pb-0.5">
          <SectionLabel
            label="offline"
            count={offline.length}
            collapsible
            expanded={offlineExpanded}
            onToggle={() => setOfflineExpanded((v) => !v)}
          />
          {offlineExpanded &&
            offline.map((b) => <BuddyRow key={b.id} buddy={b} />)}
        </div>
      )}
    </div>
  );
}
