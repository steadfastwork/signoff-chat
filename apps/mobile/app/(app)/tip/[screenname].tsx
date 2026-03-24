import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import { getSession } from "@/lib/session";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

const PRESETS = [1, 5, 10, 25];

export default function TipScreen() {
  const { screenname } = useLocalSearchParams<{ screenname: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [preset, setPreset] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-navigate back 2s after success
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (sent) {
      navTimer.current = setTimeout(() => router.back(), 2000);
    }
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, [sent, router]);

  const selectedDollars =
    preset !== null
      ? preset
      : custom
      ? parseFloat(custom)
      : null;

  const amountCents =
    selectedDollars !== null && isFinite(selectedDollars)
      ? Math.round(selectedDollars * 100)
      : null;

  const canSend = amountCents !== null && amountCents >= 100;

  const handleSend = async () => {
    if (!canSend || !screenname) return;

    setLoading(true);
    setError(null);

    try {
      const session = await getSession();

      // 1. Create PaymentIntent on the server
      const res = await fetch(`${API}/api/stripe/mobile-tip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
        },
        body: JSON.stringify({
          recipientScreenname: screenname,
          amountCents,
          message: message.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.clientSecret) {
        setError(data.error ?? "couldn't create tip. try again.");
        return;
      }

      // 2. Init Payment Sheet
      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: data.clientSecret,
        merchantDisplayName: "Signoff Chat",
        style: "alwaysDark",
        appearance: {
          colors: {
            primary: "#f5c842",
            background: "#191714",
            componentBackground: "#0f0e0c",
            primaryText: "#e8e4d9",
            secondaryText: "#7a7060",
            placeholderText: "#7a7060",
            icon: "#e8e4d9",
          },
        },
      });

      if (initErr) {
        setError(initErr.message);
        return;
      }

      // 3. Present Payment Sheet
      const { error: presentErr } = await presentPaymentSheet();

      if (presentErr) {
        if (presentErr.code !== "Canceled") {
          setError(presentErr.message);
        }
        return;
      }

      // 4. Success
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch {
      setError("something went wrong. try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.amber} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.amber }]}>
          tip {screenname}
        </Text>
      </View>

      {sent ? (
        // ── Success state ───────────────────────────────────────────────────
        <View style={styles.success}>
          <Text style={[styles.successText, { color: colors.amber }]}>
            tip sent. ✓
          </Text>
          <Text style={[styles.successSub, { color: colors.textMuted }]}>
            going back…
          </Text>
        </View>
      ) : (
        // ── Form ────────────────────────────────────────────────────────────
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Amount presets */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            amount
          </Text>
          <View style={styles.presets}>
            {PRESETS.map((a) => {
              const active = preset === a;
              return (
                <TouchableOpacity
                  key={a}
                  style={[
                    styles.preset,
                    { borderColor: active ? colors.amber : colors.border },
                    active && { backgroundColor: colors.amber },
                  ]}
                  onPress={() => {
                    setPreset(a);
                    setCustom("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetText,
                      { color: active ? "#0d0d0b" : colors.text },
                    ]}
                  >
                    ${a}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom amount */}
          <TextInput
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
            placeholder="custom amount (e.g. 2.50)"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={custom}
            onChangeText={(v) => {
              setCustom(v);
              setPreset(null);
            }}
          />

          {/* Message */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            message{" "}
            <Text style={{ fontStyle: "italic" }}>(optional)</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.inputMulti,
              { color: colors.text, borderColor: colors.border },
            ]}
            placeholder="say something nice..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={140}
            value={message}
            onChangeText={setMessage}
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>
            {message.length}/140
          </Text>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {/* Send button */}
          <TouchableOpacity
            style={[styles.btn, { opacity: canSend ? 1 : 0.35 }]}
            onPress={handleSend}
            disabled={!canSend || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#0d0d0b" />
            ) : (
              <Text style={styles.btnText}>
                {canSend && amountCents
                  ? `Send $${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)} →`
                  : "Send Tip →"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  title: {
    fontFamily: "VT323_400Regular",
    fontSize: 24,
  },

  body: {
    padding: 20,
    gap: 12,
  },

  label: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
  },

  presets: {
    flexDirection: "row",
    gap: 10,
  },

  preset: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },

  presetText: {
    fontFamily: "VT323_400Regular",
    fontSize: 22,
  },

  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
  },

  inputMulti: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  charCount: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    textAlign: "right",
    marginTop: -6,
  },

  errorText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: "#c0392b",
  },

  btn: {
    backgroundColor: "#f5c842",
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },

  btnText: {
    fontFamily: "VT323_400Regular",
    fontSize: 24,
    color: "#0d0d0b",
  },

  // Success
  success: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  successText: {
    fontFamily: "VT323_400Regular",
    fontSize: 40,
  },

  successSub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
  },
});
