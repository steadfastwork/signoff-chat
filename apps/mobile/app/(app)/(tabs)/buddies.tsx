import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActionSheetIOS,
  Platform,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import BottomSheet from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import PendingCard, { type PendingRequest } from "@/components/buddies/PendingCard";
import AddBuddySheet from "@/components/buddies/AddBuddySheet";
import { soketiClient } from "@/lib/soketi";
import { getSession } from "@/lib/session";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const C = {
  bg:       "#0f0e0c",
  card:     "#191714",
  amber:    "#c8860a",
  text:     "#c8c4b0",
  muted:    "#6a6860",
  dim:      "#3a3a34",
  border:   "#1e1e1a",
  online:   "#22c55e",
  away:     "#f59e0b",
  offline:  "#3a3a34",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";
const COLLAPSED_KEY = "sc-aim-collapsed-mobile";
const OFFLINE_COLLAPSED_KEY = "sc-aim-offline-collapsed-mobile";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuddyInGroup {
  userId: string;
  relationId: string;
  screenname: string;
  isGold: boolean;
  isOnline: boolean;
  isAway: boolean;
  awayMessage: string;
  currently: Record<string, string>;
}

interface BuddyGroup {
  id: string;
  name: string;
  order: number;
  memberIds: string[];
  buddies: BuddyInGroup[];
  totalCount: number;
}

interface BuddiesResponse {
  groups: BuddyGroup[];
  ungrouped: BuddyInGroup[];
  offlineBuddies: BuddyInGroup[];
}

// ---------------------------------------------------------------------------
// AIM group header — arrow + name + online/total count
// ---------------------------------------------------------------------------

function AimGroupHeader({
  name,
  onlineCount,
  totalCount,
  expanded,
  onToggle,
  isOffline = false,
}: {
  name: string;
  onlineCount: number;
  totalCount: number;
  expanded: boolean;
  onToggle: () => void;
  isOffline?: boolean;
}) {
  const rotation = useSharedValue(expanded ? 1 : 0);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 90}deg` }],
  }));

  const toggle = () => {
    rotation.value = withSpring(expanded ? 0 : 1, { damping: 14, stiffness: 200 });
    onToggle();
  };

  return (
    <TouchableOpacity
      style={styles.groupHeader}
      onPress={toggle}
      activeOpacity={0.7}
    >
      <Animated.View style={arrowStyle}>
        <Text style={styles.groupArrow}>▶</Text>
      </Animated.View>
      <Text style={styles.groupName}>{name}</Text>
      {!isOffline ? (
        <Text style={styles.groupCountContainer}>
          <Text style={styles.groupCountOnline}>{onlineCount}</Text>
          <Text style={styles.groupCountTotal}>/{totalCount}</Text>
        </Text>
      ) : (
        <Text style={styles.groupCountTotal}>{totalCount}</Text>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// AIM buddy row — no avatar, status dot + name + away snippet
// ---------------------------------------------------------------------------

function AimBuddyRow({
  buddy,
  onPress,
  onLongPress,
  isOffline = false,
}: {
  buddy: BuddyInGroup;
  onPress: () => void;
  onLongPress: () => void;
  isOffline?: boolean;
}) {
  const dotColor = isOffline
    ? C.offline
    : buddy.isAway
    ? C.away
    : C.online;

  return (
    <TouchableOpacity
      style={styles.buddyRow}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={styles.buddyName} numberOfLines={1}>
        {buddy.screenname}
        {buddy.isGold ? (
          <Text style={styles.goldStar}> ★</Text>
        ) : null}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Remove confirmation sheet
// ---------------------------------------------------------------------------

function RemoveConfirmSheet({
  buddy,
  sheetRef,
  onConfirm,
}: {
  buddy: BuddyInGroup | null;
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
          Remove{" "}
          <Text style={styles.confirmName}>{buddy?.screenname}</Text> from your
          buddy list?
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
  const [buddyData, setBuddyData] = useState<BuddiesResponse | null>(null);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Collapse state — loaded from AsyncStorage
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [offlineCollapsed, setOfflineCollapsed] = useState(true);

  // Ref: previous status map to detect online transitions
  const prevStatuses = useRef<Map<string, string>>(new Map());

  // Bottom sheets
  const addSheetRef = useRef<BottomSheet>(null);
  const removeSheetRef = useRef<BottomSheet>(null);
  const [removingBuddy, setRemovingBuddy] = useState<BuddyInGroup | null>(null);

  // ---------------------------------------------------------------------------
  // Init — load session, fetch data, load collapse prefs
  // ---------------------------------------------------------------------------

  useEffect(() => {
    getSession().then((s) => {
      if (s) setUserId(s.userId);
    });
    fetchAll();
    loadCollapsedState();
  }, []);

  const loadCollapsedState = async () => {
    try {
      const raw = await AsyncStorage.getItem(COLLAPSED_KEY);
      if (raw) setCollapsedGroups(JSON.parse(raw));
      const offlineRaw = await AsyncStorage.getItem(OFFLINE_COLLAPSED_KEY);
      setOfflineCollapsed(offlineRaw === null ? true : offlineRaw === "1");
    } catch {}
  };

  const saveCollapsedState = async (next: Record<string, boolean>) => {
    try {
      await AsyncStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {}
  };

  const saveOfflineCollapsed = async (v: boolean) => {
    try {
      await AsyncStorage.setItem(OFFLINE_COLLAPSED_KEY, v ? "1" : "0");
    } catch {}
  };

  // ---------------------------------------------------------------------------
  // Soketi presence — real-time status updates
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!userId) return;

    const channel = soketiClient.subscribe(`private-user.${userId}.buddies`);

    channel.bind(
      "buddy.status",
      (data: { userId: string; status: string; awayMessage?: string | null }) => {
        const effectiveStatus =
          data.status === "INVISIBLE" ? "OFFLINE" : data.status;
        const nowOnline = effectiveStatus !== "OFFLINE";
        const prev = prevStatuses.current.get(data.userId);
        const wasOnline =
          prev !== undefined ? prev !== "OFFLINE" && prev !== "INVISIBLE" : false;

        if (!wasOnline && nowOnline) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        prevStatuses.current.set(data.userId, data.status);

        // Update buddy data in state
        setBuddyData((prev) => {
          if (!prev) return prev;
          const isAway =
            effectiveStatus === "AWAY" ||
            (data.awayMessage != null && data.awayMessage.length > 0);

          // Find and update the buddy
          const update = (b: BuddyInGroup) =>
            b.userId === data.userId
              ? {
                  ...b,
                  isOnline: nowOnline,
                  isAway,
                  awayMessage: data.awayMessage
                    ? data.awayMessage.slice(0, 60)
                    : "",
                }
              : b;

          if (
            wasOnline === nowOnline ||
            (prev.offlineBuddies.some((b) => b.userId === data.userId) &&
              !nowOnline)
          ) {
            // Same section — update in place
            return {
              groups: prev.groups.map((g) => ({
                ...g,
                buddies: g.buddies.map(update),
              })),
              ungrouped: prev.ungrouped.map(update),
              offlineBuddies: prev.offlineBuddies.map(update),
            };
          }

          // Section change — refetch for correctness
          fetchAll();
          return prev;
        });
      }
    );

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
        const data: BuddiesResponse = await buddyRes.json();
        setBuddyData(data);

        // Track initial statuses
        const allBuddies = [
          ...data.groups.flatMap((g) => g.buddies),
          ...data.ungrouped,
          ...data.offlineBuddies,
        ];
        allBuddies.forEach((b) => {
          prevStatuses.current.set(
            b.userId,
            b.isOnline ? (b.isAway ? "AWAY" : "ONLINE") : "OFFLINE"
          );
        });

        // Auto-expand first group if it has online buddies
        const firstOnlineGroup = data.groups.find((g) => g.buddies.length > 0);
        if (firstOnlineGroup) {
          setCollapsedGroups((prev) => {
            if (prev[firstOnlineGroup.id] !== undefined) return prev;
            const next = { ...prev, [firstOnlineGroup.id]: false };
            saveCollapsedState(next);
            return next;
          });
        } else if (data.ungrouped.length > 0) {
          setCollapsedGroups((prev) => {
            if (prev["__ungrouped__"] !== undefined) return prev;
            const next = { ...prev, __ungrouped__: false };
            saveCollapsedState(next);
            return next;
          });
        }
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        const reqs: PendingRequest[] = (data.requests ?? []).map(
          (r: Record<string, unknown>) => ({
            relationId: String(r.id),
            fromUserId: String(r.requesterId),
            screenname: String(
              (r.requester as Record<string, unknown>)?.screenname ?? ""
            ),
            avatarColor: String(
              (r.requester as Record<string, unknown>)?.avatarColor ?? "#c8860a"
            ),
          })
        );
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
  // Toggle collapse
  // ---------------------------------------------------------------------------

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      saveCollapsedState(next);
      return next;
    });
  };

  const toggleOffline = () => {
    setOfflineCollapsed((v) => {
      saveOfflineCollapsed(!v);
      return !v;
    });
  };

  // ---------------------------------------------------------------------------
  // Long press action sheet
  // ---------------------------------------------------------------------------

  const handleRemoveFromList = useCallback(async (buddy: BuddyInGroup, listId: string) => {
    const res = await fetch(`${API}/api/buddy-lists/${listId}/members/${buddy.userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setBuddyData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === listId
              ? { ...g, buddies: g.buddies.filter((b) => b.userId !== buddy.userId) }
              : g
          ),
        };
      });
    }
  }, []);

  const showBuddyActions = (buddy: BuddyInGroup, listId?: string, listName?: string) => {
    if (Platform.OS === "ios") {
      const options = [
        "Cancel",
        `Message ${buddy.screenname}`,
        "View profile",
        ...(listId && listName ? [`Remove from ${listName}`] : []),
        "Remove buddy",
      ];
      const destructiveIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: destructiveIndex,
        },
        (index) => {
          if (index === 1) router.push(`/(app)/dm/${buddy.userId}`);
          if (index === 2) router.push(`/(app)/u/${buddy.screenname}`);
          if (listId && listName && index === 3) {
            handleRemoveFromList(buddy, listId);
          } else if (index === destructiveIndex) {
            setRemovingBuddy(buddy);
            removeSheetRef.current?.expand();
          }
        }
      );
    } else {
      Alert.alert(buddy.screenname, undefined, [
        {
          text: `Message ${buddy.screenname}`,
          onPress: () => router.push(`/(app)/dm/${buddy.userId}`),
        },
        {
          text: "View profile",
          onPress: () => router.push(`/(app)/u/${buddy.screenname}`),
        },
        ...(listId && listName
          ? [{
              text: `Remove from ${listName}`,
              onPress: () => handleRemoveFromList(buddy, listId),
            }]
          : []),
        {
          text: "Remove buddy",
          style: "destructive" as const,
          onPress: () => {
            setRemovingBuddy(buddy);
            removeSheetRef.current?.expand();
          },
        },
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  };

  // ---------------------------------------------------------------------------
  // Request / remove handlers
  // ---------------------------------------------------------------------------

  const handleSendRequest = useCallback(async (toUserId: string) => {
    await fetch(`${API}/api/buddies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: toUserId }),
    });
  }, []);

  const handleAccept = useCallback(
    async (relationId: string) => {
      const res = await fetch(`${API}/api/buddies/${relationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        setPending((prev) => prev.filter((r) => r.relationId !== relationId));
        await fetchAll();
      }
    },
    [fetchAll]
  );

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

  const handleRemoveConfirm = useCallback(async () => {
    if (!removingBuddy) return;
    removeSheetRef.current?.close();
    const res = await fetch(`${API}/api/buddies/${removingBuddy.relationId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setBuddyData((prev) => {
        if (!prev) return prev;
        return {
          groups: prev.groups.map((g) => ({
            ...g,
            buddies: g.buddies.filter((b) => b.userId !== removingBuddy.userId),
          })),
          ungrouped: prev.ungrouped.filter(
            (b) => b.userId !== removingBuddy.userId
          ),
          offlineBuddies: prev.offlineBuddies.filter(
            (b) => b.userId !== removingBuddy.userId
          ),
        };
      });
    }
    setRemovingBuddy(null);
  }, [removingBuddy]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const allEmpty =
    buddyData &&
    buddyData.groups.length === 0 &&
    buddyData.ungrouped.length === 0 &&
    buddyData.offlineBuddies.length === 0 &&
    pending.length === 0;

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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.amber}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Pending requests ── */}
          {pending.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
            >
              <PendingCard
                requests={pending}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            </Animated.View>
          )}

          {/* ── AIM Groups ── */}
          {buddyData?.groups.map((group) => {
            const isExpanded = !(collapsedGroups[group.id] ?? true);
            return (
              <View key={group.id}>
                <AimGroupHeader
                  name={group.name}
                  onlineCount={group.buddies.length}
                  totalCount={group.totalCount}
                  expanded={isExpanded}
                  onToggle={() => toggleGroup(group.id)}
                />
                {isExpanded &&
                  group.buddies.map((b) => (
                    <AimBuddyRow
                      key={b.userId}
                      buddy={b}
                      onPress={() =>
                        router.push(`/(app)/dm/${b.userId}` as never)
                      }
                      onLongPress={() => showBuddyActions(b, group.id, group.name)}
                    />
                  ))}
                {isExpanded && group.buddies.length === 0 && (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>none online.</Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* ── Ungrouped online buddies ── */}
          {buddyData && buddyData.ungrouped.length > 0 && (
            <View>
              <AimGroupHeader
                name="Buddies"
                onlineCount={buddyData.ungrouped.length}
                totalCount={buddyData.ungrouped.length}
                expanded={!(collapsedGroups["__ungrouped__"] ?? true)}
                onToggle={() => toggleGroup("__ungrouped__")}
              />
              {!(collapsedGroups["__ungrouped__"] ?? true) &&
                buddyData.ungrouped.map((b) => (
                  <AimBuddyRow
                    key={b.userId}
                    buddy={b}
                    onPress={() =>
                      router.push(`/(app)/dm/${b.userId}` as never)
                    }
                    onLongPress={() => showBuddyActions(b)}
                  />
                ))}
            </View>
          )}

          {/* ── Offline section ── */}
          {buddyData && buddyData.offlineBuddies.length > 0 && (
            <View style={styles.offlineSection}>
              <View style={styles.offlineDivider} />
              <AimGroupHeader
                name="Offline"
                onlineCount={0}
                totalCount={buddyData.offlineBuddies.length}
                expanded={!offlineCollapsed}
                onToggle={toggleOffline}
                isOffline
              />
              {!offlineCollapsed &&
                buddyData.offlineBuddies.map((b) => (
                  <AimBuddyRow
                    key={b.userId}
                    buddy={b}
                    onPress={() =>
                      router.push(`/(app)/u/${b.screenname}` as never)
                    }
                    onLongPress={() => showBuddyActions(b)}
                    isOffline
                  />
                ))}
            </View>
          )}

          {/* ── Global empty state ── */}
          {allEmpty && (
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
          onSendRequest={(uid) => handleSendRequest(uid)}
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

  // AIM group header
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 32,
    backgroundColor: C.bg,
  },
  groupArrow: {
    fontSize: 10,
    color: C.dim,
    fontFamily: "Courier",
  },
  groupName: {
    flex: 1,
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: C.muted,
    letterSpacing: 0.2,
  },
  groupCountContainer: {
    fontSize: 11,
  },
  groupCountOnline: {
    fontSize: 11,
    color: C.amber,
    fontFamily: "DMSans_400Regular",
  },
  groupCountTotal: {
    fontSize: 11,
    color: C.dim,
    fontFamily: "DMSans_400Regular",
  },

  // AIM buddy row
  buddyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 26,
    paddingRight: 14,
    paddingVertical: 8,
    minHeight: 36,
    gap: 8,
    backgroundColor: C.bg,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  buddyName: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.text,
  },
  goldStar: {
    fontSize: 10,
    color: C.amber,
  },

  // Offline section
  offlineSection: {
    opacity: 0.45,
  },
  offlineDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 4,
  },

  // Section empty
  emptySection: {
    paddingLeft: 26,
    paddingRight: 14,
    paddingVertical: 8,
  },
  emptySectionText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
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
