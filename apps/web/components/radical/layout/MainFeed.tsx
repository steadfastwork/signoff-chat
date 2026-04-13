"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PostCard, type PostCardPost } from "@/components/radical/PostCard";
import { TagFilterBar } from "@/components/radical/TagFilterBar";
import { FeedEmptyState } from "@/components/radical/FeedEmptyState";
import { PersonBubble } from "@/components/radical/PersonBubble";
import { useRadicalLayout, type BuddyData } from "./RadicalLayoutContext";
import { AVATAR_PALETTE } from "./avatarPalette";
import { getInitials } from "@/lib/utils";
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
  echoOf?: { user: { screenname: string } } | null;
  user: {
    id: string;
    screenname: string;
    isGoldMember: boolean;
    avatarColor?: string;
    status: string;
    currently: unknown;
  };
}

function mapPost(p: ApiPost): PostCardPost {
  const currently = parseCurrently(p.user.currently);
  const currentlyFields = filledFields(currently).map(([key]) => ({
    emoji: CURRENTLY_META[key].emoji,
    label: CURRENTLY_META[key].label,
  }));

  return {
    id:             p.id,
    postType:       p.postType,
    user: {
      screenname:   p.user.screenname,
      avatarColor:  p.user.avatarColor,
      isGoldMember: p.user.isGoldMember,
    },
    awayMessage:   p.content || undefined,
    bodyText:      p.bodyText ?? undefined,
    quoteText:     p.quoteText ?? undefined,
    quoteAttrib:   p.quoteAttrib ?? undefined,
    imageUrl:      p.imageUrl ?? undefined,
    imageCaption:  p.imageCaption ?? undefined,
    tags:          p.tags ?? [],
    nudgeCount:    p.nudgeCount,
    echoCount:     p.echoCount,
    hasNudged:     p.hasNudged,
    createdAt:     new Date(p.setAt),
    awayStatus:    (p.user.status as "ONLINE" | "AWAY" | "OFFLINE") || "OFFLINE",
    currentlyFields,
    echoOf:        p.echoOf ?? null,
  };
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function PostSkeleton() {
  return (
    <div style={{
      background: "var(--fog1)", border: "1px solid var(--edge1)",
      borderRadius: "var(--r2)", padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--fog2)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: 80, height: 10, borderRadius: 4, background: "var(--fog2)", marginBottom: 6 }} />
          <div style={{ width: 120, height: 8, borderRadius: 4, background: "var(--fog2)" }} />
        </div>
      </div>
      <div style={{ height: 12, borderRadius: 4, background: "var(--fog2)" }} />
      <div style={{ height: 12, borderRadius: 4, background: "var(--fog2)", width: "75%" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MainFeed
// ---------------------------------------------------------------------------

export function MainFeed({ onOpenChat }: { onOpenChat?: (screenname: string) => void }) {
  const { data: session } = useSession();
  const { activeTag, setActiveTag, setComposerOpen, setComposerType, setActiveBuddy } = useRadicalLayout();

  const [posts,      setPosts]      = useState<PostCardPost[]>([]);
  const [cursor,     setCursor]     = useState<string | null>(null);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore] = useState(false);
  const [tagCounts,  setTagCounts]  = useState<{ tag: string; count: number }[]>([]);
  const [buddies,    setBuddies]    = useState<BuddyData[]>([]);
  const [awayMsg,    setAwayMsg]    = useState("");

  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  // Fetch posts
  const fetchPosts = useCallback(async (tag: string | null, fromCursor: string | null) => {
    const params = new URLSearchParams();
    if (tag && !["away", "thought", "quote", "photo"].includes(tag.toLowerCase())) {
      params.set("tag", tag);
    } else if (tag && tag !== "all") {
      params.set("type", tag.toUpperCase());
    }
    if (fromCursor) params.set("cursor", fromCursor);

    const res = await fetch(`/api/posts?${params}`);
    if (!res.ok) return null;
    return res.json() as Promise<{ posts: ApiPost[]; nextCursor: string | null }>;
  }, []);

  // Initial / tag-change load
  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setCursor(null);
    setHasMore(true);

    fetchPosts(activeTag, null).then((data) => {
      if (!data) return;
      setPosts(data.posts.map(mapPost));
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);

      // Build tag counts from posts
      const tally = new Map<string, number>();
      for (const p of data.posts) {
        for (const t of p.tags) tally.set(t, (tally.get(t) ?? 0) + 1);
      }
      setTagCounts(Array.from(tally.entries()).map(([tag, count]) => ({ tag, count })));
    }).finally(() => setLoading(false));
  }, [activeTag, fetchPosts]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          setLoadingMore(true);
          fetchPosts(activeTag, cursor).then((data) => {
            if (!data) return;
            setPosts((prev) => [...prev, ...data.posts.map(mapPost)]);
            setCursor(data.nextCursor);
            setHasMore(!!data.nextCursor);
          }).finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [activeTag, cursor, hasMore, loadingMore, fetchPosts]);

  // Fetch buddies for people strip
  useEffect(() => {
    fetch("/api/buddies")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const all: BuddyData[] = [];
        const add = (arr: any[]) => {
          for (const b of arr) {
            all.push({
              userId:      b.userId,
              screenname:  b.screenname,
              isGold:      b.isGold,
              isOnline:    b.isOnline,
              isAway:      b.isAway,
              awayMessage: b.awayMessage ?? "",
              currently:   b.currently ?? [],
              avatarColor: deriveAvatarColor(b.userId),
            });
          }
        };
        for (const g of (data.groups ?? [])) add(g.buddies ?? []);
        add(data.ungrouped ?? []);
        setBuddies(all.filter((b) => b.isOnline).slice(0, 12));
      })
      .catch(() => {});
  }, []);

  // Current user's away message
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/away-feed?userId=${session.user.id}&limit=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setAwayMsg(data?.feed?.[0]?.awayMessage ?? ""))
      .catch(() => {});
  }, [session?.user?.id]);

  const handleNudge = async (postId: string) => {
    setPosts((prev) => prev.map((p) =>
      p.id === postId
        ? { ...p, hasNudged: !p.hasNudged, nudgeCount: p.nudgeCount + (p.hasNudged ? -1 : 1) }
        : p
    ));
    await fetch(`/api/posts/${postId}/nudge`, { method: "POST" });
  };

  const handleEcho = async (postId: string) => {
    await fetch(`/api/posts/${postId}/echo`, { method: "POST" });
  };

  const avatarColor = session?.user?.avatarColor ?? "amber";
  const { bg, fg } = AVATAR_PALETTE[avatarColor] ?? AVATAR_PALETTE.amber;
  const screenname = session?.user?.screenname ?? "";

  return (
    <div ref={scrollRef} style={{
      flex: 1, minWidth: 0,
      display: "flex", flexDirection: "column",
      background: "var(--ink)",
      overflowY: "auto",
    }}>
      {/* Your status hero */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setComposerType("AWAY"); setComposerOpen(true); }}
        onKeyDown={(e) => e.key === "Enter" && (setComposerType("AWAY"), setComposerOpen(true))}
        style={{
          margin: "16px 20px 0",
          padding: "16px 20px",
          background: "var(--fog1)",
          border: "1px solid rgba(232,150,26,.15)",
          borderRadius: "var(--r2)",
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 14,
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: bg, color: fg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, fontFamily: "var(--sans)", userSelect: "none",
          }}>
            {getInitials(screenname)}
          </div>
          <span style={{
            position: "absolute", bottom: -1, right: -1,
            width: 9, height: 9, borderRadius: "50%",
            background: "var(--green)", border: "2px solid var(--ink)",
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "var(--serif)", fontStyle: "italic",
            fontSize: 16, color: awayMsg ? "var(--snow)" : "var(--snow4)",
            margin: 0, lineHeight: 1.4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {awayMsg || "what are you up to right now?"}
          </p>
        </div>

        <span style={{
          fontSize: 11, fontWeight: 600, color: "var(--amber)",
          fontFamily: "var(--sans)", flexShrink: 0,
          background: "var(--ambg)", borderRadius: "var(--rp)",
          padding: "4px 10px",
        }}>
          ✦ Update away
        </span>
      </div>

      {/* People strip */}
      {buddies.length > 0 && (
        <div style={{ padding: "14px 20px 0" }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "var(--snow5)",
            fontFamily: "var(--sans)", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 10,
          }}>
            Your people
          </div>
          <div style={{
            display: "flex", gap: 14, overflowX: "auto",
            scrollbarWidth: "none", paddingBottom: 4,
          }}>
            {buddies.map((b) => {
              const { bg: aBg, fg: aFg } = AVATAR_PALETTE[b.avatarColor] ?? AVATAR_PALETTE.amber;
              return (
                <PersonBubble
                  key={b.userId}
                  user={{
                    screenname: b.screenname,
                    avatarBg:   aBg,
                    avatarColor: aFg,
                    initials:    getInitials(b.screenname),
                  }}
                  awayStatus={!b.isOnline ? "OFFLINE" : b.isAway ? "AWAY" : "ONLINE"}
                  onClick={() => setActiveBuddy(b)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tag filter bar */}
      <div style={{ padding: "0 20px" }}>
        <TagFilterBar
          activeTag={activeTag}
          tags={tagCounts}
          onTagSelect={setActiveTag}
        />
      </div>

      {/* Post feed */}
      <div style={{ padding: "0 20px 80px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <>
            <PostSkeleton /><PostSkeleton /><PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <FeedEmptyState activeTag={activeTag} />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onNudge={handleNudge}
              onEcho={handleEcho}
              onReply={() => {}}
              onTagClick={setActiveTag}
              onUserClick={(sn) => onOpenChat?.(sn)}
            />
          ))
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loadingMore && <PostSkeleton />}
      </div>

      {/* Bottom compose bar */}
      <div style={{
        position: "sticky", bottom: 0,
        borderTop: "1px solid var(--edge1)",
        background: "var(--ink2)",
        padding: "0 20px",
        height: 52,
        display: "flex", alignItems: "center", gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: bg, color: fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, fontFamily: "var(--sans)",
          userSelect: "none", flexShrink: 0,
        }}>
          {getInitials(screenname)}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => { setComposerType("AWAY"); setComposerOpen(true); }}
          onKeyDown={(e) => e.key === "Enter" && (setComposerType("AWAY"), setComposerOpen(true))}
          style={{ flex: 1, cursor: "text" }}
        >
          <span style={{
            fontFamily: "var(--serif)", fontStyle: "italic",
            fontSize: 14, color: "var(--snow4)",
          }}>
            what are you up to right now?
          </span>
        </div>

        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {(["THOUGHT", "QUOTE", "PHOTO"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setComposerType(t); setComposerOpen(true); }}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--fog1)", border: "1px solid var(--edge1)",
                color: "var(--snow3)", fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {t === "THOUGHT" ? "✍" : t === "QUOTE" ? "❝" : "📷"}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setComposerType("AWAY"); setComposerOpen(true); }}
          style={{
            padding: "5px 12px", borderRadius: "var(--rp)",
            background: "var(--ambg)", border: "1px solid rgba(232,150,26,.35)",
            color: "var(--amber)", fontSize: 11, fontWeight: 700,
            fontFamily: "var(--sans)", cursor: "pointer", flexShrink: 0,
          }}
        >
          Set away ✦
        </button>
      </div>
    </div>
  );
}
