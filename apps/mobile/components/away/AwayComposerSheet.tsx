import { forwardRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";

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
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";
const MAX_AWAY = 140;

type Visibility = "PUBLIC" | "BUDDIES" | "PRIVATE";

const VIS_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "PUBLIC",  label: "everyone",  hint: "shown in the away feed" },
  { value: "BUDDIES", label: "buddies",   hint: "only your buddy list" },
  { value: "PRIVATE", label: "just me",   hint: "sets your status but stays private" },
];

const CURRENTLY_FIELDS = [
  { key: "reading",   emoji: "📖", placeholder: "reading…" },
  { key: "listening", emoji: "🎵", placeholder: "listening to…" },
  { key: "watching",  emoji: "🎬", placeholder: "watching…" },
  { key: "playing",   emoji: "🎮", placeholder: "playing…" },
  { key: "making",    emoji: "🛠", placeholder: "making…" },
  { key: "feeling",   emoji: "💭", placeholder: "feeling…" },
] as const;

type CurrentlyKey = typeof CURRENTLY_FIELDS[number]["key"];

interface Props {
  initialMessage?:    string;
  initialCurrently?:  Partial<Record<CurrentlyKey, string>>;
  initialVisibility?: Visibility;
  onSaved?: () => void;
}

const AwayComposerSheet = forwardRef<BottomSheet, Props>(
  ({ initialMessage = "", initialCurrently = {}, initialVisibility = "PUBLIC", onSaved }, ref) => {
    const [message,    setMessage]    = useState(initialMessage);
    const [currently,  setCurrently]  = useState<Partial<Record<CurrentlyKey, string>>>(initialCurrently);
    const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
    const [saving,     setSaving]     = useState(false);
    const [error,      setError]      = useState<string | null>(null);

    const charsLeft  = MAX_AWAY - message.length;
    const overLimit  = charsLeft < 0;
    const canSave    = message.trim().length > 0 && !overLimit && !saving;

    const save = async () => {
      if (!canSave) return;
      setSaving(true);
      setError(null);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const res = await fetch(`${API}/api/profile`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            awayMessage: message.trim(),
            awayVisibility: visibility,
            currently,
            status: "AWAY",
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError((d as Record<string, string>).error ?? "failed to save");
          return;
        }
        onSaved?.();
        (ref as React.RefObject<BottomSheet>).current?.close();
      } finally {
        setSaving(false);
      }
    };

    return (
      <BottomSheet
        ref={ref}
        snapPoints={["85%"]}
        index={-1}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: C.surface }}
        handleIndicatorStyle={{ backgroundColor: C.muted }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetScrollView contentContainerStyle={styles.container}>
          {/* Label */}
          <Text style={styles.sectionLabel}>away message</Text>

          {/* Away textarea */}
          <View style={styles.textareaWrap}>
            <TextInput
              style={styles.textarea}
              value={message}
              onChangeText={setMessage}
              placeholder="i'm away because…"
              placeholderTextColor={C.placeholder}
              multiline
              maxLength={MAX_AWAY + 10}
            />
            {message.length > 100 && (
              <Text style={[styles.counter, overLimit && styles.counterOver]}>
                {charsLeft}
              </Text>
            )}
          </View>

          {/* Currently */}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>currently</Text>
          <View style={styles.currentlyList}>
            {CURRENTLY_FIELDS.map(({ key, emoji, placeholder }) => (
              <View key={key} style={styles.currentlyRow}>
                <Text style={styles.emoji}>{emoji}</Text>
                <TextInput
                  style={styles.currentlyInput}
                  value={currently[key] ?? ""}
                  onChangeText={(v) => setCurrently((prev) => ({ ...prev, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor={C.placeholder}
                  maxLength={80}
                />
              </View>
            ))}
          </View>

          {/* Visibility */}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>who can see this</Text>
          <View style={styles.visRow}>
            {VIS_OPTIONS.map(({ value, label, hint }) => (
              <TouchableOpacity
                key={value}
                style={[styles.visBtn, visibility === value && styles.visBtnActive]}
                onPress={() => setVisibility(value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.visBtnLabel, visibility === value && styles.visBtnLabelActive]}>
                  {label}
                </Text>
                <Text style={styles.visBtnHint}>{hint}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {error && <Text style={styles.error}>{error}</Text>}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={save}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#0f0e0c" size="small" />
              : <Text style={styles.saveBtnText}>save away message</Text>}
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

AwayComposerSheet.displayName = "AwayComposerSheet";
export default AwayComposerSheet;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 8,
  },

  sectionLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    color: C.muted,
    textTransform: "lowercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  textareaWrap: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    minHeight: 90,
  },
  textarea: {
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    fontStyle: "italic",
    color: "#d6c897",
    lineHeight: 24,
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

  currentlyList: { gap: 8 },
  currentlyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emoji: { fontSize: 16, width: 22, textAlign: "center" },
  currentlyInput: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.text,
  },

  visRow: { gap: 8 },
  visBtn: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#111",
  },
  visBtnActive: {
    borderColor: C.amberBorder,
    backgroundColor: "#2a1a00",
  },
  visBtnLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: C.muted,
  },
  visBtnLabelActive: { color: C.amber },
  visBtnHint: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
    opacity: 0.7,
  },

  error: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },

  saveBtn: {
    marginTop: 16,
    backgroundColor: C.amber,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: "#0f0e0c",
  },
});
