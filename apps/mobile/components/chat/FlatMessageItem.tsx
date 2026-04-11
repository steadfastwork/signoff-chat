import { View, Text } from "react-native";
import type { CachedMessage } from "@/lib/db/localMessages";

// ---------------------------------------------------------------------------
// Color palette (mirrors web userColors.ts)
// ---------------------------------------------------------------------------

const PALETTE = [
  "#4a9eff",
  "#22c55e",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#60a5fa",
  "#fb923c",
  "#a3e635",
];
const SELF_COLOR = "#c8860a";

function getColorForUser(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Extended type for DM messages with optional color/size runtime fields
// ---------------------------------------------------------------------------

export interface DMCachedMessage extends CachedMessage {
  text_color?: string | null;
  font_size?: string | null;
}

// ---------------------------------------------------------------------------
// FlatMessageItem
// Renders a group of consecutive messages from the same sender in AIM style:
//   screenname: message text                           12:34pm
//   screenname: continuation message                  12:35pm
// ---------------------------------------------------------------------------

interface Props {
  messages: DMCachedMessage[];
  currentUserId: string;
  isDM?: boolean;
}

export default function FlatMessageItem({ messages, currentUserId, isDM }: Props) {
  if (messages.length === 0) return null;
  const first = messages[0];
  const isOwn = first.author_id === currentUserId;

  const nameColor = isDM
    ? (first.text_color ?? (isOwn ? SELF_COLOR : getColorForUser(first.author_id)))
    : (isOwn ? SELF_COLOR : getColorForUser(first.author_id));

  const prefix = `${first.author_name}:`;

  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 2 }}>
      {messages.map((msg) => {
        const text = stripHtml(msg.content);
        const time = formatTime(msg.created_at);

        const textColor = isDM
          ? (msg.text_color ?? "#e4e0cc")
          : "#e5e5d8";

        const fontSize = isDM
          ? (msg.font_size === "sm" ? 12 : msg.font_size === "lg" ? 17 : 14)
          : 13;

        return (
          <View
            key={msg.id}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}
          >
            {/* Name — shown on every message */}
            <Text
              style={{
                color: nameColor,
                fontWeight: "700",
                fontSize: isDM ? fontSize : 13,
                flexShrink: 0,
              }}
            >
              {prefix}
            </Text>

            {/* Content */}
            <Text
              style={{ color: textColor, fontSize, flex: 1 }}
              // eslint-disable-next-line react-native/no-raw-text
            >
              {text}
            </Text>

            {/* Timestamp */}
            <Text
              style={{ color: "#2a2a1a", fontSize: 10, flexShrink: 0 }}
            >
              {time}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
