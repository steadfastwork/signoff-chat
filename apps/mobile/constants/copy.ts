/**
 * User-facing copy strings — centralised so they stay consistent across
 * screens and are easy to update in one place.
 */

// ── Registration / onboarding ────────────────────────────────────────────────

/** Warning card displayed above the registration form. */
export const SCREENNAME_WARNING = {
  title: "Write this down somewhere safe.",
  body:  "Your screenname is how people find you. We have no way to recover it if you forget it.\nOld school — just like it should be.",
} as const;

/** Four bullet points shown in the post-registration welcome modal. */
export const WELCOME_BULLETS = [
  {
    emoji: "✏️",
    title: "Write down your screenname somewhere.",
    body:  "We genuinely cannot recover it.",
  },
  {
    emoji: "📸",
    title: "Screenshots are king.",
    body:  "Messages expire from our servers. If something matters, save it.",
  },
  {
    emoji: "🔒",
    title: "Your messages use AES-256 + ML-KEM encryption.",
    body:  "We cannot read them. Not us. Not anyone.",
  },
  {
    emoji: "🌿",
    title: "Sign off when you're done.",
    body:  "That's literally the point.",
  },
] as const;

/** Short screenshot reminder text shown as a dismissible banner in the feed. */
export const SCREENSHOT_REMINDER = "if it matters, screenshot it.";

// ── Feed / message expiry ────────────────────────────────────────────────────

/** Dismissible note explaining that channel messages expire from the server. */
export const EXPIRY_NOTE =
  "Channel messages expire from our servers. Screenshot anything you want to keep.";

// ── Account deletion ─────────────────────────────────────────────────────────

/** Confirmation text shown after successful account deletion. */
export const DELETION_FINAL = {
  title: "Your account has been permanently deleted.",
  body:  "All your posts, messages, and data have been removed from our servers. We cannot recover them.",
} as const;
