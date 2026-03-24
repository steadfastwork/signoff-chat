import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Image,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Avatar from "@/components/Avatar";

const C = {
  bg:          "#0f0e0c",
  card:        "#191714",
  amber:       "#f5c842",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  inputBg:     "#110e0a",
  placeholder: "#4a4438",
};

const MAX_CHARS     = 512;
const MAX_AWAY_CHARS = 140;

interface Props {
  screenname: string;
  avatarColor: string;
  onPost: (content: string, privacy: "PUBLIC" | "BUDDIES_ONLY", mediaUri?: string) => Promise<void>;
}

export default function Composer({ screenname, avatarColor, onPost }: Props) {
  const [expanded, setExpanded]     = useState(false);
  const [content, setContent]       = useState("");
  const [privacy, setPrivacy]       = useState<"PUBLIC" | "BUDDIES_ONLY">("PUBLIC");
  const [isAway, setIsAway]         = useState(false);
  const [mediaUri, setMediaUri]     = useState<string | null>(null);
  const [sending, setSending]       = useState(false);

  const height  = useSharedValue(60);
  const opacity = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  const limit = isAway ? MAX_AWAY_CHARS : MAX_CHARS;
  const charsLeft = limit - content.length;
  const overLimit = charsLeft < 0;

  const expand = () => {
    setExpanded(true);
    height.value  = withSpring(220, { damping: 18, stiffness: 160 });
    opacity.value = withTiming(1, { duration: 200 });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const collapse = () => {
    setExpanded(false);
    height.value  = withSpring(60, { damping: 18, stiffness: 160 });
    opacity.value = withTiming(0, { duration: 150 });
    inputRef.current?.blur();
  };

  const containerStyle = useAnimatedStyle(() => ({ height: height.value }));
  const toolbarStyle   = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const pickMedia = async (type: "image" | "video") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === "image"
        ? ImagePicker.MediaTypeOptions.Images
        : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
    }
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || overLimit || sending) return;
    setSending(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onPost(trimmed, privacy, mediaUri ?? undefined);
      setContent("");
      setMediaUri(null);
      collapse();
    } finally {
      setSending(false);
    }
  };

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* ── Collapsed row ── */}
      <Pressable style={styles.collapsedRow} onPress={expand}>
        <Avatar screenname={screenname} color={avatarColor} size={34} />
        {!expanded && (
          <Text style={styles.placeholder}>What's on your mind?</Text>
        )}
        {expanded && (
          <TouchableOpacity onPress={collapse} hitSlop={8} style={{ marginLeft: "auto" }}>
            <Text style={styles.dismissBtn}>cancel</Text>
          </TouchableOpacity>
        )}
      </Pressable>

      {/* ── Expanded area ── */}
      <Animated.View style={[styles.expanded, toolbarStyle]} pointerEvents={expanded ? "auto" : "none"}>
        <TextInput
          ref={inputRef}
          style={styles.textarea}
          placeholder={isAway ? "set your away message..." : "say something..."}
          placeholderTextColor={C.placeholder}
          multiline
          scrollEnabled
          maxLength={limit + 20} // slight buffer, we enforce visually
          value={content}
          onChangeText={setContent}
          textAlignVertical="top"
        />

        {/* Media preview */}
        {mediaUri ? (
          <View style={styles.mediaPreview}>
            <Image source={{ uri: mediaUri }} style={styles.mediaThumb} />
            <TouchableOpacity
              style={styles.removeMedia}
              onPress={() => setMediaUri(null)}
              hitSlop={8}
            >
              <Text style={styles.removeMediaText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Toolbar ── */}
        <View style={styles.toolbar}>
          {/* Left: media buttons */}
          <View style={styles.toolbarLeft}>
            <ToolbarButton icon="📷" onPress={() => pickMedia("image")} />
            <ToolbarButton icon="🎬" onPress={() => pickMedia("video")} />
            <ToolbarButton label="GIF" onPress={() => {}} />
          </View>

          {/* Right: toggles + send */}
          <View style={styles.toolbarRight}>
            {/* Away message toggle */}
            <ToolbarButton
              icon="💤"
              active={isAway}
              onPress={() => setIsAway((v) => !v)}
            />
            {/* Privacy toggle */}
            <ToolbarButton
              icon={privacy === "PUBLIC" ? "🌐" : "👥"}
              active={privacy === "BUDDIES_ONLY"}
              onPress={() =>
                setPrivacy((v) => (v === "PUBLIC" ? "BUDDIES_ONLY" : "PUBLIC"))
              }
            />
            {/* Char counter */}
            <Text style={[styles.charCount, overLimit && styles.charCountOver]}>
              {charsLeft}
            </Text>
            {/* Send */}
            <TouchableOpacity
              style={[styles.sendBtn, (overLimit || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={overLimit || sending}
              activeOpacity={0.8}
            >
              <Text style={styles.sendBtnText}>{sending ? "..." : "Send"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function ToolbarButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon?: string;
  label?: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.toolbarBtn, active && styles.toolbarBtnActive]}
      onPress={onPress}
      hitSlop={4}
      activeOpacity={0.7}
    >
      {icon  && <Text style={styles.toolbarBtnIcon}>{icon}</Text>}
      {label && <Text style={[styles.toolbarBtnLabel, active && styles.toolbarBtnLabelActive]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    overflow: "hidden",
  },
  collapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  placeholder: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.placeholder,
    flex: 1,
  },
  dismissBtn: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
  },

  // Expanded
  expanded: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  textarea: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    minHeight: 64,
    maxHeight: 100,
    paddingTop: 0,
    lineHeight: 20,
  },

  // Media preview
  mediaPreview: {
    position: "relative",
    alignSelf: "flex-start",
  },
  mediaThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: C.border,
  },
  removeMedia: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#e05c4b",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  removeMediaText: {
    fontSize: 10,
    color: "#fff",
    fontFamily: "DMSans_700Bold",
  },

  // Toolbar
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toolbarLeft: {
    flexDirection: "row",
    gap: 4,
  },
  toolbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toolbarBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  toolbarBtnActive: {
    backgroundColor: "rgba(245,200,66,0.12)",
  },
  toolbarBtnIcon: {
    fontSize: 16,
  },
  toolbarBtnLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: C.muted,
  },
  toolbarBtnLabelActive: {
    color: C.amber,
  },

  // Char counter
  charCount: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
    minWidth: 30,
    textAlign: "right",
  },
  charCountOver: {
    color: "#e05c4b",
    fontFamily: "DMSans_700Bold",
  },

  // Send button
  sendBtn: {
    backgroundColor: C.amber,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: "#0f0e0c",
  },
});
