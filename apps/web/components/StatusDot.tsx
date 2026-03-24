export type StatusValue =
  | "ONLINE"
  | "AWAY"
  | "IDLE"
  | "INVISIBLE"
  | "OFFLINE";

export type DotSize = "sm" | "md" | "lg";

interface StatusDotProps {
  status: StatusValue;
  size?: DotSize;
  /**
   * Background color of the parent element.
   * Used for the 2 px separating ring so the dot appears to float above
   * any background. Defaults to "transparent".
   */
  bg?: string;
  className?: string;
}

const SIZE_PX: Record<DotSize, number> = {
  sm: 8,
  md: 10,
  lg: 12,
};

/**
 * The color shown to the viewer.
 * INVISIBLE is treated as OFFLINE visually for other users' contexts;
 * when showing a user their *own* status we pass "INVISIBLE" directly
 * so the selector can highlight it correctly.
 */
const DOT_COLOR: Record<StatusValue, string> = {
  ONLINE: "#22c55e",
  AWAY: "#f59e0b",
  IDLE: "#6a6860",
  INVISIBLE: "#6a6860", // same shade as idle/offline-ish
  OFFLINE: "#3a3a34",
};

const DOT_ANIMATION: Record<StatusValue, string | undefined> = {
  ONLINE: "status-glow 2s ease-in-out infinite",
  AWAY: undefined,
  IDLE: "status-idle-pulse 2.5s ease-in-out infinite",
  INVISIBLE: undefined,
  OFFLINE: undefined,
};

export function StatusDot({
  status,
  size = "md",
  bg = "transparent",
  className,
}: StatusDotProps) {
  const px = SIZE_PX[size];
  const color = DOT_COLOR[status];
  const animation = DOT_ANIMATION[status];

  return (
    <span
      aria-label={status.toLowerCase()}
      role="img"
      className={className}
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: px,
        height: px,
        borderRadius: "50%",
        background: color,
        border: `2px solid ${bg}`,
        animation,
      }}
    />
  );
}
