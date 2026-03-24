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
import { useLocalSearchParams, useRouter } from "expo-router";
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
import ChannelMessage from "@/components/channels/ChannelMessage";
import InvitePanel from "@/components/channels/InvitePanel";
import ThreadSheet from "@/components/channels/ThreadSheet";

// ---------------------------------------------------------------------------
// NO read receipts. NO typing indicators. NO delivery status.
// Device = archive. Server expires messages after 30 days.
// Local messages are NEVER auto-deleted. They stay on device forever.
// ---------------------------------------------------------------------------

const C = {
  bg:          "#0f0e0c",
  card:        "#191714",
  amber:       "#f5c842",
  amberTint:   "rgba(245,200,66,0.08)",
  amberBorder: "rgba(245,200,66,0.25)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  placeholder: "#4a4438",
  inputBg:     "#110e0a",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

type ChannelType = "PUBLIC" | "PRIVATE" | "SECRET";

interface ChannelMeta {
  name: string;
  type: ChannelType;
  memberCount: number;
  slowModeMinutes: number;
}

function typeBadge(type: ChannelType): string {
  if (type === "PRIVATE") return "🔒";
  if (type === "SECRET")  return "👁";
  return "#";
}

// ─────────────────────────────────────────────────────────────────────────────
// Slow mode countdown hook
// Returns seconds remaining (0 = can send)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function ChannelScreen() {
  const { channelName } = useLocalSearchParams<{ channelName: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const inviteSheetRef = useRef<BottomSheet>(null);
  const threadSheetRef = useRef<BottomSheet>(null);
  const listRef        = useRef<FlashList<CachedMessage>>(null);
  const inputRef       = useRef<TextInput>(null);

  const [messages,     setMessages]     = useState<CachedMessage[]>([]);
  const [meta,         setMeta]         = useState<ChannelMeta | null>(null);
  const [draft,        setDraft]        = useState("");
  const [sending,      setSending]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasEarlier,   setHasEarlier]   = useState(false);
  const [serverExpired,setServerExpired]= useState(false);
  const [mediaUri,     setMediaUri]     = useState<string | null>(null);
  const [threadTarget, setThreadTarget] = useState<CachedMessage | null>(null);
  const [lastSentAt,   setLastSentAt]   = useState<Date | null>(null);

  const slowSecs = useSlowMode(meta?.slowModeMinutes ?? 0, lastSentAt);
  const canSend  = !!draft.trim() && !sending && slowSecs === 0;

  // ── Load channel meta ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!channelName) return;
    fetch(`${API}/api/channels/${channelName}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setMeta(data); })
      .catch(() => {});
  }, [channelName]);

  // ── Load messages: SQLite first, then server ──────────────────────────────
  useEffect(() => {
    if (!channelName) return;

    // Immediate: show from device cache
    getMessages(channelName, 80).then((cached) => {
      if (cached.length > 0) {
        setMessages(cached);
      }
    });

    // Then sync from server (newest 80)
    fetch(`${API}/api/channels/${channelName}/messages?limit=80`)
      .then((r) => r.ok ? r.json() : null)
      .then(async (data) => {
        if (!data) return;
        const msgs = mapServerMessages(channelName, data.messages ?? []);
        setMessages(msgs);
        setHasEarlier(data.hasMore ?? false);
        // Persist each to SQLite — device archive
        for (const msg of msgs) {
          await insertMessage(msgToInsert(msg));
        }
      })
      .catch(() => {});
  }, [channelName]);

  // ── Soketi live messages ──────────────────────────────────────────────────
  useEffect(() => {
    if (!channelName) return;
    const ch = soketiClient.subscribe(`channel.${channelName}`);

    ch.bind("message", async (data: Record<string, unknown>) => {
      const msg = mapSoketiMessage(channelName, data);
      // Save to SQLite immediately — device is the archive
      await insertMessage(msgToInsert(msg));
      setMessages((prev) => [msg, ...prev]);
    });

    return () => { soketiClient.unsubscribe(`channel.${channelName}`); };
  }, [channelName]);

  // ── Load earlier messages ─────────────────────────────────────────────────
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

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!canSend || !channelName) return;
    const content = draft.trim();
    setDraft("");
    setSending(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const body: Record<string, unknown> = { content };
      if (mediaUri) body.mediaUrl = mediaUri; // attachment URI passed to server
      await fetch(`${API}/api/channels/${channelName}/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      setLastSentAt(new Date());
      setMediaUri(null);
    } finally {
      setSending(false);
    }
  }, [canSend, draft, channelName, mediaUri]);

  // ── Photo picker ──────────────────────────────────────────────────────────
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

  // ── Thread ────────────────────────────────────────────────────────────────
  const handleThreadPress = useCallback((msg: CachedMessage) => {
    setThreadTarget(msg);
    threadSheetRef.current?.expand();
  }, []);

  const handleAuthorPress = useCallback((screenname: string) => {
    router.push(`/u/${screenname}`);
  }, [router]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>
            {meta ? typeBadge(meta.type) : "#"}{channelName}
          </Text>
          {meta && (
            <Text style={styles.headerMeta}>
              {meta.memberCount.toLocaleString()} members
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => inviteSheetRef.current?.expand()}
          activeOpacity={0.8}
        >
          <Text style={styles.inviteBtnText}>Invite</Text>
        </TouchableOpacity>
      </View>

      {/* Message list — inverted, newest at bottom */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlashList
          ref={listRef}
          data={messages}
          estimatedItemSize={64}
          keyExtractor={(item) => item.id}
          inverted
          renderItem={({ item }) => (
            <ChannelMessage
              message={item}
              onThreadPress={handleThreadPress}
              onAuthorPress={handleAuthorPress}
            />
          )}
          ListFooterComponent={
            <>
              {/* "Load earlier" or expiry note at top of inverted list */}
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

        {/* Composer */}
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

          {/* Slow mode indicator */}
          {slowSecs > 0 && (
            <View style={styles.slowModeBar}>
              <Text style={styles.slowModeText}>
                🕐 {formatCountdown(slowSecs)} — slow mode
              </Text>
            </View>
          )}

          <View style={styles.composer}>
            {/* Photo button */}
            <TouchableOpacity onPress={handlePickPhoto} hitSlop={8} style={styles.photoBtn}>
              <Ionicons name="camera-outline" size={22} color={C.muted} />
            </TouchableOpacity>

            {/* Text input */}
            <TextInput
              ref={inputRef}
              style={[styles.input, slowSecs > 0 && { opacity: 0.4 }]}
              placeholder={slowSecs > 0 ? `slow mode — ${formatCountdown(slowSecs)}` : "message…"}
              placeholderTextColor={C.placeholder}
              multiline
              maxLength={512}
              value={draft}
              onChangeText={setDraft}
              editable={slowSecs === 0}
            />

            {/* Send button */}
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && { opacity: 0.35 }]}
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#0f0e0c" />
                : <Text style={styles.sendBtnText}>↑</Text>}
            </TouchableOpacity>
          </View>

          {/* Expiry disclaimer */}
          <Text style={styles.expiryDisclaimer}>
            messages expire from our servers in 30 days · your device keeps them
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* Invite bottom sheet */}
      <InvitePanel ref={inviteSheetRef} channelName={channelName ?? ""} />

      {/* Thread bottom sheet */}
      <ThreadSheet
        ref={threadSheetRef}
        parentMessage={threadTarget}
        channelName={channelName ?? ""}
        onAuthorPress={handleAuthorPress}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function mapServerMessages(channelId: string, raw: Record<string, unknown>[]): CachedMessage[] {
  return raw.map((m) => ({
    id:          String(m.id),
    channel_id:  channelId,
    author_id:   String((m.author as Record<string, unknown>)?.id   ?? ""),
    author_name: String((m.author as Record<string, unknown>)?.screenname ?? ""),
    content:     String(m.content),
    media_url:   m.mediaUrl  ? String(m.mediaUrl)  : null,
    media_type:  m.mediaType ? String(m.mediaType) : null,
    created_at:  String(m.createdAt),
    expires_at:  String(m.expiresAt ?? new Date(Date.now() + 30 * 86400_000).toISOString()),
    synced_at:   new Date().toISOString(),
  }));
}

