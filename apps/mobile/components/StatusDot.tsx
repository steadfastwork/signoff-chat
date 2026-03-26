import { View, StyleSheet } from "react-native";

type Status = "ONLINE" | "AWAY" | "IDLE" | "OFFLINE" | "INVISIBLE";
type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 8, md: 10, lg: 12 };

const STATUS_COLOR: Record<Status, string> = {
  ONLINE:    "#22c55e",
  AWAY:      "#f59e0b",
  IDLE:      "#6a6860",
  OFFLINE:   "#3a3a34",
  INVISIBLE: "#3a3a34",
};

interface Props {
  status: Status;
  size?: Size;
}

export function StatusDot({ status, size = "md" }: Props) {
  const px = SIZE_PX[size];
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.OFFLINE;

  return (
    <View
      style={[
        styles.dot,
        {
          width:           px,
          height:          px,
          borderRadius:    px / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    // No text, no timestamp — purely a colored circle.
  },
});
