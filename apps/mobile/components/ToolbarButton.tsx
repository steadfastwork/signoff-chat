import { TouchableOpacity, Text, StyleSheet } from "react-native";

interface Props {
  label: string;
  onPress?: () => void;
  active?: boolean;
}

export function ToolbarButton({ label, onPress, active }: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, active && styles.btnActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2c2820",
    backgroundColor: "#191714",
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: {
    borderColor: "#f5c842",
    backgroundColor: "rgba(245,200,66,0.07)",
  },
  label: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "#7a7060",
  },
  labelActive: {
    color: "#f5c842",
  },
});
