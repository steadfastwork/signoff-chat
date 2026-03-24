import { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type BottomSheet from "@gorhom/bottom-sheet";
import SafetySheet, { type SafetyTarget } from "@/components/SafetySheet";
import type { CachedMessage } from "@/lib/db/localMessages";

// ---------------------------------------------------------------------------
// NO read receipts. NO typing indicators. NO delivery status.
// A message is a message. It was sent. That's all anyone needs to know.
// ---------------------------------------------------------------------------

const C = {
  text:       "#e8e4d9",
  muted:      "#7a7060",
  border:     "#1e1c18",
  threadTint: "rgba(245,200,66,0.06)",
};

// Deterministic color from author id — same person always gets same color
const PALETTE = [
  "#f5c842", "#4caf50", "#2196f3", "#e91e63",
  "#ff9800", "#9c27b0", "#00bcd4", "#ff5722",
];
function authorColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return isToday ? time : `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

interface Props {
  message: CachedMessage;
  isLocalOnly?:   boolean;
  isOwnMessage?:  boolean;
  onThreadPress?: (message: CachedMessage) => void;
  onAuthorPress?: (screenname: string) => void;
}

export default function ChannelMessage({
  message,
  isLocalOnly,
  isOwnMessage,
  onThreadPress,
  onAuthorPress,
}: Props) {
  const color      = authorColor(message.author_id);
  const safetyRef  = useRef<BottomSheet>(null);

  const safetyTarget: SafetyTarget = {
    screenname:       message.author_name,
    screenname_lower: message.author_name.toLowerCase(),
    targetType:       "message",
    targetId:         message.id,
  };

  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onLongPress={() => onThreadPress?.(message)}
        delayLongPress={400}
        activeOpacity={0.85}
      >
        {/* Avatar */}
        <TouchableOpacity
          onPress={() => onAuthorPress?.(message.author_name)}
          hitSlop={6}
          style={[styles.avatar, { backgroundColor: color + "22", borderColor: color + "55" }]}
        >
          <Text style={[styles.avatarInitial, { color }]}>
            {(message.author_name[0] ?? "?").toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Body */}
        <View style={styles.body}>
          <View style={styles.meta}>
            <Text style={[styles.authorName, { color }]}>{message.author_name}</Text>
            <Text style={styles.time}>{formatTime(message.created_at)}</Text>
            {isLocalOnly && (
              <Text style={styles.localBadge}>📱 device only</Text>
            )}
          </View>

          <Text style={styles.content}>{message.content}</Text>

          {message.media_url ? (
            <Image
              source={{ uri: message.media_url }}
              style={styles.media}
              contentFit="cover"
              transition={150}
            />
          ) : null}
        </View>

        {/* ··· menu — hidden on own messages */}
        {!isOwnMessage && (
          <TouchableOpacity
            onPress={() => safetyRef.current?.expand()}
            hitSlop={10}
            style={styles.moreBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={15} color={C.muted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <SafetySheet ref={safetyRef} target={safetyTarget} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
  },
  body: { flex: 1, gap: 3 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authorName: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
  },
  time: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
  },
  localBadge: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    color: C.muted,
    opacity: 0.7,
  },
  content: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
  },
  media: {
    height: 180,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: "#1e1c18",
  },
  moreBtn: {
    paddingTop: 4,
    paddingLeft: 4,
  },
});
