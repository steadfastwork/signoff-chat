import { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";

const C = {
  bg:          "#0f0e0c",
  amber:       "#f5c842",
  amberDim:    "rgba(245,200,66,0.12)",
  amberBorder: "rgba(245,200,66,0.3)",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
};

export type FilterTag = "all" | "AWAY" | "THOUGHT" | "QUOTE" | "PHOTO" | string;

const FIXED_FILTERS: { label: string; value: FilterTag }[] = [
  { label: "all",      value: "all" },
  { label: "✦ away",  value: "AWAY" },
  { label: "✍ thought",value: "THOUGHT" },
  { label: "❝ quote", value: "QUOTE" },
  { label: "📷 photo", value: "PHOTO" },
];

interface Props {
  active:      FilterTag;
  tags?:       string[];
  onSelect:    (tag: FilterTag) => void;
}

export default function TagFilterPills({ active, tags = [], onSelect }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  const pills = [
    ...FIXED_FILTERS,
    ...tags.map((t) => ({ label: `#${t}`, value: t as FilterTag })),
  ];

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {pills.map(({ label, value }) => {
        const isActive = active === value;
        return (
          <TouchableOpacity
            key={value}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onSelect(value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
    flexDirection: "row",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "transparent",
  },
  pillActive: {
    borderColor: C.amberBorder,
    backgroundColor: C.amberDim,
  },
  pillText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
  pillTextActive: {
    fontFamily: "DMSans_700Bold",
    color: C.amber,
  },
});
