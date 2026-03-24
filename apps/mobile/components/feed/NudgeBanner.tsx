import { useEffect } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";

interface Props {
  count: number;
  onPress: () => void;
  onDismiss: () => void;
}

export default function NudgeBanner({ count, onPress, onDismiss }: Props) {
  const translateY = useSharedValue(-60);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    // Slide in
    translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
    opacity.value    = withTiming(1, { duration: 200 });
    // Auto-dismiss after 5s
    const timer = setTimeout(() => {
      translateY.value = withTiming(-60, { duration: 280 });
      opacity.value    = withDelay(200, withTiming(0, { duration: 200 }));
      setTimeout(onDismiss, 500);
    }, 5000);
    return () => clearTimeout(timer);
  }, [count]); // re-trigger on count change

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.banner, style]}>
      <TouchableOpacity
        style={styles.inner}
        onPress={() => {
          onPress();
          onDismiss();
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.text}>
          ↑ {count} new {count === 1 ? "post" : "posts"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
  inner: {
    backgroundColor: "#f5c842",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: "#0f0e0c",
  },
});
