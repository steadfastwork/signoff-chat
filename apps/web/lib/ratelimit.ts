/**
 * Signoff Chat — Rate Limiting
 *
 * Backed by Upstash Redis (sliding window algorithm).
 * Falls back to a no-op (pass-through) when env vars are not configured,
 * so dev environments without Upstash still work.
 *
 * Usage:
 *   const rl = await rateLimit(limiters.postCreate, `post:${userId}`);
 *   if (rl) return rl;   // 429 response — exit the handler
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Redis client (lazy — created once per cold start)
// ---------------------------------------------------------------------------

let _redis: Redis | null | undefined = undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[ratelimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. " +
          "Rate limiting is DISABLED. Set these env vars for production."
      );
    }
    _redis = null;
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

// ---------------------------------------------------------------------------
// Factory — returns null when Redis is unavailable (no-op mode)
// ---------------------------------------------------------------------------

function make(
  requests: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`
): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: "sc:rl",
    analytics: false,
  });
}

// ---------------------------------------------------------------------------
// Named limiters (spec §1)
// ---------------------------------------------------------------------------

export const limiters = {
  /** Auth routes: 5 req/min per IP */
  auth: make(5, "1 m"),

  /** Post creation: 10 posts/min per user (normal) */
  postCreate: make(10, "1 m"),

  /**
   * Restricted post rate: 50% of normal.
   * Applied when: account age < 7 days OR warningCount > 0.
   */
  postCreateRestricted: make(5, "1 m"),

  /** Channel messages: 30/min per user */
  channelMessage: make(30, "1 m"),

  /** Restricted channel messages: 50% of normal */
  channelMessageRestricted: make(15, "1 m"),

  /** Board post creation: 5/min per user */
  boardPostCreate: make(5, "1 m"),

  /** Restricted board post creation: 50% of normal */
  boardPostCreateRestricted: make(2, "1 m"),

  /** Board comments: 20/min per user */
  boardComment: make(20, "1 m"),

  /** Restricted board comments: 50% of normal */
  boardCommentRestricted: make(10, "1 m"),

  /** Search: 20 req/min per user */
  search: make(20, "1 m"),

  /** Tips: 5/hr per user */
  tip: make(5, "1 h"),

  /** Invite link generation: 10/hr per user (identifier includes channel/board ID) */
  invite: make(10, "1 h"),

  /**
   * Duplicate content detection key: hash of (userId + contentHash).
   * Allows 2 identical sends per hour — 3rd triggers auto-flag.
   */
  duplicateContent: make(2, "1 h"),
};

// ---------------------------------------------------------------------------
// Helper — call at the top of a route handler
// Returns a 429 NextResponse if rate limited, null if allowed
// ---------------------------------------------------------------------------

export async function rateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  if (!limiter) return null; // no-op when Redis is not configured

  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// isRestrictedUser — true if account age < 7 days OR warningCount > 0
// Import prisma lazily to avoid edge runtime issues
// ---------------------------------------------------------------------------

export function isRestrictedUser(user: {
  createdAt: Date;
  warningCount: number;
}): boolean {
  const accountAgeDays =
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return accountAgeDays < 7 || user.warningCount > 0;
}

// ---------------------------------------------------------------------------
// contentHash — stable hash of message content for duplicate detection
// Uses a simple djb2 so we don't need a crypto import in the edge runtime.
// ---------------------------------------------------------------------------

export function contentHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}
