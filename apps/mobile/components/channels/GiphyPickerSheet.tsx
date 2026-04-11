import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

const C = {
  bg:          "#0f0e0c",
  surface:     "#191714",
  amber:       "#f5c842",
  text:        "#e8e4d9",
  muted:       "#7a7060",
  border:      "#2c2820",
  placeholder: "#4a4438",
};

export interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  title: string;
}

async function fetchGifs(type: "trending" | "search", q?: string): Promise<GifResult[]> {
  const params = new URLSearchParams({ type, limit: "24" });
  if (type === "search" && q) params.set("q", q);
  const res = await fetch(`${API}/api/giphy?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.gifs ?? [];
}

interface Props {
  onSelect: (gif: GifResult) => void;
}

const GiphyPickerSheet = forwardRef<BottomSheet, Props>(({ onSelect }, ref) => {
  const [query,    setQuery]   = useState("");
  const [gifs,     setGifs]    = useState<GifResult[]>([]);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((type: "trending" | "search", q?: string) => {
    setLoading(true);
    setError(false);
    fetchGifs(type, q)
      .then(setGifs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Load trending on mount
  useEffect(() => { load("trending"); }, [load]);

  // Debounced search on query change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      load(query.trim() ? "search" : "trending", query.trim() || undefined);
    }, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, load]);

  return (
    <BottomSheet
      ref={ref}
      snapPoints={["55%"]}
      index={-1}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: C.surface }}
      handleIndicatorStyle={{ backgroundColor: C.muted }}
    >
      <BottomSheetView style={styles.container}>
        {/* Search input */}
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="search GIFs…"
            placeholderTextColor={C.placeholder}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Grid */}
        {loading ? (
          <ActivityIndicator color={C.amber} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.emptyText}>could not load GIFs</Text>
        ) : gifs.length === 0 ? (
          <Text style={styles.emptyText}>no GIFs found</Text>
        ) : (
          <FlatList
            data={gifs}
            keyExtractor={(g) => g.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item);
                  (ref as React.RefObject<BottomSheet>).current?.close();
                }}
                style={styles.gifCell}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: item.previewUrl }}
                  style={styles.gifImage}
                  contentFit="cover"
                  transition={100}
                />
              </TouchableOpacity>
            )}
          />
        )}

        <Text style={styles.attribution}>Powered by GIPHY</Text>
      </BottomSheetView>
    </BottomSheet>
  );
});

GiphyPickerSheet.displayName = "GiphyPickerSheet";
export default GiphyPickerSheet;

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 4 },

  searchRow: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: "#110e0a",
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.text,
  },

  grid: { paddingHorizontal: 6, paddingBottom: 16 },
  gifCell: { flex: 1, margin: 3, borderRadius: 8, overflow: "hidden" },
  gifImage: { width: "100%", aspectRatio: 1, backgroundColor: "#1a1a0e" },

  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
    marginTop: 40,
  },

  attribution: {
    fontFamily: "DMSans_400Regular",
    fontSize: 9,
    color: C.muted,
    textAlign: "center",
    paddingBottom: 8,
    opacity: 0.5,
  },
});
