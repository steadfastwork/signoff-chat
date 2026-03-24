/**
 * IP hashing — one-way, ephemeral.
 *
 * Raw IP addresses are PII. We never log, store, or pass them anywhere.
 * Instead we produce a short one-way token that is only useful for rate
 * limiting within a single salt epoch (rotated daily by the cron job at
 * /api/cron/rotate-rate-limit-salt).
 *
 * After the salt rotates, yesterday's tokens become uncorrelatable —
 * even if Upstash is subpoenaed the keys reveal nothing about the IPs.
 */

import { sha256 } from "@noble/hashes/sha2.js";

/**
 * Hash a raw IP address with the current rate-limit salt.
 * Returns the first 16 hex chars (64 bits) — enough entropy for a
 * rate-limit key, short enough to keep Redis key sizes small.
 *
 * @param rawIp  - The raw IP string from the request header (NEVER logged)
 * @param salt   - The current RATE_LIMIT_SALT from env (rotated daily)
 */
export function hashIp(rawIp: string, salt: string): string {
  const input = new TextEncoder().encode(rawIp + salt);
  const digest = sha256(input);
  return Buffer.from(digest).toString("hex").slice(0, 16);
}

/**
 * Extract and immediately hash the requester's IP.
 * The raw IP is never assigned to a variable that escapes this function.
 *
 * @returns 16-char hex string safe to use as a rate-limit key prefix
 */
export function getHashedIp(headers: Headers): string {
  const rawIp =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";

  const salt = process.env.RATE_LIMIT_SALT ?? "dev-salt";
  return hashIp(rawIp, salt);
}
