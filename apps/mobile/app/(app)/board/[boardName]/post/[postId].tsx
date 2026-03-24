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

export default function BoardPostScreen() {
  const { boardName, postId } = useLocalSearchParams<{ boardName: string; postId: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [post, setPost] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/boards/${boardName}/posts/${postId}`);
      if (!res.ok) return;
      setPost(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }, [boardName, postId]);

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
        <Text style={[styles.title, { color: colors.amber }]}>b/{boardName}</Text>
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
            <>
              <Text style={[styles.postTitle, { color: colors.text }]}>
                {String(post.title ?? "")}
              </Text>
              <Text style={[styles.postMeta, { color: colors.textMuted }]}>
                by {String((post.author as Record<string, unknown>)?.screenname ?? "unknown")}
              </Text>
              <Text style={[styles.postBody, { color: colors.text }]}>
                {String(post.body ?? "")}
              </Text>

              {/* Comments */}
              {Array.isArray(post.comments) && post.comments.length > 0 && (
                <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
                  <Text style={[styles.commentsLabel, { color: colors.textMuted }]}>
                    {post.comments.length} comment{post.comments.length !== 1 ? "s" : ""}
                  </Text>
                  {(post.comments as Record<string, unknown>[]).map((c) => (
                    <View key={String(c.id)} style={[styles.comment, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.commentAuthor, { color: colors.amber }]}>
                        {String((c.author as Record<string, unknown>)?.screenname ?? "")}
                      </Text>
                      <Text style={[styles.commentBody, { color: colors.text }]}>
                        {String(c.body ?? "")}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
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
  body: { padding: 16, gap: 10 },
  postTitle: { fontFamily: "DMSans_700Bold", fontSize: 20, lineHeight: 26 },
  postMeta: { fontFamily: "DMSans_400Regular", fontSize: 12 },
  postBody: { fontFamily: "DMSans_400Regular", fontSize: 14, lineHeight: 22, marginTop: 8 },
  commentsSection: { marginTop: 24, borderTopWidth: 1, paddingTop: 16 },
  commentsLabel: { fontFamily: "DMSans_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  comment: { paddingBottom: 12, borderBottomWidth: 1, marginBottom: 12, gap: 3 },
  commentAuthor: { fontFamily: "DMSans_700Bold", fontSize: 12 },
  commentBody: { fontFamily: "DMSans_400Regular", fontSize: 14, lineHeight: 20 },
  empty: { fontFamily: "DMSans_400Regular", fontSize: 13, textAlign: "center", marginTop: 32 },
});
