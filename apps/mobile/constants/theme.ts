/**
 * Design token aliases for React Native components.
 *
 * Tokens live in @signoff/config so they're shared with the web app.
 * This file re-exports them under the DARK / LIGHT / SHARED names the
 * mobile audit spec requires, and also re-exports FOUNDING_MEMBER_THRESHOLD
 * so it's discoverable without digging into the config package.
 */

import { tokens, FOUNDING_MEMBER_THRESHOLD } from "@signoff/config";

export { FOUNDING_MEMBER_THRESHOLD };

/** Dark-mode color palette. */
export const DARK = tokens.dark;

/** Light-mode color palette. */
export const LIGHT = tokens.light;

/**
 * Values that are the same in both themes (typography, spacing, radii).
 * Extend this object as shared tokens are added to @signoff/config.
 */
export const SHARED = {
  fontMono:   "IBMPlexMono_400Regular",
  fontPixel:  "VT323_400Regular",
  fontSans:   "DMSans_400Regular",
  fontSansMd: "DMSans_500Medium",
  fontSerif:  "DMSerifDisplay_400Regular",

  radiusSm:  6,
  radiusMd:  10,
  radiusLg:  16,
  radiusFull: 999,

  spacingXs: 4,
  spacingSm: 8,
  spacingMd: 16,
  spacingLg: 24,
  spacingXl: 32,
} as const;

export type DarkTokens  = typeof DARK;
export type LightTokens = typeof LIGHT;
export type SharedTokens = typeof SHARED;
