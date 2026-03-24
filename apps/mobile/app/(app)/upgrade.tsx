import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { getSession } from "@/lib/session";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

// ---------------------------------------------------------------------------
// Feature comparison data
// ---------------------------------------------------------------------------

const ROWS: { label: string; free: string; gold: string }[] = [
  { label: "posts",            free: "✓",        gold: "✓" },
  { label: "channels",         free: "✓",        gold: "✓" },
  { label: "buddy list",       free: "✓",        gold: "✓" },
  { label: "boards",           free: "✓",        gold: "✓" },
  { label: "message archive",  free: "30 days",  gold: "90 days" },
  { label: "photo uploads",    free: "—",        gold: "✓" },
  { label: "gold ★ badge",     free: "—",        gold: "✓" },
  { label: "tips",             free: "send only", gold: "send + receive" },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function UpgradeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [isGold, setIsGold] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ★ scale animation shown on success
  const starScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getSession().then((s) => setIsGold(s?.isGoldMember ?? false));
  }, []);

  const animateStar = () => {
    Animated.sequence([
      Animated.spring(starScale, {
        toValue: 2.4,
        useNativeDriver: true,
        speed: 14,
        bounciness: 18,
      }),
      Animated.spring(starScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 10,
        bounciness: 6,
      }),
    ]).start();
  };

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await getSession();
      const res = await fetch(`${API}/api/stripe/mobile-subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
      });

      const data = await res.json();

      if (!res.ok || !data.clientSecret) {
        setError(data.error ?? "couldn't start checkout. try again.");
        return;
      }

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

      const { error: presentErr } = await presentPaymentSheet();

      if (presentErr) {
        if (presentErr.code !== "Canceled") {
          setError(presentErr.message);
        }
        return;
      }

      // Success
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateStar();
      setSuccess(true);
    } catch {
      setError("something went wrong. try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const session = await getSession();
      const res = await fetch(`${API}/api/stripe/mobile-portal`, {
        method: "POST",
        headers: session?.token
          ? { Authorization: `Bearer ${session.token}` }
          : {},
      });
      const data = await res.json();
      if (data.url) await Linking.openURL(data.url);
    } catch {
      // non-fatal
    }
  };

  // Still loading session
  if (isGold === null) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.amber} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.amber} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Heading */}
        <Text style={[styles.heading, { color: colors.amber }]}>go gold.</Text>
        <Text style={[styles.price, { color: colors.text }]}>
          $4 / month. cancel anytime. no tricks.
        </Text>

        {isGold || success ? (
          // ── Already Gold / success state ──────────────────────────────────
          <View style={styles.goldState}>
            <Animated.Text
              style={[
                styles.goldStar,
                { color: colors.amber, transform: [{ scale: starScale }] },
              ]}
            >
              ★
            </Animated.Text>
            <Text style={[styles.goldLabel, { color: colors.amber }]}>
              you're gold ★
            </Text>
            {!success && (
              <TouchableOpacity
                onPress={handleManageSubscription}
                style={styles.manageBtn}
                activeOpacity={0.7}
              >
                <Text style={[styles.manageBtnText, { color: colors.textMuted }]}>
                  manage subscription →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // ── Upgrade state ─────────────────────────────────────────────────
          <>
            {/* Comparison table */}
            <View style={[styles.table, { borderColor: colors.border }]}>
              {/* Table header */}
              <View style={[styles.tableRow, styles.tableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.colLabel, { color: colors.textMuted }]} />
                <Text style={[styles.colHead, { color: colors.textMuted }]}>
                  free
                </Text>
                <Text style={[styles.colHead, { color: colors.amber }]}>
                  gold
                </Text>
              </View>

              {ROWS.map((row, i) => (
                <View
                  key={row.label}
                  style={[
                    styles.tableRow,
                    i < ROWS.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.colLabel, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {row.label}
                  </Text>
                  <Text style={[styles.colFree, { color: colors.textMuted }]}>
                    {row.free}
                  </Text>
                  <Text style={[styles.colGold, { color: colors.amber }]}>
                    {row.gold}
                  </Text>
                </View>
              ))}
            </View>

            {/* Archive note */}
            <Text style={[styles.archiveNote, { color: colors.textMuted, borderLeftColor: colors.border }]}>
              Either way, your device stores messages locally forever. The
              expiry only affects syncing to a new device.
            </Text>

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={[styles.cta, { opacity: loading ? 0.6 : 1 }]}
              onPress={handleUpgrade}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0d0d0b" />
              ) : (
                <Text style={styles.ctaText}>Go Gold →</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  body: {
    padding: 24,
    gap: 20,
    alignItems: "stretch",
  },

  heading: {
    fontFamily: "VT323_400Regular",
    fontSize: 64,
    textAlign: "center",
    lineHeight: 68,
  },

  price: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: -8,
  },

  // Comparison table
  table: {
    borderWidth: 1,
    marginTop: 4,
  },

  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  tableHeader: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },

  colLabel: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
  },

  colHead: {
    width: 72,
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
  },

  colFree: {
    width: 72,
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    textAlign: "center",
  },

  colGold: {
    width: 72,
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    textAlign: "center",
  },

  archiveNote: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    paddingLeft: 10,
    borderLeftWidth: 2,
  },

  errorText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: "#c0392b",
    textAlign: "center",
  },

  cta: {
    backgroundColor: "#f5c842",
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },

  ctaText: {
    fontFamily: "VT323_400Regular",
    fontSize: 26,
    color: "#0d0d0b",
  },

  // Already-Gold / success state
  goldState: {
    alignItems: "center",
    marginTop: 40,
    gap: 16,
  },

  goldStar: {
    fontFamily: "VT323_400Regular",
    fontSize: 80,
  },

  goldLabel: {
    fontFamily: "VT323_400Regular",
    fontSize: 32,
  },

  manageBtn: {
    marginTop: 8,
  },

  manageBtnText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
