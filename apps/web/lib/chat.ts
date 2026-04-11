/**
 * Chat message grouping utilities.
 * Groups consecutive messages from the same sender; inserts time separators
 * between clusters more than 15 minutes apart.
 */

export interface ChatMessage {
  id: string;
  senderId: string;
  screenname: string;
  isGold: boolean;
  content: string;         // sanitized HTML (may be empty for gif-only messages)
  gifId?: string | null;
  gifUrl?: string | null;
  gifTitle?: string | null;
  mediaUrl?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | "GIF" | null;
  createdAt: string;       // ISO timestamp
  isEncrypted?: boolean;
  thread?: { id: string; messageCount: number; lastReplyBy?: string | null } | null;
  // DM font color (feature flag: DM_FONT_COLORS)
  textColor?: string | null;
  fontSize?: string | null;
}

export interface MessageGroup {
  type: "group";
  senderId: string;
  screenname: string;
  isGold: boolean;
  isOwn: boolean;
  avatarColor: string;
  avatarText: string;
  timestamp: string;       // display timestamp of first message in group
  messages: ChatMessage[];
}

export interface TimeSeparator {
  type: "separator";
  label: string;
}

export type GroupedItem = MessageGroup | TimeSeparator;

// ---------------------------------------------------------------------------
// Avatar color derivation (deterministic from id)
// ---------------------------------------------------------------------------

const AVATAR_COLOR_KEYS = ["amber", "rose", "sky", "emerald", "violet", "orange"];

export function deriveAvatarColorKey(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLOR_KEYS[h % AVATAR_COLOR_KEYS.length];
}

export const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  amber:   { bg: "#78350f", text: "#fcd34d" },
  rose:    { bg: "#881337", text: "#fda4af" },
  sky:     { bg: "#0c4a6e", text: "#7dd3fc" },
  emerald: { bg: "#064e3b", text: "#6ee7b7" },
  violet:  { bg: "#4c1d95", text: "#c4b5fd" },
  orange:  { bg: "#7c2d12", text: "#fdba74" },
};

// ---------------------------------------------------------------------------
// Separator label formatting
// ---------------------------------------------------------------------------

function formatSeparatorLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const msgStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (msgStart.getTime() === todayStart.getTime()) {
    return `Today at ${timeStr}`;
  }
  if (msgStart.getTime() === yesterdayStart.getTime()) {
    return `Yesterday at ${timeStr}`;
  }
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }) + ` at ${timeStr}`;
}

// ---------------------------------------------------------------------------
// groupMessages
// ---------------------------------------------------------------------------

const GAP_MS = 15 * 60 * 1000; // 15 minutes

export function groupMessages(
  messages: ChatMessage[],
  currentUserId: string
): GroupedItem[] {
  const result: GroupedItem[] = [];

  let currentGroup: MessageGroup | null = null;
  let lastTs = 0;

  for (const msg of messages) {
    const ts = new Date(msg.createdAt).getTime();
    const isOwn = msg.senderId === currentUserId;

    const needsSeparator = ts - lastTs > GAP_MS;
    const senderChanged = currentGroup && currentGroup.senderId !== msg.senderId;

    // Insert separator if gap > 15 min
    if (needsSeparator && result.length > 0) {
      result.push({ type: "separator", label: formatSeparatorLabel(msg.createdAt) });
      currentGroup = null;
    }

    // Start a new group if sender changed or we just inserted a separator
    if (!currentGroup || senderChanged) {
      currentGroup = {
        type: "group",
        senderId: msg.senderId,
        screenname: msg.screenname,
        isGold: msg.isGold,
        isOwn,
        avatarColor: deriveAvatarColorKey(msg.senderId),
        avatarText: msg.screenname.slice(0, 2).toUpperCase(),
        timestamp: formatSeparatorLabel(msg.createdAt),
        messages: [],
      };
      result.push(currentGroup);
    }

    currentGroup.messages.push(msg);
    lastTs = ts;
  }

  return result;
}
