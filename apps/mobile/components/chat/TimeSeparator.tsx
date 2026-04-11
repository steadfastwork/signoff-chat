import { View, Text, StyleSheet } from "react-native";

interface Props { label: string }

export default function TimeSeparator({ label }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  line: { flex: 1, height: 1, backgroundColor: "#1e1e1a" },
  labelContainer: {
    backgroundColor: "#1c1e26",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  label: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: "#6a6860",
    fontWeight: "500",
  },
});
