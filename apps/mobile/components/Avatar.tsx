import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  screenname: string;
  color: string;
  size?: number;
  statusDot?: string; // hex color of status dot
  onPress?: () => void;
}

export default function Avatar({ screenname, color, size = 32, statusDot, onPress }: Props) {
  const initial = (screenname?.[0] ?? "?").toUpperCase();
  const fontSize = Math.round(size * 0.42);

  const content = (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + "22", borderColor: color + "55" }]}>
      <Text style={[styles.initial, { fontSize, color }]}>{initial}</Text>
      {statusDot && (
        <View
          style={[
            styles.dot,
            {
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
              backgroundColor: statusDot,
              bottom: -1,
              right: -1,
            },
          ]}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={6}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
  },
  initial: {
    fontFamily: "DMSans_700Bold",
  },
  dot: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#0f0e0c",
  },
});
