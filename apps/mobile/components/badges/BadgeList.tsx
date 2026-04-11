import { View, Text, Pressable, Alert } from "react-native";

type BadgeType = "FOUNDER" | "FOUNDING_DONOR";

const BADGE_CONFIG: Record<BadgeType, { emoji: string; label: string; description: string; color: string }> = {
  FOUNDER: { emoji: "⚡", label: "Founder", description: "One of the first 100 members of Signoff Chat.", color: "#c8860a" },
  FOUNDING_DONOR: { emoji: "🤝", label: "Founding Donor", description: "Helped fund Signoff Chat during its founding.", color: "#a78bfa" },
};

const BADGE_ORDER: BadgeType[] = ["FOUNDER", "FOUNDING_DONOR"];

interface BadgeItem {
  badge: BadgeType;
  awardedAt: string;
}

interface Props {
  badges: BadgeItem[];
  size: "sm" | "md";
}

export function BadgeList({ badges, size }: Props) {
  if (!badges || badges.length === 0) return null;

  const sorted = [...badges].sort(
    (a, b) => BADGE_ORDER.indexOf(a.badge) - BADGE_ORDER.indexOf(b.badge)
  );

  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      {sorted.map(({ badge }) => {
        const cfg = BADGE_CONFIG[badge];
        if (size === "sm") {
          return (
            <Pressable
              key={badge}
              onPress={() => Alert.alert(cfg.label, cfg.description)}
            >
              <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
            </Pressable>
          );
        }
        return (
          <View
            key={badge}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              height: 26,
              paddingHorizontal: 10,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: `${cfg.color}59`,
              backgroundColor: `${cfg.color}26`,
            }}
          >
            <Text style={{ fontSize: 11, color: cfg.color }}>{cfg.emoji} {cfg.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
