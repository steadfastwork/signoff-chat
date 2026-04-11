import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import * as SecureStore from "expo-secure-store";
import BottomSheet from "@gorhom/bottom-sheet";
import EncryptionBadge from "@/components/EncryptionBadge";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/feed/PostCard";
import SkeletonPost from "@/components/feed/SkeletonPost";
import Composer from "@/components/feed/Composer";
import StatusSheet from "@/components/feed/StatusSheet";
import NudgeBanner from "@/components/feed/NudgeBanner";
import AwayCard, { type AwayEntry } from "@/components/away/AwayCard";
import AwayComposerSheet from "@/components/away/AwayComposerSheet";
import { soketiClient } from "@/lib/soketi";
import { getSession } from "@/lib/session";
import {
  getCachedPosts,
  upsertPosts,
  type CachedPost,
} from "@/lib/db/localPosts";

// ---------------------------------------------------------------------------
const C = {
  bg:     "#0f0e0c",
  card:   "#191714",
  amber:  "#f5c842",
  text:   "#e8e4d9",
  muted:  "#7a7060",
  border: "#1e1c18",
};

const API               = process.env.EXPO_PUBLIC_API_URL ?? "";
const EXPIRY_NOTE_KEY   = "signoff_expiry_note_dismissed";
const STATUS_COLORS: Record<string, string> = {
  ONLINE:    "#4caf50",
  AWAY:      "#ff9800",
  IDLE:      "#f5c842",
  INVISIBLE: "#9e9e9e",
  OFFLINE:   "#3a3a32",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiPostToCached(p: Record<string, unknown>): CachedPost {
  const author = (p.author ?? {}) as Record<string, unknown>;
  return {
    id:             String(p.id),
    author_id:      String(author.id ?? ""),
    author_name:    String(author.screenname ?? ""),
    author_is_gold: author.isGoldMember ? 1 : 0,
    author_color:   String(author.avatarColor ?? "#f5c842"),
    content:        String(p.content ?? ""),
    privacy:        String(p.privacy ?? "PUBLIC"),
    media_url:      p.mediaUrl ? String(p.mediaUrl) : null,
    media_type:     p.mediaType ? String(p.mediaType) : null,
    nudge_count:    Number((p._count as Record<string, unknown>)?.nudges ?? 0),
    reply_count:    Number((p._count as Record<string, unknown>)?.replies ?? 0),
    created_at:     String(p.createdAt ?? new Date().toISOString()),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FeedScreen() {
  // Session
  const [session, setSession] = useState<{ screenname: string; userId: string; avatarColor: string; isGoldMember: boolean } | null>(null);

  // Posts
  const [posts, setPosts]           = useState<CachedPost[]>([]);
  const [firstLoad, setFirstLoad]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor]         = useState<string | null>(null);
  const [hasMore, setHasMore]       = useState(true);

  // Status
  const [status, setStatus] = useState("ONLINE");

  // Online count
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  // Expiry note
  const [showExpiryNote, setShowExpiryNote] = useState(false);

  // New posts via Soketi
  const [newPostCount, setNewPostCount] = useState(0);
  const listRef = useRef<FlashList<CachedPost>>(null);

  // Tab state
  const [tab, setTab] = useState<"away" | "posts">("away");

  // Away feed state
  const [awayEntries, setAwayEntries]         = useState<AwayEntry[]>([]);
  const [awayLoading, setAwayLoading]         = useState(false);
  const [awayCursor,  setAwayCursor]          = useState<string | null>(null);
  const [awayHasMore, setAwayHasMore]         = useState(true);
  const [awayRefreshing, setAwayRefreshing]   = useState(false);

  // Bottom sheets
  const statusSheetRef      = useRef<BottomSheet>(null);
  const awayComposerRef     = useRef<BottomSheet>(null);

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (s) setSession(s);

      // Show expiry note if not dismissed
      const dismissed = await SecureStore.getItemAsync(EXPIRY_NOTE_KEY);
      if (!dismissed) setShowExpiryNote(true);

      // Load cached posts immediately for instant display
      const cached = await getCachedPosts(30);
      if (cached.length > 0) {
        setPosts(cached);
        setFirstLoad(false);
      }

      // Then fetch fresh from API
      await fetchFeed(true);
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Soketi: real-time new posts + online count
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const feedChannel = soketiClient.subscribe("presence-feed");

    // Online member count from presence channel
    feedChannel.bind("pusher:subscription_succeeded", (data: { count?: number }) => {
      setOnlineCount(data.count ?? null);
    });
    feedChannel.bind("pusher:member_added", () => {
      setOnlineCount((n) => (n ?? 0) + 1);
    });
    feedChannel.bind("pusher:member_removed", () => {
      setOnlineCount((n) => Math.max((n ?? 1) - 1, 0));
    });

    // New post event
    feedChannel.bind("new-post", (data: Record<string, unknown>) => {
      const incoming = apiPostToCached(data);
      setNewPostCount((n) => n + 1);
      upsertPosts([incoming]);
    });

    return () => {
      soketiClient.unsubscribe("presence-feed");
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchFeed = useCallback(async (reset = false) => {
    try {
      const params = reset ? "" : cursor ? `?cursor=${cursor}` : "";
      const res = await fetch(`${API}/api/posts/feed${params}`);
      if (!res.ok) return;
      const data = await res.json();

      const fetched: CachedPost[] = (data.posts ?? []).map(apiPostToCached);

      if (reset) {
        setPosts(fetched);
        setCursor(data.nextCursor ?? null);
        setHasMore(!!data.nextCursor);
      } else {
        setPosts((prev) => [...prev, ...fetched]);
        setCursor(data.nextCursor ?? null);
        setHasMore(!!data.nextCursor);
      }

      if (fetched.length > 0) await upsertPosts(fetched);
    } catch {
      // Network error — show cached
    } finally {
      setFirstLoad(false);
    }
  }, [cursor]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCursor(null);
    setHasMore(true);
    await fetchFeed(true);
    setRefreshing(false);
    setNewPostCount(0);
  }, [fetchFeed]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore || firstLoad) return;
    setLoadingMore(true);
    await fetchFeed(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, firstLoad, fetchFeed]);

  // ---------------------------------------------------------------------------
  // Post submission
  // ---------------------------------------------------------------------------

  const handlePost = useCallback(
    async (content: string, privacy: "PUBLIC" | "BUDDIES_ONLY") => {
      const res = await fetch(`${API}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, privacy }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const newPost = apiPostToCached(data);
      setPosts((prev) => [newPost, ...prev]);
      await upsertPosts([newPost]);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Status change
  // ---------------------------------------------------------------------------

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setStatus(newStatus);
    try {
      await fetch(`${API}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {}
  }, []);

  // ---------------------------------------------------------------------------
  // Away feed fetch
  // ---------------------------------------------------------------------------

  const fetchAwayFeed = useCallback(async (reset = false) => {
    if (awayLoading && !reset) return;
    setAwayLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (!reset && awayCursor) params.set("cursor", awayCursor);
      const res = await fetch(`${API}/api/away-feed?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const entries: AwayEntry[] = (data.entries ?? []).map((e: Record<string, unknown>) => ({
        id:          String(e.id),
        userId:      String(e.userId),
        screenname:  String(e.screenname),
        isGold:      Boolean(e.isGold),
        awayMessage: String(e.awayMessage),
        setAt:       String(e.setAt),
        nudgeCount:  Number(e.nudgeCount ?? 0),
        hasNudged:   Boolean(e.hasNudged),
      }));
      if (reset) {
        setAwayEntries(entries);
      } else {
        setAwayEntries((prev) => [...prev, ...entries]);
      }
      setAwayCursor(data.cursor ?? null);
      setAwayHasMore(!!data.cursor);
    } catch {
      // network error — fail silently
    } finally {
      setAwayLoading(false);
    }
  }, [awayLoading, awayCursor]);

  useEffect(() => {
    if (tab === "away" && awayEntries.length === 0) {
      fetchAwayFeed(true);
    }
  }, [tab]);

  const handleAwayRefresh = useCallback(async () => {
    setAwayRefreshing(true);
    setAwayCursor(null);
    setAwayHasMore(true);
    await fetchAwayFeed(true);
    setAwayRefreshing(false);
  }, [fetchAwayFeed]);

  const handleNudge = useCallback(async (awayId: string, hasNudged: boolean) => {
    // Optimistic update
    setAwayEntries((prev) =>
      prev.map((e) =>
        e.id === awayId
          ? { ...e, hasNudged: !hasNudged, nudgeCount: e.nudgeCount + (hasNudged ? -1 : 1) }
          : e
      )
    );
    try {
      await fetch(`${API}/api/away/${awayId}/nudge`, { method: "POST" });
    } catch {
      // Revert on failure
      setAwayEntries((prev) =>
        prev.map((e) =>
          e.id === awayId
            ? { ...e, hasNudged, nudgeCount: e.nudgeCount + (hasNudged ? 1 : -1) }
            : e
        )
      );
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Expiry note dismiss
  // ---------------------------------------------------------------------------

  const dismissExpiryNote = useCallback(async () => {
    setShowExpiryNote(false);
    await SecureStore.setItemAsync(EXPIRY_NOTE_KEY, "1");
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const skeletons = firstLoad ? Array.from({ length: 5 }, (_, i) => i) : [];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ── New posts nudge banner ── */}
      {newPostCount > 0 && (
        <NudgeBanner
          count={newPostCount}
          onPress={() => {
            listRef.current?.scrollToIndex({ index: 0, animated: true });
            onRefresh();
          }}
          onDismiss={() => setNewPostCount(0)}
        />
      )}

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <Text style={styles.logo}>SIGNOFF.CHAT</Text>
        <View style={styles.headerRight}>
          <EncryptionBadge />
          {session && (
            <Avatar
              screenname={session.screenname}
              color={session.avatarColor}
              size={30}
              statusDot={STATUS_COLORS[status]}
              onPress={() => statusSheetRef.current?.expand()}
            />
          )}
        </View>
      </View>

      {/* ── Online bar ── */}
      <View style={[styles.onlineBar, { borderBottomColor: C.border }]}>
        <View style={styles.onlineDot} />
        <Text style={styles.onlineText}>
          {onlineCount !== null ? `${onlineCount} online` : "connecting..."}
          {"  ·  "}
          <Text style={styles.onlineFeature}>no algorithm</Text>
        </Text>
      </View>

      {/* ── Tab switcher ── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "away" && styles.tabBtnActive]}
          onPress={() => setTab("away")}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabBtnText, tab === "away" && styles.tabBtnTextActive]}>
            away
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "posts" && styles.tabBtnActive]}
          onPress={() => setTab("posts")}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabBtnText, tab === "posts" && styles.tabBtnTextActive]}>
            posts
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Away tab ── */}
      {tab === "away" && (
        <>
          {/* Set away button */}
          <TouchableOpacity
            style={styles.setAwayBtn}
            onPress={() => awayComposerRef.current?.expand()}
            activeOpacity={0.8}
          >
            <Text style={styles.setAwayBtnText}>✦ set your away message…</Text>
          </TouchableOpacity>

          <FlashList
            data={awayEntries}
            estimatedItemSize={120}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AwayCard entry={item} onNudge={handleNudge} />
            )}
            refreshControl={
              <RefreshControl
                refreshing={awayRefreshing}
                onRefresh={handleAwayRefresh}
                tintColor={C.amber}
                colors={[C.amber]}
              />
            }
            onEndReached={() => { if (awayHasMore && !awayLoading) fetchAwayFeed(false); }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              awayLoading ? null : (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>no away messages yet.</Text>
                  <Text style={styles.emptyHint}>set yours and your buddies will see it here.</Text>
                </View>
              )
            }
          />
        </>
      )}

      {/* ── Posts tab ── */}
      {tab === "posts" && (
        <>
          {/* Composer */}
          {session && (
            <Composer
              screenname={session.screenname}
              avatarColor={session.avatarColor}
              onPost={handlePost}
            />
          )}

          {/* Expiry note */}
          {showExpiryNote && (
            <View style={styles.expiryNote}>
              <Text style={styles.expiryText}>if it matters, screenshot it.</Text>
              <Text style={styles.expiryDismiss} onPress={dismissExpiryNote}>
                got it ✕
              </Text>
            </View>
          )}

          {firstLoad ? (
            <View style={{ flex: 1 }}>
              {skeletons.map((i) => <SkeletonPost key={i} />)}
            </View>
          ) : (
            <FlashList
              ref={listRef}
              data={posts}
              estimatedItemSize={110}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <PostCard post={item} />}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={C.amber}
                  colors={[C.amber]}
                />
              }
              onEndReached={onEndReached}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loadingMore ? <View style={styles.loadingMore}><SkeletonPost /></View> : null
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>your buddies haven't posted yet.</Text>
                  <Text style={styles.emptyHint}>be the first.</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* ── Status bottom sheet ── */}
      {session && (
        <StatusSheet
          ref={statusSheetRef}
          current={status}
          onChange={handleStatusChange}
        />
      )}

      {/* ── Away composer sheet ── */}
      <AwayComposerSheet
        ref={awayComposerRef}
        onSaved={() => fetchAwayFeed(true)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabBtnActive: {
    borderColor: "rgba(245,200,66,0.3)",
    backgroundColor: "rgba(245,200,66,0.08)",
  },
  tabBtnText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
  },
  tabBtnTextActive: {
    fontFamily: "DMSans_700Bold",
    color: C.amber,
  },

  // Set away
  setAwayBtn: {
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.2)",
    backgroundColor: "rgba(245,200,66,0.05)",
    alignItems: "center",
  },
  setAwayBtnText: {
    fontFamily: "DMSans_400Regular",
    fontStyle: "italic",
    fontSize: 13,
    color: "#a07820",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  logo: {
    fontFamily: "VT323_400Regular",
    fontSize: 26,
    color: C.amber,
    letterSpacing: 1.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Online bar
  onlineBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#4caf50",
  },
  onlineText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
  onlineFeature: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: C.muted,
  },

  // Expiry note
  expiryNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  expiryText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
    fontStyle: "italic",
  },
  expiryDismiss: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
    opacity: 0.6,
  },

  // Empty state
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.muted,
  },
  emptyHint: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    opacity: 0.6,
  },

  loadingMore: {
    opacity: 0.6,
  },
});
