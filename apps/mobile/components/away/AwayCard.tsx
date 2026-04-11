import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

const C = {
  bg:          "#0f0e0c",
  surface:     "#191714",
  amber:       "#f5c842",
  amberBorder: "rgba(245,200,66,0.2)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
};

// Deterministic color from userId
const PALETTE = ["#f5c842","#4caf50","#2196f3","#e91e63","#ff9800","#9c27b0","#00bcd4","#ff5722"];
function userColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export interface AwayEntry {
  id: string;
  userId: string;
  screenname: string;
  isGold: boolean;
  awayMessage: string;
  setAt: string;
  nudgeCount: number;
  hasNudged: boolean;
}

interface Props {
  entry: AwayEntry;
  onNudge: (id: string, current: boolean) => void;
}

export default function AwayCard({ entry, onNudge }: Props) {
  const router = useRouter();
  const color  = userColor(entry.userId);
  const isHot  = entry.nudgeCount > 5;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        {/* Avatar */}
        <TouchableOpacity
          onPress={() => router.push(`/u/${entry.screenname}`)}
          style={[styles.avatar, { backgroundColor: color + "22", borderColor: color + "55" }]}
          hitSlop={6}
        >
          <Text style={[styles.avatarInitial, { color }]}>
            {(entry.screenname[0] ?? "?").toUpperCase()}
          </Text>
        </TouchableOpacity>

        <View style={styles.nameRow}>
          <TouchableOpacity onPress={() => router.push(`/u/${entry.screenname}`)}>
            <Text style={[styles.screenname, entry.isGold && styles.goldName]}>
              {entry.isGold ? `✦ ${entry.screenname}` : entry.screenname}
            </Text>
          </TouchableOpacity>
          <Text style={styles.timeAgo}>{timeAgo(entry.setAt)}</Text>
        </View>
      </View>

      {/* Away message */}
      <View style={[styles.awayBlock, isHot && styles.awayBlockHot]}>
        <Text style={[styles.awayText, isHot && styles.awayTextHot]}>
          {entry.awayMessage}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {/* Nudge */}
        <TouchableOpacity
          style={[styles.nudgeBtn, entry.hasNudged && styles.nudgeBtnActive]}
          onPress={() => onNudge(entry.id, entry.hasNudged)}
          activeOpacity={0.75}
        >
          <Text style={[styles.nudgeBtnText, entry.hasNudged && styles.nudgeBtnTextActive]}>
            👋 {entry.nudgeCount > 0 ? entry.nudgeCount : "nudge"}
          </Text>
        </TouchableOpacity>

        {/* Reply → DM */}
        <TouchableOpacity
          style={styles.replyBtn}
          onPress={() =>
            router.push({
              pathname: "/dm/[userId]" as never,
              params: { userId: entry.userId, quote: entry.awayMessage },
            })
          }
          activeOpacity={0.75}
        >
          <Text style={styles.replyBtnText}>reply →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontFamily: "DMSans_700Bold", fontSize: 14 },

  nameRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  screenname: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: C.text,
  },
  goldName: { color: C.amber },
  timeAgo: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
  },

  awayBlock: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(245,200,66,0.3)",
    paddingLeft: 10,
    paddingVertical: 2,
  },
  awayBlockHot: { borderLeftColor: C.amber },
  awayText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    fontStyle: "italic",
    color: "#d6c897",
    lineHeight: 20,
  },
  awayTextHot: { color: C.amber },

  actions: { flexDirection: "row", gap: 10, alignItems: "center" },

  nudgeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#111",
  },
  nudgeBtnActive: {
    borderColor: C.amberBorder,
    backgroundColor: "#2a1a00",
  },
  nudgeBtnText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
  nudgeBtnTextActive: { color: C.amber },

  replyBtn: { paddingHorizontal: 6 },
  replyBtnText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#92400e",
  },
});
