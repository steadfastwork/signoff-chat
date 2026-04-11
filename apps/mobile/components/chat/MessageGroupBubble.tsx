import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { CachedMessage } from "@/lib/db/localMessages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PALETTE = ["#e07b54","#4caf50","#2196f3","#e91e63","#ff9800","#9c27b0","#00bcd4","#cf7230"];
function authorColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// Strip HTML tags from Tiptap-generated content (web → mobile cross-post)
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  messages: CachedMessage[];
  currentUserId: string;
  onAuthorPress?: (screenname: string) => void;
  onLongPress?: (msg: CachedMessage) => void;
  onThreadPress?: (msg: CachedMessage) => void;
}

// ---------------------------------------------------------------------------
// MessageGroupBubble
// ---------------------------------------------------------------------------

export default function MessageGroupBubble({
  messages,
  currentUserId,
  onAuthorPress,
  onLongPress,
  onThreadPress,
}: Props) {
  if (messages.length === 0) return null;
  const first = messages[0];
  const isOwn  = first.author_id === currentUserId;
  const aColor = authorColor(first.author_id);
  const initials = (first.author_name[0] ?? "?").toUpperCase();

  return (
    <View style={styles.group}>
      {/* ── Group header: avatar + name + gold star + timestamp ── */}
      <View style={styles.groupHeader}>
        <TouchableOpacity
          onPress={() => onAuthorPress?.(first.author_name)}
          style={[
            styles.avatar,
            isOwn
              ? styles.ownAvatar
              : { backgroundColor: aColor + "22", borderColor: aColor + "55", borderWidth: 1 },
          ]}
          hitSlop={6}
          activeOpacity={0.8}
        >
          <Text style={[styles.avatarInitial, { color: isOwn ? "#fff8e6" : aColor }]}>
            {initials}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerMeta}>
          <Text
            style={[styles.authorName, isOwn ? styles.ownAuthorName : { color: "#e8e4d9" }]}
          >
            {first.author_name}
          </Text>
          {first.author_is_gold && (
            <Text style={styles.goldStar}>★</Text>
          )}
          <Text style={styles.timestamp}>
            {formatTime(first.created_at)}{isOwn ? " · you" : ""}
          </Text>
        </View>
      </View>

      {/* ── Messages — indented under avatar column ── */}
      {messages.map((msg) => {
        const displayText = stripHtml(msg.content);
        const hasText  = displayText.length > 0;
        const hasGif   = !!msg.gif_url;
        const hasMedia = !!msg.media_url && !hasGif;
        const replyCount = msg.reply_count ?? 0;

        return (
          <TouchableOpacity
            key={msg.id}
            onLongPress={() => onLongPress?.(msg)}
            delayLongPress={400}
            activeOpacity={0.9}
            style={styles.messageRow}
          >
            {hasGif && (
              <Image
                source={{ uri: msg.gif_url! }}
                style={styles.gifImage}
                contentFit="contain"
                transition={150}
                accessibilityLabel={msg.gif_title ?? "GIF"}
              />
            )}
            {hasMedia && (
              <Image
                source={{ uri: msg.media_url! }}
                style={styles.mediaImage}
                contentFit="cover"
                transition={150}
              />
            )}
            {hasText && (
              <Text style={styles.messageText}>{displayText}</Text>
            )}
            {replyCount > 0 && (
              <TouchableOpacity
                style={styles.threadLink}
                onPress={() => (onThreadPress ?? onLongPress)?.(msg)}
                hitSlop={4}
              >
                <Text style={styles.threadText}>
                  💬 {replyCount} {replyCount === 1 ? "reply" : "replies"}
                  {msg.last_reply_by ? ` · last by ${msg.last_reply_by}` : ""}
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  group: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
  },

  // Header row
  groupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,        // Change 3: rounded square, not circle
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ownAvatar: {
    backgroundColor: "#c8860a", // Hardcoded amber — Change 12
  },
  avatarInitial: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
  },
  headerMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    paddingTop: 4,
  },
  authorName: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
  },
  ownAuthorName: {
    color: "#c8860a", // Amber for own name — Change 4
  },
  goldStar: {
    fontSize: 11,
    color: "#c8860a",  // Change 6: ★ after name, amber
    marginLeft: 2,
  },
  timestamp: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: "#4a4840",
    marginLeft: 2,
  },

  // Message content rows
  messageRow: {
    paddingLeft: 54,   // 44px avatar + 10px gap — Change 10
    marginBottom: 2,
  },
  messageText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,          // Change 5
    color: "#e4e0cc",      // Change 5
    lineHeight: 22,
  },

  // Thread reply link — Change 7
  threadLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  threadText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#c8860a",  // Hardcoded amber — Change 12
  },

  // Media
  gifImage: {
    width: 220,
    height: 160,
    backgroundColor: "#111",
    borderRadius: 8,
    marginBottom: 4,
  },
  mediaImage: {
    width: 220,
    height: 180,
    backgroundColor: "#111",
    borderRadius: 8,
    marginBottom: 4,
  },
});
