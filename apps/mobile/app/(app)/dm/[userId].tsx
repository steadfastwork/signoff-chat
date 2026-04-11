import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type BottomSheet from "@gorhom/bottom-sheet";
import { soketiClient } from "@/lib/soketi";
import { getSession } from "@/lib/session";
import FlatMessageItem from "@/components/chat/FlatMessageItem";
import type { DMCachedMessage } from "@/components/chat/FlatMessageItem";
import ColorPickerSheet from "@/components/chat/ColorPickerSheet";
import TimeSeparator from "@/components/chat/TimeSeparator";
import type { DMFontSize } from "@/lib/dmColors";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const C = {
  bg:          "#0f0e0c",
  headerBg:    "#0d0d0b",
  amber:       "#c8860a",
  text:        "#e8e4d9",
  muted:       "#6a6860",
  dim:         "#3a3a34",
  border:      "#1e1e1a",
  placeholder: "#3a3a34",
  inputBg:     "#161614",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";
const GAP_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DMMessage {
  id: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  createdAt: string;
  textColor?: string | null;
  fontSize?: string | null;
  author: {
    id: string;
    screenname: string;
    isGoldMember: boolean;
  };
}

type GroupedItem =
  | { type: "group"; messages: DMCachedMessage[]; authorId: string; authorName: string }
  | { type: "separator"; label: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSepLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yestStart = new Date(todayStart.getTime() - 86_400_000);
  const msgStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (msgStart.getTime() === todayStart.getTime()) return `Today at ${time}`;
  if (msgStart.getTime() === yestStart.getTime()) return `Yesterday at ${time}`;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + ` at ${time}`;
}

function dmMessageToCached(msg: DMMessage): DMCachedMessage {
  return {
    id: msg.id,
    channel_id: "",
    author_id: msg.author.id,
    author_name: msg.author.screenname,
    content: msg.content,
    media_url: msg.mediaUrl ?? null,
    media_type: msg.mediaType ?? null,
    created_at: msg.createdAt,
    // Runtime DM color/size fields
    text_color: msg.textColor ?? null,
    font_size: msg.fontSize ?? null,
    // CachedMessage required fields (not used in DM context)
    gif_url: null,
    gif_title: null,
    expires_at: "",
    synced_at: "",
  } as DMCachedMessage;
}

function groupMessages(messages: DMCachedMessage[]): GroupedItem[] {
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
// Debounce utility
// ---------------------------------------------------------------------------

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DMScreen() {
  const { userId: otherUserId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentUserId, setCurrentUserId] = useState("");
  const [otherScreenname, setOtherScreenname] = useState("");
  const [messages, setMessages] = useState<DMCachedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // DM_FONT_COLORS feature flag + user preferences
  const [dmFontColorsEnabled, setDmFontColorsEnabled] = useState(false);
  const [myColor, setMyColor] = useState<string>("#c8860a");
  const [mySize, setMySize] = useState<DMFontSize>("md");

  const inputRef = useRef<TextInput>(null);
  const colorSheetRef = useRef<BottomSheet>(null);

  // ── Session ────────────────────────────────────────────────────────────────
  useEffect(() => {
    getSession().then((s) => {
      if (s?.userId) setCurrentUserId(s.userId as string);
    });
  }, []);

  // ── Feature flag + profile prefs ──────────────────────────────────────────
  useEffect(() => {
    // Feature flag
    fetch(`${API}/api/feature-flags/DM_FONT_COLORS`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.enabled) setDmFontColorsEnabled(true);
      })
      .catch(() => {});

    // User profile preferences
    fetch(`${API}/api/profile`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        if (d.dmTextColor) setMyColor(d.dmTextColor);
        if (d.dmFontSize) setMySize(d.dmFontSize as DMFontSize);
      })
      .catch(() => {});
  }, []);

  // ── Load other user info ───────────────────────────────────────────────────
  useEffect(() => {
    if (!otherUserId) return;
    fetch(`${API}/api/users/by-id/${otherUserId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.screenname) setOtherScreenname(d.screenname); })
      .catch(() => {});
  }, [otherUserId]);

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!otherUserId) return;
    const res = await fetch(`${API}/api/messages/${otherUserId}`);
    if (!res.ok) return;
    const data = await res.json();
    const msgs: DMMessage[] = Array.isArray(data.messages) ? data.messages : [];
    setMessages(msgs.map(dmMessageToCached));
  }, [otherUserId]);

  useEffect(() => {
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
  }, [loadMessages]);

  // ── Pusher live messages ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId || !otherUserId) return;
    const ids = [currentUserId, otherUserId].sort();
    const channelName = `private-dm-${ids[0]}-${ids[1]}`;
    const ch = soketiClient.subscribe(channelName);

    ch.bind("new-dm", (msg: DMMessage) => {
      const cached = dmMessageToCached(msg);
      setMessages((prev) => {
        if (prev.some((m) => m.id === cached.id)) return prev;
        return [cached, ...prev];
      });
    });

    return () => { soketiClient.unsubscribe(channelName); };
  }, [currentUserId, otherUserId]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending || !otherUserId) return;
    setDraft("");
    setSending(true);
    try {
      const body: Record<string, unknown> = { content: text };
      if (dmFontColorsEnabled) {
        body.textColor = myColor;
        body.fontSize = mySize;
      }
      const res = await fetch(`${API}/api/messages/${otherUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const saved: DMMessage = await res.json();
        setMessages((prev) => [dmMessageToCached(saved), ...prev]);
      }
    } finally {
      setSending(false);
    }
  }, [draft, sending, otherUserId, dmFontColorsEnabled, myColor, mySize]);

  // ── Save profile prefs (debounced) ────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveColor = useCallback(
    debounce((hex: string) => {
      fetch(`${API}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dmTextColor: hex }),
      }).catch(() => {});
    }, 500),
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveSize = useCallback(
    debounce((size: DMFontSize) => {
      fetch(`${API}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dmFontSize: size }),
      }).catch(() => {});
    }, 500),
    []
  );

  const handleColorChange = useCallback((hex: string) => {
    setMyColor(hex);
    saveColor(hex);
  }, [saveColor]);

  const handleSizeChange = useCallback((size: DMFontSize) => {
    setMySize(size);
    saveSize(size);
  }, [saveSize]);

  const grouped = groupMessages(messages);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerName} numberOfLines={1}>
              {otherScreenname || "…"}
            </Text>
            <Text style={styles.headerSub}>direct message</Text>
          </View>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {loading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={C.muted} />
            </View>
          ) : (
            <FlashList
              data={grouped}
              estimatedItemSize={40}
              keyExtractor={(item, i) =>
                item.type === "group" ? item.messages[0].id : `sep-${i}`
              }
              inverted
              renderItem={({ item }) => {
                if (item.type === "separator") {
                  return <TimeSeparator label={item.label} />;
                }
                return (
                  <FlatMessageItem
                    messages={item.messages as DMCachedMessage[]}
                    currentUserId={currentUserId}
                    isDM={true}
                  />
                );
              }}
              contentContainerStyle={{ paddingTop: 8 }}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: C.dim, fontSize: 13 }}>no messages yet. say hi!</Text>
                </View>
              }
            />
          )}

          {/* Composer */}
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={`message ${otherScreenname || "…"}…`}
              placeholderTextColor={C.placeholder}
              value={draft}
              onChangeText={setDraft}
              fontSize={16}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            {dmFontColorsEnabled && (
              <TouchableOpacity
                style={[styles.colorDot, { backgroundColor: myColor }]}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  colorSheetRef.current?.expand();
                }}
                activeOpacity={0.8}
                accessibilityLabel="Pick text color"
              />
            )}
            <TouchableOpacity
              style={[styles.sendBtn, !draft.trim() && { opacity: 0.4 }]}
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.sendText}>↑</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Color Picker Sheet — rendered outside KeyboardAvoidingView so it overlays correctly */}
      {dmFontColorsEnabled && (
        <ColorPickerSheet
          sheetRef={colorSheetRef}
          currentColor={myColor}
          currentSize={mySize}
          onColorChange={handleColorChange}
          onSizeChange={handleSizeChange}
        />
      )}
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.headerBg,
  },
  backBtn: {
    paddingRight: 12,
  },
  backArrow: {
    color: C.muted,
    fontSize: 28,
    lineHeight: 28,
  },
  headerCenter: {
    flex: 1,
  },
  headerName: {
    color: C.text,
    fontSize: 15,
    fontWeight: "700",
  },
  headerSub: {
    color: C.muted,
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 1,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.headerBg,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
