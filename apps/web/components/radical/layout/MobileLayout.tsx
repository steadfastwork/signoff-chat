"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { PostCard, type PostCardPost } from "@/components/radical/PostCard";
import { TagFilterBar } from "@/components/radical/TagFilterBar";
import { FeedEmptyState } from "@/components/radical/FeedEmptyState";
import { PersonBubble } from "@/components/radical/PersonBubble";
import { PostComposer } from "@/components/radical/PostComposer";
import { useRadicalLayout, type BuddyData } from "./RadicalLayoutContext";
import { AVATAR_PALETTE } from "./avatarPalette";
import { getInitials, formatTimestamp } from "@/lib/utils";
import { deriveAvatarColor } from "@/lib/auth";
import { parseCurrently, filledFields, CURRENTLY_META } from "@/lib/currently";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiPost {
  id: string;
  postType: "AWAY" | "THOUGHT" | "QUOTE" | "PHOTO";
  content: string;
  bodyText?: string | null;
  quoteText?: string | null;
  quoteAttrib?: string | null;
  imageUrl?: string | null;
  imageCaption?: string | null;
  tags: string[];
  nudgeCount: number;
  echoCount: number;
  hasNudged: boolean;
  setAt: string;
  editedAt?: string | null;
  echoOf?: { user: { screenname: string } } | null;
  user: { id: string; screenname: string; isGoldMember: boolean; avatarColor?: string; status: string; currently: unknown };
}

function mapPost(p: ApiPost, viewerId?: string): PostCardPost {
  const currently = parseCurrently(p.user.currently);
  return {
    id:           p.id,
    postType:     p.postType,
    user:         { screenname: p.user.screenname, avatarColor: p.user.avatarColor, isGoldMember: p.user.isGoldMember },
    awayMessage:  p.content || undefined,
    bodyText:     p.bodyText ?? undefined,
    quoteText:    p.quoteText ?? undefined,
    quoteAttrib:  p.quoteAttrib ?? undefined,
    imageUrl:     p.imageUrl ?? undefined,
    imageCaption: p.imageCaption ?? undefined,
    tags:         p.tags ?? [],
    nudgeCount:   p.nudgeCount,
    echoCount:    p.echoCount,
    hasNudged:    p.hasNudged,
    createdAt:    new Date(p.setAt),
    editedAt:     p.editedAt ? new Date(p.editedAt) : null,
    isOwnPost:    viewerId ? p.user.id === viewerId : false,
    awayStatus:   (p.user.status as "ONLINE" | "AWAY" | "OFFLINE") || "OFFLINE",
    currentlyFields: filledFields(currently).map(([key]) => ({
      emoji: CURRENTLY_META[key].emoji, label: CURRENTLY_META[key].label,
    })),
    echoOf: p.echoOf ?? null,
  };
}

// ---------------------------------------------------------------------------
// Mobile Feed screen
// ---------------------------------------------------------------------------

