import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { register, login } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Warm palette
// ---------------------------------------------------------------------------
const C = {
  bg:           "#0f0e0c",
  card:         "#191714",
  amber:        "#f5c842",
  amberTint:    "rgba(245,200,66,0.07)",
  amberBorder:  "rgba(245,200,66,0.28)",
  text:         "#e8e4d9",
  muted:        "#7a7060",
  border:       "#2c2820",
  inputBg:      "#110e0a",
  placeholder:  "#4a4438",
  success:      "#5cb85c",
  error:        "#e05c4b",
};

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------
function passwordStrength(p: string): 0 | 1 | 2 | 3 {
  if (!p || p.length < 8) return 0;
  let score = 0;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score >= 3) return 3;
  if (score >= 2) return 2;
  return 1;
}

const STRENGTH_COLOR = ["transparent", C.error, C.amber, C.success];
const STRENGTH_LABEL = ["", "weak", "getting there", "strong ✓"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function RegisterScreen() {
  const router = useRouter();

  // Form state
  const [screenname, setScreenname] = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Screenname availability
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submission
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Welcome modal
  const [showWelcome, setShowWelcome] = useState(false);
  const [finalScreenname, setFinalScreenname] = useState("");

  const API = process.env.EXPO_PUBLIC_API_URL ?? "";
  const strength = passwordStrength(password);
  const passwordsMatch = confirm.length > 0 && confirm === password;
  const passwordMismatch = confirm.length > 0 && confirm !== password;

  // ── Screenname live check ──
  const handleScreennameChange = (value: string) => {
    setScreenname(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!value) { setNameStatus("idle"); return; }

    const valid = /^[a-zA-Z0-9_]{3,20}$/.test(value);
    if (!valid) {
      setNameStatus(value.length < 3 ? "idle" : "invalid");
      return;
    }

    setNameStatus("checking");
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/users/${value}`);
        setNameStatus(res.status === 404 ? "available" : "taken");
      } catch {
        setNameStatus("idle");
      }
    }, 500);
  };

  // ── Submit ──
  const handleRegister = async () => {
    const name = screenname.trim();
    if (!name || !email.trim() || !password || !confirm) return;
    if (password !== confirm) { setError("passwords don't match."); return; }
    if (nameStatus === "taken") { setError("that screenname is taken."); return; }
    if (nameStatus === "invalid") { setError("screenname can only have letters, numbers, and underscores."); return; }

    setLoading(true);
    setError(null);
    try {
      await register(name, email, password);
      await login(name, password);
      setFinalScreenname(name);
      setShowWelcome(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleDismissWelcome = () => {
    setShowWelcome(false);
    router.replace("/(app)/(tabs)/feed");
  };

  // ── Name status indicator ──
  const NameIndicator = () => {
    if (nameStatus === "idle") return null;
    if (nameStatus === "checking") return (
      <ActivityIndicator size="small" color={C.muted} style={styles.nameIndicator} />
    );
    return (
      <View style={styles.nameIndicator}>
        {nameStatus === "available" && (
          <Text style={[styles.nameStatusText, { color: C.success }]}>✓ available</Text>
        )}
        {nameStatus === "taken" && (
          <Text style={[styles.nameStatusText, { color: C.error }]}>✗ taken</Text>
        )}
        {nameStatus === "invalid" && (
          <Text style={[styles.nameStatusText, { color: C.error }]}>✗ letters, numbers, underscores only</Text>
        )}
      </View>
    );
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.logo}>SIGNOFF.CHAT</Text>
            <Text style={styles.tagline}>speak freely. disconnect proudly.</Text>
          </View>

          <Text style={styles.headline}>Pick your screenname.</Text>

          {/* ── Screenname warning card ── */}
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>✏️</Text>
            <View style={styles.warningBody}>
              <Text style={styles.warningTitle}>Write this down somewhere safe.</Text>
              <Text style={styles.warningText}>
                Your screenname is how people find you. We have no way to recover it if you forget it.
                {"\n"}Old school — just like it should be.
              </Text>
            </View>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>

            {/* Screenname */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>screenname</Text>
              <Text style={styles.fieldHint}>3–20 chars · letters numbers underscores</Text>
              <View style={[
                styles.inputRow,
                nameStatus === "available" && styles.inputRowSuccess,
                (nameStatus === "taken" || nameStatus === "invalid") && styles.inputRowError,
              ]}>
                <Text style={styles.inputPrefix}>@</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="coolperson99"
                  placeholderTextColor={C.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  maxLength={20}
                  returnKeyType="next"
                  value={screenname}
                  onChangeText={handleScreennameChange}
                />
                <NameIndicator />
              </View>
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>recovery email</Text>
              <Text style={styles.fieldHint}>we hash this — we never store it plaintext. only used if you forget your password.</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={C.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="at least 8 characters"
                  placeholderTextColor={C.placeholder}
                  secureTextEntry={!showPw}
                  returnKeyType="next"
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={C.muted} />
                </TouchableOpacity>
              </View>
              {/* Strength bar */}
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBar}>
                    {[1, 2, 3].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthSegment,
                          { backgroundColor: strength >= level ? STRENGTH_COLOR[strength] : C.border },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: STRENGTH_COLOR[strength] }]}>
                    {STRENGTH_LABEL[strength]}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirm password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>confirm password</Text>
              <View style={[
                styles.inputRow,
                passwordsMatch && styles.inputRowSuccess,
                passwordMismatch && styles.inputRowError,
              ]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="same again"
                  placeholderTextColor={C.placeholder}
                  secureTextEntry={!showConfirm}
                  returnKeyType="go"
                  onSubmitEditing={handleRegister}
                  value={confirm}
                  onChangeText={setConfirm}
                />
                <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={18} color={C.muted} />
                </TouchableOpacity>
              </View>
              {passwordMismatch && (
                <Text style={[styles.fieldHint, { color: C.error }]}>passwords don't match</Text>
              )}
            </View>

            {/* Error */}
            {error && <Text style={styles.error}>{error}</Text>}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.btnInner}>
                  <ActivityIndicator size="small" color={C.bg} style={{ marginRight: 8 }} />
                  <Text style={styles.btnText}>Creating account...</Text>
                </View>
              ) : (
                <Text style={styles.btnText}>Create account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Back to login */}
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={styles.loginLink}
          >
            <Text style={styles.loginLinkText}>Already have an account? Sign in →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Welcome modal ── */}
      <Modal visible={showWelcome} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Welcome, {finalScreenname}.</Text>

            <View style={styles.modalBody}>
              <Text style={styles.modalIntro}>A few things:</Text>

              <View style={styles.modalItem}>
                <Text style={styles.modalEmoji}>✏️</Text>
                <View style={styles.modalItemBody}>
                  <Text style={styles.modalItemTitle}>Write down your screenname somewhere.</Text>
                  <Text style={styles.modalItemText}>We genuinely cannot recover it.</Text>
                </View>
              </View>

              <View style={styles.modalItem}>
                <Text style={styles.modalEmoji}>📸</Text>
                <View style={styles.modalItemBody}>
                  <Text style={styles.modalItemTitle}>Screenshots are king.</Text>
                  <Text style={styles.modalItemText}>Messages expire from our servers. If something matters, save it.</Text>
                </View>
              </View>

              <View style={styles.modalItem}>
                <Text style={styles.modalEmoji}>🔒</Text>
                <View style={styles.modalItemBody}>
                  <Text style={styles.modalItemTitle}>Your messages use AES-256 + ML-KEM encryption.</Text>
                  <Text style={styles.modalItemText}>We cannot read them. Not us. Not anyone.</Text>
                </View>
              </View>

              <View style={styles.modalItem}>
                <Text style={styles.modalEmoji}>🌿</Text>
                <View style={styles.modalItemBody}>
                  <Text style={styles.modalItemTitle}>Sign off when you're done.</Text>
                  <Text style={styles.modalItemText}>That's literally the point.</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalBtn}
              onPress={handleDismissWelcome}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBtnText}>Got it. Let's go.</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    fontFamily: "VT323_400Regular",
    fontSize: 48,
    color: C.amber,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.muted,
    fontStyle: "italic",
    marginTop: 4,
  },

  headline: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    color: C.text,
    marginBottom: 16,
  },

  // Warning card
  warningCard: {
    flexDirection: "row",
    backgroundColor: C.amberTint,
    borderWidth: 1,
    borderColor: C.amberBorder,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    alignItems: "flex-start",
  },
  warningIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  warningBody: {
    flex: 1,
    gap: 4,
  },
  warningTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: C.amber,
  },
  warningText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.text,
    lineHeight: 19,
    opacity: 0.85,
  },

  // Form card
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    gap: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 20,
  },

  // Fields
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  fieldHint: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
    opacity: 0.8,
  },

  // Input row
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  inputRowSuccess: {
    borderColor: C.success,
  },
  inputRowError: {
    borderColor: C.error,
  },
  inputPrefix: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
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
  eyeBtn: {
    paddingLeft: 8,
  },
  nameIndicator: {
    marginLeft: 6,
  },
  nameStatusText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
  },

  // Strength bar
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  strengthBar: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
  },
  strengthSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    minWidth: 80,
  },

  // Error
  error: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.amber,
    marginTop: -4,
  },

  // Button
  btn: {
    backgroundColor: C.amber,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 2,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: C.bg,
  },

  // Login link
  loginLink: {
    alignItems: "center",
  },
  loginLinkText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.amber,
  },

  // Welcome modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 24,
    color: C.text,
    marginBottom: 20,
  },
  modalBody: {
    gap: 18,
    marginBottom: 28,
  },
  modalIntro: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.muted,
  },
  modalItem: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  modalEmoji: {
    fontSize: 20,
    lineHeight: 24,
    marginTop: 1,
  },
  modalItemBody: {
    flex: 1,
    gap: 3,
  },
  modalItemTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: C.text,
  },
  modalItemText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    lineHeight: 18,
  },
  modalBtn: {
    backgroundColor: C.amber,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: C.bg,
  },
});
