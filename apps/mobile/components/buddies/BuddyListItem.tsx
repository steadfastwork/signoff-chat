import { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import Avatar from "@/components/Avatar";

// ---------------------------------------------------------------------------
// NO lastSeen. NO "active X hours ago". NO timestamps of any kind.
// Offline = offline. The product is proud of this.
// ---------------------------------------------------------------------------

const C = {
  bg:     "#0f0e0c",
  text:   "#e8e4d9",
  muted:  "#7a7060",
  border: "#1e1c18",
  amber:  "#f5c842",
  gold:   "#d4a017",
};

export const STATUS_COLORS: Record<string, string> = {
  ONLINE:    "#4caf50",
  AWAY:      "#ff9800",
  IDLE:      "#f5c842",
  INVISIBLE: "#9e9e9e",
  OFFLINE:   "#3a3a32",
};

export interface Buddy {
  id: string;         // user ID
  relationId: string;
  screenname: string;
  status: string;
  awayMessage: string | null;
  isGoldMember: boolean;
  avatarColor: string;
}

interface Props {
  buddy: Buddy;
  onPress: () => void;
  onRemoveRequest: (buddy: Buddy) => void;
}

function RightAction({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.swipeAction} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.swipeActionText}>Remove</Text>
    </TouchableOpacity>
  );
}

export default function BuddyListItem({ buddy, onPress, onRemoveRequest }: Props) {
  const swipeRef = useRef<Swipeable>(null);

  const handleRemoveTap = () => {
    swipeRef.current?.close();
    onRemoveRequest(buddy);
  };

  return (
    <Animated.View entering={FadeInDown.duration(180).springify()} exiting={FadeOutUp.duration(140)}>
      <Swipeable
        ref={swipeRef}
        friction={2}
        overshootRight={false}
        renderRightActions={() => <RightAction onPress={handleRemoveTap} />}
      >
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
          <Avatar
            screenname={buddy.screenname}
            color={buddy.avatarColor}
            size={40}
            statusDot={STATUS_COLORS[buddy.status] ?? STATUS_COLORS.OFFLINE}
          />
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.screenname}>{buddy.screenname}</Text>
              {buddy.isGoldMember && (
                <Text style={styles.gold}>★</Text>
              )}
            </View>
            {buddy.awayMessage ? (
              <Text style={styles.away} numberOfLines={1}>
                {buddy.awayMessage}
              </Text>
            ) : (
              // Deliberate empty space — no status text, no last-seen
              <View style={{ height: 14 }} />
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  info: { flex: 1, gap: 3 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  screenname: {
    fontFamily: "DMSans_700Bold",
    fontSize: 15,
    color: C.text,
  },
  gold: {
    fontSize: 12,
    color: C.gold,
  },
  away: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    fontStyle: "italic",
  },
  // Swipe
  swipeAction: {
    backgroundColor: "#c0392b",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
  },
  swipeActionText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: "#fff",
  },
});
