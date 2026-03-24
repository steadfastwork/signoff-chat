import { z } from "zod";

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export const screennameSchema = z
  .string()
  .min(3, "screenname must be at least 3 characters")
  .max(20, "screenname must be 20 characters or fewer")
  .regex(/^[a-zA-Z0-9_]+$/, "screenname may only contain letters, numbers, and underscores");

export const passwordSchema = z
  .string()
  .min(8, "password must be at least 8 characters");

export const bioSchema = z
  .string()
  .max(160, "bio must be 160 characters or fewer")
  .optional();

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export const postContentSchema = z
  .string()
  .min(1, "post cannot be empty")
  .max(512, "post must be 512 characters or fewer");

export const awayMessageSchema = z
  .string()
  .max(140, "away message must be 140 characters or fewer");

export const replyContentSchema = z
  .string()
  .min(1, "reply cannot be empty")
  .max(256, "reply must be 256 characters or fewer");

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export const channelNameSchema = z
  .string()
  .min(1, "channel name cannot be empty")
  .max(32, "channel name must be 32 characters or fewer")
  .regex(/^[a-z0-9-]+$/, "channel name may only contain lowercase letters, numbers, and hyphens");

export const channelMessageSchema = z
  .string()
  .min(1, "message cannot be empty")
  .max(512, "message must be 512 characters or fewer");

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export const boardNameSchema = z
  .string()
  .min(1, "board name cannot be empty")
  .max(32, "board name must be 32 characters or fewer")
  .regex(/^[a-z0-9-]+$/, "board name may only contain lowercase letters, numbers, and hyphens");

export const vibeStatementSchema = z
  .string()
  .min(1, "vibe statement cannot be empty")
  .max(200, "vibe statement must be 200 characters or fewer");

export const boardPostTitleSchema = z
  .string()
  .min(1, "title cannot be empty")
  .max(140, "title must be 140 characters or fewer");

export const boardPostBodySchema = z
  .string()
  .max(2000, "body must be 2000 characters or fewer")
  .optional();

export const boardCommentSchema = z
  .string()
  .min(1, "comment cannot be empty")
  .max(512, "comment must be 512 characters or fewer");

export const tagSchema = z
  .string()
  .max(30, "tag must be 30 characters or fewer")
  .optional();

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export const inviteTokenSchema = z
  .string()
  .length(12, "invalid invite token")
  .regex(/^[0-9a-f]{12}$/, "invalid invite token format");

export const inviteMaxUsesSchema = z
  .number()
  .int()
  .min(1, "max uses must be at least 1")
  .max(50, "max uses cannot exceed 50");

// ---------------------------------------------------------------------------
// Tips
// ---------------------------------------------------------------------------

export const tipAmountSchema = z
  .number()
  .int("tip amount must be a whole number of cents")
  .min(100, "minimum tip is $1.00")
  .max(10000, "maximum tip is $100.00");

export const tipMessageSchema = z
  .string()
  .max(140, "tip message must be 140 characters or fewer")
  .optional();
