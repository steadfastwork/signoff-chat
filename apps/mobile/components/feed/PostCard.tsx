import { useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type BottomSheet from "@gorhom/bottom-sheet";
import Avatar from "@/components/Avatar";
import SafetySheet, { type SafetyTarget } from "@/components/SafetySheet";
import type { CachedPost } from "@/lib/db/localPosts";

const C = {
  text:   "#e8e4d9",
  muted:  "#7a7060",
  amber:  "#f5c842",
  border: "#1e1c18",
  gold:   "#d4a017",
  bg:     "#0f0e0c",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface Props {
  post:       CachedPost;
  /** True when this post belongs to the current session user — hides safety menu */
  isOwnPost?: boolean;
}

export default function PostCard({ post, isOwnPost }: Props) {
  const router       = useRouter();
  const safetyRef    = useRef<BottomSheet>(null);

  const safetyTarget: SafetyTarget = {
    screenname:       post.author_name,
    screenname_lower: post.author_name.toLowerCase(),
    targetType:       "post",
    targetId:         post.id,
  };

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/post/${post.id}`)}
        activeOpacity={0.75}
      >
        <View style={styles.top}>
          <Avatar
            screenname={post.author_name}
            color={post.author_color}
            size={34}
            onPress={() => router.push(`/(app)/u/${post.author_name}`)}
          />
          <View style={styles.authorBlock}>
            <View style={styles.authorRow}>
              <Text style={styles.authorName}>{post.author_name}</Text>
              {!!post.author_is_gold && (
                <Text style={styles.gold}>★</Text>
              )}
              {post.privacy !== "PUBLIC" && (
                <Ionicons
                  name={post.privacy === "BUDDIES_ONLY" ? "people" : "lock-closed"}
                  size={11}
                  color={C.muted}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
            <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
          </View>

          {/* ··· menu — hidden on own posts */}
          {!isOwnPost && (
            <TouchableOpacity
              onPress={() => safetyRef.current?.expand()}
              hitSlop={10}
              style={styles.moreBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.content} numberOfLines={6}>{post.content}</Text>

        {post.media_url ? (
          <Image
            source={{ uri: post.media_url }}
            style={styles.media}
            contentFit="cover"
            transition={200}
          />
        ) : null}

        <View style={styles.actions}>
          <View style={styles.action}>
            <Ionicons name="flash-outline" size={14} color={C.muted} />
            <Text style={styles.actionCount}>{post.nudge_count}</Text>
          </View>
          <View style={styles.action}>
            <Ionicons name="chatbubble-outline" size={14} color={C.muted} />
            <Text style={styles.actionCount}>{post.reply_count}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Safety sheet — rendered outside the card TouchableOpacity */}
      <SafetySheet
        ref={safetyRef}
        target={safetyTarget}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  authorBlock: { flex: 1, gap: 2 },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  authorName: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: C.text,
  },
  gold: { fontSize: 12, color: C.gold },
  time: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
  moreBtn: {
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  content: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    lineHeight: 21,
    marginLeft: 44,
  },
  media: {
    height: 200,
    borderRadius: 10,
    marginLeft: 44,
    backgroundColor: "#1e1c18",
  },
  actions: {
    flexDirection: "row",
    gap: 16,
    marginLeft: 44,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionCount: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
});
