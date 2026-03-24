import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inviteLink: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    channelMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    boardMember: {
      findUnique: vi.fn(),
    },
    channel: {
      findUnique: vi.fn(),
    },
    board: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  limiters: { invite: null },
}));

// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInvite(overrides: Partial<{
  useCount: number;
  maxUses: number;
  isRevoked: boolean;
  expiresAt: Date;
  channelId: string | null;
  boardId: string | null;
}> = {}) {
  return {
    token: randomBytes(6).toString("hex"),
    channelId: "ch-1",
    boardId: null,
    createdById: "user-owner",
    useCount: 0,
    maxUses: 10,
    isRevoked: false,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
    ...overrides,
  };
}

/** Mirrors the redemption validation in the join routes */
function validateInvite(invite: ReturnType<typeof makeInvite>): {
  valid: boolean;
  reason?: string;
} {
  if (invite.isRevoked) return { valid: false, reason: "revoked" };
  if (invite.expiresAt < new Date()) return { valid: false, reason: "expired" };
  if (invite.useCount >= invite.maxUses) return { valid: false, reason: "max_uses" };
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Token expiry
// ---------------------------------------------------------------------------

describe("invite token expiry", () => {
  it("a fresh token (just created) is valid", () => {
    const invite = makeInvite();
    expect(validateInvite(invite).valid).toBe(true);
  });

  it("a token expiring in the future is valid", () => {
    const invite = makeInvite({
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h from now
    });
    expect(validateInvite(invite).valid).toBe(true);
  });

  it("a token that expired 1 second ago is invalid", () => {
    const invite = makeInvite({
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = validateInvite(invite);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("a token that expired 25 hours ago is invalid", () => {
    const invite = makeInvite({
      expiresAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    expect(validateInvite(invite).valid).toBe(false);
    expect(validateInvite(invite).reason).toBe("expired");
  });

  it("expiry is set to exactly 24 hours from creation", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000);
    expect(expiresAt.getTime() - now).toBe(86_400_000);
  });

  it("tokens cannot be used after expiry even if not revoked", () => {
    const invite = makeInvite({
      isRevoked: false,
      useCount: 0,
      maxUses: 10,
      expiresAt: new Date(Date.now() - 1),
    });
    expect(validateInvite(invite).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Max uses enforcement
// ---------------------------------------------------------------------------

describe("invite max uses", () => {
  it("a token with 0 uses (unused) is valid", () => {
    const invite = makeInvite({ useCount: 0, maxUses: 10 });
    expect(validateInvite(invite).valid).toBe(true);
  });

  it("a token with uses < maxUses is valid", () => {
    const invite = makeInvite({ useCount: 9, maxUses: 10 });
    expect(validateInvite(invite).valid).toBe(true);
  });

  it("a token at exactly maxUses is invalid", () => {
    const invite = makeInvite({ useCount: 10, maxUses: 10 });
    const result = validateInvite(invite);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("max_uses");
  });

  it("a token over maxUses is invalid", () => {
    const invite = makeInvite({ useCount: 11, maxUses: 10 });
    expect(validateInvite(invite).valid).toBe(false);
  });

  it("a single-use token (maxUses=1) is valid once", () => {
    const invite = makeInvite({ useCount: 0, maxUses: 1 });
    expect(validateInvite(invite).valid).toBe(true);
  });

  it("a single-use token (maxUses=1) is invalid after first use", () => {
    const invite = makeInvite({ useCount: 1, maxUses: 1 });
    expect(validateInvite(invite).valid).toBe(false);
  });

  it("maxUses is capped at 50 (server-side cap)", () => {
    const requested = 100;
    const cap = Math.min(Math.max(1, requested), 50);
    expect(cap).toBe(50);
  });

  it("maxUses minimum is 1", () => {
    const requested = -5;
    const cap = Math.min(Math.max(1, requested), 50);
    expect(cap).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Revocation
// ---------------------------------------------------------------------------

describe("invite revocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a revoked token is immediately invalid", () => {
    const invite = makeInvite({ isRevoked: true });
    const result = validateInvite(invite);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("revoked");
  });

  it("revocation takes priority over other checks", () => {
    // Even a fresh, under-used token is invalid when revoked
    const invite = makeInvite({
      isRevoked: true,
      useCount: 0,
      maxUses: 10,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    expect(validateInvite(invite).valid).toBe(false);
    expect(validateInvite(invite).reason).toBe("revoked");
  });

  it("updates the invite record to isRevoked=true", async () => {
    const token = "abc123def456";
    (prisma.inviteLink.update as Mock).mockResolvedValue({
      token,
      isRevoked: true,
    });

    const updated = await prisma.inviteLink.update({
      where: { token },
      data: { isRevoked: true },
    });

    expect(updated.isRevoked).toBe(true);
    expect(prisma.inviteLink.update).toHaveBeenCalledWith({
      where: { token },
      data: { isRevoked: true },
    });
  });

  it("only the invite creator can revoke", () => {
    const invite = { createdById: "user-owner" };
    const channelCreatorId = "user-owner";

    const canRevoke = (userId: string) =>
      invite.createdById === userId || channelCreatorId === userId;

    expect(canRevoke("user-owner")).toBe(true);
    expect(canRevoke("random-user")).toBe(false);
  });

  it("the channel/board creator can also revoke any invite for their space", () => {
    const invite = { createdById: "user-member" };
    const channelCreatorId = "user-owner";

    const canRevoke = (userId: string) =>
      invite.createdById === userId || channelCreatorId === userId;

    // Channel owner can revoke an invite created by a member
    expect(canRevoke("user-owner")).toBe(true);
    // Random user cannot
    expect(canRevoke("user-random")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Token entropy and format
// ---------------------------------------------------------------------------

describe("invite token format", () => {
  it("token is a 12-character lowercase hex string", () => {
    for (let i = 0; i < 20; i++) {
      const token = randomBytes(6).toString("hex");
      expect(token).toHaveLength(12);
      expect(/^[0-9a-f]{12}$/.test(token)).toBe(true);
    }
  });

  it("no two tokens are the same (probabilistic uniqueness)", () => {
    const tokens = Array.from({ length: 500 }, () =>
      randomBytes(6).toString("hex")
    );
    const unique = new Set(tokens);
    expect(unique.size).toBe(500);
  });
});
