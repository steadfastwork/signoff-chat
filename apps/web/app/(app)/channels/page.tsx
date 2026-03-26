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
  category: string | null;
  slowModeMinutes: number;
  memberCap: number | null;
  memberCount: number;
  messageCount?: number;
  isFeatured?: boolean;
  isVerified?: boolean;
  favoriteByMe: boolean;
  canManage?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: "GAMING",    label: "gaming" },
  { value: "MUSIC",     label: "music" },
  { value: "ART",       label: "art" },
  { value: "TECH",      label: "tech" },
  { value: "SPORTS",    label: "sports" },
  { value: "POLITICS",  label: "politics" },
  { value: "HUMOR",     label: "humor" },
  { value: "LIFESTYLE", label: "lifestyle" },
  { value: "STUDY",     label: "study" },
  { value: "SUPPORT",   label: "support" },
  { value: "OTHER",     label: "other" },
];

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
          {channel.isVerified && (
            <span className="text-[10px]" title="verified" style={{ color: "#2dd4bf" }}>✓</span>
          )}
          {channel.isFeatured && (
            <span
              className="text-[10px] font-mono px-1 py-0.5 rounded"
              style={{ background: "rgba(200,134,10,0.1)", color: "#c8860a", border: "1px solid rgba(200,134,10,0.2)" }}
            >
              featured
            </span>
          )}
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

          {channel.category && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
              style={{ color: "var(--text-dim)", borderColor: "var(--border)" }}
            >
              {channel.category.toLowerCase()}
            </span>
          )}

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

type MainTab = "yours" | "discover";
type DiscoverTab = "featured" | "new" | "active" | "category";

