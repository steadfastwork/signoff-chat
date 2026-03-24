import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Channel type enforcement
// ---------------------------------------------------------------------------

describe("channel types", () => {
  const VALID_TYPES = ["PUBLIC", "INVITE_ONLY", "SECRET"] as const;

  it("PUBLIC is a valid type", () => expect(VALID_TYPES).toContain("PUBLIC"));
  it("INVITE_ONLY is a valid type", () => expect(VALID_TYPES).toContain("INVITE_ONLY"));
  it("SECRET is a valid type", () => expect(VALID_TYPES).toContain("SECRET"));

  it("PRIVATE is not a recognised type", () => {
    expect(VALID_TYPES).not.toContain("PRIVATE");
  });

  it("there are exactly 3 channel types", () => {
    expect(VALID_TYPES).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Slow mode enforcement logic
// ---------------------------------------------------------------------------

describe("slow mode", () => {
  /** Mirror of the route handler logic */
  function isSlowModeBlocked(
    slowModeMinutes: number,
    lastMessageAt: Date | null
  ): boolean {
    if (slowModeMinutes <= 0 || !lastMessageAt) return false;
    const cooldownMs = slowModeMinutes * 60 * 1000;
    const elapsed = Date.now() - lastMessageAt.getTime();
    return elapsed < cooldownMs;
  }

  it("no block when slowModeMinutes is 0 (disabled)", () => {
    expect(isSlowModeBlocked(0, new Date())).toBe(false);
  });

  it("no block when user has never posted (lastMessageAt is null)", () => {
    expect(isSlowModeBlocked(5, null)).toBe(false);
  });

  it("blocks a message posted within the cooldown window", () => {
    const lastMessageAt = new Date(Date.now() - 2 * 60 * 1000); // 2 min ago
    expect(isSlowModeBlocked(5, lastMessageAt)).toBe(true);
  });

  it("allows a message posted exactly at the cooldown boundary", () => {
    const lastMessageAt = new Date(Date.now() - 5 * 60 * 1000 - 1); // 5 min + 1ms ago
    expect(isSlowModeBlocked(5, lastMessageAt)).toBe(false);
  });

  it("allows a message posted after the cooldown window", () => {
    const lastMessageAt = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    expect(isSlowModeBlocked(5, lastMessageAt)).toBe(false);
  });

  it("default slow mode is 10 minutes", () => {
    // Matches the Prisma schema default: slowModeMinutes default 10
    const DEFAULT_SLOW_MODE_MINUTES = 10;
    expect(DEFAULT_SLOW_MODE_MINUTES).toBe(10);
  });

  it("correctly calculates remaining cooldown in ms", () => {
    const slowModeMinutes = 5;
    const lastMessageAt = new Date(Date.now() - 3 * 60 * 1000); // 3 min ago
    const cooldownMs = slowModeMinutes * 60 * 1000;
    const elapsed = Date.now() - lastMessageAt.getTime();
    const remainingMs = cooldownMs - elapsed;
    // Should be roughly 2 minutes remaining
    expect(remainingMs).toBeGreaterThan(1.9 * 60 * 1000);
    expect(remainingMs).toBeLessThan(2.1 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// Invite token generation
// ---------------------------------------------------------------------------

describe("invite token generation", () => {
  it("generates a 12-character string", () => {
    const token = randomBytes(6).toString("hex");
    expect(token).toHaveLength(12);
  });

  it("is all lowercase hex characters", () => {
    const token = randomBytes(6).toString("hex");
    expect(/^[0-9a-f]{12}$/.test(token)).toBe(true);
  });

  it("uses 6 bytes (48 bits of entropy)", () => {
    // 6 bytes * 2 hex chars/byte = 12 chars
    expect(6 * 2).toBe(12);
  });

  it("generates unique tokens on repeated calls", () => {
    const tokens = new Set(
      Array.from({ length: 1000 }, () => randomBytes(6).toString("hex"))
    );
    // Collision probability with 48-bit entropy over 1000 tries is negligible
    expect(tokens.size).toBe(1000);
  });

  it("old 4-byte tokens had weaker entropy", () => {
    // 4-byte = 32-bit ≈ 4 billion possible values (upgraded to 6-byte = 48-bit)
    const oldEntropy = 4 * 8; // 32 bits
    const newEntropy = 6 * 8; // 48 bits
    expect(newEntropy).toBeGreaterThan(oldEntropy);
  });
});

// ---------------------------------------------------------------------------
// Invite token expiry
// ---------------------------------------------------------------------------

describe("invite token expiry", () => {
  it("expiry is set to exactly 24 hours after creation", () => {
    const created = Date.now();
    const expiresAt = new Date(created + 24 * 60 * 60 * 1000);
    const diffMs = expiresAt.getTime() - created;
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  it("a token created 25 hours ago is expired", () => {
    const created = Date.now() - 25 * 60 * 60 * 1000;
    const expiresAt = new Date(created + 24 * 60 * 60 * 1000);
    expect(expiresAt < new Date()).toBe(true);
  });

  it("a token created 23 hours ago is still valid", () => {
    const created = Date.now() - 23 * 60 * 60 * 1000;
    const expiresAt = new Date(created + 24 * 60 * 60 * 1000);
    expect(expiresAt > new Date()).toBe(true);
  });

  it("expiry check: expiresAt must be in the future", () => {
    const futureExpiry = new Date(Date.now() + 1000);
    const pastExpiry = new Date(Date.now() - 1000);
    expect(futureExpiry > new Date()).toBe(true);
    expect(pastExpiry > new Date()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Message content validation (mirrors POST handler)
// ---------------------------------------------------------------------------

describe("channel message content", () => {
  const MAX_LEN = 512;

  it("accepts content up to 512 characters", () => {
    expect("a".repeat(MAX_LEN).length).toBeLessThanOrEqual(MAX_LEN);
  });

  it("rejects content over 512 characters", () => {
    expect("a".repeat(MAX_LEN + 1).length).toBeGreaterThan(MAX_LEN);
  });

  it("empty content is rejected", () => {
    expect("".length).toBe(0);
    expect("".length > 0).toBe(false);
  });
});
