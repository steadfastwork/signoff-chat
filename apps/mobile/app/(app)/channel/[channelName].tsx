import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import type BottomSheet from "@gorhom/bottom-sheet";
import { soketiClient } from "@/lib/soketi";
import { getSession } from "@/lib/session";
import {
  insertMessage,
  getMessages,
  type CachedMessage,
} from "@/lib/db/localMessages";
import MessageGroupBubble from "@/components/chat/MessageGroupBubble";
import FlatMessageItem from "@/components/chat/FlatMessageItem";
import TimeSeparator from "@/components/chat/TimeSeparator";
import GiphyPickerSheet, { type GifResult } from "@/components/channels/GiphyPickerSheet";
import InvitePanel from "@/components/channels/InvitePanel";
import ThreadSheet from "@/components/channels/ThreadSheet";

// ---------------------------------------------------------------------------
// Change 1: suppress the global Stack header — channel renders its own header
// ---------------------------------------------------------------------------
export const options = { headerShown: false };

// ---------------------------------------------------------------------------
// NO read receipts. NO typing indicators. NO delivery status.
// Device = archive. Server expires messages after 30 days.
// Local messages are NEVER auto-deleted. They stay on device forever.
// ---------------------------------------------------------------------------

const GAP_MS = 15 * 60 * 1000; // 15 minutes

type GroupedItem =
  | { type: "group"; messages: CachedMessage[]; authorId: string; authorName: string }
  | { type: "separator"; label: string };

function formatSepLabel(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yestStart  = new Date(todayStart.getTime() - 86_400_000);
  const msgStart   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (msgStart.getTime() === todayStart.getTime()) return `Today at ${time}`;
  if (msgStart.getTime() === yestStart.getTime())  return `Yesterday at ${time}`;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + ` at ${time}`;
}

function groupMessages(messages: CachedMessage[]): GroupedItem[] {
  const ordered = [...messages].reverse();
  const result: GroupedItem[] = [];
  let current: (GroupedItem & { type: "group" }) | null = null;
  let lastTs = 0;

  for (const msg of ordered) {
    const ts = new Date(msg.created_at).getTime();
    const gap = ts - lastTs > GAP_MS;
    const senderChanged = current && current.authorId !== msg.author_id;

    if (gap && result.length > 0) {
      result.push({ type: "separator", label: formatSepLabel(msg.created_at) });
      current = null;
    }

    if (!current || senderChanged) {
      current = { type: "group", messages: [], authorId: msg.author_id, authorName: msg.author_name };
      result.push(current);
    }

    current.messages.push(msg);
    lastTs = ts;
  }

  return result.reverse();
}

