/**
 * Deterministic per-user color palette for the flat DM format.
 * getColorForUser returns the same color for the same userId every time.
 */

export const DM_COLOR_PALETTE = [
  "#4a9eff", // blue
  "#22c55e", // green
  "#a78bfa", // violet
  "#f472b6", // pink
  "#34d399", // emerald
  "#60a5fa", // sky
  "#fb923c", // orange
  "#a3e635", // lime
];

export const SELF_COLOR = "#c8860a";

export function getColorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return DM_COLOR_PALETTE[h % DM_COLOR_PALETTE.length];
}
