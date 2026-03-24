import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Small E2E badge shown in the feed header.
export default function EncryptionBadge() {
  return (
    <View style={styles.badge}>
      <Ionicons name="lock-closed" size={10} color="#5cb85c" />
      <Text style={styles.label}>e2e</Text>
    </View>
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
});
