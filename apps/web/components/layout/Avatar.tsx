"use client";

import Image from "next/image";
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

// Named theme overrides (Gold members can choose one)
const THEME_PALETTES: Record<string, { dark: { bg: string; text: string }; light: { bg: string; text: string } }> = {
  amber:   { dark: { bg: "#2a1800", text: "#c8860a" }, light: { bg: "#fef3c7", text: "#92400e" } },
  teal:    { dark: { bg: "#042f2e", text: "#2dd4bf" }, light: { bg: "#ccfbf1", text: "#0f766e" } },
  rose:    { dark: { bg: "#3a1018", text: "#fda4af" }, light: { bg: "#ffe4e6", text: "#be123c" } },
  violet:  { dark: { bg: "#2d1b5e", text: "#c4b5fd" }, light: { bg: "#ede9fe", text: "#6d28d9" } },
  emerald: { dark: { bg: "#052e20", text: "#6ee7b7" }, light: { bg: "#d1fae5", text: "#065f46" } },
  sky:     { dark: { bg: "#0c2340", text: "#7dd3fc" }, light: { bg: "#e0f2fe", text: "#0369a1" } },
};

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
  /** Gold member profile photo URL */
  avatarUrl?: string | null;
  /** Gold member chosen color theme */
  profileTheme?: string | null;
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
  avatarUrl,
  profileTheme,
  bg,
  className,
}: AvatarProps) {
  const { theme } = useTheme();
  const cfg = SIZES[size];
  const themePalette = profileTheme ? THEME_PALETTES[profileTheme]?.[theme] : null;
  const palette = themePalette ?? PALETTES[hashIndex(screenname)][theme];
  const initials = screenname.slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative flex-shrink-0 ${className ?? ""}`}
      style={{ width: cfg.box, height: cfg.box }}
    >
      {/* Avatar box */}
      <div
        className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          background: palette.bg,
          boxShadow: isGoldMember ? `0 0 0 2px #c8860a` : undefined,
        }}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={screenname}
            width={cfg.box}
            height={cfg.box}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <span
            className="font-bold font-mono select-none"
            style={{ color: palette.text, fontSize: cfg.text }}
          >
            {initials}
          </span>
        )}
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
