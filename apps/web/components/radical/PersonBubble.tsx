"use client";

// ---------------------------------------------------------------------------
// PersonBubble — avatar with gradient status ring
// ---------------------------------------------------------------------------

type AwayStatus = "ONLINE" | "AWAY" | "OFFLINE";

interface PersonBubbleUser {
  screenname:  string;
  avatarBg:    string;
  avatarColor: string;
  initials:    string;
}

interface PersonBubbleProps {
  user:       PersonBubbleUser;
  awayStatus: AwayStatus;
  onClick:    () => void;
}

const RING_BG: Record<AwayStatus, string> = {
  ONLINE:  "linear-gradient(135deg, var(--green), #18a858)",
  AWAY:    "linear-gradient(135deg, var(--away),  #c47810)",
  OFFLINE: "var(--ink4)",
};

export function PersonBubble({ user, awayStatus, onClick }: PersonBubbleProps) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      {/* Gradient ring */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        style={{
          width: 52, height: 52,
          borderRadius: 17,
          padding: 2,
          background: RING_BG[awayStatus],
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {/* Inner avatar */}
        <div style={{
          width: "100%", height: "100%",
          borderRadius: 15,
          border: "2px solid var(--ink)",
          background: user.avatarBg,
          color: user.avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, fontFamily: "var(--sans)",
          userSelect: "none",
        }}>
          {user.initials}
        </div>
      </div>

      {/* Label */}
      <span style={{
        fontSize: 10, fontWeight: 500, fontFamily: "var(--sans)",
        color: "var(--snow3)",
        maxWidth: 52,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {user.screenname}
      </span>
    </div>
  );
}
