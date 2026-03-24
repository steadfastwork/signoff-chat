import { forwardRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// SafetySheet — universal Block / Mute / Report bottom sheet.
// Used from PostCard "...", ChannelMessage "...", and Profile view.
//
// Philosophy: user controls first.
// Block/mute: immediate, silent, no notification to target.
// Report: goes to staff review queue. CSAM triggers immediate alert.
// ---------------------------------------------------------------------------

const C = {
  bg:          "#191714",
  amber:       "#f5c842",
  amberTint:   "rgba(245,200,66,0.08)",
  amberBorder: "rgba(245,200,66,0.25)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  danger:      "#e05252",
  dangerTint:  "rgba(224,82,82,0.08)",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

type ReportReason = "SPAM" | "HARASSMENT" | "CSAM" | "THREAT" | "IMPERSONATION" | "OTHER";
type TargetType   = "user" | "post" | "message";

export interface SafetyTarget {
  /** Screenname of the content author — displayed in sheet title */
  screenname: string;
  /** For block/mute calls */
  screenname_lower: string;
  /** Report target */
  targetType: TargetType;
  targetId:   string;
}

interface Props {
  target: SafetyTarget | null;
  onBlockConfirmed?: () => void;
  onMuteConfirmed?:  () => void;
}

type View = "menu" | "report-reasons" | "report-confirm" | "done";

const REPORT_REASONS: { key: ReportReason; label: string; desc: string }[] = [
  { key: "SPAM",          label: "Spam",           desc: "Repetitive or unwanted content." },
  { key: "HARASSMENT",    label: "Harassment",      desc: "Targeted abuse or intimidation." },
  { key: "THREAT",        label: "Threat",          desc: "Credible threat of harm." },
  { key: "IMPERSONATION", label: "Impersonation",   desc: "Pretending to be someone else." },
  { key: "CSAM",          label: "Child safety",    desc: "Content involving minors." },
  { key: "OTHER",         label: "Other",           desc: "Something else." },
];

const SafetySheet = forwardRef<BottomSheet, Props>(
  ({ target, onBlockConfirmed, onMuteConfirmed }, ref) => {
    const [view,           setView]           = useState<View>("menu");
    const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
    const [loading,        setLoading]        = useState(false);

    const reset = useCallback(() => {
      setView("menu");
      setSelectedReason(null);
      setLoading(false);
    }, []);

    const close = useCallback(() => {
      (ref as React.RefObject<BottomSheet>)?.current?.close();
      setTimeout(reset, 300);
    }, [ref, reset]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.55}
        />
      ),
      []
    );

    // ── Block ──────────────────────────────────────────────────────────────
    const handleBlock = useCallback(async () => {
      if (!target) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      try {
        await fetch(`${API}/api/users/${target.screenname_lower}/block`, {
          method: "POST",
        });
        onBlockConfirmed?.();
        close();
      } finally {
        setLoading(false);
      }
    }, [target, onBlockConfirmed, close]);

    // ── Mute ───────────────────────────────────────────────────────────────
    const handleMute = useCallback(async () => {
      if (!target) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLoading(true);
      try {
        await fetch(`${API}/api/users/${target.screenname_lower}/mute`, {
          method: "POST",
        });
        onMuteConfirmed?.();
        close();
      } finally {
        setLoading(false);
      }
    }, [target, onMuteConfirmed, close]);

    // ── Report ─────────────────────────────────────────────────────────────
    const handleReport = useCallback(async () => {
      if (!target || !selectedReason) return;
      setLoading(true);
      try {
        await fetch(`${API}/api/reports`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType: target.targetType,
            targetId:   target.targetId,
            reason:     selectedReason,
          }),
        });
        setView("done");
      } finally {
        setLoading(false);
      }
    }, [target, selectedReason]);

    if (!target) return null;

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={["45%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheet}
        handleIndicatorStyle={{ backgroundColor: C.muted, width: 36 }}
        onChange={(idx) => { if (idx === -1) reset(); }}
      >
        <BottomSheetView style={styles.content}>
          {/* ── Menu view ── */}
          {view === "menu" && (
            <>
              <Text style={styles.title}>@{target.screenname}</Text>

              <View style={styles.actions}>
                {/* Mute — softest action */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={handleMute}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  {loading
                    ? <ActivityIndicator size="small" color={C.muted} />
                    : <Text style={styles.actionIcon}>🔇</Text>}
                  <View style={styles.actionText}>
                    <Text style={styles.actionLabel}>Mute @{target.screenname}</Text>
                    <Text style={styles.actionDesc}>
                      Their posts disappear from your feed. They won't know.
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* Block — stronger */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={handleBlock}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionIcon}>🚫</Text>
                  <View style={styles.actionText}>
                    <Text style={[styles.actionLabel, { color: C.danger }]}>
                      Block @{target.screenname}
                    </Text>
                    <Text style={styles.actionDesc}>
                      Neither of you sees the other. Removes buddy connection.
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* Report — escalates to staff */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => setView("report-reasons")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionIcon}>🚨</Text>
                  <View style={styles.actionText}>
                    <Text style={styles.actionLabel}>Report</Text>
                    <Text style={styles.actionDesc}>
                      Send to our review team. Anonymous to the reported user.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={close}>
                <Text style={styles.cancelText}>cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Report reasons ── */}
          {view === "report-reasons" && (
            <>
              <View style={styles.backRow}>
                <TouchableOpacity onPress={() => setView("menu")} hitSlop={8}>
                  <Text style={styles.backText}>← back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Report reason</Text>
                <View style={{ width: 40 }} />
              </View>

              <View style={styles.actions}>
                {REPORT_REASONS.map((r, i) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.reasonRow,
                      selectedReason === r.key && styles.reasonRowActive,
                      i < REPORT_REASONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                    ]}
                    onPress={() => { setSelectedReason(r.key); setView("report-confirm"); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.actionText}>
                      <Text style={styles.actionLabel}>{r.label}</Text>
                      <Text style={styles.actionDesc}>{r.desc}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── Report confirm ── */}
          {view === "report-confirm" && selectedReason && (
            <>
              <View style={styles.backRow}>
                <TouchableOpacity onPress={() => setView("report-reasons")} hitSlop={8}>
                  <Text style={styles.backText}>← back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Confirm report</Text>
                <View style={{ width: 40 }} />
              </View>

              <View style={[styles.confirmCard, selectedReason === "CSAM" && styles.confirmCardUrgent]}>
                <Text style={styles.confirmReason}>
                  {REPORT_REASONS.find((r) => r.key === selectedReason)?.label}
                </Text>
                <Text style={styles.confirmDesc}>
                  {selectedReason === "CSAM"
                    ? "This will send an immediate high-priority alert to our trust and safety team."
                    : "This will be reviewed by our trust and safety team. The reported user won't be notified."}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.reportBtn, loading && { opacity: 0.55 }]}
                onPress={handleReport}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#0f0e0c" />
                  : <Text style={styles.reportBtnText}>Submit report</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={close}>
                <Text style={styles.cancelText}>cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Done ── */}
          {view === "done" && (
            <>
              <Text style={[styles.title, { textAlign: "center" }]}>
                Report sent ✓
              </Text>
              <Text style={styles.doneDesc}>
                Our team will review it. Thank you for keeping the community safe.
              </Text>
              <TouchableOpacity style={styles.doneBtn} onPress={close} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

SafetySheet.displayName = "SafetySheet";
export default SafetySheet;

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
  content: { paddingHorizontal: 20, paddingBottom: 28, gap: 16 },

  title: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: C.text,
  },

  backRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.muted },

  actions: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  actionIcon: { fontSize: 20, width: 26, textAlign: "center" },
  actionText: { flex: 1, gap: 2 },
  actionLabel: { fontFamily: "DMSans_700Bold", fontSize: 14, color: C.text },
  actionDesc:  { fontFamily: "DMSans_400Regular", fontSize: 12, color: C.muted },
  divider:     { height: 1, backgroundColor: C.border },

  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  reasonRowActive: { backgroundColor: C.amberTint },
  chevron: { fontFamily: "DMSans_400Regular", fontSize: 18, color: C.muted },

  confirmCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  confirmCardUrgent: {
    borderColor: C.danger,
    backgroundColor: C.dangerTint,
  },
  confirmReason: { fontFamily: "DMSans_700Bold", fontSize: 14, color: C.text },
  confirmDesc:   { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.muted, lineHeight: 18 },

  reportBtn: {
    backgroundColor: C.danger,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  reportBtnText: { fontFamily: "DMSans_700Bold", fontSize: 15, color: "#fff" },

  cancelBtn: { alignItems: "center", paddingVertical: 4 },
  cancelText: { fontFamily: "DMSans_400Regular", fontSize: 14, color: C.muted },

  doneDesc: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  doneBtn: {
    backgroundColor: C.amber,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  doneBtnText: { fontFamily: "DMSans_700Bold", fontSize: 15, color: "#0f0e0c" },
});
