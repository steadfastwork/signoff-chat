"use client";

import { useTheme } from "@/components/ThemeProvider";
import { StatusDot, type StatusValue } from "@/components/StatusDot";

// ---------------------------------------------------------------------------
// Size config
// ---------------------------------------------------------------------------

const SIZES = {
  sm: { box: 32, text: 11, dot: "sm" as const },
  md: { box: 38, text: 13, dot: "sm" as const },
  lg: { box: 56, text: 18, dot: "md" as const },
  xl: { box: 80, text: 26, dot: "lg" as const },
} as const;

// ---------------------------------------------------------------------------
// Color palettes — 4 warm pairs, dark + light variants
// ---------------------------------------------------------------------------

const PALETTES = [
  // Blue
  {
    dark:  { bg: "#0f2a4a", text: "#93c5fd", ring: "#1e3a5f" },
    light: { bg: "#dbeafe", text: "#1d4ed8", ring: "#bfdbfe" },
  },
  // Violet
  {
    dark:  { bg: "#2d1b5e", text: "#c4b5fd", ring: "#3b1d7a" },
    light: { bg: "#ede9fe", text: "#6d28d9", ring: "#ddd6fe" },
  },
  // Emerald
  {
    dark:  { bg: "#052e20", text: "#6ee7b7", ring: "#064e3b" },
    light: { bg: "#d1fae5", text: "#065f46", ring: "#a7f3d0" },
  },
  // Coral/Rose
  {
    dark:  { bg: "#3a1018", text: "#fda4af", ring: "#4a1525" },
    light: { bg: "#ffe4e6", text: "#be123c", ring: "#fecdd3" },
  },
] as const;

function hashIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % PALETTES.length;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AvatarProps {
  screenname: string;
  size?: keyof typeof SIZES;
  isGoldMember?: boolean;
  status?: StatusValue;
  /** Background color of parent for status dot ring */
  bg?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Avatar({
  screenname,
  size = "md",
  isGoldMember = false,
  status,
  bg,
  className,
}: AvatarProps) {
  const { theme } = useTheme();
  const cfg = SIZES[size];
  const palette = PALETTES[hashIndex(screenname)][theme];
  const initials = screenname.slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative flex-shrink-0 ${className ?? ""}`}
      style={{ width: cfg.box, height: cfg.box }}
    >
      {/* Avatar box */}
      <div
        className="w-full h-full rounded-xl flex items-center justify-center"
        style={{
          background: palette.bg,
          boxShadow: isGoldMember
            ? `0 0 0 2px #c8860a`
            : undefined,
        }}
      >
        <span
          className="font-bold font-mono select-none"
          style={{ color: palette.text, fontSize: cfg.text }}
        >
          {initials}
        </span>
      </div>

      {/* Status dot */}
      {status && (
        <StatusDot
          status={status}
          size={cfg.dot}
          bg={bg ?? "var(--surface)"}
          className="absolute -bottom-0.5 -right-0.5"
        />
      )}
    </div>
  );
}
