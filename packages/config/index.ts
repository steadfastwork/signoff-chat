// ---------------------------------------------------------------------------
// Character limits
// ---------------------------------------------------------------------------

export const MAX_POST_LENGTH = 512;
export const MAX_AWAY_MESSAGE_LENGTH = 140;
export const MAX_REPLY_LENGTH = 256;
export const MAX_CHANNEL_MESSAGE_LENGTH = 512;
export const MAX_BOARD_POST_TITLE_LENGTH = 140;
export const MAX_BOARD_POST_BODY_LENGTH = 2000;
export const MAX_BOARD_COMMENT_LENGTH = 512;
export const MAX_VIBE_STATEMENT_LENGTH = 200;
export const MAX_BIO_LENGTH = 160;
export const MAX_TIP_MESSAGE_LENGTH = 140;
export const MAX_TAG_LENGTH = 30;
export const MAX_SCREENNAME_LENGTH = 20;
export const MIN_SCREENNAME_LENGTH = 3;
export const MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// Invite links
// ---------------------------------------------------------------------------

export const INVITE_LINK_EXPIRY_HOURS = 24;
export const INVITE_LINK_DEFAULT_MAX_USES = 10;
export const INVITE_LINK_MAX_USES_CAP = 50;
export const INVITE_TOKEN_BYTES = 6; // 12-char hex

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export const CHANNEL_PUBLIC_MAX_MEMBERS = 500;
export const CHANNEL_DEFAULT_SLOW_MODE_MINUTES = 10;
export const CHANNEL_MAX_MESSAGES_STORED = 500;

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export const FOUNDING_MEMBER_THRESHOLD = 50;
export const BOARD_POST_ARCHIVE_DAYS = 30;

// ---------------------------------------------------------------------------
// Design tokens (mirror CSS variables in globals.css)
// Used in React Native / Expo where CSS variables aren't available.
// ---------------------------------------------------------------------------

export const tokens = {
  dark: {
    bg: "#0d0d08",
    card: "#141410",
    border: "#2a2a1e",
    text: "#e8e8d8",
    textMuted: "#888874",
    amber: "#f5c842",
    amberDim: "#c9a030",
    teal: "#3ecfcf",
    tealDim: "#2aa8a8",
    red: "#e05555",
    green: "#4caf7d",
    blue: "#5b8dee",
  },
  light: {
    bg: "#fafaf5",
    card: "#ffffff",
    border: "#e2e2d0",
    text: "#1a1a10",
    textMuted: "#888874",
    amber: "#b8860b",
    amberDim: "#9a7009",
    teal: "#1a9494",
    tealDim: "#147878",
    red: "#cc3333",
    green: "#2e7d52",
    blue: "#2563eb",
  },
} as const;

export type ColorScheme = keyof typeof tokens;
export type DesignToken = keyof typeof tokens.dark;

// ---------------------------------------------------------------------------
// Polling / real-time
// ---------------------------------------------------------------------------

export const PUSHER_FALLBACK_POLL_MS = 30_000;
