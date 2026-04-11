export type BadgeType = "FOUNDER" | "FOUNDING_DONOR";

export const BADGE_ORDER: BadgeType[] = ["FOUNDER", "FOUNDING_DONOR"];

export const BADGE_CONFIG: Record<BadgeType, {
  emoji: string;
  label: string;
  description: string;
  color: string;
}> = {
  FOUNDER: {
    emoji: "⚡",
    label: "Founder",
    description: "One of the first 100 members of Signoff Chat.",
    color: "#c8860a",
  },
  FOUNDING_DONOR: {
    emoji: "🤝",
    label: "Founding Donor",
    description: "Helped fund Signoff Chat during its founding.",
    color: "#a78bfa",
  },
};

export const FOUNDER_CAP = 100;
