import { forwardRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

const C = {
  bg:     "#191714",
  text:   "#e8e4d9",
  muted:  "#7a7060",
  border: "#2c2820",
  amber:  "#f5c842",
};

const STATUSES = [
  { key: "ONLINE",    label: "Online",    dot: "#4caf50" },
  { key: "AWAY",      label: "Away",      dot: "#ff9800" },
  { key: "IDLE",      label: "Idle",      dot: "#f5c842" },
  { key: "INVISIBLE", label: "Invisible", dot: "#9e9e9e" },
] as const;

type Status = (typeof STATUSES)[number]["key"];

interface Props {
  current: Status | string;
  onChange: (status: Status) => void;
}

const StatusSheet = forwardRef<BottomSheet, Props>(({ current, onChange }, ref) => {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.55} />
    ),
    []
  );

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={["28%"]}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheet}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>set status</Text>
        <View style={styles.grid}>
          {STATUSES.map((s) => {
            const active = current === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.cell, active && styles.cellActive]}
                onPress={() => {
                  onChange(s.key);
                  (ref as React.RefObject<BottomSheet>)?.current?.close();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.dot, { backgroundColor: s.dot }]} />
                <Text style={[styles.cellLabel, active && styles.cellLabelActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
});

StatusSheet.displayName = "StatusSheet";
export default StatusSheet;

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
  handle: { backgroundColor: C.muted, width: 36 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  title: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "47%",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cellActive: {
    borderColor: C.amber,
    backgroundColor: "rgba(245,200,66,0.07)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cellLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
  },
  cellLabelActive: {
    fontFamily: "DMSans_700Bold",
    color: C.amber,
  },
});
