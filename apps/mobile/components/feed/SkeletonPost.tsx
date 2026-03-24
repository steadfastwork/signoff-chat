import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

function Bone({ width, height, radius = 6 }: { width: number | string; height: number; radius?: number }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        style,
        {
          width: width as number,
          height,
          borderRadius: radius,
          backgroundColor: "#2c2820",
        },
      ]}
    />
  );
}

export default function SkeletonPost() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Bone width={36} height={36} radius={18} />
        <View style={styles.meta}>
          <Bone width={100} height={12} />
          <Bone width={60} height={10} />
        </View>
      </View>
      <View style={styles.lines}>
        <Bone width="100%" height={12} />
        <Bone width="85%" height={12} />
        <Bone width="60%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1c18",
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  meta: { gap: 6 },
  lines: { gap: 8 },
});
