import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function PostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [post, setPost] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/posts/${postId}`);
      if (!res.ok) return;
      setPost(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPost();
    setRefreshing(false);
  }, [fetchPost]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.amber} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.amber }]}>{"// POST"}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.amber} style={styles.loader} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />
          }
          contentContainerStyle={styles.body}
        >
          {post ? (
            <Text style={[styles.content, { color: colors.text }]}>
              {String(post.content ?? "")}
            </Text>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>post not found.</Text>
          )}
        </ScrollView>
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
  body: { padding: 16 },
  content: { fontFamily: "DMSans_400Regular", fontSize: 15, lineHeight: 22 },
  empty: { fontFamily: "DMSans_400Regular", fontSize: 13, textAlign: "center", marginTop: 32 },
});