function mapSoketiMessage(channelId: string, data: Record<string, unknown>): CachedMessage {
  return {
    id:          String(data.id),
    channel_id:  channelId,
    author_id:   String((data.author as Record<string, unknown>)?.id   ?? ""),
    author_name: String((data.author as Record<string, unknown>)?.screenname ?? ""),
    content:     String(data.content),
    media_url:   data.mediaUrl  ? String(data.mediaUrl)  : null,
    media_type:  data.mediaType ? String(data.mediaType) : null,
    created_at:  String(data.createdAt),
    expires_at:  String(data.expiresAt ?? new Date(Date.now() + 30 * 86400_000).toISOString()),
    synced_at:   new Date().toISOString(),
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
    createdAt:  msg.created_at,
    expiresAt:  msg.expires_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  headerCenter: { flex: 1, gap: 2 },
  headerName: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: C.text,
  },
  headerMeta: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
  },
  inviteBtn: {
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inviteBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: C.amber,
  },

  // Load earlier / expiry note (rendered at list footer, inverted = top)
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

  // Composer
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
    paddingTop: 8,
    paddingHorizontal: 0,
  },
  mediaPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 6,
    gap: 8,
  },
  mediaPreviewLabel: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
  slowModeBar: {
    alignItems: "center",
    paddingBottom: 6,
  },
  slowModeText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 2,
    gap: 8,
  },
  photoBtn: {
    paddingBottom: 9,
  },
  input: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxHeight: 80,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: "#0f0e0c",
  },
  expiryDisclaimer: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
    opacity: 0.55,
    textAlign: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});
