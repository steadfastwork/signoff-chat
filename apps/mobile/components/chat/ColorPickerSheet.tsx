import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { DM_COLOR_PALETTE, DM_FONT_SIZES, type DMFontSize } from "@/lib/dmColors";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  sheetRef: React.RefObject<BottomSheet>;
  currentColor: string;
  currentSize: DMFontSize;
  onColorChange: (hex: string) => void;
  onSizeChange: (size: DMFontSize) => void;
}

// ---------------------------------------------------------------------------
// ColorPickerSheet
// ---------------------------------------------------------------------------

export default function ColorPickerSheet({
  sheetRef,
  currentColor,
  currentSize,
  onColorChange,
  onSizeChange,
}: Props) {
  const snapPoints = ["35%"];

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        {/* Heading */}
        <Text style={styles.heading}>Your text color</Text>

        {/* Color swatches */}
        <View style={styles.swatchRow}>
          {DM_COLOR_PALETTE.map((c) => {
            const isActive = c.hex === currentColor;
            return (
              <TouchableOpacity
                key={c.hex}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  onColorChange(c.hex);
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: c.hex },
                  isActive ? styles.swatchActive : styles.swatchInactive,
                  isActive && { transform: [{ scale: 1.15 }] },
                ]}
                activeOpacity={0.8}
                accessibilityLabel={c.label}
              />
            );
          })}
        </View>

        {/* Font size pills */}
        <View style={styles.sizeRow}>
          {(Object.entries(DM_FONT_SIZES) as [DMFontSize, { px: number; label: string }][]).map(
            ([key, val]) => {
              const isActive = key === currentSize;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => onSizeChange(key)}
                  style={[styles.sizePill, isActive ? styles.sizePillActive : styles.sizePillInactive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sizePillText, isActive ? styles.sizePillTextActive : styles.sizePillTextInactive]}>
                    {val.label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        {/* Done button */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => sheetRef.current?.close()}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: "#191714",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    backgroundColor: "#3a3830",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  heading: {
    fontSize: 12,
    color: "#6a6860",
    marginBottom: 14,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  swatchInactive: {
    borderWidth: 2,
    borderColor: "transparent",
  },
  sizeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  sizePill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  sizePillActive: {
    backgroundColor: "#1a1200",
    borderColor: "#8a6010",
  },
  sizePillInactive: {
    backgroundColor: "transparent",
    borderColor: "#2c2820",
  },
  sizePillText: {
    fontSize: 14,
    fontWeight: "700",
  },
  sizePillTextActive: {
    color: "#c8860a",
  },
  sizePillTextInactive: {
    color: "#6a6860",
  },
  doneBtn: {
    backgroundColor: "#c8860a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
