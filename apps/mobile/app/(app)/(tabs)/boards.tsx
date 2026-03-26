import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import type { Board } from "@signoff/types";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function BoardsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Redirect to feed if boards are disabled
  useEffect(() => {
    fetch(`${API}/api/feature-flags/boards`)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((data: { enabled: boolean }) => {
        if (!data.enabled) router.replace("/(app)/(tabs)/feed");
      })
      .catch(() => router.replace("/(app)/(tabs)/feed"));
  }, [router]);

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/boards`);
      if (!res.ok) return;
      const data = await res.json();
      setBoards(data.boards ?? []);
    } catch {}
  }, []);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBoards();
    setRefreshing(false);
  }, [fetchBoards]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.amber }]}>{"// BOARDS"}</Text>
      </View>
      <FlashList
        data={boards}
        estimatedItemSize={72}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.amber}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push(`/(app)/board/${item.name}`)}
            activeOpacity={0.7}
          >
            <Text style={[styles.displayName, { color: colors.text }]}>
              {item.displayName}
            </Text>
            <Text style={[styles.name, { color: colors.textMuted }]}>b/{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            no boards yet.
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontFamily: "VT323_400Regular", fontSize: 22 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 2,
  },
  displayName: { fontFamily: "DMSans_700Bold", fontSize: 14 },
  name: { fontFamily: "DMSans_400Regular", fontSize: 12 },
  empty: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    textAlign: "center",
    marginTop: 64,
  },
});
