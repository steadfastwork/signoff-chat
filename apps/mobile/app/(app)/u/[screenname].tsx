import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type BottomSheet from "@gorhom/bottom-sheet";
import SafetySheet, { type SafetyTarget } from "@/components/SafetySheet";

// ---------------------------------------------------------------------------
// Other-user profile.
// NO last seen. NO join date. NO "active X ago". NO "seen recently".
// Status = dot + label only. Offline means offline.
// Mutual channels shown only if PUBLIC or INVITE_ONLY (never SECRET).
// ---------------------------------------------------------------------------

const C = {
  bg:          "#0f0e0c",
  card:        "#191714",
  amber:       "#f5c842",
  amberTint:   "rgba(245,200,66,0.1)",
  amberBorder: "rgba(245,200,66,0.3)",
  gold:        "#d4a017",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  teal:        "#26a69a",
  tealTint:    "rgba(38,166,154,0.12)",
  tealBorder:  "rgba(38,166,154,0.3)",
  danger:      "#e05252",
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
  ONLINE:  "#4caf50",
  AWAY:    "#f5c842",
  IDLE:    "#ff9800",
  OFFLINE: "#7a7060",
};
const STATUS_LABEL: Record<string, string> = {
  ONLINE:  "Online",
  AWAY:    "Away",
  IDLE:    "Idle",
  OFFLINE: "Offline",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

type Relationship = "self" | "buddy" | "pending" | "none" | "blocked";

interface UserPost {
  id:       string;
  content:  string;
  privacy:  string;
  mediaUrl: string | null;
  createdAt: string;
  _count:   { nudges: number; replies: number };
}

interface MutualChannel { name: string; type: string }
interface PublicBoard   { name: string; displayName: string }

interface UserProfile {
  id:               string;
  screenname:       string;
  bio:              string | null;
  awayMessage:      string | null;
  status:           string;
  isGoldMember:     boolean;
  avatarColor:      string;
  postCount:        number;
  buddyCount:       number;
  relationship:     Relationship;
  pendingDirection: "sent" | "received" | null;
  posts:            UserPost[];
  mutualChannels:   MutualChannel[];
  publicBoards:     PublicBoard[];
}

function PostRow({ post, onPress }: { post: UserPost; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.postRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.postContent} numberOfLines={4}>{post.content}</Text>
      <Text style={styles.postMeta}>
        {[
          post._count.nudges  > 0 ? `⚡ ${post._count.nudges}`  : "",
          post._count.replies > 0 ? `💬 ${post._count.replies}` : "",
        ].filter(Boolean).join("  ")}
      </Text>
    </TouchableOpacity>
  );
}

