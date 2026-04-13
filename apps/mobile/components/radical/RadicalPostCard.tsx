import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const C = {
  bg:        "#0f0e0c",
  surface:   "#191714",
  amber:     "#f5c842",
  amberDim:  "rgba(245,200,66,0.15)",
  amberBorder:"rgba(245,200,66,0.25)",
  text:      "#e8e4d9",
  muted:     "#7a7060",
  border:    "#2c2820",
  thought:   "#4caf50",
  thoughtDim:"rgba(76,175,80,0.12)",
  quote:     "#a78bfa",
  quoteDim:  "rgba(167,139,250,0.12)",
  photo:     "#fb7185",
  photoDim:  "rgba(251,113,133,0.12)",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostType = "AWAY" | "THOUGHT" | "QUOTE" | "PHOTO";

export interface RadicalPost {
  id:          string;
  postType:    PostType;
  content:     string;
  bodyText?:   string | null;
  quoteText?:  string | null;
  quoteAttrib?:string | null;
  imageUrl?:   string | null;
  imageCaption?:string | null;
  tags:        string[];
  nudgeCount:  number;
  echoCount:   number;
  hasNudged:   boolean;
  setAt:       string;
  user: {
    id:          string;
    screenname:  string;
    isGoldMember:boolean;
    avatarColor?:string;
    status:      string;
  };
  echoOf?: { user: { screenname: string } } | null;
}

interface Props {
  post:     RadicalPost;
  onNudge:  (id: string, current: boolean) => void;
  onEcho:   (id: string) => void;
  onTagPress:(tag: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PALETTE: Record<string, { bg: string; fg: string }> = {
  amber:   { bg: "#2d1800", fg: "#e8961a" },
  rose:    { bg: "#2d0f1a", fg: "#fb7185" },
  sky:     { bg: "#0a1d2d", fg: "#38bdf8" },
  emerald: { bg: "#0a2418", fg: "#34d17a" },
  violet:  { bg: "#1e1030", fg: "#a78bfa" },
  orange:  { bg: "#2d1200", fg: "#fb923c" },
};

function avatarColors(color?: string) {
  return PALETTE[color ?? "amber"] ?? PALETTE.amber;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AvatarBubble({ user, size = 32, radius = 10 }: { user: RadicalPost["user"]; size?: number; radius?: number }) {
  const { bg, fg } = avatarColors(user.avatarColor);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: radius, backgroundColor: bg }]}>
      <Text style={[styles.avatarInitial, { color: fg, fontSize: Math.round(size * 0.38) }]}>
        {(user.screenname[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}

function AuthorRow({ user, time, typeBadge, typeBadgeColor, typeBadgeBg }: {
  user:           RadicalPost["user"];
  time:           string;
  typeBadge?:     string;
  typeBadgeColor?:string;
  typeBadgeBg?:   string;
}) {
  const router = useRouter();
  return (
    <View style={styles.authorRow}>
      <TouchableOpacity
        onPress={() => router.push(`/u/${user.screenname}` as never)}
        style={styles.authorLeft}
        hitSlop={6}
      >
        <AvatarBubble user={user} />
        <View style={styles.authorMeta}>
          <Text style={[styles.screenname, user.isGoldMember && styles.goldName]}>
            {user.isGoldMember ? `✦ ${user.screenname}` : user.screenname}
          </Text>
          <Text style={styles.timeText}>{time}</Text>
        </View>
      </TouchableOpacity>
      {typeBadge && (
        <View style={[styles.typeBadge, { backgroundColor: typeBadgeBg ?? C.amberDim, borderColor: typeBadgeColor ?? C.amber }]}>
          <Text style={[styles.typeBadgeText, { color: typeBadgeColor ?? C.amber }]}>{typeBadge}</Text>
        </View>
      )}
    </View>
  );
}

function EchoCredit({ screenname }: { screenname: string }) {
  return (
    <Text style={styles.echoCredit}>↩ echoed from @{screenname}</Text>
  );
}

function TagRow({ tags, onTagPress }: { tags: string[]; onTagPress: (t: string) => void }) {
  if (!tags.length) return null;
  return (
    <View style={styles.tagRow}>
      {tags.map((t) => (
        <TouchableOpacity key={t} onPress={() => onTagPress(t)} hitSlop={4}>
          <Text style={styles.tagChip}>#{t}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ActionRow({ post, onNudge, onEcho }: { post: RadicalPost; onNudge: (id: string, current: boolean) => void; onEcho: (id: string) => void }) {
  return (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.actionBtn, post.hasNudged && styles.actionBtnActive]}
        onPress={() => onNudge(post.id, post.hasNudged)}
        activeOpacity={0.75}
      >
        <Text style={[styles.actionBtnText, post.hasNudged && styles.actionBtnTextActive]}>
          👋{post.nudgeCount > 0 ? ` ${post.nudgeCount}` : ""}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onEcho(post.id)}
        activeOpacity={0.75}
      >
        <Text style={[styles.actionBtnText, { color: "#4caf50" }]}>
          ↩{post.echoCount > 0 ? ` ${post.echoCount}` : ""}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card variants
// ---------------------------------------------------------------------------

function AwayCard({ post, onNudge, onEcho, onTagPress }: Props) {
  return (
    <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: C.amberBorder }]}>
      <AuthorRow user={post.user} time={timeAgo(post.setAt)} typeBadge="Away" />
      {post.echoOf && <EchoCredit screenname={post.echoOf.user.screenname} />}
      <Text style={styles.awayMessage}>{post.content}</Text>
      <TagRow tags={post.tags} onTagPress={onTagPress} />
      <ActionRow post={post} onNudge={onNudge} onEcho={onEcho} />
    </View>
  );
}

function ThoughtCard({ post, onNudge, onEcho, onTagPress }: Props) {
  return (
    <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: C.thoughtDim }]}>
      <AuthorRow user={post.user} time={timeAgo(post.setAt)} typeBadge="✍ Thought" typeBadgeColor={C.thought} typeBadgeBg={C.thoughtDim} />
      {post.echoOf && <EchoCredit screenname={post.echoOf.user.screenname} />}
      <Text style={styles.bodyText}>{post.bodyText}</Text>
      <TagRow tags={post.tags} onTagPress={onTagPress} />
      <ActionRow post={post} onNudge={onNudge} onEcho={onEcho} />
    </View>
  );
}

function QuoteCard({ post, onNudge, onEcho, onTagPress }: Props) {
  return (
    <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: C.quoteDim }]}>
      <AuthorRow user={post.user} time={timeAgo(post.setAt)} typeBadge="❝ Quote" typeBadgeColor={C.quote} typeBadgeBg={C.quoteDim} />
      {post.echoOf && <EchoCredit screenname={post.echoOf.user.screenname} />}
      <View style={styles.quoteBlock}>
        <Text style={styles.quoteDecor}>"</Text>
        <View style={[styles.quoteBorder, { borderLeftColor: C.quote }]}>
          <Text style={styles.quoteText}>{post.quoteText}</Text>
          {post.quoteAttrib ? (
            <Text style={styles.quoteAttrib}>— {post.quoteAttrib}</Text>
          ) : null}
        </View>
      </View>
      <TagRow tags={post.tags} onTagPress={onTagPress} />
      <ActionRow post={post} onNudge={onNudge} onEcho={onEcho} />
    </View>
  );
}

