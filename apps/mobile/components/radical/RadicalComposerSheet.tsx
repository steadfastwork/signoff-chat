import { forwardRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { getSession } from "@/lib/session";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const C = {
  bg:          "#0f0e0c",
  surface:     "#191714",
  amber:       "#f5c842",
  amberBorder: "rgba(245,200,66,0.25)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  inputBg:     "#110e0a",
  placeholder: "#4a4438",
  thought:     "#4caf50",
  quote:       "#a78bfa",
  photo:       "#fb7185",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostType = "AWAY" | "THOUGHT" | "QUOTE" | "PHOTO";

interface Props {
  defaultType?: PostType;
  onPosted?:    () => void;
}

const TYPE_CONFIG: Record<PostType, { label: string; color: string; icon: string }> = {
  AWAY:    { label: "Away message", color: C.amber,   icon: "✦" },
  THOUGHT: { label: "Thought",      color: C.thought, icon: "✍" },
  QUOTE:   { label: "Quote",        color: C.quote,   icon: "❝" },
  PHOTO:   { label: "Photo",        color: C.photo,   icon: "📷" },
};

// ---------------------------------------------------------------------------
// RadicalComposerSheet
// ---------------------------------------------------------------------------

const RadicalComposerSheet = forwardRef<BottomSheet, Props>(
  ({ defaultType = "AWAY", onPosted }, ref) => {
    const [type,       setType]       = useState<PostType>(defaultType);
    const [content,    setContent]    = useState("");
    const [bodyText,   setBodyText]   = useState("");
    const [quoteText,  setQuoteText]  = useState("");
    const [quoteAttrib,setQuoteAttrib] = useState("");
    const [imageUrl,   setImageUrl]   = useState("");
    const [imageCaption, setImageCaption] = useState("");
    const [tags,       setTagsRaw]    = useState("");
    const [saving,     setSaving]     = useState(false);
    const [error,      setError]      = useState<string | null>(null);

    // Reset form
    const reset = () => {
      setContent(""); setBodyText(""); setQuoteText("");
      setQuoteAttrib(""); setImageUrl(""); setImageCaption("");
      setTagsRaw(""); setError(null);
    };

    const canPost = (() => {
      if (saving) return false;
      if (type === "AWAY")    return content.trim().length > 0;
      if (type === "THOUGHT") return bodyText.trim().length > 0;
      if (type === "QUOTE")   return quoteText.trim().length > 0;
      if (type === "PHOTO")   return imageUrl.trim().length > 0;
      return false;
    })();

    const handlePost = async () => {
      if (!canPost) return;
      setSaving(true);
      setError(null);

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const session = await getSession();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;

        const parsedTags = tags
          .split(/[\s,]+/)
          .map((t) => t.replace(/^#/, "").trim().toLowerCase())
          .filter(Boolean);

        const body: Record<string, unknown> = { postType: type, tags: parsedTags };

        if (type === "AWAY") {
          body.content = content.trim();
        } else if (type === "THOUGHT") {
          body.content  = "";
          body.bodyText = bodyText.trim();
        } else if (type === "QUOTE") {
          body.content    = "";
          body.quoteText  = quoteText.trim();
          body.quoteAttrib = quoteAttrib.trim() || undefined;
        } else if (type === "PHOTO") {
          body.content      = "";
          body.imageUrl     = imageUrl.trim();
          body.imageCaption = imageCaption.trim() || undefined;
        }

        const res = await fetch(`${API}/api/posts`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError((d as Record<string, string>).error ?? "failed to post");
          return;
        }

        reset();
        onPosted?.();
        (ref as React.RefObject<BottomSheet>).current?.close();
      } finally {
        setSaving(false);
      }
    };

    const cfg = TYPE_CONFIG[type];

    return (
      <BottomSheet
        ref={ref}
        snapPoints={["80%"]}
        index={-1}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: C.surface }}
        handleIndicatorStyle={{ backgroundColor: C.muted }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetScrollView contentContainerStyle={styles.container}>
          {/* Type selector */}
          <View style={styles.typeRow}>
            {(["AWAY", "THOUGHT", "QUOTE", "PHOTO"] as PostType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, type === t && { borderColor: TYPE_CONFIG[t].color, backgroundColor: `${TYPE_CONFIG[t].color}18` }]}
                onPress={() => setType(t)}
                activeOpacity={0.75}
              >
                <Text style={[styles.typeBtnText, type === t && { color: TYPE_CONFIG[t].color }]}>
                  {TYPE_CONFIG[t].icon} {TYPE_CONFIG[t].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── AWAY ── */}
          {type === "AWAY" && (
            <>
              <Text style={styles.label}>away message</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textareaAway}
                  value={content}
                  onChangeText={setContent}
                  placeholder="what are you up to right now?"
                  placeholderTextColor={C.placeholder}
                  multiline
                  maxLength={200}
                />
                {content.length > 120 && (
                  <Text style={[styles.counter, content.length > 140 && styles.counterOver]}>
                    {140 - content.length}
                  </Text>
                )}
              </View>
            </>
          )}

          {/* ── THOUGHT ── */}
          {type === "THOUGHT" && (
            <>
              <Text style={styles.label}>thought</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textarea}
                  value={bodyText}
                  onChangeText={setBodyText}
                  placeholder="what's on your mind?"
                  placeholderTextColor={C.placeholder}
                  multiline
                  maxLength={2000}
                />
              </View>
            </>
          )}

          {/* ── QUOTE ── */}
          {type === "QUOTE" && (
            <>
              <Text style={styles.label}>quote</Text>
              <View style={[styles.inputWrap, { borderLeftWidth: 3, borderLeftColor: C.quote, paddingLeft: 10 }]}>
                <TextInput
                  style={styles.textarea}
                  value={quoteText}
                  onChangeText={setQuoteText}
                  placeholder="enter the quote…"
                  placeholderTextColor={C.placeholder}
                  multiline
                  maxLength={1000}
                />
              </View>
              <Text style={[styles.label, { marginTop: 12 }]}>attribution</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={quoteAttrib}
                  onChangeText={setQuoteAttrib}
                  placeholder="— who said it (optional)"
                  placeholderTextColor={C.placeholder}
                  maxLength={100}
                />
              </View>
            </>
          )}

          {/* ── PHOTO ── */}
          {type === "PHOTO" && (
            <>
              <Text style={styles.label}>image URL</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  placeholder="https://…"
                  placeholderTextColor={C.placeholder}
                  autoCapitalize="none"
                  keyboardType="url"
                  maxLength={500}
                />
              </View>
              <Text style={[styles.label, { marginTop: 12 }]}>caption</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={imageCaption}
                  onChangeText={setImageCaption}
                  placeholder="caption (optional)"
                  placeholderTextColor={C.placeholder}
                  maxLength={200}
                />
              </View>
            </>
          )}

          {/* Tags */}
          <Text style={[styles.label, { marginTop: 12 }]}>tags</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTagsRaw}
              placeholder="music nostalgia vibes"
              placeholderTextColor={C.placeholder}
              autoCapitalize="none"
              maxLength={100}
            />
          </View>

          {/* Error */}
          {error && <Text style={styles.error}>{error}</Text>}

          {/* Post button */}
          <TouchableOpacity
            style={[styles.postBtn, { backgroundColor: cfg.color }, !canPost && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!canPost}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#0f0e0c" size="small" />
              : <Text style={styles.postBtnText}>post {cfg.icon}</Text>
            }
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

RadicalComposerSheet.displayName = "RadicalComposerSheet";
export default RadicalComposerSheet;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 6,
  },

  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  typeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  typeBtnText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
  },

  label: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    color: C.muted,
    textTransform: "lowercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  inputWrap: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  input: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
  },
  textarea: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.text,
    lineHeight: 22,
    minHeight: 90,
    textAlignVertical: "top",
  },
  textareaAway: {
    fontFamily: "DMSans_400Regular",
    fontSize: 17,
    fontStyle: "italic",
    color: "#d6c897",
    lineHeight: 25,
    minHeight: 70,
    textAlignVertical: "top",
  },
  counter: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    color: C.muted,
    textAlign: "right",
    marginTop: 4,
  },
  counterOver: { color: "#ef4444" },

  error: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },

  postBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: "#0f0e0c",
  },
});
