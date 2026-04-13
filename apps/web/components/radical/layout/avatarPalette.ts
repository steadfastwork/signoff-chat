// ---------------------------------------------------------------------------
// Avatar color palette — shared across layout components
// Maps deriveAvatarColor output to hex pairs
// ---------------------------------------------------------------------------

export const AVATAR_PALETTE: Record<string, { bg: string; fg: string }> = {
  amber:   { bg: "#2d1800", fg: "#e8961a" },
  rose:    { bg: "#2d0f1a", fg: "#fb7185" },
  sky:     { bg: "#0a1d2d", fg: "#38bdf8" },
  emerald: { bg: "#0a2418", fg: "#34d17a" },
  violet:  { bg: "#1e1030", fg: "#a78bfa" },
  orange:  { bg: "#2d1200", fg: "#fb923c" },
};