export default function UserProfileScreen() {
  const { screenname } = useLocalSearchParams<{ screenname: string }>();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const safetyRef  = useRef<BottomSheet>(null);

  const [user,        setUser]        = useState<UserProfile | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [buddyLoading,setBuddyLoading]= useState(false);
  const [notFound,    setNotFound]    = useState(false);

  const fetchUser = useCallback(async () => {
    if (!screenname) return;
    try {
      const res = await fetch(`${API}/api/users/${screenname}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (res.ok) setUser(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }, [screenname]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUser();
    setRefreshing(false);
  }, [fetchUser]);

  // ── Buddy actions ────────────────────────────────────────────────────────
  const handleAddBuddy = useCallback(async () => {
    if (!user) return;
    setBuddyLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await fetch(`${API}/api/buddies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenname: user.screenname }),
      });
      if (res.ok) {
        setUser((prev) =>
          prev ? { ...prev, relationship: "pending", pendingDirection: "sent" } : prev
        );
      }
    } finally {
      setBuddyLoading(false);
    }
  }, [user]);

  const handleAcceptBuddy = useCallback(async () => {
    if (!user) return;
    setBuddyLoading(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const res = await fetch(`${API}/api/buddies/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        setUser((prev) =>
          prev ? { ...prev, relationship: "buddy", pendingDirection: null } : prev
        );
      }
    } finally {
      setBuddyLoading(false);
    }
  }, [user]);

  const handleDeclineBuddy = useCallback(async () => {
    if (!user) return;
    setBuddyLoading(true);
    try {
      await fetch(`${API}/api/buddies/${user.id}`, {
        method: "DELETE",
      });
      setUser((prev) =>
        prev ? { ...prev, relationship: "none", pendingDirection: null } : prev
      );
    } finally {
      setBuddyLoading(false);
    }
  }, [user]);

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </TouchableOpacity>
        </View>
        <ActivityIndicator color={C.amber} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (notFound || !user) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>user not found.</Text>
      </View>
    );
  }

  const avatarHex   = AVATAR_COLOR_MAP[user.avatarColor] ?? C.amber;
  const initial     = (user.screenname[0] ?? "?").toUpperCase();
  const dotColor    = STATUS_DOT[user.status]  ?? C.muted;
  const statusLabel = STATUS_LABEL[user.status] ?? "Offline";

  // Filter mutual channels — never show SECRET ones
  const visibleChannels = user.mutualChannels.filter((c) => c.type !== "SECRET");

  const safetyTarget: SafetyTarget = {
    screenname:       user.screenname,
    screenname_lower: user.screenname.toLowerCase(),
    targetType:       "user",
    targetId:         user.id,
  };

  // ── Profile header used as FlashList ListHeaderComponent ─────────────────
  const ListHeader = (
    <View>
      {/* Back + actions header */}
      <View style={[styles.headerBar, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {/* ··· safety menu */}
        <TouchableOpacity
          onPress={() => safetyRef.current?.expand()}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <View
          style={[
            styles.avatarRing,
            { borderColor: user.isGoldMember ? C.gold : "transparent" },
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
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      </View>

      {/* Name */}
      <View style={styles.nameRow}>
        <Text style={styles.screenname}>{user.screenname}</Text>
        {user.isGoldMember && <Text style={styles.goldStar}>★</Text>}
      </View>

      {/* Status — dot + label ONLY. No timestamp. */}
      <View style={styles.statusRow}>
        <View style={[styles.statusInlineDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statusText}>{statusLabel}</Text>
      </View>

      {/* Bio */}
      {user.bio ? (
        <Text style={styles.bio}>{user.bio}</Text>
      ) : null}

      {/* Away message */}
      {user.awayMessage ? (
        <View style={styles.awayMsgWrap}>
          <View style={styles.awayMsgBorder} />
          <Text style={styles.awayMsg}>{user.awayMessage}</Text>
        </View>
      ) : null}

      {/* Stats — NO join date */}
      <Text style={styles.stats}>
        {user.postCount.toLocaleString()} posts · {user.buddyCount.toLocaleString()} buddies
      </Text>

      {/* Buddy + tip actions */}
      <View style={styles.actionsRow}>
        {user.relationship === "none" && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleAddBuddy}
            disabled={buddyLoading}
            activeOpacity={0.8}
          >
            {buddyLoading
              ? <ActivityIndicator size="small" color="#0f0e0c" />
              : <Text style={styles.primaryBtnText}>Add buddy</Text>}
          </TouchableOpacity>
        )}

        {user.relationship === "pending" && user.pendingDirection === "sent" && (
          <View style={styles.pendingChip}>
            <Text style={styles.pendingText}>request sent</Text>
          </View>
        )}

        {user.relationship === "pending" && user.pendingDirection === "received" && (
          <View style={styles.pendingActions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleAcceptBuddy}
              disabled={buddyLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={handleDeclineBuddy}
              disabled={buddyLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.ghostBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {user.relationship === "buddy" && (
          <View style={styles.buddyChip}>
            <Text style={styles.buddyChipText}>buddies ✓</Text>
          </View>
        )}

        {/* Tip button — always shown unless self */}
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => router.push(`/(app)/tip/${user.screenname}`)}
          activeOpacity={0.8}
        >
          <Text style={styles.ghostBtnText}>Send tip ★</Text>
        </TouchableOpacity>
      </View>

      {/* Mutual channels — amber chips, never SECRET */}
      {visibleChannels.length > 0 && (
        <View style={styles.chipsSection}>
          <Text style={styles.chipsSectionLabel}>MUTUAL CHANNELS</Text>
          <View style={styles.chips}>
            {visibleChannels.map((ch) => (
              <TouchableOpacity
                key={ch.name}
                style={styles.amberChip}
                onPress={() => router.push(`/channel/${ch.name}`)}
                activeOpacity={0.75}
              >
                <Text style={styles.amberChipText}>
                  {ch.type === "INVITE_ONLY" ? "🔒" : "#"}{ch.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Public boards — teal chips */}
      {user.publicBoards.length > 0 && (
        <View style={styles.chipsSection}>
          <Text style={styles.chipsSectionLabel}>BOARDS</Text>
          <View style={styles.chips}>
            {user.publicBoards.map((b) => (
              <TouchableOpacity
                key={b.name}
                style={styles.tealChip}
                onPress={() => router.push(`/(app)/board/${b.name}`)}
                activeOpacity={0.75}
              >
                <Text style={styles.tealChipText}>{b.displayName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Posts divider */}
      <View style={styles.postsDivider}>
        <Text style={styles.postsDividerLabel}>POSTS</Text>
      </View>
    </View>
  );

  return (
    <>
      <View style={[styles.root, { paddingTop: 0 }]}>
        <FlashList
          data={user.posts}
          estimatedItemSize={80}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => (
            <PostRow
              post={item}
              onPress={() => router.push(`/(app)/post/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>no posts yet.</Text>
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

      <SafetySheet
        ref={safetyRef}
        target={safetyTarget}
        onBlockConfirmed={() => router.back()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  // Avatar
  avatarWrap: { alignItems: "center", marginTop: 4, marginBottom: 12 },
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

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
  },
  screenname: { fontFamily: "DMSans_700Bold", fontSize: 24, color: C.text },
  goldStar:   { fontSize: 18, color: C.gold },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 5,
  },
  statusInlineDot: { width: 8, height: 8, borderRadius: 4 },
  // NO timestamp displayed here or anywhere — only the label below
  statusText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.muted },

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

  stats: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
    marginTop: 12,
  },

  // Actions
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  primaryBtn: {
    backgroundColor: C.amber,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: "center",
  },
  primaryBtnText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: "#0f0e0c" },
  ghostBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ghostBtnText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: C.muted },
  pendingChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pendingText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.muted, fontStyle: "italic" },
  pendingActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  buddyChip: {
    backgroundColor: "rgba(76,175,80,0.1)",
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.3)",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buddyChipText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: "#4caf50" },

  // Chips
  chipsSection: { marginTop: 20, paddingHorizontal: 18, gap: 10 },
  chipsSectionLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: C.muted,
    letterSpacing: 1,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amberChip: {
    backgroundColor: C.amberTint,
    borderWidth: 1,
    borderColor: C.amberBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  amberChipText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.amber },
  tealChip: {
    backgroundColor: C.tealTint,
    borderWidth: 1,
    borderColor: C.tealBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tealChipText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.teal },

  // Posts section
  postsDivider: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginTop: 8,
  },
  postsDividerLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: C.muted,
    letterSpacing: 1,
  },
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
  postMeta: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 32,
  },
  notFound: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.muted,
    textAlign: "center",
    marginTop: 60,
  },
});
