import { useState } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { login } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Warm palette — auth screens feel human, not terminal
// ---------------------------------------------------------------------------
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

export default function LoginScreen() {
  const router = useRouter();
  const [screenname, setScreenname] = useState("");
  const [password, setPassword]     = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleLogin = async () => {
    const name = screenname.trim();
    if (!name || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(name, password);
      router.replace("/(app)/(tabs)/feed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
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

        {/* ── Card ── */}
        <View style={styles.card}>

          {/* Screenname */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>your screenname</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="coolperson99"
                placeholderTextColor={C.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="next"
                value={screenname}
                onChangeText={setScreenname}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={C.placeholder}
                secureTextEntry={!showPw}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPw((v) => !v)}
                hitSlop={8}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPw ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={C.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error && (
            <Text style={styles.error}>{error}</Text>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.btnInner}>
                <ActivityIndicator size="small" color={C.bg} style={{ marginRight: 8 }} />
                <Text style={styles.btnText}>Signing in...</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Below card ── */}
        <TouchableOpacity
          onPress={() => router.push("/(auth)/register")}
          activeOpacity={0.7}
          style={styles.registerLink}
        >
          <Text style={styles.registerLinkText}>
            New here? Get a screenname →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 36,
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

  // Card
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
  },

  // Fields
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
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

  // Register link
  registerLink: {
    alignItems: "center",
    marginTop: 24,
  },
  registerLinkText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.amber,
  },
});
