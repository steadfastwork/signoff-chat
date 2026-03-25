"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  tags: string[];
  slowModeMinutes: number;
  memberCap: number | null;
  memberCount: number;
  favoriteByMe: boolean;
  canManage?: boolean;
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

function ChannelCard({
  channel,
  onFavoriteToggle,
}: {
  channel: ChannelSummary;
  onFavoriteToggle?: (id: string, value: boolean) => void;
}) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (toggling) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/channels/${channel.name}/favorite`, { method: "POST" });
      if (res.ok) {
        const { favoriteByMe } = await res.json();
        onFavoriteToggle?.(channel.id, favoriteByMe);
      }
    } finally {
      setToggling(false);
    }
  };

  return (
    <Link
      href={`/channels/${channel.name}`}
      className="flex items-start gap-3 px-4 py-3 rounded-xl border transition-all group"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-bright)";
        (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg)";
      }}
    >
      {/* Hash icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-lg font-mono"
        style={{ background: "var(--surface)", color: "var(--text-dim)" }}
      >
        #
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
          >
            #{channel.name}
          </span>
          <TypeBadge type={channel.type} />
        </div>

        {channel.description && (
          <p
            className="text-xs mt-0.5 line-clamp-2"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
          >
            {channel.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
            {channel.memberCount.toLocaleString()} member
            {channel.memberCount !== 1 ? "s" : ""}
            {channel.slowModeMinutes > 0 && (
              <span className="ml-2">· 🕐 {channel.slowModeMinutes}m slow</span>
            )}
          </p>

          {channel.tags?.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {channel.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
                  style={{ color: "var(--text-dim)", borderColor: "var(--border)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings button (owner only) */}
      {channel.canManage && (
        <button
          onClick={(e) => { e.preventDefault(); router.push(`/channels/${channel.name}/settings`); }}
          className="flex-shrink-0 text-[11px] font-mono px-2 py-1 rounded-lg border transition-all mt-0.5"
          style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
          title="channel settings"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--amber)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--amber)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
        >
          ⚙
        </button>
      )}

      {/* Favorite star */}
      {onFavoriteToggle && (
        <button
          onClick={handleFavorite}
          disabled={toggling}
          className="flex-shrink-0 text-base transition-opacity disabled:opacity-40 mt-0.5"
          style={{ color: channel.favoriteByMe ? "#d4a017" : "var(--text-dim)" }}
          title={channel.favoriteByMe ? "unfavorite" : "favorite"}
        >
          {channel.favoriteByMe ? "★" : "☆"}
        </button>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Channel browser page
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
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

  // Debounced search (re-triggers on query or tagFilter change)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (tagFilter) params.set("tag", tagFilter);
        const res = await fetch(`/api/channels?${params.toString()}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } finally {
        setLoadingSearch(false);
      }
    }, 250);
  }, [query, tagFilter]);

  // Collect all tags from visible results for filter chips
  const allTags = Array.from(
    new Set(results.flatMap((c) => c.tags ?? []))
  ).sort();

  const handleFavoriteToggle = (channelId: string, value: boolean) => {
    setMyChannels((prev) =>
      prev.map((c) => c.id === channelId ? { ...c, favoriteByMe: value } : c)
    );
    setResults((prev) =>
      prev.map((c) => c.id === channelId ? { ...c, favoriteByMe: value } : c)
    );
  };

  const favorites = myChannels.filter((c) => c.favoriteByMe);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--text)" }}
            >
              Channels
            </h1>
            <p
              className="text-sm mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              real-time chatrooms for any vibe
            </p>
          </div>
          {session && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="h-9 px-4 rounded-xl text-sm font-mono font-bold transition-all"
              style={{
                background: showCreate ? "var(--surface)" : "var(--amber)",
                color: showCreate ? "var(--text-muted)" : "#fff8e6",
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
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <CreateChannelPanel onClose={() => setShowCreate(false)} />
          </div>
        )}

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-xl border px-3 h-10 mb-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <span className="text-sm" style={{ color: "var(--text-dim)" }}>
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search channels by name or tag…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text)" }}
          />
          {loadingSearch && (
            <span
              className="text-[10px] font-mono animate-pulse"
              style={{ color: "var(--text-dim)" }}
            >
              …
            </span>
          )}
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-5">
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="text-[10px] font-mono px-2 py-1 rounded-full border transition-all"
                style={{ color: "var(--text-dim)", borderColor: "var(--border)" }}
              >
                × clear
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className="text-[10px] font-mono px-2 py-1 rounded-full border transition-all"
                style={{
                  background: tagFilter === tag ? "rgba(45,212,191,0.10)" : "transparent",
                  color: tagFilter === tag ? "var(--teal)" : "var(--text-dim)",
                  borderColor: tagFilter === tag ? "rgba(45,212,191,0.25)" : "var(--border)",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Favorites section */}
        {session && favorites.length > 0 && (
          <section className="mb-6">
            <h2
              className="text-[11px] font-mono uppercase tracking-widest mb-3"
              style={{ color: "var(--text-dim)" }}
            >
              ★ favorites
            </h2>
            <div className="flex flex-col gap-2">
              {favorites.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} onFavoriteToggle={handleFavoriteToggle} />
              ))}
            </div>
          </section>
        )}

        {/* Your channels */}
        {session && !loadingMine && myChannels.length > 0 && (
          <section className="mb-8">
            <h2
              className="text-[11px] font-mono uppercase tracking-widest mb-3"
              style={{ color: "var(--text-dim)" }}
            >
              your channels
            </h2>
            <div className="flex flex-col gap-2">
              {myChannels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} onFavoriteToggle={handleFavoriteToggle} />
              ))}
            </div>
          </section>
        )}

        {/* Search results */}
        <section>
          {query.length > 0 || tagFilter ? (
            <>
              <h2
                className="text-[11px] font-mono uppercase tracking-widest mb-3"
                style={{ color: "var(--text-dim)" }}
              >
                results
              </h2>
              {results.length === 0 && !loadingSearch ? (
                <p
                  className="text-sm italic py-4"
                  style={{ color: "var(--text-dim)" }}
                >
                  no channels match your search.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map((ch) => (
                    <ChannelCard key={ch.id} channel={ch} onFavoriteToggle={session ? handleFavoriteToggle : undefined} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h2
                className="text-[11px] font-mono uppercase tracking-widest mb-3"
                style={{ color: "var(--text-dim)" }}
              >
                all public channels
              </h2>
              {results.length === 0 && !loadingSearch ? (
                <p
                  className="text-sm italic py-4"
                  style={{ color: "var(--text-dim)" }}
                >
                  no channels yet — be the first!
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map((ch) => (
                    <ChannelCard key={ch.id} channel={ch} onFavoriteToggle={session ? handleFavoriteToggle : undefined} />
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
