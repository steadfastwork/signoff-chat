import { forwardRef, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import Avatar from "@/components/Avatar";
import { STATUS_COLORS } from "./BuddyListItem";

// ---------------------------------------------------------------------------
// Search by screenname ONLY.
// NO email search. NO phone contact sync. No "find by phone number".
// People find each other by screenname. That's the whole point.
// ---------------------------------------------------------------------------

const C = {
  bg:          "#191714",
  inputBg:     "#110e0a",
  amber:       "#f5c842",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  placeholder: "#4a4438",
  success:     "#5cb85c",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

interface SearchResult {
  id: string;
  screenname: string;
  status: string;
  avatarColor: string;
  isGoldMember: boolean;
  relationship: string;
}

interface Props {
  onSendRequest: (userId: string, screenname: string) => Promise<void>;
}

const AddBuddySheet = forwardRef<BottomSheet, Props>(({ onSendRequest }, ref) => {
  const [query, setQuery]     = useState("");
  const [result, setResult]   = useState<SearchResult | null | "not-found">(null);
  const [checking, setChecking] = useState(false);
  const [sent, setSent]       = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.55} />
    ),
    []
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setResult(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 2) return;

    setChecking(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/users/${encodeURIComponent(trimmed)}`);
        if (res.status === 404) {
          setResult("not-found");
        } else if (res.ok) {
          setResult(await res.json());
        }
      } catch {
        setResult("not-found");
      } finally {
        setChecking(false);
      }
    }, 500);
  };

  const handleAdd = async (userId: string, screenname: string) => {
    setSending(userId);
    try {
      await onSendRequest(userId, screenname);
      setSent((prev) => new Set(prev).add(userId));
    } finally {
      setSending(null);
    }
  };

  const handleClose = () => {
    setQuery("");
    setResult(null);
    (ref as React.RefObject<BottomSheet>)?.current?.close();
  };

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={["50%"]}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheet}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>find a buddy</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={8}>
            <Text style={styles.closeBtn}>done</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search input ── */}
        <View style={styles.inputRow}>
          <Text style={styles.atPrefix}>@</Text>
          <BottomSheetTextInput
            style={styles.input}
            placeholder="search by screenname"
            placeholderTextColor={C.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={handleQueryChange}
          />
          {checking && (
            <ActivityIndicator size="small" color={C.muted} style={{ marginLeft: 8 }} />
          )}
        </View>

        {/* NO hint about email or phone — on purpose. */}
        <Text style={styles.hint}>screennames only · no emails · no phone numbers</Text>

        {/* ── Result ── */}
        {result === "not-found" && query.trim().length >= 2 && (
          <View style={styles.notFound}>
            <Text style={styles.notFoundText}>no one found with that screenname.</Text>
          </View>
        )}

        {result && result !== "not-found" && (
          <View style={styles.resultRow}>
            <Avatar
              screenname={result.screenname}
              color={result.avatarColor}
              size={42}
              statusDot={STATUS_COLORS[result.status] ?? STATUS_COLORS.OFFLINE}
            />
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>
                {result.screenname}
                {result.isGoldMember ? "  ★" : ""}
              </Text>
              <Text style={[styles.resultStatus, { color: STATUS_COLORS[result.status] ?? C.muted }]}>
                {result.status.toLowerCase()}
              </Text>
            </View>

            {result.relationship === "buddy" ? (
              <View style={styles.alreadyBuddy}>
                <Text style={styles.alreadyBuddyText}>buddies ✓</Text>
              </View>
            ) : result.relationship === "pending" ? (
              <View style={styles.alreadyBuddy}>
                <Text style={styles.alreadyBuddyText}>pending</Text>
              </View>
            ) : result.relationship === "self" ? null : sent.has(result.id) ? (
              <View style={styles.sentBadge}>
                <Text style={styles.sentText}>sent ✓</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addBtn, sending === result.id && { opacity: 0.6 }]}
                onPress={() => handleAdd(result.id, result.screenname)}
                disabled={sending === result.id}
                activeOpacity={0.8}
              >
                {sending === result.id
                  ? <ActivityIndicator size="small" color="#0f0e0c" />
                  : <Text style={styles.addBtnText}>Add buddy</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
});

AddBuddySheet.displayName = "AddBuddySheet";
export default AddBuddySheet;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#2c2820",
  },
  handle: { backgroundColor: C.muted, width: 36 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontFamily: "DMSans_700Bold",
    fontSize: 18,
    color: C.text,
  },
  closeBtn: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.amber,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: "#2c2820",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  atPrefix: {
    fontFamily: "DMSans_700Bold",
    fontSize: 17,
    color: C.amber,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    color: C.text,
    paddingVertical: 13,
  },

  hint: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
    marginTop: -6,
  },

  notFound: { paddingVertical: 8 },
  notFoundText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.muted,
    fontStyle: "italic",
  },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2c2820",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    backgroundColor: "#111009",
  },
  resultInfo: { flex: 1, gap: 3 },
  resultName: {
    fontFamily: "DMSans_700Bold",
    fontSize: 15,
    color: C.text,
  },
  resultStatus: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
  },
  addBtn: {
    backgroundColor: C.amber,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: "center",
  },
  addBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: "#0f0e0c",
  },
  alreadyBuddy: {
    borderWidth: 1,
    borderColor: "#2c2820",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alreadyBuddyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
  sentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sentText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: C.success,
  },
});