export default function ChannelsPage() {
  const { data: session } = useSession();
  const [mainTab, setMainTab] = useState<MainTab>("yours");
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>("featured");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Yours tab
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [myChannels, setMyChannels] = useState<ChannelSummary[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Discover tab
  const [discoverResults, setDiscoverResults] = useState<ChannelSummary[]>([]);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [loadingDiscover, setLoadingDiscover] = useState(false);

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

  // Load discover channels when tab / subtab / category changes
  useEffect(() => {
    if (mainTab !== "discover") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingDiscover(true);
      try {
        const params = new URLSearchParams();
        if (discoverQuery) params.set("q", discoverQuery);
        if (discoverTab === "category" && categoryFilter) {
          params.set("category", categoryFilter);
        } else if (discoverTab === "featured") {
          params.set("mode", "featured");
        } else if (discoverTab === "active") {
          params.set("mode", "active");
        }
        // new = default sort (createdAt desc)
        const res = await fetch(`/api/channels?${params.toString()}`);
        const data = await res.json();
        setDiscoverResults(Array.isArray(data) ? data : []);
      } finally {
        setLoadingDiscover(false);
      }
    }, discoverQuery ? 250 : 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, discoverTab, categoryFilter, discoverQuery]);

  // Filtered "yours" channels
  const filteredMine = myChannels.filter((c) => {
    const q = query.toLowerCase();
    const matchesQuery = !q || c.name.includes(q) || c.description?.toLowerCase().includes(q);
    const matchesTag = !tagFilter || c.tags.includes(tagFilter);
    return matchesQuery && matchesTag;
  });

  const favorites = filteredMine.filter((c) => c.favoriteByMe);
  const nonFavorites = filteredMine.filter((c) => !c.favoriteByMe);
  const allTags = Array.from(new Set(myChannels.flatMap((c) => c.tags ?? []))).sort();

  const handleFavoriteToggle = (channelId: string, value: boolean) => {
    setMyChannels((prev) =>
      prev.map((c) => c.id === channelId ? { ...c, favoriteByMe: value } : c)
    );
    setDiscoverResults((prev) =>
      prev.map((c) => c.id === channelId ? { ...c, favoriteByMe: value } : c)
    );
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              Channels
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              real-time chatrooms for any vibe
            </p>
          </div>
          {session && (
            <button
              onClick={() => { setShowCreate((v) => !v); setMainTab("yours"); }}
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

        {/* Main tabs */}
        <div
          className="flex gap-1 mb-5 p-1 rounded-xl"
          style={{ background: "var(--surface)" }}
        >
          {(["yours", "discover"] as MainTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className="flex-1 h-8 rounded-lg text-xs font-mono font-bold transition-all"
              style={{
                background: mainTab === tab ? "var(--bg)" : "transparent",
                color: mainTab === tab ? "var(--amber)" : "var(--text-muted)",
                boxShadow: mainTab === tab ? "0 1px 3px rgba(0,0,0,0.3)" : undefined,
              }}
            >
              {tab === "yours" ? "your channels" : "discover"}
            </button>
          ))}
        </div>

        {/* ── YOUR CHANNELS tab ── */}
        {mainTab === "yours" && (
          <>
            {/* Search */}
            <div
              className="flex items-center gap-2 rounded-xl border px-3 h-10 mb-3"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <span className="text-sm" style={{ color: "var(--text-dim)" }}>🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search your channels…"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
              />
            </div>

            {/* Tag filter chips */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
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

            {loadingMine ? (
              <p className="text-sm py-8 text-center animate-pulse" style={{ color: "var(--text-dim)" }}>
                loading…
              </p>
            ) : myChannels.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm italic mb-3" style={{ color: "var(--text-dim)" }}>
                  you haven&apos;t joined any channels yet.
                </p>
                <button
                  onClick={() => setMainTab("discover")}
                  className="text-xs font-mono"
                  style={{ color: "var(--amber)" }}
                >
                  explore channels →
                </button>
              </div>
            ) : (
              <>
                {favorites.length > 0 && (
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

                {nonFavorites.length > 0 && (
                  <section>
                    <h2
                      className="text-[11px] font-mono uppercase tracking-widest mb-3"
                      style={{ color: "var(--text-dim)" }}
                    >
                      joined
                    </h2>
                    <div className="flex flex-col gap-2">
                      {nonFavorites.map((ch) => (
                        <ChannelCard key={ch.id} channel={ch} onFavoriteToggle={handleFavoriteToggle} />
                      ))}
                    </div>
                  </section>
                )}

                {filteredMine.length === 0 && (
                  <p className="text-sm italic py-4 text-center" style={{ color: "var(--text-dim)" }}>
                    no channels match your search.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* ── DISCOVER tab ── */}
        {mainTab === "discover" && (
          <>
            {/* Discover subtabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {(
                [
                  { id: "featured", label: "featured" },
                  { id: "new",      label: "newest" },
                  { id: "active",   label: "most active" },
                  { id: "category", label: "by category" },
                ] as { id: DiscoverTab; label: string }[]
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setDiscoverTab(id)}
                  className="flex-shrink-0 h-8 px-3 rounded-lg text-xs font-mono font-bold transition-all border"
                  style={{
                    background: discoverTab === id ? "var(--amber-tint)" : "transparent",
                    color: discoverTab === id ? "var(--amber)" : "var(--text-muted)",
                    borderColor: discoverTab === id ? "var(--amber)" : "var(--border)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category filter (only in category tab) */}
            {discoverTab === "category" && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CATEGORY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setCategoryFilter(categoryFilter === value ? null : value)}
                    className="text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all"
                    style={{
                      background: categoryFilter === value ? "rgba(200,134,10,0.1)" : "transparent",
                      color: categoryFilter === value ? "var(--amber)" : "var(--text-muted)",
                      borderColor: categoryFilter === value ? "var(--amber)" : "var(--border)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Search within discover */}
            <div
              className="flex items-center gap-2 rounded-xl border px-3 h-10 mb-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <span className="text-sm" style={{ color: "var(--text-dim)" }}>🔍</span>
              <input
                value={discoverQuery}
                onChange={(e) => setDiscoverQuery(e.target.value)}
                placeholder="search channels…"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
              />
              {loadingDiscover && (
                <span
                  className="text-[10px] font-mono animate-pulse"
                  style={{ color: "var(--text-dim)" }}
                >
                  …
                </span>
              )}
            </div>

            {discoverResults.length === 0 && !loadingDiscover ? (
              <p className="text-sm italic py-6 text-center" style={{ color: "var(--text-dim)" }}>
                {discoverTab === "featured"
                  ? "no featured channels yet."
                  : discoverTab === "category" && !categoryFilter
                  ? "pick a category above."
                  : "no channels found."}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {discoverResults.map((ch) => (
                  <ChannelCard
                    key={ch.id}
                    channel={ch}
                    onFavoriteToggle={session ? handleFavoriteToggle : undefined}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