function MobileFeedScreen() {
  const { data: session }  = useSession();
  const { activeTag, setActiveTag, setComposerOpen, setComposerType, activeScreen } = useRadicalLayout();
  const [posts,     setPosts]     = useState<PostCardPost[]>([]);
  const [cursor,    setCursor]    = useState<string | null>(null);
  const [hasMore,   setHasMore]   = useState(true);
  const [loading,   setLoading]   = useState(true);
  const [tagCounts, setTagCounts] = useState<{ tag: string; count: number }[]>([]);
  const [buddies,   setBuddies]   = useState<BuddyData[]>([]);
  const [awayMsg,   setAwayMsg]   = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  const viewerId = session?.user?.id;

  // Scroll to top when feed becomes active
  useEffect(() => {
    if (activeScreen === "feed" && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeScreen]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTag && activeTag !== "all") {
      if (["away", "thought", "quote", "photo"].includes(activeTag.toLowerCase())) {
        params.set("type", activeTag.toUpperCase());
      } else {
        params.set("tag", activeTag);
      }
    }
    fetch(`/api/posts?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setPosts(data.posts.map((p: ApiPost) => mapPost(p, viewerId)));
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
        const tally = new Map<string, number>();
        for (const p of data.posts) {
          for (const t of p.tags) tally.set(t, (tally.get(t) ?? 0) + 1);
        }
        setTagCounts(Array.from(tally.entries()).map(([tag, count]) => ({ tag, count })));
      })
      .finally(() => setLoading(false));
  }, [activeTag]);

  useEffect(() => {
    fetch("/api/buddies")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const all: BuddyData[] = [];
        const add = (arr: any[]) => arr.forEach((b) => all.push({
          userId: b.userId, screenname: b.screenname, isGold: b.isGold,
          isOnline: b.isOnline, isAway: b.isAway, awayMessage: b.awayMessage ?? "",
          currently: b.currently ?? [], avatarColor: deriveAvatarColor(b.userId),
        }));
        for (const g of (data.groups ?? [])) add(g.buddies ?? []);
        add(data.ungrouped ?? []);
        setBuddies(all.filter((b) => b.isOnline).slice(0, 8));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/away-feed?userId=${session.user.id}&limit=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setAwayMsg(data?.feed?.[0]?.awayMessage ?? ""))
      .catch(() => {});
  }, [session?.user?.id]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loading) {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        if (activeTag && activeTag !== "all") {
          if (["away", "thought", "quote", "photo"].includes(activeTag.toLowerCase())) {
            params.set("type", activeTag.toUpperCase());
          } else {
            params.set("tag", activeTag);
          }
        }
        fetch(`/api/posts?${params}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            if (!data) return;
            setPosts((prev) => [...prev, ...data.posts.map((p: ApiPost) => mapPost(p, viewerId))]);
            setCursor(data.nextCursor);
            setHasMore(!!data.nextCursor);
          });
      }
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [activeTag, cursor, hasMore, loading]);

  const avatarColor = session?.user?.avatarColor ?? "amber";
  const { bg, fg } = AVATAR_PALETTE[avatarColor] ?? AVATAR_PALETTE.amber;

  return (
    <div ref={scrollRef} style={{ height: "100%", overflowY: "auto", padding: "0 0 80px" }}>
      {/* Status card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setComposerType("AWAY"); setComposerOpen(true); }}
        onKeyDown={(e) => e.key === "Enter" && (setComposerType("AWAY"), setComposerOpen(true))}
        style={{
          margin: "14px 16px 0",
          padding: "14px 16px",
          background: "var(--fog1)", border: "1px solid rgba(232,150,26,.15)",
          borderRadius: "var(--r2)", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 11,
          background: bg, color: fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none", flexShrink: 0,
        }}>
          {getInitials(session?.user?.screenname ?? "")}
        </div>
        <p style={{
          fontFamily: "var(--serif)", fontStyle: "italic",
          fontSize: 15, color: awayMsg ? "var(--snow)" : "var(--snow4)",
          margin: 0, flex: 1, lineHeight: 1.4,
        }}>
          {awayMsg || "what are you up to?"}
        </p>
        <span style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--sans)", flexShrink: 0 }}>
          ✦
        </span>
      </div>

      {/* Buddy bubbles */}
      {buddies.length > 0 && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{
            display: "flex", gap: 12, overflowX: "auto",
            scrollbarWidth: "none", paddingBottom: 4,
          }}>
            {buddies.map((b) => {
              const { bg: aBg, fg: aFg } = AVATAR_PALETTE[b.avatarColor] ?? AVATAR_PALETTE.amber;
              return (
                <PersonBubble
                  key={b.userId}
                  user={{ screenname: b.screenname, avatarBg: aBg, avatarColor: aFg, initials: getInitials(b.screenname) }}
                  awayStatus={!b.isOnline ? "OFFLINE" : b.isAway ? "AWAY" : "ONLINE"}
                  onClick={() => {}}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tag filter */}
      <div style={{ padding: "0 16px" }}>
        <TagFilterBar activeTag={activeTag} tags={tagCounts} onTagSelect={setActiveTag} />
      </div>

      {/* Posts */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)" }}>Loading…</span>
          </div>
        ) : posts.length === 0 ? (
          <FeedEmptyState activeTag={activeTag} />
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={{ ...p, isOwnPost: p.user.screenname === session?.user?.screenname }}
              onNudge={() => {}} onEcho={() => {}} onReply={() => {}}
              onTagClick={setActiveTag} onUserClick={() => {}}
              onDelete={(postId) => setPosts((prev) => prev.filter((x) => x.id !== postId))}
              onEdit={(postId, updates) => setPosts((prev) => prev.map((x) => x.id === postId ? { ...x, ...updates } : x))}
            />
          ))
        )}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile Talk screen
