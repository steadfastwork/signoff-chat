import { useState } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";

// Small E2E badge shown in the feed header. Tapping it opens a plain-language
// explanation of the encryption used for channel messages.
export default function EncryptionBadge() {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.badge}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.75}
      >
        <Text style={styles.label}>🔒 AES-256 + ML-KEM</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.sheet}>
            <Text style={styles.title}>End-to-end encrypted</Text>
            <Text style={styles.body}>
              Channel messages are encrypted with{" "}
              <Text style={styles.highlight}>AES-256-GCM</Text> using a shared
              key that is itself protected by{" "}
              <Text style={styles.highlight}>ML-KEM</Text> (CRYSTALS-Kyber), a
              post-quantum key encapsulation algorithm. Neither Signoff Chat nor
              anyone else can read your messages — not now, not in the future.
            </Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(92,184,92,0.12)",
    borderWidth: 1,
    borderColor: "rgba(92,184,92,0.3)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  label: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    color: "#5cb85c",
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#191714",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2c2820",
    padding: 24,
    width: "100%",
    maxWidth: 380,
    gap: 16,
  },
  title: {
    fontFamily: "DMSans_700Bold",
    fontSize: 18,
    color: "#e8e4d9",
  },
  body: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#b0aa9a",
    lineHeight: 21,
  },
  highlight: {
    fontFamily: "DMSans_700Bold",
    color: "#5cb85c",
  },
  closeBtn: {
    backgroundColor: "#5cb85c",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  closeBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: "#0f0e0c",
  },
});
