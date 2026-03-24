import { forwardRef, useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

const C = {
  bg:          "#191714",
  inputBg:     "#110e0a",
  amber:       "#f5c842",
  amberTint:   "rgba(245,200,66,0.08)",
  amberBorder: "rgba(245,200,66,0.3)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  placeholder: "#4a4438",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

type ChannelType = "PUBLIC" | "PRIVATE" | "SECRET";

const TYPE_OPTIONS: {
  key: ChannelType;
  icon: string;
  label: string;
  desc: string;
}[] = [
  { key: "PUBLIC",  icon: "#",  label: "Public",       desc: "Anyone can find and join." },
  { key: "PRIVATE", icon: "🔒", label: "Invite only",  desc: "Invite link required. Not discoverable." },
  { key: "SECRET",  icon: "👁", label: "Secret",       desc: "Hidden. Invite link only. No trace." },
];

interface Props {
  onCreated: (channelName: string) => void;
}

// Sanitise channel name: lowercase, hyphens only, no leading/trailing hyphens
function sanitize(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const CreateChannelSheet = forwardRef<BottomSheet, Props>(({ onCreated }, ref) => {
  const [name, setName]           = useState("");
  const [type, setType]           = useState<ChannelType>("PUBLIC");
  const [slowMode, setSlowMode]   = useState("0");
  const [memberCap, setMemberCap] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.55} />
    ),
    []
  );

  const handleNameChange = (v: string) => setName(sanitize(v));

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("channel name is required."); return; }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: trimmed,
        type,
        slowModeMinutes: parseInt(slowMode, 10) || 0,
      };
      if (type === "PUBLIC" && memberCap) {
        body.memberCap = parseInt(memberCap, 10) || undefined;
      }
      const res = await fetch(`${API}/api/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "couldn't create channel."); return; }
      // Reset
      setName(""); setType("PUBLIC"); setSlowMode("0"); setMemberCap("");
      (ref as React.RefObject<BottomSheet>)?.current?.close();
      onCreated(data.name);
    } finally {
      setLoading(false);
    }
  };

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
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>new channel</Text>
          <TouchableOpacity
            onPress={() => (ref as React.RefObject<BottomSheet>)?.current?.close()}
            hitSlop={8}
          >
            <Text style={styles.closeBtn}>cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>channel name</Text>
          <View style={styles.inputRow}>
            <Text style={styles.hashPrefix}>#</Text>
            <BottomSheetTextInput
              style={styles.input}
              placeholder="my-channel"
              placeholderTextColor={C.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              value={name}
              onChangeText={handleNameChange}
            />
          </View>
          <Text style={styles.hint}>lowercase · hyphens only · auto-formatted</Text>
        </View>

        {/* Type */}
        <View style={styles.field}>
          <Text style={styles.label}>type</Text>
          <View style={styles.typeGrid}>
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.typeCard, active && styles.typeCardActive]}
                  onPress={() => setType(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.typeIcon}>{opt.icon}</Text>
                  <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.typeDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Slow mode */}
        <View style={styles.field}>
          <Text style={styles.label}>slow mode</Text>
          <View style={styles.inputRow}>
            <BottomSheetTextInput
              style={[styles.input, styles.inputShort]}
              placeholder="0"
              placeholderTextColor={C.placeholder}
              keyboardType="number-pad"
              value={slowMode}
              onChangeText={setSlowMode}
            />
            <Text style={styles.inputSuffix}>minutes</Text>
          </View>
          <Text style={styles.hint}>0 = off · 10 = recommended</Text>
        </View>

        {/* Member cap — public only */}
        {type === "PUBLIC" && (
          <View style={styles.field}>
            <Text style={styles.label}>member cap <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.inputRow}>
              <BottomSheetTextInput
                style={[styles.input, styles.inputShort]}
                placeholder="500"
                placeholderTextColor={C.placeholder}
                keyboardType="number-pad"
                value={memberCap}
                onChangeText={setMemberCap}
              />
              <Text style={styles.inputSuffix}>members max</Text>
            </View>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color="#0f0e0c" />
            : <Text style={styles.createBtnText}>Create channel</Text>}
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

CreateChannelSheet.displayName = "CreateChannelSheet";
export default CreateChannelSheet;

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
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 22 },

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title:    { fontFamily: "DMSans_700Bold", fontSize: 18, color: C.text },
  closeBtn: { fontFamily: "DMSans_400Regular", fontSize: 14, color: C.muted },

  field: { gap: 7 },
  label: { fontFamily: "DMSans_700Bold", fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  optional: { fontFamily: "DMSans_400Regular", textTransform: "none", letterSpacing: 0 },
  hint:  { fontFamily: "DMSans_400Regular", fontSize: 12, color: C.muted, opacity: 0.75 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  hashPrefix: { fontFamily: "DMSans_700Bold", fontSize: 17, color: C.amber, marginRight: 4 },
  input:      { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 15, color: C.text, paddingVertical: 12 },
  inputShort: { flex: 0, width: 70 },
  inputSuffix:{ fontFamily: "DMSans_400Regular", fontSize: 13, color: C.muted, marginLeft: 10 },

  typeGrid: { gap: 8 },
  typeCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  typeCardActive: { borderColor: C.amber, backgroundColor: C.amberTint },
  typeIcon:       { fontSize: 18, marginBottom: 2 },
  typeLabel:      { fontFamily: "DMSans_700Bold", fontSize: 14, color: C.text },
  typeLabelActive:{ color: C.amber },
  typeDesc:       { fontFamily: "DMSans_400Regular", fontSize: 12, color: C.muted },

  error:     { fontFamily: "DMSans_400Regular", fontSize: 14, color: C.amber },
  createBtn: { backgroundColor: C.amber, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  createBtnText: { fontFamily: "DMSans_700Bold", fontSize: 16, color: "#0f0e0c" },
});
