"use client";

import { BADGE_CONFIG, BADGE_ORDER, type BadgeType } from "@/lib/badges";

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

  if (size === "md") {
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {sorted.map(({ badge }) => {
          const cfg = BADGE_CONFIG[badge];
          return (
            <span
              key={badge}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 24,
                padding: "0 10px",
                borderRadius: 99,
                border: `1px solid ${cfg.color}66`,
                background: `${cfg.color}1a`,
                color: cfg.color,
                fontSize: 11,
                fontWeight: 500,
                fontFamily: "IBM Plex Mono, monospace",
                whiteSpace: "nowrap",
              }}
            >
              {cfg.emoji} {cfg.label}
            </span>
          );
        })}
      </div>
    );
  }

  // sm — emoji only with CSS tooltip
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {sorted.map(({ badge }) => {
        const cfg = BADGE_CONFIG[badge];
        return (
          <span
            key={badge}
            title={`${cfg.label} — ${cfg.description}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              fontSize: 12,
              cursor: "default",
              lineHeight: 1,
            }}
          >
            {cfg.emoji}
          </span>
        );
      })}
    </span>
  );
}
