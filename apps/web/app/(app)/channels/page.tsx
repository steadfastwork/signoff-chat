"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CreateChannelPanel } from "@/components/CreateChannelPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelSummary {
  id: string;
  name: string;
  description: string | null;
  type: "PUBLIC" | "INVITE_ONLY" | "SECRET";
  slowModeMinutes: number;
  memberCap: number | null;
  memberCount: number;
}

// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: "PUBLIC" | "INVITE_ONLY" | "SECRET" }) {
  if (type === "PUBLIC") return null;
  return (
    <span
      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
      style={{
        background:
          type === "INVITE_ONLY"
            ? "rgba(251,191,36,0.08)"
            : "rgba(139,92,246,0.08)",
        color: type === "INVITE_ONLY" ? "#f59e0b" : "#a78bfa",
        border: `1px solid ${type === "INVITE_ONLY" ? "rgba(251,191,36,0.2)" : "rgba(139,92,246,0.2)"}`,
      }}
    >
      {type === "INVITE_ONLY" ? "🔒 invite only" : "👁 secret"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Channel card
// ---------------------------------------------------------------------------

function ChannelCard({ channel }: { channel: ChannelSummary }) {
  return (
    <Link
      href={`/channels/${channel.name}`}
      className="flex items-start gap-3 px-4 py-3 rounded-xl border transition-all group"
      style={{ borderColor: "#1e1e14", background: "#0d0d0b" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#2a2a1a";
        (e.currentTarget as HTMLAnchorElement).style.background = "#111109";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#1e1e14";
        (e.currentTarget as HTMLAnchorElement).style.background = "#0d0d0b";
      }}
    >
      {/* Hash icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-lg font-mono"
        style={{ background: "#1a1a12", color: "#3a3a2a" }}
      >
        #
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold"
            style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
          >
            #{channel.name}
          </span>
          <TypeBadge type={channel.type} />
        </div>

        {channel.description && (
          <p
            className="text-xs mt-0.5 line-clamp-2"
            style={{ color: "#6b7280", fontFamily: "var(--font-dm-sans)" }}
          >
            {channel.description}
          </p>
        )}

        <p
          className="text-[11px] font-mono mt-1"
          style={{ color: "#2a2a1a" }}
        >
          {channel.memberCount.toLocaleString()} member
          {channel.memberCount !== 1 ? "s" : ""}
          {channel.slowModeMinutes > 0 && (
            <span className="ml-2">· 🕐 {channel.slowModeMinutes}m slow</span>
          )}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Channel browser page
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChannelSummary[]>([]);
  const [myChannels, setMyChannels] = useState<ChannelSummary[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingMine, setLoadingMine] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load user's channels on mount
  useEffect(() => {
    if (!session?.user?.id) { setLoadingMine(false); return; }
    fetch("/api/channels?mine=true")
      .then((r) => r.json())
      .then((data) => setMyChannels(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingMine(false));
  }, [session?.user?.id]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(
          `/api/channels?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } finally {
        setLoadingSearch(false);
      }
    }, 250);
  }, [query]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0d0d0b", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: "#e5e7eb" }}
            >
              Channels
            </h1>
            <p
              className="text-sm mt-0.5"
              style={{ color: "#6b7280" }}
            >
              real-time chatrooms for any vibe
            </p>
          </div>
          {session && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="h-9 px-4 rounded-xl text-sm font-mono font-bold transition-all"
              style={{
                background: showCreate ? "#1a1a12" : "#c8860a",
                color: showCreate ? "#6b7280" : "#fff8e6",
              }}
            >
              {showCreate ? "cancel" : "+ create"}
            </button>
          )}
        </div>

        {/* Create panel */}
        {showCreate && (
          <div
            className="rounded-2xl border mb-6"
            style={{ borderColor: "#1e1e14", background: "#111109" }}
          >
            <CreateChannelPanel onClose={() => setShowCreate(false)} />
          </div>
        )}

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-xl border px-3 h-10 mb-6"
          style={{ borderColor: "#1e1e14", background: "#111109" }}
        >
          <span className="text-sm" style={{ color: "#3a3a2a" }}>
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search channels…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "#d1d5db" }}
          />
          {loadingSearch && (
            <span
              className="text-[10px] font-mono animate-pulse"
              style={{ color: "#3a3a2a" }}
            >
              …
            </span>
          )}
        </div>

        {/* Your channels */}
        {session && !loadingMine && myChannels.length > 0 && (
          <section className="mb-8">
            <h2
              className="text-[11px] font-mono uppercase tracking-widest mb-3"
              style={{ color: "#3a3a2a" }}
            >
              your channels
            </h2>
            <div className="flex flex-col gap-2">
              {myChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} />
              ))}
            </div>
          </section>
        )}

        {/* Search results */}
        <section>
          {query.length > 0 ? (
            <>
              <h2
                className="text-[11px] font-mono uppercase tracking-widest mb-3"
                style={{ color: "#3a3a2a" }}
              >
                results
              </h2>
              {results.length === 0 && !loadingSearch ? (
                <p
                  className="text-sm italic py-4"
                  style={{ color: "#2a2a1a" }}
                >
                  no channels match "{query}"
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map((ch) => (
                    <ChannelCard key={ch.id} channel={ch} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h2
                className="text-[11px] font-mono uppercase tracking-widest mb-3"
                style={{ color: "#3a3a2a" }}
              >
                all public channels
              </h2>
              {results.length === 0 && !loadingSearch ? (
                <p
                  className="text-sm italic py-4"
                  style={{ color: "#2a2a1a" }}
                >
                  no channels yet — be the first!
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map((ch) => (
                    <ChannelCard key={ch.id} channel={ch} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
