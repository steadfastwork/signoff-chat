import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as SQLite from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";
import { getSession, clearSession } from "@/lib/session";

// ---------------------------------------------------------------------------
// Edit profile.
// Photo upload: Gold members only.
// DANGER ZONE: account deletion with screenname confirmation.
// ---------------------------------------------------------------------------

const C = {
  bg:          "#0f0e0c",
  card:        "#191714",
  amber:       "#f5c842",
  amberTint:   "rgba(245,200,66,0.08)",
  amberBorder: "rgba(245,200,66,0.25)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  inputBg:     "#110e0a",
  placeholder: "#4a4438",
  danger:      "#e05252",
  dangerTint:  "rgba(224,82,82,0.08)",
  dangerBorder:"rgba(224,82,82,0.3)",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ProfileData {
  screenname:  string;
  bio:         string;
  awayMessage: string;
  isGoldMember: boolean;
  avatarUrl:   string | null;
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// ── Collapsible password section ──────────────────────────────────────────────
function PasswordSection() {
  const [open,        setOpen]        = useState(false);
  const [current,     setCurrent]     = useState("");
  const [next,        setNext]        = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext,    setShowNext]    = useState(false);

  const handleSave = useCallback(async () => {
    if (!current || !next) { setError("fill in all fields."); return; }
    if (next.length < 8)   { setError("password must be at least 8 characters."); return; }
    if (next !== confirm)  { setError("passwords don't match."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/profile/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "couldn't change password.");
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  }, [current, next, confirm]);

  return (
    <View style={styles.passwordSection}>
      <TouchableOpacity
        style={styles.passwordToggle}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.passwordToggleText}>Change password</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={C.muted}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.passwordFields}>
          {/* Current */}
          <View style={styles.passwordInputRow}>
            <BottomSheetTextInput
              style={styles.passwordInput}
              placeholder="current password"
              placeholderTextColor={C.placeholder}
              secureTextEntry={!showCurrent}
              value={current}
              onChangeText={setCurrent}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowCurrent((v) => !v)} hitSlop={6}>
              <Ionicons name={showCurrent ? "eye-off" : "eye"} size={18} color={C.muted} />
            </TouchableOpacity>
          </View>

          {/* New */}
          <View style={styles.passwordInputRow}>
            <BottomSheetTextInput
              style={styles.passwordInput}
              placeholder="new password"
              placeholderTextColor={C.placeholder}
              secureTextEntry={!showNext}
              value={next}
              onChangeText={setNext}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowNext((v) => !v)} hitSlop={6}>
              <Ionicons name={showNext ? "eye-off" : "eye"} size={18} color={C.muted} />
            </TouchableOpacity>
          </View>

          {/* Confirm */}
          <BottomSheetTextInput
            style={[styles.passwordInputRow, { paddingRight: 14 }]}
            placeholder="confirm new password"
            placeholderTextColor={C.placeholder}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
          />

          {error   && <Text style={styles.fieldError}>{error}</Text>}
          {success && <Text style={styles.fieldSuccess}>password changed ✓</Text>}

          <TouchableOpacity
            style={[styles.passwordSaveBtn, saving && { opacity: 0.55 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator size="small" color="#0f0e0c" />
              : <Text style={styles.passwordSaveBtnText}>Update password</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Delete confirmation bottom sheet ─────────────────────────────────────────
const DeleteSheet = forwardRef<
  BottomSheet,
  { screenname: string; onDeleted: () => void }
>(({ screenname, onDeleted }, ref) => {
  const [input,    setInput]    = useState("");
  const [deleting, setDeleting] = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    []
  );

  const confirmed = input.trim().toLowerCase() === screenname.toLowerCase();

  const handleDelete = useCallback(async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = await fetch(`${API}/api/profile`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "deletion failed. try again.");
        return;
      }
      setDone(true);
      // Small pause so the user reads the confirmation message
      setTimeout(onDeleted, 2400);
    } finally {
      setDeleting(false);
    }
  }, [confirmed, deleting, onDeleted]);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={["62%"]}
      enablePanDownToClose={!deleting && !done}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.deleteSheet}
      handleIndicatorStyle={{ backgroundColor: C.muted, width: 36 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={(idx) => { if (idx === -1) { setInput(""); setError(null); } }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.deleteSheetContent}>
        {!done ? (
          <>
            <Text style={styles.deleteTitle}>This is permanent.</Text>

            <Text style={styles.deleteBody}>
              Your account, posts, buddies, messages, and history are deleted from
              our servers immediately. There is no undo. This is by design.
            </Text>

            <View style={styles.deleteConfirmWrap}>
              <Text style={styles.deleteConfirmLabel}>
                type <Text style={styles.deleteConfirmScreenname}>{screenname}</Text> to confirm
              </Text>
              <BottomSheetTextInput
                style={[
                  styles.deleteConfirmInput,
                  confirmed && { borderColor: C.danger },
                ]}
                placeholder={screenname}
                placeholderTextColor={C.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                value={input}
                onChangeText={setInput}
              />
            </View>

            {error && <Text style={styles.deleteError}>{error}</Text>}

            <TouchableOpacity
              style={[
                styles.deleteBtn,
                (!confirmed || deleting) && { opacity: 0.35 },
              ]}
              onPress={handleDelete}
              disabled={!confirmed || deleting}
              activeOpacity={0.85}
            >
              {deleting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.deleteBtnText}>Delete everything</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => (ref as React.RefObject<BottomSheet>)?.current?.close()}
              style={styles.deleteCancelBtn}
              disabled={deleting}
            >
              <Text style={styles.deleteCancelText}>cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.deleteDone}>
            <Text style={styles.deleteDoneTitle}>
              Your account has been permanently deleted.
            </Text>
            <Text style={styles.deleteDoneBody}>
              Everything is gone. Take care.
            </Text>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});
DeleteSheet.displayName = "DeleteSheet";

// ── Main screen ───────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const deleteRef = useRef<BottomSheet>(null);

  const [profile,     setProfile]     = useState<ProfileData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [bio,         setBio]         = useState("");
  const [awayMessage, setAwayMessage] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [photoUri,    setPhotoUri]    = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/profile`);
        if (res.ok) {
          const d = await res.json();
          setProfile(d);
          setBio(d.bio ?? "");
          setAwayMessage(d.awayMessage ?? "");
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Photo upload (Gold only) ──────────────────────────────────────────────
  const handlePickPhoto = useCallback(async () => {
    if (!profile?.isGoldMember) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }, [profile?.isGoldMember]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        bio:         bio.trim(),
        awayMessage: awayMessage.trim(),
      };
      if (photoUri) body.avatarUrl = photoUri;

      const res = await fetch(`${API}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error ?? "save failed.");
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setSaveError("couldn't save. check your connection.");
    } finally {
      setSaving(false);
    }
  }, [bio, awayMessage, photoUri, router]);

  // ── After account deleted ─────────────────────────────────────────────────
  const handleDeleted = useCallback(async () => {
    // Clear session token
    await clearSession();
    // Delete local SQLite databases entirely
    try {
      await SQLite.deleteDatabaseAsync("signoff_messages.db");
      await SQLite.deleteDatabaseAsync("signoff_posts.db");
    } catch {}
    router.replace("/(auth)/login");
  }, [router]);

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.amber} />
      </View>
    );
  }

  const screenname = profile?.screenname ?? "";

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Photo upload ── */}
          <View style={styles.section}>
            <SectionLabel>PROFILE PHOTO</SectionLabel>
            <TouchableOpacity
              style={[
                styles.photoBtn,
                !profile?.isGoldMember && styles.photoBtnDisabled,
              ]}
              onPress={handlePickPhoto}
              disabled={!profile?.isGoldMember}
              activeOpacity={0.7}
            >
              {photoUri ? (
                <Text style={styles.photoUri} numberOfLines={1}>{photoUri.split("/").pop()}</Text>
              ) : (
                <Text style={[styles.photoBtnText, !profile?.isGoldMember && { color: C.muted }]}>
                  {profile?.isGoldMember ? "Choose photo…" : "★ Gold members only"}
                </Text>
              )}
              <Ionicons
                name="image-outline"
                size={18}
                color={profile?.isGoldMember ? C.amber : C.muted}
              />
            </TouchableOpacity>
            {!profile?.isGoldMember && (
              <TouchableOpacity onPress={() => router.push("/(app)/upgrade")}>
                <Text style={styles.goldHint}>upgrade to Gold to set a profile photo →</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Bio ── */}
          <View style={styles.section}>
            <SectionLabel>BIO</SectionLabel>
            <View style={styles.inputWrap}>
              <TextAreaField
                value={bio}
                onChangeText={setBio}
                maxLength={160}
                placeholder="tell the world who you are"
              />
            </View>
            <Text style={styles.charCount}>{bio.length}/160</Text>
          </View>

          {/* ── Away message ── */}
          <View style={styles.section}>
            <SectionLabel>AWAY MESSAGE</SectionLabel>
            <View style={styles.inputWrap}>
              <TextAreaField
                value={awayMessage}
                onChangeText={setAwayMessage}
                maxLength={140}
                placeholder="brb, grabbing coffee"
                multiline={false}
              />
            </View>
            <Text style={styles.charCount}>{awayMessage.length}/140</Text>
          </View>

          {/* ── Password change ── */}
          <View style={styles.section}>
            <SectionLabel>SECURITY</SectionLabel>
            <PasswordSection />
          </View>

          {/* Save error */}
          {saveError && <Text style={styles.saveError}>{saveError}</Text>}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color="#0f0e0c" />
              : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>

          {/* ── DANGER ZONE ── */}
          <View style={styles.dangerDivider}>
            <View style={styles.dangerLine} />
            <Text style={styles.dangerDividerLabel}>DANGER ZONE</Text>
            <View style={styles.dangerLine} />
          </View>

          <View style={styles.dangerZone}>
            <View style={styles.dangerInfo}>
              <Text style={styles.dangerTitle}>Delete account</Text>
              <Text style={styles.dangerDesc}>
                Permanently removes your account and all associated data from our servers.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() => deleteRef.current?.expand()}
              activeOpacity={0.8}
            >
              <Text style={styles.dangerBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete confirmation sheet */}
      <DeleteSheet
        ref={deleteRef}
        screenname={screenname}
        onDeleted={handleDeleted}
      />
    </>
  );
}

