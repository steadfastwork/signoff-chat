import { forwardRef, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

// ---------------------------------------------------------------------------
// Invite panel.
// NO creator attribution shown. No "created by [name]". No use count history.
// Just the link. "⏱ expires 24h · max 10 uses · no permanent links"
// ---------------------------------------------------------------------------

const C = {
  bg:          "#191714",
  inputBg:     "#110e0a",
  amber:       "#f5c842",
  amberTint:   "rgba(245,200,66,0.07)",
  amberBorder: "rgba(245,200,66,0.25)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  placeholder: "#4a4438",
  success:     "#5cb85c",
};

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

interface InviteLink {
  token: string;
  usesRemaining: number;
}

interface Props {
  channelName: string;
}

const InvitePanel = forwardRef<BottomSheet, Props>(({ channelName }, ref) => {
  const [invite, setInvite]     = useState<InviteLink | null>(null);
  const [loading, setLoading]   = useState(false);
  const [snQuery, setSnQuery]   = useState("");
  const [snSending, setSnSending] = useState(false);
  const [snSent, setSnSent]     = useState(false);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.55} />
    ),
    []
  );

  const fetchOrCreate = useCallback(async () => {
    setLoading(true);
    try {
      // Try to get existing invite link
      const res = await fetch(`${API}/api/channels/${channelName}/invites`);
      if (res.ok) {
        const data = await res.json();
        const links: InviteLink[] = data.inviteLinks ?? [];
        if (links.length > 0) {
          setInvite(links[0]);
          return;
        }
      }
      // Create new invite link
      const createRes = await fetch(`${API}/api/channels/${channelName}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (createRes.ok) {
        const data = await createRes.json();
        setInvite({ token: data.token, usesRemaining: data.usesRemaining });
      }
    } finally {
      setLoading(false);
    }
  }, [channelName]);

  const handleShare = async () => {
    if (!invite) return;
    const link = `${API}/invite/${invite.token}`;
    await Share.share({ message: link, title: `Join #${channelName} on Signoff Chat` });
  };

  const handleInviteByScreenname = async () => {
    if (!snQuery.trim() || !invite) return;
    setSnSending(true);
    try {
      await fetch(`${API}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toScreenname: snQuery.trim(),
          content: `You've been invited to join #${channelName} → ${API}/invite/${invite.token}`,
        }),
      });
      setSnSent(true);
      setSnQuery("");
    } finally {
      setSnSending(false);
    }
  };

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={["52%"]}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheet}
      handleIndicatorStyle={{ backgroundColor: C.muted, width: 36 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={(idx) => { if (idx === 0 && !invite) fetchOrCreate(); }}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>invite to #{channelName}</Text>

        {/* Policy notice */}
        <View style={styles.policyRow}>
          <Text style={styles.policyText}>
            ⏱ expires 24h · max 10 uses · no permanent links
          </Text>
        </View>

        {/* Invite link */}
        {loading ? (
          <ActivityIndicator color={C.amber} />
        ) : invite ? (
          <View style={styles.linkCard}>
            <View style={styles.linkRow}>
              <Text style={styles.linkToken} numberOfLines={1} selectable>
                {`${API}/invite/${invite.token}`}
              </Text>
            </View>
            <View style={styles.linkMeta}>
              <Text style={styles.usesText}>{invite.usesRemaining} uses remaining</Text>
            </View>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={styles.shareBtnText}>Share link</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Invite by screenname */}
        <Text style={styles.sectionLabel}>invite by screenname</Text>
        <View style={styles.snRow}>
          <View style={styles.snInputWrap}>
            <Text style={styles.atPrefix}>@</Text>
            <BottomSheetTextInput
              style={styles.snInput}
              placeholder="screenname"
              placeholderTextColor={C.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              value={snQuery}
              onChangeText={(v) => { setSnQuery(v); setSnSent(false); }}
            />
          </View>
          <TouchableOpacity
            style={[styles.snBtn, (!snQuery.trim() || snSending) && { opacity: 0.4 }]}
            onPress={handleInviteByScreenname}
            disabled={!snQuery.trim() || snSending}
            activeOpacity={0.85}
          >
            {snSending
              ? <ActivityIndicator size="small" color="#0f0e0c" />
              : <Text style={styles.snBtnText}>Send</Text>}
          </TouchableOpacity>
        </View>
        {snSent && <Text style={styles.snSent}>invite sent ✓</Text>}

        {/* No attribution note */}
        {/* Deliberately no "created by" or "generated by" text. */}
      </BottomSheetView>
    </BottomSheet>
  );
});

InvitePanel.displayName = "InvitePanel";
export default InvitePanel;

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
  title:   { fontFamily: "DMSans_700Bold", fontSize: 18, color: C.text },

  policyRow: {
    backgroundColor: C.amberTint,
    borderWidth: 1,
    borderColor: C.amberBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  policyText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: C.amber },

  linkCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    backgroundColor: "#111009",
  },
  linkRow: { flexDirection: "row", alignItems: "center" },
  linkToken: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 13, color: C.text },
  linkMeta: {},
  usesText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: C.muted },
  shareBtn: { backgroundColor: C.amber, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  shareBtnText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: "#0f0e0c" },

  divider: { height: 1, backgroundColor: C.border },
  sectionLabel: { fontFamily: "DMSans_700Bold", fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 },

  snRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  snInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  atPrefix: { fontFamily: "DMSans_700Bold", fontSize: 16, color: C.amber, marginRight: 3 },
  snInput: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 15, color: C.text, paddingVertical: 11 },
  snBtn:    { backgroundColor: C.amber, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11, alignItems: "center", minWidth: 72 },
  snBtnText:{ fontFamily: "DMSans_700Bold", fontSize: 14, color: "#0f0e0c" },
  snSent:   { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.success },
});
