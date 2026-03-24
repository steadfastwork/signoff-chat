"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { pusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import { PostCard, type FeedPost } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { FeedSkeletonCard } from "./SkeletonCard";
import { incrementElectronUnread } from "@/lib/electronUnread";

// ---------------------------------------------------------------------------
// Local DB cache helpers (Electron only — no-ops in browser)
// ---------------------------------------------------------------------------

function toLocalPost(post: FeedPost): ElectronLocalPost {
  return {
    id:            post.id,
    authorId:      post.author?.id ?? null,
    screenname:    post.author?.screenname ?? null,
    content:       post.content ?? null,
    mediaUrl:      (post as { mediaUrl?: string }).mediaUrl ?? null,
    isAwayMessage: (post as { isAwayMessage?: boolean }).isAwayMessage ?? false,
    privacy:       (post as { privacy?: string }).privacy ?? null,
    nudgeCount:    post.nudgeCount ?? 0,
    createdAt:     post.createdAt ?? null,
    cachedAt:      new Date().toISOString(),
  };
}

async function loadCachedFeed(): Promise<FeedPost[]> {
  if (typeof window === "undefined" || !("electronAPI" in window)) return [];
  try {
    const cached = await window.electronAPI!.db.getFeed(40);
    // Convert flat cached posts back to the FeedPost shape the component expects
    return cached.map((p) => ({
      id:         p.id,
      content:    p.content ?? "",
      nudgeCount: p.nudgeCount,
      createdAt:  p.createdAt ?? new Date().toISOString(),
      author: {
        id:          p.authorId ?? "",
        screenname:  p.screenname ?? "unknown",
        // cached posts won't have full author data — fill with defaults
        isGoldMember: false,
        avatarColor:  "amber",
        status:       "OFFLINE" as const,
      },
    })) as FeedPost[];
  } catch {
    return [];
  }
}

function cacheFeedPost(post: FeedPost) {
  if (typeof window === "undefined" || !("electronAPI" in window)) return;
  window.electronAPI!.db.savePost(toLocalPost(post)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

export function Feed() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newCount, setNewCount] = useState(0);

  // Keep a ref so Pusher handler sees latest posts without stale closure
  const postsRef = useRef<FeedPost[]>([]);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  // ---- Initial load -------------------------------------------------------
  const fetchPage = useCallback(async (cursor?: string) => {
    const url = cursor ? `/api/posts?cursor=${cursor}` : "/api/posts";
    const res = await fetch(url);
    return res.json() as Promise<{ posts: FeedPost[]; nextCursor: string | null }>;
  }, []);

  useEffect(() => {
    // Show cached posts instantly while the real fetch is in flight
    loadCachedFeed().then((cached) => {
      if (cached.length > 0) {
        setPosts(cached);
        setLoading(false);
      }
    });

    fetchPage()
      .then((data) => {
        const fresh = data.posts ?? [];
        setPosts(fresh);
        setNextCursor(data.nextCursor);
        // Persist to local DB for next launch
        fresh.forEach(cacheFeedPost);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPage]);

  // ---- Pusher + polling fallback ------------------------------------------
  // Subscribes to the global feed channel. If Pusher disconnects or fails,
  // falls back to polling /api/posts every 30 s until reconnected.
  useEffect(() => {
    const POLL_MS = 30_000;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const data = await fetchPage();
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const fresh = (data.posts ?? []).filter((p) => !ids.has(p.id));
          if (fresh.length > 0) setNewCount((n) => n + fresh.length);
          return fresh.length > 0 ? [...fresh, ...prev] : prev;
        });
      } catch { /* silently ignore network errors during polling */ }
    };

    const startPolling = () => {
      if (!pollTimer) pollTimer = setInterval(poll, POLL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    };

    const handleStateChange = ({ current }: { current: string }) => {
      if (current === "connected") stopPolling();
      else if (current === "disconnected" || current === "failed") startPolling();
    };

    pusherClient.connection.bind("state_change", handleStateChange);
    // Start polling immediately if already disconnected at mount time
    if (pusherClient.connection.state !== "connected") startPolling();

    const ch = pusherClient.subscribe(CHANNELS.GLOBAL_FEED);
    ch.bind(EVENTS.NEW_POST, (post: FeedPost) => {
      // Skip if already at the top (e.g. the current user just posted)
      if (postsRef.current[0]?.id === post.id) return;
      if (postsRef.current.some((p) => p.id === post.id)) return;
      setNewCount((n) => n + 1);
      setPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        return [post, ...prev];
      });
      // Cache and badge
      cacheFeedPost(post);
      if (document.hidden) incrementElectronUnread();
    });

    return () => {
      stopPolling();
      pusherClient.connection.unbind("state_change", handleStateChange);
      pusherClient.unsubscribe(CHANNELS.GLOBAL_FEED);
    };
  }, [fetchPage]);

  // ---- Handlers -----------------------------------------------------------
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextCursor);
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...(data.posts ?? []).filter((p) => !ids.has(p.id))];
      });
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleNewPost = (post: FeedPost) => {
    setPosts((prev) => {
      if (prev.some((p) => p.id === post.id)) return prev;
      return [post, ...prev];
    });
    setNewCount(0);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setNewCount(0);
  };

  // ---- Render -------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col">
        {[...Array(3)].map((_, i) => <FeedSkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {session && <PostComposer onPost={handleNewPost} />}

      {/* New-posts banner */}
      {newCount > 0 && (
        <button
          onClick={scrollToTop}
          className="sticky top-0 z-10 w-full py-2 text-xs font-mono font-bold transition-opacity"
          style={{
            background: "rgba(200,134,10,0.92)",
            color: "#fff8e6",
            backdropFilter: "blur(4px)",
          }}
        >
          ↑ {newCount} new post{newCount !== 1 ? "s" : ""}
        </button>
      )}

      {/* Posts */}
      <div className="flex flex-col">
        {posts.length === 0 && (
          <p
            className="p-10 text-center text-sm italic"
            style={{ color: "#2a2a1a", fontFamily: "var(--font-dm-sans)" }}
          >
            no posts yet — add some buddies to see their updates here.
          </p>
        )}
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={session?.user?.id}
          />
        ))}
      </div>

      {/* Load more */}
      {nextCursor && (
        <div className="py-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-xs font-mono px-4 py-2 rounded-lg border transition-colors disabled:opacity-40"
            style={{
              color: "#3a3a2a",
              borderColor: "#1e1e14",
            }}
          >
            {loadingMore ? "loading…" : "load more"}
          </button>
        </div>
      )}
    </div>
  );
}
