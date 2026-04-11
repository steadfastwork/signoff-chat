"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { CurrentlyDisplay } from "@/components/currently/CurrentlyDisplay";
import { parseCurrently, type CurrentlyData } from "@/lib/currently";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AwayFeedEntry {
  userId: string;
  screenname: string;
  isGoldMember: boolean;
  avatarColor: string;
  avatarUrl: string | null;
  currently: CurrentlyData;
  status: string;
  away: {
    id: string;
    content: string;
    setAt: string;
    visibility: string;
    nudgeCount: number;
    replyCount?: number;
    hasNudged?: boolean;
  };
}

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  amber:   { bg: "#78350f", text: "#fcd34d" },
  rose:    { bg: "#881337", text: "#fda4af" },
  sky:     { bg: "#0c4a6e", text: "#7dd3fc" },
  emerald: { bg: "#064e3b", text: "#6ee7b7" },
  violet:  { bg: "#4c1d95", text: "#c4b5fd" },
  orange:  { bg: "#7c2d12", text: "#fdba74" },
};

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function useRelativeTime(iso: string) {
  const [label, setLabel] = useState(() => relativeTime(iso));
  useEffect(() => {
    const tick = () => setLabel(relativeTime(iso));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [iso]);
  return label;
}

// ---------------------------------------------------------------------------
// AwayCard
// ---------------------------------------------------------------------------

export function AwayCard({
  entry: initial,
  onNudge,
}: {
  entry: AwayFeedEntry;
  onNudge?: (id: string, hasNudged: boolean, count: number) => void;
}) {
  const [entry, setEntry] = useState(initial);
  const [nudging, setNudging] = useState(false);
  const router = useRouter();
  const timeLabel = useRelativeTime(entry.away.setAt);
  const colors = AVATAR_COLORS[entry.avatarColor] ?? AVATAR_COLORS.amber;
  const hasNudged = entry.away.hasNudged ?? false;
  const isHighlyNudged = entry.away.nudgeCount > 5;

  // Keep in sync if parent updates the entry (e.g. real-time)
  const prevId = useRef(entry.away.id);
  useEffect(() => {
    if (initial.away.id !== prevId.current) {
      setEntry(initial);
      prevId.current = initial.away.id;
    }
  }, [initial]);

  const toggleNudge = async () => {
    if (nudging) return;
    setNudging(true);
    const nextHasNudged = !hasNudged;
    const nextCount = entry.away.nudgeCount + (hasNudged ? -1 : 1);
    setEntry((e) => ({
      ...e,
      away: { ...e.away, hasNudged: nextHasNudged, nudgeCount: nextCount },
    }));
    try {
      const res = await fetch(`/api/away/${entry.away.id}/nudge`, { method: "POST" });
      if (res.ok) {
        const { hasNudged: srv, nudgeCount: srvCount } = await res.json();
        setEntry((e) => ({
          ...e,
          away: { ...e.away, hasNudged: srv, nudgeCount: srvCount },
        }));
        onNudge?.(entry.away.id, srv, srvCount);
      } else {
        // roll back
        setEntry((e) => ({
          ...e,
          away: { ...e.away, hasNudged: hasNudged, nudgeCount: entry.away.nudgeCount },
        }));
      }
    } finally {
      setNudging(false);
    }
  };

  const openReply = () => {
    router.push(`/dm/${entry.userId}?quote=${encodeURIComponent(entry.away.content)}`);
  };

  const currently = parseCurrently(entry.currently);
  const hasCurrently = Object.values(currently).some(Boolean);

  return (
    <div
      className="px-4 py-4 border-b"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        <Link href={`/u/${entry.screenname}`} className="flex-shrink-0">
          <div className="relative">
            <div
              className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center"
              style={{ background: colors.bg }}
            >
              {entry.avatarUrl ? (
                <Image
                  src={entry.avatarUrl}
                  alt={entry.screenname}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <span
                  className="text-[10px] font-bold font-mono"
                  style={{ color: colors.text }}
                >
                  {entry.screenname.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status={entry.status as StatusValue} size="sm" bg="var(--bg)" />
            </span>
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-1.5 mb-1">
            <Link
              href={`/u/${entry.screenname}`}
              className="text-sm font-semibold"
              style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
            >
              {entry.screenname}
              {entry.isGoldMember && (
                <span className="ml-0.5 text-[10px]" style={{ color: "#d4a017" }}>★</span>
              )}
            </Link>
            <span
              className="text-[11px] font-mono ml-auto flex-shrink-0"
              style={{ color: "var(--text-dim)" }}
            >
              {timeLabel}
            </span>
            {entry.away.visibility === "BUDDIES" && (
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                style={{
                  background: "rgba(139,92,246,0.1)",
                  color: "#a78bfa",
                  border: "1px solid rgba(139,92,246,0.2)",
                }}
              >
                buddies only
              </span>
            )}
          </div>

          {/* Currently pills */}
          {hasCurrently && (
            <div className="mb-2">
              <CurrentlyDisplay currently={currently} size="compact" maxCompact={3} />
            </div>
          )}

          {/* Away message */}
          <p
            className="text-[15px] leading-relaxed pl-3 italic"
            style={{
              color: "var(--text)",
              fontFamily: "var(--font-dm-sans)",
              borderLeft: `3px solid ${isHighlyNudged ? "var(--amber)" : "var(--border)"}`,
            }}
          >
            {entry.away.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2.5">
            <button
              onClick={toggleNudge}
              disabled={nudging}
              className="flex items-center gap-1 text-[11px] font-mono transition-colors disabled:opacity-50"
              style={{ color: hasNudged ? "var(--amber)" : "var(--text-dim)" }}
            >
              <span>👋</span>
              <span>{entry.away.nudgeCount}</span>
            </button>
            <button
              onClick={openReply}
              className="text-[11px] font-mono transition-colors"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-dim)")}
            >
              reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
