"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CurrentlyDisplay } from "@/components/currently/CurrentlyDisplay";
import { parseCurrently, type CurrentlyData } from "@/lib/currently";
import { StatusDot, type StatusValue } from "@/components/StatusDot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscoverEntry {
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
    nudgeCount: number;
  };
  mutualBuddyCount: number;
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
// Filter pills
// ---------------------------------------------------------------------------

const FILTERS = [
  { key: "all",     label: "All" },
  { key: "books",   label: "Books" },
  { key: "music",   label: "Music" },
  { key: "film",    label: "Film" },
  { key: "games",   label: "Games" },
  { key: "making",  label: "Making things" },
  { key: "offline", label: "Offline vibes" },
];

// ---------------------------------------------------------------------------
// DiscoverCard
// ---------------------------------------------------------------------------

function DiscoverCard({
  entry,
  onAddBuddy,
}: {
  entry: DiscoverEntry;
  onAddBuddy: (userId: string, screenname: string) => void;
}) {
  const colors = AVATAR_COLORS[entry.avatarColor] ?? AVATAR_COLORS.amber;
  const currently = parseCurrently(entry.currently);
  const hasCurrently = Object.values(currently).some(Boolean);

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Link href={`/u/${entry.screenname}`} className="flex-shrink-0">
          <div className="relative">
            <div
              className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center"
              style={{ background: colors.bg }}
            >
              {entry.avatarUrl ? (
                <Image
                  src={entry.avatarUrl}
                  alt={entry.screenname}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <span
                  className="text-[11px] font-bold font-mono"
                  style={{ color: colors.text }}
                >
                  {entry.screenname.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status={entry.status as StatusValue} size="sm" bg="#0a0a08" />
            </span>
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/u/${entry.screenname}`}
                className="text-sm font-semibold"
                style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
              >
                {entry.screenname}
                {entry.isGoldMember && (
                  <span className="ml-0.5 text-[10px]" style={{ color: "#d4a017" }}>★</span>
                )}
              </Link>
              {entry.mutualBuddyCount > 0 && (
                <p className="text-[10px] font-mono mt-0.5" style={{ color: "#3a3a2a" }}>
                  {entry.mutualBuddyCount} mutual {entry.mutualBuddyCount === 1 ? "buddy" : "buddies"}
                </p>
              )}
            </div>
            <button
              onClick={() => onAddBuddy(entry.userId, entry.screenname)}
              className="flex-shrink-0 h-7 px-3 rounded-lg text-[11px] font-mono font-bold transition-all"
              style={{ background: "#2dd4bf22", color: "#2dd4bf", border: "1px solid #2dd4bf33" }}
            >
              + add
            </button>
          </div>

          {hasCurrently && (
            <div className="mt-2">
              <CurrentlyDisplay currently={currently} size="compact" maxCompact={3} />
            </div>
          )}

          <p
            className="mt-2 text-[13px] italic leading-relaxed pl-2.5"
            style={{
              color: "#9ca3af",
              fontFamily: "var(--font-dm-sans)",
              borderLeft: "2px solid #1a1a12",
            }}
          >
            {entry.away.content}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DiscoverPage() {
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState<DiscoverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<Set<string>>(new Set());
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const fetchDiscover = useCallback(async (f: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discover?filter=${f}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscover(filter);
  }, [filter, fetchDiscover]);

  const handleAddBuddy = async (userId: string, screenname: string) => {
    if (requesting.has(userId) || requested.has(userId)) return;
    setRequesting((s) => new Set(s).add(userId));
    try {
      const res = await fetch("/api/buddies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetScreenname: screenname }),
      });
      if (res.ok) {
        setRequested((s) => new Set(s).add(userId));
        setResults((prev) => prev.filter((r) => r.userId !== userId));
      }
    } finally {
      setRequesting((s) => {
        const n = new Set(s);
        n.delete(userId);
        return n;
      });
    }
  };

  const filterLabel = FILTERS.find((f) => f.key === filter);
  const emptyMessages: Record<string, string> = {
    books: "no one in your extended network is reading anything right now.",
    music: "no one is listening to anything right now.",
    film: "no one is watching anything right now.",
    games: "no one is playing anything right now.",
    making: "no one is making anything right now.",
    offline: "no offline vibes right now.",
    all: "no one new to discover right now. try adding some buddies first!",
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0d0d0b", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1
          className="font-vt323 mb-5 select-none"
          style={{ fontSize: 22, color: "var(--amber)", lineHeight: 1 }}
        >
          // discover
        </h1>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex-shrink-0 h-7 px-3 rounded-full text-[11px] font-mono transition-all"
              style={{
                background: filter === f.key ? "#c8860a22" : "transparent",
                color: filter === f.key ? "#c8860a" : "#4b5563",
                border: `1px solid ${filter === f.key ? "#c8860a33" : "#1a1a12"}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-2xl animate-pulse"
                style={{ background: "#0a0a08" }}
              />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p
            className="text-sm italic py-10 text-center"
            style={{ color: "#3a3a2a" }}
          >
            {emptyMessages[filter] ?? emptyMessages.all}
          </p>
        ) : (
          <div className="space-y-3">
            {results.map((entry) => (
              <DiscoverCard
                key={entry.userId}
                entry={entry}
                onAddBuddy={handleAddBuddy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
