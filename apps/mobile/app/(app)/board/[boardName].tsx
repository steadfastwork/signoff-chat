import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function BoardScreen() {
  const { boardName } = useLocalSearchParams<{ boardName: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [posts, setPosts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/boards/${boardName}/posts`);
      if (!res.ok) return;
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }, [boardName]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.amber} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.amber }]}>b/{boardName}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.amber} style={styles.loader} />
      ) : (
        <FlashList
          data={posts}
          estimatedItemSize={80}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => router.push(`/(app)/board/${boardName}/post/${String(item.id)}`)}
              activeOpacity={0.7}
            >
              <Text style={[styles.postTitle, { color: colors.text }]}>
                {String(item.title ?? "")}
              </Text>
              <Text style={[styles.postMeta, { color: colors.textMuted }]}>
                by {String((item.author as Record<string, unknown>)?.screenname ?? "unknown")}
                {"  "}
                {String(item._count ? (item._count as Record<string, unknown>).comments ?? 0 : 0)} comments
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>no posts yet.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontFamily: "VT323_400Regular", fontSize: 22 },
  loader: { marginTop: 64 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 4,
  },
  postTitle: { fontFamily: "DMSans_700Bold", fontSize: 14 },
  postMeta: { fontFamily: "DMSans_400Regular", fontSize: 12 },
  empty: { fontFamily: "DMSans_400Regular", fontSize: 13, textAlign: "center", marginTop: 64 },
});
