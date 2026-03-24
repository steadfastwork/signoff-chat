interface GoldBadgeProps {
  className?: string;
}

export function GoldBadge({ className }: GoldBadgeProps) {
  return (
    <span
      aria-label="Gold member"
      title="Gold member"
      className={className}
      style={{ color: "#d4a017", fontSize: "0.75em", lineHeight: 1 }}
    >
      ★
    </span>
  );
}