// ---------------------------------------------------------------------------

function MobileTalkScreen() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [chatUserId, setChatUserId]       = useState<string | null>(null);
  const [chatMessages, setChatMessages]   = useState<any[]>([]);
  const [input, setInput]                 = useState("");
  const { data: session }                 = useSession();

  useEffect(() => {
    fetch("/api/buddies")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const all: any[] = [];
        const add = (arr: any[]) => arr.forEach((b) => all.push(b));
        for (const g of (data.groups ?? [])) add(g.buddies ?? []);
        add(data.ungrouped ?? []);
        add(data.offlineBuddies ?? []);
        setConversations(all);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!chatUserId) return;
    fetch(`/api/messages/${chatUserId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.messages) setChatMessages(data.messages); });
  }, [chatUserId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !chatUserId) return;
    setInput("");
    await fetch(`/api/messages/${chatUserId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    fetch(`/api/messages/${chatUserId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.messages) setChatMessages(data.messages); });
  };

  if (chatUserId) {
    const buddy = conversations.find((c) => c.userId === chatUserId);
    const { bg, fg } = AVATAR_PALETTE[deriveAvatarColor(chatUserId)] ?? AVATAR_PALETTE.amber;

    return (
      <div style={{ height: "calc(100% - 90px)", display: "flex", flexDirection: "column" }}>
        {/* Chat header */}
        <div style={{
          height: 52, borderBottom: "1px solid var(--edge1)",
          display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
          flexShrink: 0,
        }}>
          <button
            onClick={() => setChatUserId(null)}
            style={{
              background: "transparent", border: "none",
              color: "var(--amber)", fontSize: 20, cursor: "pointer", padding: 0,
            }}
          >
            ←
          </button>
          <div style={{
            width: 28, height: 28, borderRadius: 9, background: bg, color: fg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none",
          }}>
            {getInitials(buddy?.screenname ?? "?")}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--snow)", fontFamily: "var(--sans)" }}>
            {buddy?.screenname ?? chatUserId}
          </span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {chatMessages.map((m: any) => {
            const isOwn = m.author.id === session?.user?.id;
            return (
              <div key={m.id} style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isOwn ? "var(--amber)" : "var(--snow2)", fontFamily: "var(--sans)" }}>
                  {m.author.screenname}
                </span>
                <span style={{ fontSize: 10, color: "var(--snow5)", fontFamily: "var(--sans)", marginLeft: 5 }}>
                  {formatTimestamp(m.createdAt)}
                </span>
                <div
                  style={{ margin: "2px 0 0", fontSize: 13, color: "var(--snow)", fontFamily: "var(--sans)", lineHeight: 1.5, wordBreak: "break-word" }}
                  dangerouslySetInnerHTML={{ __html: m.content }}
                />
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div style={{
          borderTop: "1px solid var(--edge1)", padding: "8px 16px",
          display: "flex", gap: 8, flexShrink: 0,
          paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={`Message ${buddy?.screenname ?? ""}…`}
            style={{
              flex: 1, background: "var(--fog1)", border: "1px solid var(--edge1)",
              borderRadius: "var(--rp)", padding: "8px 12px",
              fontFamily: "var(--sans)", fontSize: 14, color: "var(--snow)", outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              padding: "8px 14px", borderRadius: "var(--rp)",
              background: "var(--ambg)", border: "1px solid rgba(232,150,26,.35)",
              color: "var(--amber)", fontSize: 12, fontWeight: 700,
              fontFamily: "var(--sans)", cursor: "pointer",
            }}
          >→</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "14px 16px 6px" }}>
        <input
          placeholder="Search conversations…"
          style={{
            width: "100%", background: "var(--fog1)", border: "1px solid var(--edge1)",
            borderRadius: "var(--rp)", padding: "8px 14px",
            fontFamily: "var(--sans)", fontSize: 13, color: "var(--snow)", outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {conversations.map((b) => {
        const { bg, fg } = AVATAR_PALETTE[deriveAvatarColor(b.userId)] ?? AVATAR_PALETTE.amber;
        return (
          <div
            key={b.userId}
            role="button"
            tabIndex={0}
            onClick={() => setChatUserId(b.userId)}
            onKeyDown={(e) => e.key === "Enter" && setChatUserId(b.userId)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 16px", cursor: "pointer",
              borderBottom: "1px solid var(--edge1)",
            }}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: bg, color: fg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none",
              }}>
                {getInitials(b.screenname)}
              </div>
              <span style={{
                position: "absolute", bottom: -1, right: -1,
                width: 8, height: 8, borderRadius: "50%",
                background: !b.isOnline ? "var(--snow5)" : b.isAway ? "var(--away)" : "var(--green)",
                border: "2px solid var(--ink)",
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--snow)", fontFamily: "var(--sans)" }}>
                {b.screenname}
              </div>
              {b.awayMessage && (
                <p style={{
                  margin: 0, fontSize: 11, fontStyle: "italic", color: "var(--snow4)",
                  fontFamily: "var(--serif)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {b.awayMessage}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile Channels screen
// ---------------------------------------------------------------------------

function MobileChannelsScreen() {
  const router = useRouter();
  const [tab,        setTab]        = useState<"mine" | "discover">("mine");
  const [myChannels, setMyChannels] = useState<any[]>([]);
  const [discovered, setDiscovered] = useState<any[]>([]);
  const [loadingMine,setLoadingMine]= useState(true);
  const [loadingDisc,setLoadingDisc]= useState(false);
  const [query,      setQuery]      = useState("");
  const [discMode,   setDiscMode]   = useState<"featured" | "new" | "active">("featured");

  useEffect(() => {
    fetch("/api/channels?mine=true")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setMyChannels(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingMine(false));
  }, []);

  useEffect(() => {
    if (tab !== "discover") return;
    setLoadingDisc(true);
    fetch(`/api/channels?mode=${discMode}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setDiscovered(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingDisc(false));
  }, [tab, discMode]);

  const filtered = myChannels.filter((c) =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.description?.toLowerCase().includes(query.toLowerCase())
  );

  const ChannelRow = ({ ch }: { ch: any }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/channels/${ch.name}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/channels/${ch.name}`)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", cursor: "pointer", borderBottom: "1px solid var(--edge1)" }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: "var(--fog2)", color: "var(--snow3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 700, fontFamily: "var(--sans)",
      }}>#</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--snow)", fontFamily: "var(--sans)" }}>
          #{ch.name}
          {ch.favoriteByMe && <span style={{ fontSize: 10, color: "var(--amber)", marginLeft: 5 }}>★</span>}
          {ch.type !== "PUBLIC" && (
            <span style={{ fontSize: 9, color: "var(--snow4)", marginLeft: 5, fontFamily: "var(--sans)", border: "1px solid var(--edge2)", borderRadius: 3, padding: "1px 4px" }}>
              {ch.type === "INVITE_ONLY" ? "invite" : "secret"}
            </span>
          )}
        </div>
        {ch.description && (
          <p style={{ margin: 0, fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ch.description}
          </p>
        )}
      </div>
      <span style={{ fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)", flexShrink: 0 }}>
        {ch.memberCount?.toLocaleString()} ›
      </span>
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--snow)", fontFamily: "var(--sans)" }}>Channels</span>
          <a href="/channels" style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--sans)", textDecoration: "none", fontWeight: 600 }}>+ Create</a>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(["mine", "discover"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "7px 0", borderRadius: "var(--rp)",
              background: tab === t ? "var(--ambg)" : "transparent",
              border: `1px solid ${tab === t ? "rgba(232,150,26,.35)" : "var(--edge1)"}`,
              color: tab === t ? "var(--amber)" : "var(--snow4)",
              fontSize: 11, fontWeight: 600, fontFamily: "var(--sans)", cursor: "pointer",
            }}>
              {t === "mine" ? "Your channels" : "Discover"}
            </button>
          ))}
        </div>
        {/* Discover mode pills */}
        {tab === "discover" && (
          <div style={{ display: "flex", gap: 5, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none" }}>
            {(["featured", "new", "active"] as const).map((m) => (
              <button key={m} onClick={() => setDiscMode(m)} style={{
                flexShrink: 0, padding: "4px 10px", borderRadius: "var(--rp)",
                background: discMode === m ? "var(--ambg)" : "transparent",
                border: `1px solid ${discMode === m ? "rgba(232,150,26,.35)" : "var(--edge1)"}`,
                color: discMode === m ? "var(--amber)" : "var(--snow4)",
                fontSize: 10, fontWeight: 600, fontFamily: "var(--sans)", cursor: "pointer",
              }}>
                {m === "featured" ? "Featured" : m === "new" ? "Newest" : "Active"}
              </button>
            ))}
          </div>
        )}
        {/* Search (mine tab only) */}
        {tab === "mine" && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels…"
            style={{
              width: "100%", background: "var(--fog1)", border: "1px solid var(--edge1)",
              borderRadius: "var(--rp)", padding: "7px 12px",
              fontFamily: "var(--sans)", fontSize: 13, color: "var(--snow)",
              outline: "none", boxSizing: "border-box", marginBottom: 6,
            }}
          />
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
        {tab === "mine" && (
          loadingMine ? (
            <p style={{ padding: "24px 16px", fontSize: 12, color: "var(--snow5)", fontFamily: "var(--sans)", textAlign: "center" }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 14, fontStyle: "italic", color: "var(--snow5)", fontFamily: "var(--serif)", marginBottom: 12 }}>
                {query ? "No channels match." : "No channels joined yet."}
              </p>
              {!query && <button onClick={() => setTab("discover")} style={{ fontSize: 12, color: "var(--amber)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--sans)" }}>explore channels →</button>}
            </div>
          ) : (
            filtered.map((ch) => <ChannelRow key={ch.id} ch={ch} />)
          )
        )}
        {tab === "discover" && (
          loadingDisc ? (
            <p style={{ padding: "24px 16px", fontSize: 12, color: "var(--snow5)", fontFamily: "var(--sans)", textAlign: "center" }}>Loading…</p>
          ) : discovered.length === 0 ? (
            <p style={{ padding: "32px 16px", fontSize: 13, fontStyle: "italic", color: "var(--snow5)", fontFamily: "var(--serif)", textAlign: "center" }}>No channels found.</p>
          ) : (
            discovered.map((ch) => <ChannelRow key={ch.id} ch={ch} />)
          )
        )}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile You screen
// ---------------------------------------------------------------------------

function MobileYouScreen() {
  const { data: session } = useSession();
  const { setComposerOpen, setComposerType } = useRadicalLayout();
  const [awayMsg, setAwayMsg] = useState("");

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/away-feed?userId=${session.user.id}&limit=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setAwayMsg(data?.feed?.[0]?.awayMessage ?? ""))
      .catch(() => {});
  }, [session?.user?.id]);

  const avatarColor = session?.user?.avatarColor ?? "amber";
  const { bg, fg } = AVATAR_PALETTE[avatarColor] ?? AVATAR_PALETTE.amber;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "28px 16px 80px" }}>
      {/* Avatar + name */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 68, height: 68, borderRadius: 22,
          background: bg, color: fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none",
        }}>
          {getInitials(session?.user?.screenname ?? "")}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--snow)", fontFamily: "var(--sans)" }}>
            {session?.user?.screenname}
          </div>
          {session?.user?.isGoldMember && (
            <div style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--sans)", fontWeight: 700 }}>
              ★ Gold Member
            </div>
          )}
        </div>
      </div>

      {/* Away message card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setComposerType("AWAY"); setComposerOpen(true); }}
        onKeyDown={(e) => e.key === "Enter" && (setComposerType("AWAY"), setComposerOpen(true))}
        style={{
          background: "var(--ambg2)", border: "1px solid rgba(232,150,26,.2)",
          borderRadius: "var(--r2)", padding: "14px 16px", cursor: "pointer",
          marginBottom: 16,
        }}
      >
        <p style={{
          fontFamily: "var(--serif)", fontStyle: "italic",
          fontSize: 16, color: awayMsg ? "var(--snow)" : "var(--snow4)",
          margin: "0 0 6px", lineHeight: 1.4,
        }}>
          {awayMsg || "not set"}
        </p>
        <span style={{ fontSize: 10, color: "var(--amber)", fontFamily: "var(--sans)", fontWeight: 600 }}>
          ✦ Tap to update away message
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MobileLayout — root mobile container
// ---------------------------------------------------------------------------

export function MobileLayout() {
  const { mobileScreen, setMobileScreen, composerOpen, setComposerOpen, composerType, setComposerType } = useRadicalLayout();
  const { data: session } = useSession();

  const avatarColor = session?.user?.avatarColor ?? "amber";
  const { bg, fg } = AVATAR_PALETTE[avatarColor] ?? AVATAR_PALETTE.amber;

  const NAV_ITEMS = [
    { key: "feed"     as const, label: "Feed",     icon: "⊞" },
    { key: "talk"     as const, label: "Talk",     icon: "💬" },
    { key: "channels" as const, label: "Channels", icon: "#"  },
    { key: "you"      as const, label: "You",      icon: "◎"  },
  ];

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Mobile top bar */}
      <div style={{
        padding: "14px 20px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, borderBottom: "1px solid var(--edge1)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--font-vt323), monospace", fontSize: 24, color: "var(--amber)", letterSpacing: "0.04em", lineHeight: 1 }}>
            SIGNOFF.CHAT
          </span>
        </a>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, color: fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none", cursor: "pointer",
        }}>
          {getInitials(session?.user?.screenname ?? "")}
        </div>
      </div>

      {/* Screen container */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          opacity: mobileScreen === "feed" ? 1 : 0,
          pointerEvents: mobileScreen === "feed" ? "auto" : "none",
          transition: "opacity 0.2s",
        }}>
          <MobileFeedScreen />
        </div>
        <div style={{
          position: "absolute", inset: 0,
          opacity: mobileScreen === "talk" ? 1 : 0,
          pointerEvents: mobileScreen === "talk" ? "auto" : "none",
          transition: "opacity 0.2s",
        }}>
          <MobileTalkScreen />
        </div>
        <div style={{
          position: "absolute", inset: 0,
          opacity: mobileScreen === "channels" ? 1 : 0,
          pointerEvents: mobileScreen === "channels" ? "auto" : "none",
          transition: "opacity 0.2s",
        }}>
          <MobileChannelsScreen />
        </div>
        <div style={{
          position: "absolute", inset: 0,
          opacity: mobileScreen === "you" ? 1 : 0,
          pointerEvents: mobileScreen === "you" ? "auto" : "none",
          transition: "opacity 0.2s",
        }}>
          <MobileYouScreen />
        </div>
      </div>

      {/* Floating bottom nav */}
      <div style={{
        position: "fixed",
        bottom: 20,
        left: "50%", transform: "translateX(-50%)",
        background: "rgba(12,10,7,.9)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        border: "1px solid var(--edge2)",
        borderRadius: "var(--rp)",
        padding: 5, gap: 2,
        boxShadow: "0 24px 64px rgba(0,0,0,.7)",
        display: "flex", alignItems: "center",
        zIndex: 50,
      }}>
        {NAV_ITEMS.map((item, idx) => {
          const isActive = mobileScreen === item.key;
          // Insert compose button before "You"
          const nodes = [];
          if (idx === 3) {
            nodes.push(
              <button
                key="compose"
                onClick={() => { setComposerType("AWAY"); setComposerOpen(true); }}
                style={{
                  width: 50, height: 50, borderRadius: "50%",
                  background: "var(--amber)",
                  border: "none",
                  boxShadow: "0 4px 20px rgba(232,150,26,.45)",
                  fontSize: 22, color: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "transform 0.2s",
                  flexShrink: 0,
                }}
              >
                ✦
              </button>
            );
          }
          nodes.push(
            <button
              key={item.key}
              onClick={() => setMobileScreen(item.key)}
              style={{
                minWidth: 70, padding: "8px 22px", borderRadius: 22,
                background: isActive ? "var(--ambg)" : "transparent",
                border: "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 19, opacity: isActive ? 1 : 0.5 }}>{item.icon}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, fontFamily: "var(--sans)",
                color: isActive ? "var(--amber)" : "var(--snow4)",
              }}>
                {item.label}
              </span>
            </button>
          );
          return nodes;
        })}
      </div>

      {/* PostComposer overlay */}
      <PostComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPost={async (postData) => {
          await fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(postData),
          });
          setComposerOpen(false);
        }}
        mobile
        defaultType={composerType}
      />
    </div>
  );
}
