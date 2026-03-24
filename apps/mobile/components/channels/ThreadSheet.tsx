import { forwardRef, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import ChannelMessage from "./ChannelMessage";
import type { CachedMessage } from "@/lib/db/localMessages";

const C = {
  bg:          "#191714",
  inputBg:     "#110e0a",
  amber:       "#f5c842",
  amberTint:   "rgba(245,200,66,0.06)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  placeholder: "#4a4438",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ThreadReply {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface Props {
  parentMessage: CachedMessage | null;
  channelName: string;
  onAuthorPress: (screenname: string) => void;
}

const ThreadSheet = forwardRef<BottomSheet, Props>(
  ({ parentMessage, channelName, onAuthorPress }, ref) => {
    const [replies, setReplies]   = useState<ThreadReply[]>([]);
    const [loading, setLoading]   = useState(false);
    const [draft, setDraft]       = useState("");
    const [sending, setSending]   = useState(false);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.55} />
      ),
      []
    );

    useEffect(() => {
      if (!parentMessage) { setReplies([]); return; }
      fetchReplies(parentMessage.id);
    }, [parentMessage?.id]);

    const fetchReplies = async (messageId: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API}/api/channels/${channelName}/messages/${messageId}/thread`
        );
        if (res.ok) {
          const data = await res.json();
          setReplies(data.replies ?? []);
        }
      } finally {
        setLoading(false);
      }
    };

    const handleReply = async () => {
      if (!draft.trim() || !parentMessage || sending) return;
      setSending(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const res = await fetch(
          `${API}/api/channels/${channelName}/messages/${parentMessage.id}/thread`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: draft.trim() }),
          }
        );
        if (res.ok) {
          const newReply = await res.json();
          setReplies((prev) => [...prev, newReply]);
          setDraft("");
        }
      } finally {
        setSending(false);
      }
    };

    if (!parentMessage) return null;

    // Convert parent to CachedMessage format for ChannelMessage component
    const parentAsCached: CachedMessage = parentMessage;

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={["75%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheet}
        handleIndicatorStyle={{ backgroundColor: C.muted, width: 36 }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        {/* Thread label */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Thread</Text>
        </View>

        {/* Parent message — highlighted */}
        <View style={styles.parentWrap}>
          <ChannelMessage
            message={parentAsCached}
            onAuthorPress={onAuthorPress}
          />
        </View>

        <View style={styles.repliesDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Replies */}
        {loading ? (
          <ActivityIndicator color={C.amber} style={{ marginTop: 24 }} />
        ) : (
          <BottomSheetFlatList
            data={replies}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.reply}>
                <Text style={styles.replyAuthor}>{item.authorName}</Text>
                <Text style={styles.replyContent}>{item.content}</Text>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 80 }}
            ListEmptyComponent={
              <Text style={styles.emptyReplies}>
                no replies yet. be the first.
              </Text>
            }
          />
        )}

        {/* Reply composer */}
        <View style={styles.composer}>
          <BottomSheetTextInput
            style={styles.replyInput}
            placeholder="reply..."
            placeholderTextColor={C.placeholder}
            multiline
            maxLength={512}
            value={draft}
            onChangeText={setDraft}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.35 }]}
            onPress={handleReply}
            disabled={!draft.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#0f0e0c" />
              : <Text style={styles.sendBtnText}>↑</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheet>
    );
  }
);

ThreadSheet.displayName = "ThreadSheet";
export default ThreadSheet;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.border,
  },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 16, color: C.text },

  parentWrap: { backgroundColor: C.amberTint },

  repliesDivider: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  dividerLine:  { flex: 1, height: 1, backgroundColor: C.border },
  dividerLabel: { fontFamily: "DMSans_400Regular", fontSize: 11, color: C.muted },

  reply: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 3,
  },
  replyAuthor:  { fontFamily: "DMSans_700Bold", fontSize: 12, color: C.amber },
  replyContent: { fontFamily: "DMSans_400Regular", fontSize: 14, color: C.text, lineHeight: 19 },
  emptyReplies: { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.muted, fontStyle: "italic", textAlign: "center", marginTop: 24, paddingHorizontal: 20 },

  composer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  replyInput: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  sendBtnText: { fontFamily: "DMSans_700Bold", fontSize: 16, color: "#0f0e0c" },
});
