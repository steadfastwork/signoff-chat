import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SectionList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type BottomSheet from "@gorhom/bottom-sheet";
import CreateChannelSheet from "@/components/channels/CreateChannelSheet";

// ---------------------------------------------------------------------------
// NO algorithmic ranking. Joined channels sorted alphabetically.
// Discover = public only. No secret/private channels shown in discover.
// ---------------------------------------------------------------------------

const C = {
  bg:          "#0f0e0c",
  card:        "#191714",
  amber:       "#f5c842",
  amberTint:   "rgba(245,200,66,0.08)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  placeholder: "#4a4438",
  inputBg:     "#110e0a",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

type ChannelType = "PUBLIC" | "PRIVATE" | "SECRET";

interface Channel {
  name: string;
  type: ChannelType;
  memberCount: number;
  unreadCount?: number;
}

function typeIcon(type: ChannelType): string {
  if (type === "PRIVATE") return "🔒";
  if (type === "SECRET")  return "👁";
  return "#";
}

// ─────────────────────────────────────────────────────────────────────────────
// ChannelRow — for "Your channels" list
// ─────────────────────────────────────────────────────────────────────────────
function ChannelRow({
  channel,
  onPress,
}: {
  channel: Channel;
  onPress: () => void;
}) {
  const isPublic = channel.type === "PUBLIC";
  return (
    <TouchableOpacity style={styles.channelRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={[styles.channelIcon, { color: isPublic ? C.amber : C.muted }]}>
        {typeIcon(channel.type)}
      </Text>
      <Text style={styles.channelName}>{channel.name}</Text>
      <View style={styles.channelRowRight}>
        {(channel.unreadCount ?? 0) > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {channel.unreadCount! > 99 ? "99+" : channel.unreadCount}
            </Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={14} color={C.muted} />
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DiscoverCard — public channel browser cards
// ─────────────────────────────────────────────────────────────────────────────
function DiscoverCard({
  channel,
  onJoin,
  joining,
}: {
  channel: Channel;
  onJoin: () => void;
  joining: boolean;
}) {
  return (
    <View style={styles.discoverCard}>
      <View style={styles.discoverInfo}>
        <Text style={styles.discoverName}>#{channel.name}</Text>
        <Text style={styles.discoverMeta}>{channel.memberCount.toLocaleString()} members</Text>
      </View>
      <TouchableOpacity
        style={[styles.joinBtn, joining && { opacity: 0.5 }]}
        onPress={onJoin}
        disabled={joining}
        activeOpacity={0.8}
      >
        {joining
          ? <ActivityIndicator size="small" color="#0f0e0c" />
          : <Text style={styles.joinBtnText}>Join</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function ChannelsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const createSheetRef = useRef<BottomSheet>(null);

  const [myChannels,  setMyChannels]  = useState<Channel[]>([]);
  const [discover,    setDiscover]    = useState<Channel[]>([]);
  const [search,      setSearch]      = useState("");
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingDisc, setLoadingDisc] = useState(false);
  const [joiningMap,  setJoiningMap]  = useState<Record<string, boolean>>({});

  // ── Load my channels ──────────────────────────────────────────────────────
  const loadMyChannels = useCallback(async () => {
    setLoadingMine(true);
    try {
      const res = await fetch(`${API}/api/channels?member=true`);
      if (res.ok) {
        const data = await res.json();
        setMyChannels(
          (data.channels ?? []).sort((a: Channel, b: Channel) =>
            a.name.localeCompare(b.name)
          )
        );
      }
    } finally {
      setLoadingMine(false);
    }
  }, []);

  // ── Discover search ───────────────────────────────────────────────────────
  const loadDiscover = useCallback(async (q: string) => {
    setLoadingDisc(true);
    try {
      const qs = q.trim()
        ? `type=PUBLIC&q=${encodeURIComponent(q.trim())}`
        : `type=PUBLIC&limit=20`;
      const res = await fetch(`${API}/api/channels?${qs}`);
      if (res.ok) {
        const data = await res.json();
        const myNames = new Set(myChannels.map((c) => c.name));
        setDiscover(
          (data.channels ?? []).filter((c: Channel) => !myNames.has(c.name))
        );
      }
    } finally {
      setLoadingDisc(false);
    }
  }, [myChannels]);

  useEffect(() => { loadMyChannels(); }, []);

  useEffect(() => {
    const t = setTimeout(() => loadDiscover(search), 350);
    return () => clearTimeout(t);
  }, [search, myChannels]);

  // ── Join ──────────────────────────────────────────────────────────────────
  const handleJoin = useCallback(async (channelName: string) => {
    setJoiningMap((prev) => ({ ...prev, [channelName]: true }));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await fetch(`${API}/api/channels/${channelName}/join`, { method: "POST" });
      if (res.ok) {
        await loadMyChannels();
        router.push(`/channel/${channelName}`);
      }
    } finally {
      setJoiningMap((prev) => ({ ...prev, [channelName]: false }));
    }
  }, [loadMyChannels, router]);

  // ── Channel created ───────────────────────────────────────────────────────
  const handleCreated = useCallback(async (channelName: string) => {
    await loadMyChannels();
    router.push(`/channel/${channelName}`);
  }, [loadMyChannels, router]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Channels</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => createSheetRef.current?.expand()}
          activeOpacity={0.8}
          hitSlop={8}
        >
          <Ionicons name="add" size={22} color="#0f0e0c" />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={15} color={C.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="search public channels…"
          placeholderTextColor={C.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={6}>
            <Ionicons name="close-circle" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      <SectionList
        sections={[
          {
            title: "YOUR CHANNELS",
            key:   "mine",
            data:  myChannels,
          },
          {
            title: search.trim()
              ? `RESULTS FOR "${search.trim().toUpperCase()}"`
              : "DISCOVER",
            key:  "discover",
            data: discover,
          },
        ]}
        keyExtractor={(item, i) => (item as Channel).name + String(i)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 36 }}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            {(section as any).key === "mine" && loadingMine && (
              <ActivityIndicator size="small" color={C.amber} style={{ marginLeft: 8 }} />
            )}
            {(section as any).key === "discover" && loadingDisc && (
              <ActivityIndicator size="small" color={C.muted} style={{ marginLeft: 8 }} />
            )}
          </View>
        )}
        renderItem={({ item, section }) => {
          const ch = item as Channel;
          if ((section as any).key === "mine") {
            return (
              <ChannelRow
                channel={ch}
                onPress={() => router.push(`/channel/${ch.name}`)}
              />
            );
          }
          return (
            <DiscoverCard
              channel={ch}
              onJoin={() => handleJoin(ch.name)}
              joining={joiningMap[ch.name] ?? false}
            />
          );
        }}
        renderSectionFooter={({ section }) => {
          const key = (section as any).key;
          if (key === "mine" && !loadingMine && myChannels.length === 0) {
            return (
              <Text style={styles.emptyNote}>
                no channels yet. tap + to create one.
              </Text>
            );
          }
          if (key === "discover" && !loadingDisc && discover.length === 0 && search.trim()) {
            return (
              <Text style={styles.emptyNote}>
                no public channels match "{search.trim()}"
              </Text>
            );
          }
          return null;
        }}
      />

      <CreateChannelSheet ref={createSheetRef} onCreated={handleCreated} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 22, color: C.text },
  newBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // "Your channels" rows
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  channelIcon: {
    fontFamily: "DMSans_700Bold",
    fontSize: 15,
    width: 20,
    textAlign: "center",
  },
  channelName: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.text,
  },
  channelRowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  unreadBadge: {
    backgroundColor: C.amber,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: "#0f0e0c" },

  // Discover cards
  discoverCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  discoverInfo: { flex: 1, gap: 3 },
  discoverName: { fontFamily: "DMSans_700Bold", fontSize: 15, color: C.text },
  discoverMeta: { fontFamily: "DMSans_400Regular", fontSize: 12, color: C.muted },
  joinBtn: {
    backgroundColor: C.amber,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    minWidth: 64,
    alignItems: "center",
  },
  joinBtnText: { fontFamily: "DMSans_700Bold", fontSize: 13, color: "#0f0e0c" },

  emptyNote: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
});
