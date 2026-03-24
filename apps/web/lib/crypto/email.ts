/**
 * Email hashing — one-way, server-only.
 *
 * We never store a plaintext email address. Only the hash is persisted.
 * The raw address is passed directly to Resend for delivery, then discarded.
 *
 * Why pepper?  A bare sha256(email) is trivially reversible by a dictionary
 * attack against the hash column.  Adding a server-side secret makes the
 * hashes worthless without the key — even if the DB is dumped.
 *
 * Rotate EMAIL_PEPPER only when deliberately invalidating all existing logins
 * (requires a coordinated re-registration flow).
 */

import { sha256 } from "@noble/hashes/sha2.js";

function getPepper(): string {
  const pepper = process.env.EMAIL_PEPPER;
  if (!pepper) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_PEPPER is not set. Cannot hash email in production.");
    }
    // Dev fallback — deterministic but not secure
    return "dev-pepper-not-for-production";
  }
  return pepper;
}

/**
 * Normalize and hash an email address.
 * Safe to call on untrusted input — normalizes before hashing.
 *
 * @returns 64-char lowercase hex string (sha256 output)
 */
export function hashEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const pepper = getPepper();
  const input = new TextEncoder().encode(normalized + pepper);
  const digest = sha256(input);
  return Buffer.from(digest).toString("hex");
}