// ── TextInput wrapper ─────────────────────────────────────────────────────────
function TextAreaField({
  value,
  onChangeText,
  maxLength,
  placeholder,
  multiline = true,
}: {
  value: string;
  onChangeText: (v: string) => void;
  maxLength: number;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <TextInput
      style={[styles.fieldInput, multiline && { minHeight: 80, textAlignVertical: "top" }]}
      value={value}
      onChangeText={onChangeText}
      maxLength={maxLength}
      placeholder={placeholder}
      placeholderTextColor={C.placeholder}
      multiline={multiline}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2c2820",
  },
  headerTitle: { fontFamily: "DMSans_700Bold", fontSize: 17, color: C.text },

  body: { paddingHorizontal: 20, paddingTop: 24, gap: 24 },

  section: { gap: 8 },
  sectionLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Photo
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  photoBtnDisabled: { opacity: 0.6 },
  photoBtnText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: C.amber },
  photoUri: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.text,
    marginRight: 8,
  },
  goldHint: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.amber,
    opacity: 0.8,
  },

  // Inputs
  inputWrap: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
  },
  fieldInput: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  charCount: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
    textAlign: "right",
  },

  // Password
  passwordSection: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  passwordToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  passwordToggleText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
  },
  passwordFields: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  passwordInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    paddingVertical: 11,
  },
  fieldError:   { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.danger },
  fieldSuccess: { fontFamily: "DMSans_400Regular", fontSize: 13, color: "#4caf50" },
  passwordSaveBtn: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  passwordSaveBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: C.text,
  },

  // Save
  saveError: { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.danger },
  saveBtn: {
    backgroundColor: C.amber,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { fontFamily: "DMSans_700Bold", fontSize: 16, color: "#0f0e0c" },

  // Danger zone
  dangerDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  dangerLine: { flex: 1, height: 1, backgroundColor: "#3a1f1f" },
  dangerDividerLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: "#7a4040",
    letterSpacing: 1,
  },
  dangerZone: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.dangerTint,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  dangerInfo: { flex: 1, gap: 3 },
  dangerTitle: { fontFamily: "DMSans_700Bold", fontSize: 14, color: C.danger },
  dangerDesc: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#7a4040",
    lineHeight: 17,
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: C.dangerBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  dangerBtnText: { fontFamily: "DMSans_700Bold", fontSize: 13, color: C.danger },

  // Delete sheet
  deleteSheet: {
    backgroundColor: "#110a0a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#3a1a1a",
  },
  deleteSheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    gap: 20,
  },
  deleteTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    color: C.danger,
    marginTop: 4,
  },
  deleteBody: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#c08080",
    lineHeight: 22,
  },
  deleteConfirmWrap: { gap: 8 },
  deleteConfirmLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: "#7a4040",
  },
  deleteConfirmScreenname: {
    fontFamily: "DMSans_700Bold",
    color: C.danger,
  },
  deleteConfirmInput: {
    backgroundColor: "#1a0a0a",
    borderWidth: 1,
    borderColor: "#3a1a1a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.text,
  },
  deleteError: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.danger,
  },
  deleteBtn: {
    backgroundColor: C.danger,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  deleteBtnText: { fontFamily: "DMSans_700Bold", fontSize: 16, color: "#fff" },
  deleteCancelBtn: { alignItems: "center", paddingVertical: 4 },
  deleteCancelText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#7a4040",
  },
  deleteDone: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 16,
  },
  deleteDoneTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 18,
    color: C.text,
    textAlign: "center",
  },
  deleteDoneBody: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.muted,
    textAlign: "center",
  },
});
