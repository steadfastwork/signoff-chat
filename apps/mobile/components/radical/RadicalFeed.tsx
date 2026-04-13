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
import BottomSheet from "@gorhom/bottom-sheet";
import { getSession } from "@/lib/session";
import RadicalPostCard, { type RadicalPost } from "./RadicalPostCard";
import TagFilterPills, { type FilterTag } from "./TagFilterPills";
import RadicalComposerSheet, { type PostType } from "./RadicalComposerSheet";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const C = {
  bg:     "#0f0e0c",
  amber:  "#f5c842",
  text:   "#e8e4d9",
  muted:  "#7a7060",
  border: "#1e1c18",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <View style={styles.skeleton}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={styles.skeletonAvatar} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.skeletonLine, { width: 80 }]} />
          <View style={[styles.skeletonLine, { width: 50, opacity: 0.5 }]} />
        </View>
      </View>
      <View style={[styles.skeletonLine, { width: "100%" }]} />
      <View style={[styles.skeletonLine, { width: "70%" }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// RadicalFeed
// ---------------------------------------------------------------------------

export default function RadicalFeed() {
  const [posts,        setPosts]        = useState<RadicalPost[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTag>("all");
  const [cursor,       setCursor]       = useState<string | null>(null);
  const [hasMore,      setHasMore]      = useState(true);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [tags,         setTags]         = useState<string[]>([]);
  const [composerType, setComposerType] = useState<PostType>("AWAY");

  const composerRef = useRef<BottomSheet>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const buildParams = useCallback((filter: FilterTag, cur: string | null) => {
    const p = new URLSearchParams();
    if (filter !== "all") {
      const typeFilters = ["AWAY", "THOUGHT", "QUOTE", "PHOTO"];
      if (typeFilters.includes(filter as string)) {
        p.set("type", filter as string);
      } else {
        p.set("tag", filter as string);
      }
    }
    if (cur) p.set("cursor", cur);
    return p;
  }, []);

  const fetchPosts = useCallback(async (filter: FilterTag, cur: string | null): Promise<void> => {
    try {
      const session = await getSession();
      const headers: Record<string, string> = {};
      if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;

      const params = buildParams(filter, cur);
      const res = await fetch(`${API}/api/posts?${params}`, { headers });
      if (!res.ok) return;

      const data = await res.json() as {
        posts: Array<Record<string, unknown>>;
        nextCursor: string | null;
      };

      const mapped = data.posts.map(mapApiPost);

      if (!cur) {
        setPosts(mapped);
        // Collect tags from first page
        const tally = new Map<string, number>();
        for (const p of data.posts) {
          for (const t of ((p.tags ?? []) as string[])) {
            tally.set(t, (tally.get(t) ?? 0) + 1);
          }
        }
        setTags(Array.from(tally.keys()).slice(0, 12));
      } else {
        setPosts((prev) => [...prev, ...mapped]);
      }

      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {
      // Network error — keep existing data
    }
  }, [buildParams]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setCursor(null);
    setHasMore(true);
    fetchPosts(activeFilter, null).finally(() => setLoading(false));
  }, [activeFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCursor(null);
    await fetchPosts(activeFilter, null);
    setRefreshing(false);
  }, [activeFilter, fetchPosts]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    await fetchPosts(activeFilter, cursor);
    setLoadingMore(false);
  }, [hasMore, loadingMore, loading, activeFilter, cursor, fetchPosts]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleNudge = useCallback(async (postId: string, current: boolean) => {
    // Optimistic toggle
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, hasNudged: !current, nudgeCount: p.nudgeCount + (current ? -1 : 1) }
          : p
      )
    );
    try {
      const session = await getSession();
      const headers: Record<string, string> = {};
      if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
      await fetch(`${API}/api/posts/${postId}/nudge`, { method: "POST", headers });
    } catch {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, hasNudged: current, nudgeCount: p.nudgeCount + (current ? 1 : -1) }
            : p
        )
      );
    }
  }, []);

  const handleEcho = useCallback(async (postId: string) => {
    try {
      const session = await getSession();
      const headers: Record<string, string> = {};
      if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
      await fetch(`${API}/api/posts/${postId}/echo`, { method: "POST", headers });
    } catch {
      // Silent fail
    }
  }, []);

  const handleTagPress = useCallback((tag: string) => {
    setActiveFilter(tag);
  }, []);

  const openComposer = useCallback((type: PostType) => {
    setComposerType(type);
    composerRef.current?.expand();
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const skeletons = loading ? Array.from({ length: 5 }, (_, i) => i) : [];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <Text style={styles.logo}>SIGNOFF.CHAT</Text>
        <View style={styles.headerBtns}>
          {(["THOUGHT", "QUOTE", "PHOTO"] as PostType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={styles.typeBtn}
              onPress={() => openComposer(t)}
              hitSlop={8}
            >
              <Text style={styles.typeBtnText}>
                {t === "THOUGHT" ? "✍" : t === "QUOTE" ? "❝" : "📷"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tag filter pills */}
      <TagFilterPills active={activeFilter} tags={tags} onSelect={setActiveFilter} />

      {/* Feed */}
      {loading ? (
        <View style={{ flex: 1 }}>
          {skeletons.map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlashList
          data={posts}
          estimatedItemSize={140}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RadicalPostCard
              post={item}
              onNudge={handleNudge}
              onEcho={handleEcho}
              onTagPress={handleTagPress}
            />
          )}
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
          ListFooterComponent={loadingMore ? <SkeletonCard /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>nothing here yet.</Text>
              <Text style={styles.emptyHint}>set your away message and start posting.</Text>
            </View>
          }
        />
      )}

      {/* FAB — set away */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => openComposer("AWAY")}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>✦</Text>
      </TouchableOpacity>

      {/* Composer sheet */}
      <RadicalComposerSheet
        ref={composerRef}
        defaultType={composerType}
        onPosted={() => onRefresh()}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Map API response → RadicalPost
// ---------------------------------------------------------------------------

function mapApiPost(p: Record<string, unknown>): RadicalPost {
  const user = (p.user ?? {}) as Record<string, unknown>;
  return {
    id:           String(p.id),
    postType:     (p.postType ?? "AWAY") as RadicalPost["postType"],
    content:      String(p.content ?? ""),
    bodyText:     p.bodyText != null ? String(p.bodyText) : null,
    quoteText:    p.quoteText != null ? String(p.quoteText) : null,
    quoteAttrib:  p.quoteAttrib != null ? String(p.quoteAttrib) : null,
    imageUrl:     p.imageUrl != null ? String(p.imageUrl) : null,
    imageCaption: p.imageCaption != null ? String(p.imageCaption) : null,
    tags:         Array.isArray(p.tags) ? p.tags.map(String) : [],
    nudgeCount:   Number(p.nudgeCount ?? 0),
    echoCount:    Number(p.echoCount ?? 0),
    hasNudged:    Boolean(p.hasNudged),
    setAt:        String(p.setAt ?? new Date().toISOString()),
    user: {
      id:           String(user.id ?? ""),
      screenname:   String(user.screenname ?? ""),
      isGoldMember: Boolean(user.isGoldMember),
      avatarColor:  user.avatarColor ? String(user.avatarColor) : undefined,
      status:       String(user.status ?? "OFFLINE"),
    },
    echoOf: p.echoOf
      ? { user: { screenname: String((p.echoOf as Record<string, unknown>).user
          ? ((p.echoOf as Record<string, unknown>).user as Record<string, unknown>).screenname
          : "") } }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
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
  headerBtns: {
    flexDirection: "row",
    gap: 4,
  },
  typeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#191714",
    borderWidth: 1,
    borderColor: "#2c2820",
    alignItems: "center",
    justifyContent: "center",
  },
  typeBtnText: {
    fontSize: 13,
  },
  skeleton: {
    backgroundColor: "#191714",
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2c2820",
    gap: 10,
  },
  skeletonAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#2c2820",
  },
  skeletonLine: {
    height: 10,
    borderRadius: 4,
    backgroundColor: "#2c2820",
  },
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
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 20,
    color: "#0f0e0c",
  },
});
