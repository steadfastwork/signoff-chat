"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import { parseCurrently } from "@/lib/currently";
import { AwayCard, type AwayFeedEntry } from "@/components/away/AwayCard";
import { AwayHero } from "@/components/away/AwayHero";
import type { CurrentlyData } from "@/lib/currently";

interface OwnState {
  awayMessage: string | null;
  awayVisibility: "PUBLIC" | "BUDDIES" | "PRIVATE";
  currently: CurrentlyData;
}

export function AwayFeed() {
  const { data: session } = useSession();
  const [own, setOwn] = useState<OwnState | null>(null);
  const [entries, setEntries] = useState<AwayFeedEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Keep ref for Pusher handler
  const entriesRef = useRef<AwayFeedEntry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  // ---- Load own profile ----
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setOwn({
          awayMessage: data.awayMessage ?? null,
          awayVisibility: "PUBLIC",
          currently: parseCurrently(data.currently),
        });
      })
      .catch(() => {});
  }, []);

  // ---- Load away feed ----
  const fetchFeed = useCallback(async (cur?: string) => {
    const url = cur ? `/api/away-feed?cursor=${cur}` : "/api/away-feed";
    const res = await fetch(url);
    return res.json() as Promise<{ entries: AwayFeedEntry[]; cursor: string | null }>;
  }, []);

  useEffect(() => {
    fetchFeed()
      .then((data) => {
        setEntries(data.entries ?? []);
        setCursor(data.cursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchFeed]);

  // ---- Real-time away updates ----
  useEffect(() => {
    if (!session?.user?.id) return;

    const ch = pusherClient.subscribe(CHANNELS.privateUser(session.user.id));

    ch.bind(EVENTS.AWAY_MESSAGE_CHANGED, (payload: AwayFeedEntry) => {
      setEntries((prev) => {
        const exists = prev.findIndex((e) => e.userId === payload.userId);
        if (exists >= 0) {
          // Update in place and move to top if visibility allows
          const updated = [...prev];
          updated.splice(exists, 1);
          return [payload, ...updated];
        }
        // New entry — prepend
        return [payload, ...prev];
      });
    });

    return () => {
      pusherClient.unsubscribe(CHANNELS.privateUser(session.user.id));
    };
  }, [session?.user?.id]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchFeed(cursor);
      setEntries((prev) => {
        const ids = new Set(prev.map((e) => e.away.id));
        return [...prev, ...(data.entries ?? []).filter((e) => !ids.has(e.away.id))];
      });
      setCursor(data.cursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOwnSaved = (
    msg: string,
    cur: CurrentlyData,
    visibility: "PUBLIC" | "BUDDIES" | "PRIVATE"
  ) => {
    setOwn({ awayMessage: msg, awayVisibility: visibility, currently: cur });
  };

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && cursor) loadMore(); },
      { rootMargin: "200px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, loadMore]);

  return (
    <div className="flex flex-col">
      {/* Own hero card */}
      {own && (
        <div className="mb-4">
          <AwayHero
            awayMessage={own.awayMessage}
            awayVisibility={own.awayVisibility}
            currently={own.currently}
            onSaved={handleOwnSaved}
          />
        </div>
      )}

      {/* Section header */}
      {!loading && entries.length > 0 && (
        <p
          className="text-[9px] font-mono uppercase tracking-widest mb-3"
          style={{ color: "var(--text-dim)" }}
        >
          your buddies — right now
        </p>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl animate-pulse"
              style={{ background: "#0a0a08" }}
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p
          className="text-sm italic py-8 text-center"
          style={{ color: "var(--text-dim)", fontFamily: "var(--font-dm-sans)" }}
        >
          quiet in here. your buddies haven&apos;t set away messages yet.
          <br />
          <span className="text-xs not-italic font-mono" style={{ color: "var(--text-dim)" }}>
            be the first to say where you&apos;re at.
          </span>
        </p>
      ) : (
        <div className="flex flex-col -mx-4">
          {entries.map((entry) => (
            <AwayCard
              key={`${entry.userId}-${entry.away.id}`}
              entry={entry}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {loadingMore && (
        <p className="text-[11px] font-mono text-center py-3" style={{ color: "var(--text-dim)" }}>
          loading…
        </p>
      )}
    </div>
  );
}
