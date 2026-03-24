import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import BottomSheet from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import BuddyListItem, { type Buddy, STATUS_COLORS } from "@/components/buddies/BuddyListItem";
import PendingCard, { type PendingRequest } from "@/components/buddies/PendingCard";
import AddBuddySheet from "@/components/buddies/AddBuddySheet";
import { soketiClient } from "@/lib/soketi";
import { getSession } from "@/lib/session";

// ---------------------------------------------------------------------------
const C = {
  bg:     "#0f0e0c",
  card:   "#191714",
  amber:  "#f5c842",
  text:   "#e8e4d9",
  muted:  "#7a7060",
  border: "#1e1c18",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

// ---------------------------------------------------------------------------
// Section definitions — online / away / offline
// Collapsed by default. Expanded on tap.
// ---------------------------------------------------------------------------

type SectionKey = "online" | "away" | "offline";

const SECTIONS: { key: SectionKey; label: string; dot: string }[] = [
  { key: "online",  label: "online",  dot: "#4caf50" },
  { key: "away",    label: "away",    dot: "#ff9800" },
  { key: "offline", label: "offline", dot: "#3a3a32" },
];

function categorize(status: string): SectionKey {
  if (status === "ONLINE" || status === "IDLE") return "online";
  if (status === "AWAY") return "away";
  return "offline";
}

// ---------------------------------------------------------------------------
// Section header with animated chevron
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  dot,
  count,
  expanded,
  onToggle,
}: {
  label: string;
  dot: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rotation = useSharedValue(expanded ? 1 : 0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 90}deg` }],
  }));

  const toggle = () => {
    rotation.value = withSpring(expanded ? 0 : 1, { damping: 14, stiffness: 200 });
    onToggle();
  };

  return (
    <TouchableOpacity style={styles.sectionHeader} onPress={toggle} activeOpacity={0.7}>
      <View style={[styles.sectionDot, { backgroundColor: dot }]} />
      <Text style={styles.sectionLabel}>
        {label}
        {count > 0 && (
          <Text style={styles.sectionCount}> — {count}</Text>
        )}
      </Text>
      <Animated.View style={chevronStyle}>
        <Ionicons name="chevron-forward" size={14} color={C.muted} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Remove confirmation — small inline bottom sheet
// ---------------------------------------------------------------------------

function RemoveConfirmSheet({
  buddy,
  sheetRef,
  onConfirm,
}: {
  buddy: Buddy | null;
  sheetRef: React.RefObject<BottomSheet>;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["22%"]}
      enablePanDownToClose
      backgroundStyle={styles.confirmSheet}
      handleIndicatorStyle={{ backgroundColor: C.muted, width: 36 }}
    >
      <View style={styles.confirmContent}>
        <Text style={styles.confirmText}>
          Remove <Text style={styles.confirmName}>{buddy?.screenname}</Text> from your buddy list?
        </Text>
        <View style={styles.confirmActions}>
          <TouchableOpacity
            style={styles.confirmRemoveBtn}
            onPress={onConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmRemoveText}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmCancelBtn}
            onPress={() => sheetRef.current?.close()}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function BuddiesScreen() {
  const router = useRouter();
  const [buddies, setBuddies]       = useState<Buddy[]>([]);
  const [pending, setPending]       = useState<PendingRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId]         = useState<string | null>(null);

  // Section collapse state — all collapsed by default
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    online: false,
    away:   false,
    offline: false,
  });

  // Ref: previous status map to detect online transitions
  const prevStatuses = useRef<Map<string, string>>(new Map());

  // Bottom sheets
  const addSheetRef     = useRef<BottomSheet>(null);
  const removeSheetRef  = useRef<BottomSheet>(null);
  const [removingBuddy, setRemovingBuddy] = useState<Buddy | null>(null);

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  useEffect(() => {
    getSession().then((s) => {
      if (s) setUserId(s.userId);
    });
    fetchAll();
  }, []);

  // ---------------------------------------------------------------------------
  // Soketi presence — real-time status updates
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!userId) return;

    const channel = soketiClient.subscribe(`private-user.${userId}.buddies`);

    // Buddy status changed
    channel.bind("buddy.status", (data: { userId: string; status: string }) => {
      setBuddies((prev) => {
        const updated = prev.map((b) => {
          if (b.id !== data.userId) return b;

          const wasOnline = categorize(prevStatuses.current.get(b.id) ?? "OFFLINE") === "online";
          const nowOnline = categorize(data.status) === "online";

          if (!wasOnline && nowOnline) {
            // Buddy just came online — haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          prevStatuses.current.set(b.id, data.status);
          return { ...b, status: data.status };
        });
        return updated;
      });
    });

    // New buddy relation accepted
    channel.bind("buddy.added", () => {
      fetchAll();
    });

    return () => {
      soketiClient.unsubscribe(`private-user.${userId}.buddies`);
    };
  }, [userId]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchAll = useCallback(async () => {
    try {
      const [buddyRes, pendingRes] = await Promise.all([
        fetch(`${API}/api/buddies`),
        fetch(`${API}/api/buddies/requests?direction=received`),
      ]);

      if (buddyRes.ok) {
        const data = await buddyRes.json();
        const list: Buddy[] = (data.buddies ?? []).map((b: Record<string, unknown>) => ({
          id:           String(b.id),
          relationId:   String(b.relationId),
          screenname:   String(b.screenname),
          status:       String(b.status ?? "OFFLINE"),
          awayMessage:  b.awayMessage ? String(b.awayMessage) : null,
          isGoldMember: Boolean(b.isGoldMember),
          avatarColor:  String(b.avatarColor ?? "#f5c842"),
        }));
        // Store initial statuses
        list.forEach((b) => prevStatuses.current.set(b.id, b.status));
        setBuddies(list);

        // Auto-expand online section if there are online buddies
        const hasOnline = list.some((b) => categorize(b.status) === "online");
        if (hasOnline) {
          setExpanded((e) => ({ ...e, online: true }));
        }
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        const reqs: PendingRequest[] = (data.requests ?? []).map((r: Record<string, unknown>) => ({
          relationId:  String(r.id),
          fromUserId:  String(r.requesterId),
          screenname:  String((r.requester as Record<string, unknown>)?.screenname ?? ""),
          avatarColor: String((r.requester as Record<string, unknown>)?.avatarColor ?? "#f5c842"),
          // NO createdAt. We don't store it. We don't show it.
        }));
        setPending(reqs);
      }
    } catch {}
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSendRequest = useCallback(async (toUserId: string) => {
    await fetch(`${API}/api/buddies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: toUserId }),
    });
  }, []);

  const handleAccept = useCallback(async (relationId: string) => {
    const res = await fetch(`${API}/api/buddies/${relationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) {
      setPending((prev) => prev.filter((r) => r.relationId !== relationId));
      await fetchAll();
    }
  }, [fetchAll]);

  const handleDecline = useCallback(async (relationId: string) => {
    const res = await fetch(`${API}/api/buddies/${relationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    if (res.ok) {
      setPending((prev) => prev.filter((r) => r.relationId !== relationId));
    }
  }, []);

  const handleRemoveRequest = useCallback((buddy: Buddy) => {
    setRemovingBuddy(buddy);
    removeSheetRef.current?.expand();
  }, []);

  const handleRemoveConfirm = useCallback(async () => {
    if (!removingBuddy) return;
    removeSheetRef.current?.close();
    const res = await fetch(`${API}/api/buddies/${removingBuddy.relationId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setBuddies((prev) => prev.filter((b) => b.id !== removingBuddy.id));
    }
    setRemovingBuddy(null);
  }, [removingBuddy]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Group buddies into sections
  const grouped = buddies.reduce<Record<SectionKey, Buddy[]>>(
    (acc, buddy) => {
      const key = categorize(buddy.status);
      acc[key].push(buddy);
      return acc;
    },
    { online: [], away: [], offline: [] }
  );

  const toggleSection = (key: SectionKey) =>
    setExpanded((e) => ({ ...e, [key]: !e[key] }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.root} edges={["top"]}>

        {/* ── Header ── */}
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <Text style={styles.headerTitle}>Buddies</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => addSheetRef.current?.expand()}
            hitSlop={6}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={C.amber} />
          </TouchableOpacity>
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.amber} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Pending requests ── */}
          {pending.length > 0 && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <PendingCard
                requests={pending}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            </Animated.View>
          )}

          {/* ── Sections ── */}
          {SECTIONS.map((section) => {
            const sectionBuddies = grouped[section.key];
            const isExpanded = expanded[section.key];

            return (
              <View key={section.key}>
                <SectionHeader
                  label={section.label}
                  dot={section.dot}
                  count={sectionBuddies.length}
                  expanded={isExpanded}
                  onToggle={() => toggleSection(section.key)}
                />
                {isExpanded && sectionBuddies.map((buddy) => (
                  <BuddyListItem
                    key={buddy.id}
                    buddy={buddy}
                    onPress={() => router.push(`/(app)/u/${buddy.screenname}`)}
                    onRemoveRequest={handleRemoveRequest}
                  />
                ))}
                {isExpanded && sectionBuddies.length === 0 && (
                  <Animated.View entering={FadeIn.duration(150)} style={styles.sectionEmpty}>
                    <Text style={styles.sectionEmptyText}>none here.</Text>
                  </Animated.View>
                )}
              </View>
            );
          })}

          {/* ── Global empty state ── */}
          {buddies.length === 0 && pending.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>no buddies yet.</Text>
              <TouchableOpacity
                onPress={() => addSheetRef.current?.expand()}
                activeOpacity={0.7}
              >
                <Text style={styles.emptyLink}>find a screenname →</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── Add buddy sheet ── */}
        <AddBuddySheet
          ref={addSheetRef}
          onSendRequest={(userId) => handleSendRequest(userId)}
        />

        {/* ── Remove confirmation sheet ── */}
        <RemoveConfirmSheet
          buddy={removingBuddy}
          sheetRef={removeSheetRef}
          onConfirm={handleRemoveConfirm}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    color: C.text,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  sectionLabel: {
    flex: 1,
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: C.muted,
    textTransform: "lowercase",
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontFamily: "DMSans_400Regular",
    color: C.muted,
  },

  // Section empty
  sectionEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sectionEmptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    fontStyle: "italic",
  },

  // Global empty
  empty: {
    paddingTop: 80,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.muted,
  },
  emptyLink: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.amber,
  },

  // Remove confirm sheet
  confirmSheet: {
    backgroundColor: "#191714",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#2c2820",
  },
  confirmContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 16,
  },
  confirmText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.text,
    lineHeight: 22,
  },
  confirmName: {
    fontFamily: "DMSans_700Bold",
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
  },
  confirmRemoveBtn: {
    flex: 1,
    backgroundColor: "#c0392b",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  confirmRemoveText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 15,
    color: "#fff",
  },
  confirmCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2c2820",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  confirmCancelText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.muted,
  },
});