function PhotoCard({ post, onNudge, onEcho, onTagPress }: Props) {
  return (
    <View style={[styles.card, styles.photoCard]}>
      <AuthorRow user={post.user} time={timeAgo(post.setAt)} typeBadge="📷 Photo" typeBadgeColor={C.photo} typeBadgeBg={C.photoDim} />
      {post.echoOf && <EchoCredit screenname={post.echoOf.user.screenname} />}
      {post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          style={styles.photoImage}
          resizeMode="cover"
          accessibilityLabel={post.imageCaption ?? "Photo"}
        />
      ) : null}
      {post.imageCaption ? (
        <Text style={styles.photoCaption}>{post.imageCaption}</Text>
      ) : null}
      <TagRow tags={post.tags} onTagPress={onTagPress} />
      <ActionRow post={post} onNudge={onNudge} onEcho={onEcho} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// RadicalPostCard — main export
// ---------------------------------------------------------------------------

export default function RadicalPostCard(props: Props) {
  switch (props.post.postType) {
    case "AWAY":    return <AwayCard    {...props} />;
    case "THOUGHT": return <ThoughtCard {...props} />;
    case "QUOTE":   return <QuoteCard   {...props} />;
    case "PHOTO":   return <PhotoCard   {...props} />;
    default:        return null;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  photoCard: {
    padding: 0,
    overflow: "hidden",
    gap: 0,
  },

  // Avatar
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: "DMSans_700Bold",
  },

  // Author row
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
  },
  authorMeta: {
    flex: 1,
  },
  screenname: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: C.text,
  },
  goldName: { color: C.amber },
  timeText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
  },

  // Type badge
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // Echo credit
  echoCredit: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
    fontStyle: "italic",
  },

  // Away message
  awayMessage: {
    fontFamily: "DMSans_400Regular",
    fontSize: 18,
    fontStyle: "italic",
    color: "#d6c897",
    lineHeight: 26,
    letterSpacing: -0.2,
  },

  // Thought body
  bodyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    color: C.text,
    lineHeight: 24,
  },

  // Quote
  quoteBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  quoteDecor: {
    fontFamily: "DMSans_400Regular",
    fontSize: 52,
    color: "rgba(167,139,250,0.2)",
    lineHeight: 44,
    marginTop: -4,
  },
  quoteBorder: {
    flex: 1,
    borderLeftWidth: 3,
    paddingLeft: 10,
    gap: 4,
  },
  quoteText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    fontStyle: "italic",
    color: C.text,
    lineHeight: 24,
  },
  quoteAttrib: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },

  // Photo
  photoImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#111",
  },
  photoCaption: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },

  // Tags
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: C.amber,
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#111",
  },
  actionBtnActive: {
    borderColor: C.amberBorder,
    backgroundColor: "#2a1a00",
  },
  actionBtnText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: C.muted,
  },
  actionBtnTextActive: { color: C.amber },
});