// ---------------------------------------------------------------------------
// Hardcoded Signoff color palette — never use theme variables here (Change 12)
// ---------------------------------------------------------------------------
const C = {
  bg:          "#0f0e0c",
  headerBg:    "#0d0d0b",
  amber:       "#c8860a",   // hardcoded — immune to profile theme
  text:        "#e8e4d9",
  muted:       "#6a6860",
  border:      "#1e1e1a",
  placeholder: "#3a3a34",
  inputBg:     "#161614",
  pillBorder:  "#2a2a28",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

type ChannelType = "PUBLIC" | "PRIVATE" | "SECRET";

interface ChannelMeta {
  name: string;
  type: ChannelType;
  memberCount: number;
  slowModeMinutes: number;
  isDM?: boolean;
}

// ---------------------------------------------------------------------------
// Slow mode countdown hook
// ---------------------------------------------------------------------------
function useSlowMode(slowModeMinutes: number, lastSentAt: Date | null): number {
  const [secsLeft, setSecsLeft] = useState(0);

  useEffect(() => {
    if (!slowModeMinutes || !lastSentAt) { setSecsLeft(0); return; }
    const intervalMs = slowModeMinutes * 60 * 1000;
    const update = () => {
      const elapsed = Date.now() - lastSentAt.getTime();
      const remaining = Math.max(0, Math.ceil((intervalMs - elapsed) / 1000));
      setSecsLeft(remaining);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [slowModeMinutes, lastSentAt]);

  return secsLeft;
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function ChannelScreen() {
  const { channelName } = useLocalSearchParams<{ channelName: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentUserId,   setCurrentUserId]   = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");

  const inviteSheetRef  = useRef<BottomSheet>(null);
  const threadSheetRef  = useRef<BottomSheet>(null);
  const giphySheetRef   = useRef<BottomSheet>(null);
  const listRef         = useRef<FlashList<GroupedItem>>(null);
  const inputRef        = useRef<TextInput>(null);

  const [messages,      setMessages]      = useState<CachedMessage[]>([]);
  const [meta,          setMeta]          = useState<ChannelMeta | null>(null);
  const [draft,         setDraft]         = useState("");
  const [sending,       setSending]       = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [hasEarlier,    setHasEarlier]    = useState(false);
  const [serverExpired, setServerExpired] = useState(false);
  const [mediaUri,      setMediaUri]      = useState<string | null>(null);
  const [pendingGif,    setPendingGif]    = useState<GifResult | null>(null);
  const [threadTarget,  setThreadTarget]  = useState<CachedMessage | null>(null);
  const [lastSentAt,    setLastSentAt]    = useState<Date | null>(null);

  const slowSecs = useSlowMode(meta?.slowModeMinutes ?? 0, lastSentAt);
  const canSend  = (!!draft.trim() || !!pendingGif) && !sending && slowSecs === 0;

  // User initials for pill avatar
  const userInitials = currentUserName
    ? currentUserName.slice(0, 2).toUpperCase()
    : "ME";

  // ── Session ────────────────────────────────────────────────────────────────
  useEffect(() => {
    getSession().then((s) => {
      if (s?.userId)     setCurrentUserId(s.userId);
      if ((s as Record<string, unknown>)?.screenname) {
        setCurrentUserName(String((s as Record<string, unknown>).screenname));
      }
    });
  }, []);

  // ── Channel meta ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!channelName) return;
    fetch(`${API}/api/channels/${channelName}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setMeta(data); })
      .catch(() => {});
  }, [channelName]);

  // ── Load messages: SQLite first, then server ───────────────────────────────
  useEffect(() => {
    if (!channelName) return;

    getMessages(channelName, 80).then((cached) => {
      if (cached.length > 0) setMessages(cached);
    });

    fetch(`${API}/api/channels/${channelName}/messages?limit=80`)
      .then((r) => r.ok ? r.json() : null)
      .then(async (data) => {
        if (!data) return;
        const msgs = mapServerMessages(channelName, data.messages ?? []);
        setMessages(msgs);
        setHasEarlier(data.hasMore ?? false);
        for (const msg of msgs) await insertMessage(msgToInsert(msg));
      })
      .catch(() => {});
  }, [channelName]);

  // ── Soketi live messages ───────────────────────────────────────────────────
  useEffect(() => {
    if (!channelName) return;
    const ch = soketiClient.subscribe(`channel.${channelName}`);

    ch.bind("message", async (data: Record<string, unknown>) => {
      const msg = mapSoketiMessage(channelName, data);
      await insertMessage(msgToInsert(msg));
      setMessages((prev) => [msg, ...prev]);
    });

    return () => { soketiClient.unsubscribe(`channel.${channelName}`); };
  }, [channelName]);

  // ── Load earlier messages ──────────────────────────────────────────────────
  const handleLoadEarlier = useCallback(async () => {
    if (loadingMore || !channelName || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[messages.length - 1];
      const res = await fetch(
        `${API}/api/channels/${channelName}/messages?before=${oldest.id}&limit=40`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.serverExpired) {
        setServerExpired(true);
        setHasEarlier(false);
        return;
      }
      const older = mapServerMessages(channelName, data.messages ?? []);
      setMessages((prev) => [...prev, ...older]);
      setHasEarlier(data.hasMore ?? false);
      for (const msg of older) await insertMessage(msgToInsert(msg));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, channelName, messages]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!canSend || !channelName) return;
    const content = draft.trim();
    setDraft("");
    setSending(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const body: Record<string, unknown> = { content };
      if (mediaUri)   body.mediaUrl  = mediaUri;
      if (pendingGif) { body.gifId = pendingGif.id; body.gifUrl = pendingGif.url; body.gifTitle = pendingGif.title; }
      await fetch(`${API}/api/channels/${channelName}/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      setLastSentAt(new Date());
      setMediaUri(null);
      setPendingGif(null);
    } finally {
      setSending(false);
    }
  }, [canSend, draft, channelName, mediaUri, pendingGif]);

  // ── Photo picker ───────────────────────────────────────────────────────────
  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
    }
  }, []);

  // ── Thread ─────────────────────────────────────────────────────────────────
  const handleThreadPress = useCallback((msg: CachedMessage) => {
    setThreadTarget(msg);
    threadSheetRef.current?.expand();
  }, []);

  const handleAuthorPress = useCallback((screenname: string) => {
    router.push(`/u/${screenname}`);
  }, [router]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Change 1: explicit header suppression */}
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* ── Channel Header (Change 2) ── */}
        <View style={styles.header}>
          {/* Back arrow */}
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          {/* Center: two rows */}
          <View style={styles.headerCenter}>
            {/* Row 1: lock + name + badge + spacer + invite */}
            <View style={styles.headerRow1}>
              {meta && meta.type !== "PUBLIC" && (
                <Text style={styles.lockIcon}>
                  {meta.type === "SECRET" ? "👁" : "🔒"}
                </Text>
              )}
              <Text style={styles.headerName} numberOfLines={1}>
                {channelName}
              </Text>
              {meta?.type === "PRIVATE" && (
                <View style={styles.inviteOnlyBadge}>
                  <Text style={styles.inviteOnlyText}>invite only</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={() => inviteSheetRef.current?.expand()}
                activeOpacity={0.8}
              >
                <Text style={styles.inviteBtnText}>Invite</Text>
              </TouchableOpacity>
            </View>

            {/* Row 2: subtitle */}
            {meta && (
              <Text style={styles.headerSubtitle}>
                {meta.memberCount.toLocaleString()} members
                {meta.slowModeMinutes > 0 ? ` · ${meta.slowModeMinutes} min slow mode` : ""}
              </Text>
            )}
          </View>
        </View>

        {/* ── Message list — inverted, newest at bottom ── */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <FlashList
            ref={listRef}
            data={groupMessages(messages)}
            estimatedItemSize={80}
            keyExtractor={(item, i) =>
              item.type === "group" ? item.messages[0].id : `sep-${i}`
            }
            inverted
            renderItem={({ item }) => {
              if (item.type === "separator") {
                return <TimeSeparator label={item.label} />;
              }
              if (meta?.isDM) {
                return (
                  <FlatMessageItem
                    messages={item.messages}
                    currentUserId={currentUserId}
                  />
                );
              }
              return (
                <MessageGroupBubble
                  messages={item.messages}
                  currentUserId={currentUserId}
                  onAuthorPress={handleAuthorPress}
                  onLongPress={handleThreadPress}
                  onThreadPress={handleThreadPress}
                />
              );
            }}
            ListFooterComponent={
              <>
                {serverExpired ? (
                  <View style={styles.expiryNote}>
                    <Text style={styles.expiryText}>
                      earlier messages expired from our servers.
                    </Text>
                    <Text style={styles.expiryHint}>
                      your device archive goes back further — scroll up.
                    </Text>
                  </View>
                ) : hasEarlier ? (
                  <TouchableOpacity
                    style={styles.loadEarlierBtn}
                    onPress={handleLoadEarlier}
                    disabled={loadingMore}
                    activeOpacity={0.7}
                  >
                    {loadingMore
                      ? <ActivityIndicator size="small" color={C.muted} />
                      : <Text style={styles.loadEarlierText}>load earlier</Text>}
                  </TouchableOpacity>
                ) : null}
              </>
            }
            contentContainerStyle={{ paddingTop: 8 }}
          />

          {/* ── Composer (Change 8: pill input) ── */}
          <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {/* Media preview */}
            {mediaUri && (
              <View style={styles.mediaPreviewRow}>
                <Text style={styles.mediaPreviewLabel} numberOfLines={1}>
                  📎 {mediaUri.split("/").pop()}
                </Text>
                <TouchableOpacity onPress={() => setMediaUri(null)} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </TouchableOpacity>
              </View>
            )}
            {pendingGif && (
              <View style={styles.mediaPreviewRow}>
                <Text style={styles.mediaPreviewLabel} numberOfLines={1}>
                  🎞 {pendingGif.title || "GIF"}
                </Text>
                <TouchableOpacity onPress={() => setPendingGif(null)} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </TouchableOpacity>
              </View>
            )}

            {/* Pill row */}
            <View style={styles.pill}>
              {/* Amber avatar — hardcoded, never themed (Change 12) */}
              <View style={styles.pillAvatar}>
                <Text style={styles.pillAvatarText}>{userInitials}</Text>
              </View>

              {/* Text input */}
              <TextInput
                ref={inputRef}
                style={[styles.pillInput, slowSecs > 0 && { opacity: 0.4 }]}
                placeholder={`Message #${channelName}...`}
                placeholderTextColor={C.placeholder}
                value={draft}
                onChangeText={setDraft}
                editable={slowSecs === 0}
                fontSize={16}          // Change 8: prevent iOS zoom
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />

              {/* Camera button */}
              <TouchableOpacity
                onPress={handlePickPhoto}
                hitSlop={6}
                style={styles.pillCameraBtn}
              >
                <Ionicons name="camera-outline" size={18} color={C.muted} />
              </TouchableOpacity>

              {/* Send button — hardcoded amber (Change 12) */}
              <TouchableOpacity
                style={[styles.pillSendBtn, !canSend && { opacity: 0.4 }]}
                onPress={handleSend}
                disabled={!canSend}
                activeOpacity={0.8}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Text style={styles.pillSendText}>↑</Text>}
              </TouchableOpacity>
            </View>

            {/* Slow mode text (Change 8) */}
            {slowSecs > 0 && (
              <Text style={styles.slowModeText}>
                🕐 slow mode · {formatCountdown(slowSecs)} between messages
              </Text>
            )}

            {/* Expiry disclaimer */}
            <Text style={styles.expiryDisclaimer}>
              messages expire from our servers in 30 days · your device keeps them
            </Text>
          </View>
        </KeyboardAvoidingView>

        {/* Bottom sheets */}
        <InvitePanel ref={inviteSheetRef} channelName={channelName ?? ""} />
        <ThreadSheet
          ref={threadSheetRef}
          parentMessage={threadTarget}
          channelName={channelName ?? ""}
          onAuthorPress={handleAuthorPress}
        />
        <GiphyPickerSheet
          ref={giphySheetRef}
          onSelect={(gif) => setPendingGif(gif)}
        />
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapServerMessages(channelId: string, raw: Record<string, unknown>[]): CachedMessage[] {
  return raw.map((m) => {
    const author = m.author as Record<string, unknown> | null | undefined;
    const thread = m.thread as Record<string, unknown> | null | undefined;
    return {
      id:           String(m.id),
      channel_id:   channelId,
      author_id:    String(author?.id   ?? ""),
      author_name:  String(author?.screenname ?? ""),
      content:      String(m.content ?? ""),
      media_url:    m.mediaUrl  ? String(m.mediaUrl)  : null,
      media_type:   m.mediaType ? String(m.mediaType) : null,
      gif_url:      m.gifUrl    ? String(m.gifUrl)    : null,
      gif_title:    m.gifTitle  ? String(m.gifTitle)  : null,
      created_at:   String(m.createdAt),
      expires_at:   String(m.expiresAt ?? new Date(Date.now() + 30 * 86400_000).toISOString()),
      synced_at:    new Date().toISOString(),
      // Runtime fields (not persisted in SQLite)
      author_is_gold: author?.isGoldMember === true,
      reply_count:    typeof thread?.messageCount === "number" ? thread.messageCount : 0,
      last_reply_by:  thread?.lastReplyBy ? String(thread.lastReplyBy) : null,
    };
  });
}

function mapSoketiMessage(channelId: string, data: Record<string, unknown>): CachedMessage {
  const author = data.author as Record<string, unknown> | null | undefined;
  return {
    id:           String(data.id),
    channel_id:   channelId,
    author_id:    String(author?.id   ?? ""),
    author_name:  String(author?.screenname ?? ""),
    content:      String(data.content ?? ""),
    media_url:    data.mediaUrl  ? String(data.mediaUrl)  : null,
    media_type:   data.mediaType ? String(data.mediaType) : null,
    gif_url:      data.gifUrl    ? String(data.gifUrl)    : null,
    gif_title:    data.gifTitle  ? String(data.gifTitle)  : null,
    created_at:   String(data.createdAt),
    expires_at:   String(data.expiresAt ?? new Date(Date.now() + 30 * 86400_000).toISOString()),
    synced_at:    new Date().toISOString(),
    author_is_gold: author?.isGoldMember === true,
    reply_count: 0,
    last_reply_by: null,
  };
}

function msgToInsert(msg: CachedMessage) {
  return {
    id:         msg.id,
    channelId:  msg.channel_id,
    authorId:   msg.author_id,
    authorName: msg.author_name,
    content:    msg.content,
    mediaUrl:   msg.media_url,
    mediaType:  msg.media_type,
    gifUrl:     msg.gif_url,
    gifTitle:   msg.gif_title,
    createdAt:  msg.created_at,
    expiresAt:  msg.expires_at,
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Header (Change 2) ──────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.headerBg,
    gap: 0,
  },
  backBtn: {
    paddingRight: 8,
  },
  backArrow: {
    fontSize: 24,
    color: C.amber,   // hardcoded amber — Change 12
    lineHeight: 30,
  },
  headerCenter: { flex: 1, gap: 2 },
  headerRow1: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockIcon: {
    fontSize: 14,
    color: "#6a6860",
  },
  headerName: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: "#e4e0cc",
    // No numberOfLines truncation — show full name
  },
  inviteOnlyBadge: {
    backgroundColor: C.amber,   // hardcoded amber — Change 12
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inviteOnlyText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: "#1a0800",
  },
  inviteBtn: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a28",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtnText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#c8c4b0",
  },
  headerSubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: "#4a4840",
    marginTop: 2,
    paddingLeft: 32,
  },

  // ── Load earlier / expiry note ─────────────────────────────────────────────
  loadEarlierBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
  },
  loadEarlierText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
  },
  expiryNote: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 4,
  },
  expiryText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
  },
  expiryHint: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
    opacity: 0.65,
    textAlign: "center",
  },

  // ── Composer wrapper (Change 8) ────────────────────────────────────────────
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: "#0f0f0d",
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 0,
  },
  mediaPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  mediaPreviewLabel: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },

  // Pill container (Change 8)
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.inputBg,   // #161614
    borderWidth: 1,
    borderColor: C.pillBorder,     // #2a2a28
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pillAvatar: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: C.amber,  // hardcoded amber (Change 12)
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pillAvatarText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: "#ffffff",
  },
  pillInput: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 0,
    color: "#e4e0cc",
    // fontSize set inline as prop (16 prevents iOS zoom)
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  pillCameraBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pillSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.amber,  // hardcoded amber (Change 12)
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pillSendText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 18,
    color: "#ffffff",
  },

  // Slow mode + expiry text
  slowModeText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: "#3a3a34",
    textAlign: "center",
    marginTop: 5,
  },
  expiryDisclaimer: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
    opacity: 0.55,
    textAlign: "center",
    paddingVertical: 4,
  },
});
