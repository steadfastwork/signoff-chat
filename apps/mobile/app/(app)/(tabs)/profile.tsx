import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { getSession } from "@/lib/session";
import { clearSession } from "@/lib/session";

// ---------------------------------------------------------------------------
// Own profile screen.
// NO "member since". NO join date. NO last seen. NO activity timestamps.
// Status = dot + label only.
// ---------------------------------------------------------------------------

const C = {
  bg:          "#0f0e0c",
  card:        "#191714",
  amber:       "#f5c842",
  amberTint:   "rgba(245,200,66,0.08)",
  amberBorder: "rgba(245,200,66,0.3)",
  gold:        "#d4a017",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  teal:        "#26a69a",
};

const AVATAR_COLOR_MAP: Record<string, string> = {
  amber:   "#f5c842",
  rose:    "#e91e63",
  sky:     "#2196f3",
  emerald: "#4caf50",
  violet:  "#9c27b0",
  orange:  "#ff9800",
};

const STATUS_DOT: Record<string, string> = {
  ONLINE:    "#4caf50",
  AWAY:      "#f5c842",
  IDLE:      "#ff9800",
  INVISIBLE: "#7a7060",
  OFFLINE:   "#7a7060",
};
const STATUS_LABEL: Record<string, string> = {
  ONLINE:    "Online",
  AWAY:      "Away",
  IDLE:      "Idle",
  INVISIBLE: "Invisible",
  OFFLINE:   "Offline",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

interface OwnPost {
  id:            string;
  content:       string;
  privacy:       string;
  isAwayMessage: boolean;
  mediaUrl:      string | null;
  createdAt:     string;
  _count:        { nudges: number; replies: number };
}

interface Profile {
  id:            string;
  screenname:    string;
  bio:           string | null;
  awayMessage:   string | null;
  status:        string;
  isGoldMember:  boolean;
  avatarColor:   string;
  postCount:     number;
  buddyCount:    number;
  posts:         OwnPost[];
}

type Tab = "posts" | "away";

// ── Tiny post row ─────────────────────────────────────────────────────────────
function PostRow({ post }: { post: OwnPost }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.postRow}
      onPress={() => router.push(`/(app)/post/${post.id}`)}
      activeOpacity={0.75}
    >
      <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>
      <View style={styles.postMeta}>
        <Text style={styles.postMetaText}>
          {post._count.nudges > 0 ? `⚡ ${post._count.nudges}  ` : ""}
          {post._count.replies > 0 ? `💬 ${post._count.replies}` : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Away message row ──────────────────────────────────────────────────────────
function AwayRow({ post }: { post: OwnPost }) {
  return (
    <View style={styles.awayRow}>
      <View style={styles.awayBorder} />
      <Text style={styles.awayContent}>{post.content}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [activeTab,  setActiveTab]  = useState<Tab>("posts");
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    const session = await getSession();
    if (!session) return;
    try {
      const res = await fetch(`${API}/api/users/${session.screenname}`);
      if (res.ok) setProfile(await res.json());
    } catch {}
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await fetch(`${API}/api/profile/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OFFLINE" }),
      });
    } catch {}
    await clearSession();
    router.replace("/(auth)/login");
  }, [router]);

  if (!profile) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.amber} />
      </View>
    );
  }

  const avatarHex   = AVATAR_COLOR_MAP[profile.avatarColor] ?? C.amber;
  const initial     = (profile.screenname[0] ?? "?").toUpperCase();
  const dotColor    = STATUS_DOT[profile.status]  ?? C.muted;
  const statusLabel = STATUS_LABEL[profile.status] ?? "Offline";

  const regularPosts = profile.posts.filter((p) => !p.isAwayMessage);
  const awayPosts    = profile.posts.filter((p) => p.isAwayMessage);
  const listData     = activeTab === "posts" ? regularPosts : awayPosts;

  // ── Header rendered inside FlashList ─────────────────────────────────────
  const ListHeader = (
    <View style={styles.header}>
      {/* Top action row */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => router.push("/(app)/profile/edit")}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <View
          style={[
            styles.avatarRing,
            { borderColor: profile.isGoldMember ? C.gold : "transparent" },
          ]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: avatarHex + "22", borderColor: avatarHex + "55" },
            ]}
          >
            <Text style={[styles.avatarInitial, { color: avatarHex }]}>{initial}</Text>
          </View>
        </View>
        {/* Status dot */}
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      </View>

      {/* Name */}
      <View style={styles.nameRow}>
        <Text style={styles.screenname}>{profile.screenname}</Text>
        {profile.isGoldMember && <Text style={styles.goldStar}>★</Text>}
      </View>

      {/* Status label — dot + label only, NO timestamp */}
      <View style={styles.statusRow}>
        <View style={[styles.statusInlineDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statusText}>{statusLabel}</Text>
      </View>

      {/* Bio */}
      {profile.bio ? (
        <Text style={styles.bio}>{profile.bio}</Text>
      ) : null}

      {/* Away message */}
      {profile.awayMessage ? (
        <View style={styles.awayMsgWrap}>
          <View style={styles.awayMsgBorder} />
          <Text style={styles.awayMsg}>{profile.awayMessage}</Text>
        </View>
      ) : null}

      {/* Stats — posts · buddies (NO join date) */}
      <Text style={styles.stats}>
        {profile.postCount.toLocaleString()} posts · {profile.buddyCount.toLocaleString()} buddies
      </Text>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => router.push("/(app)/profile/edit")}
          activeOpacity={0.8}
        >
          <Text style={styles.ghostBtnText}>Edit profile →</Text>
        </TouchableOpacity>
      </View>

      {/* Gold upsell */}
      {!profile.isGoldMember && (
        <TouchableOpacity
          style={styles.goldUpsell}
          onPress={() => router.push("/(app)/upgrade")}
          activeOpacity={0.85}
        >
          <Text style={styles.goldUpsellText}>★ Upgrade to Gold</Text>
          <Text style={styles.goldUpsellSub}>longer message history · photo profiles · more</Text>
        </TouchableOpacity>
      )}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(["posts", "away"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "posts" ? "Posts" : "Away Messages"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlashList
        data={listData}
        estimatedItemSize={80}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) =>
          activeTab === "posts"
            ? <PostRow post={item} />
            : <AwayRow post={item} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {activeTab === "posts" ? "no posts yet." : "no away messages yet."}
          </Text>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            disabled={signingOut}
            activeOpacity={0.7}
          >
            {signingOut
              ? <ActivityIndicator size="small" color={C.muted} />
              : <Text style={styles.signOutText}>Sign out</Text>}
          </TouchableOpacity>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.amber}
          />
        }
        contentContainerStyle={{ paddingBottom: 48 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: { paddingBottom: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 4,
  },

  // Avatar
  avatarWrap: { alignItems: "center", marginTop: 8, marginBottom: 12 },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontFamily: "DMSans_700Bold", fontSize: 34 },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: C.bg,
    position: "absolute",
    bottom: 0,
    right: "30%",
  },

  // Name + status
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
  },
  screenname: { fontFamily: "DMSans_700Bold", fontSize: 24, color: C.text },
  goldStar:   { fontSize: 18, color: C.gold },
  statusRow:  {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 5,
  },
  statusInlineDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.muted },

  // Bio + away
  bio: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    textAlign: "center",
    marginTop: 12,
    marginHorizontal: 32,
    lineHeight: 20,
  },
  awayMsgWrap: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginTop: 10,
    gap: 10,
  },
  awayMsgBorder: { width: 3, borderRadius: 2, backgroundColor: C.amber },
  awayMsg: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    fontStyle: "italic",
    lineHeight: 18,
  },

  // Stats
  stats: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
    marginTop: 12,
  },

  // Actions
  actions: { alignItems: "center", marginTop: 14, gap: 10 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  ghostBtnText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: C.muted },

  // Gold upsell
  goldUpsell: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: C.amberTint,
    borderWidth: 1,
    borderColor: C.amberBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    gap: 3,
  },
  goldUpsellText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: C.amber },
  goldUpsellSub:  { fontFamily: "DMSans_400Regular", fontSize: 12, color: C.muted },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginTop: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive:     { borderBottomColor: C.amber },
  tabText:       { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.muted },
  tabTextActive: { fontFamily: "DMSans_700Bold", color: C.amber },

  // Post rows
  postRow: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 6,
  },
  postContent: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
  },
  postMeta:     { flexDirection: "row" },
  postMetaText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: C.muted },

  // Away rows
  awayRow: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  awayBorder:  { width: 3, borderRadius: 2, backgroundColor: C.amber },
  awayContent: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.muted,
    fontStyle: "italic",
    lineHeight: 20,
  },

  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 32,
  },

  // Sign out
  signOutBtn: {
    alignItems: "center",
    paddingVertical: 24,
    marginTop: 8,
  },
  signOutText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
  },
});
