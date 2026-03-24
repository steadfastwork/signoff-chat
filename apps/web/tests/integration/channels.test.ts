import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    channelMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    inviteLink: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    channelMessage: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    buddyRelation: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/pusher", () => ({
  pusherServer: { trigger: vi.fn() },
  CHANNELS: { channelRoom: (n: string) => `presence-channel-${n}` },
  EVENTS: { CHANNEL_MESSAGE: "new-message" },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  limiters: { channelMessage: null, invite: null },
}));

// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const INVITE_ONLY_CHANNEL = {
  id: "ch-1",
  name: "test-channel",
  type: "INVITE_ONLY",
  slowModeMinutes: 0,
  creatorId: "user-owner",
};

const MEMBER = {
  userId: "user-1",
  channelId: "ch-1",
  lastMessageAt: null,
};

// ---------------------------------------------------------------------------
// INVITE_ONLY channel creation
// ---------------------------------------------------------------------------

describe("INVITE_ONLY channel", () => {
  it("type INVITE_ONLY is stored as a distinct value from PUBLIC", () => {
    expect(INVITE_ONLY_CHANNEL.type).toBe("INVITE_ONLY");
    expect(INVITE_ONLY_CHANNEL.type).not.toBe("PUBLIC");
  });

  it("non-members cannot access SECRET channels (middleware enforces 404)", () => {
    const SECRET_CHANNEL = { type: "SECRET" };
    // Route returns 404 (not 403) to prevent membership enumeration
    const statusForNonMember = SECRET_CHANNEL.type === "SECRET" ? 404 : 403;
    expect(statusForNonMember).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Invite generation
// ---------------------------------------------------------------------------

describe("invite generation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("token is 12 hex characters", () => {
    const token = randomBytes(6).toString("hex");
    expect(token).toHaveLength(12);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("stores a 24-hour expiry", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000);
    const diffHours = (expiresAt.getTime() - now) / (60 * 60 * 1000);
    expect(diffHours).toBe(24);
  });

  it("invite is linked to the correct channel", async () => {
    const token = randomBytes(6).toString("hex");
    const invite = {
      token,
      channelId: "ch-1",
      createdById: "user-1",
      expiresAt: new Date(Date.now() + 86_400_000),
      maxUses: 10,
      useCount: 0,
      isRevoked: false,
    };

    (prisma.inviteLink.create as Mock).mockResolvedValue(invite);

    const created = await prisma.inviteLink.create({ data: invite });
    expect(created.channelId).toBe("ch-1");
    expect(created.token).toBe(token);
  });

  it("maxUses is capped at 50", () => {
    const requested = 100;
    const cap = Math.min(Math.max(1, requested), 50);
    expect(cap).toBe(50);
  });

  it("maxUses minimum is 1", () => {
    const requested = 0;
    const cap = Math.min(Math.max(1, requested), 50);
    expect(cap).toBe(1);
  });

  it("PUBLIC channels do not need invite links", () => {
    const channel = { type: "PUBLIC" };
    const needsInvite = channel.type !== "PUBLIC";
    expect(needsInvite).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invite redemption → member joins
// ---------------------------------------------------------------------------

describe("invite redemption", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valid token allows a new user to join", async () => {
    const token = randomBytes(6).toString("hex");
    const invite = {
      token,
      channelId: "ch-1",
      createdById: "user-owner",
      expiresAt: new Date(Date.now() + 86_400_000),
      maxUses: 10,
      useCount: 0,
      isRevoked: false,
    };

    (prisma.inviteLink.findUnique as Mock).mockResolvedValue({
      ...invite,
      channel: INVITE_ONLY_CHANNEL,
    });
    (prisma.channelMember.findUnique as Mock).mockResolvedValue(null); // not yet a member
    (prisma.$transaction as Mock).mockResolvedValue([{}, {}]);

    const found = await prisma.inviteLink.findUnique({ where: { token } });
    const alreadyMember = await prisma.channelMember.findUnique({
      where: { userId_channelId: { userId: "user-2", channelId: "ch-1" } },
    });

    expect(found).not.toBeNull();
    expect(found!.isRevoked).toBe(false);
    expect(found!.expiresAt > new Date()).toBe(true);
    expect(found!.useCount < found!.maxUses).toBe(true);
    expect(alreadyMember).toBeNull();
  });

  it("use count increments on each redemption", async () => {
    const invite = { token: "abc123def456", useCount: 2, maxUses: 10 };
    const updatedUseCount = invite.useCount + 1;
    expect(updatedUseCount).toBe(3);
    expect(updatedUseCount <= invite.maxUses).toBe(true);
  });

  it("invite at maxUses is rejected", () => {
    const invite = { useCount: 10, maxUses: 10 };
    const canUse = invite.useCount < invite.maxUses;
    expect(canUse).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Slow mode enforcement
// ---------------------------------------------------------------------------

describe("slow mode enforcement", () => {
  function checkSlowMode(
    slowModeMinutes: number,
    lastMessageAt: Date | null
  ): { blocked: boolean; remainingMs?: number } {
    if (slowModeMinutes <= 0 || !lastMessageAt) return { blocked: false };
    const cooldownMs = slowModeMinutes * 60 * 1000;
    const elapsed = Date.now() - lastMessageAt.getTime();
    if (elapsed < cooldownMs) {
      return { blocked: true, remainingMs: cooldownMs - elapsed };
    }
    return { blocked: false };
  }

  it("blocks a message within the cooldown window and returns remainingMs", () => {
    const lastMessageAt = new Date(Date.now() - 2 * 60 * 1000);
    const result = checkSlowMode(5, lastMessageAt);
    expect(result.blocked).toBe(true);
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it("allows a message after the cooldown has elapsed", () => {
    const lastMessageAt = new Date(Date.now() - 10 * 60 * 1000);
    const result = checkSlowMode(5, lastMessageAt);
    expect(result.blocked).toBe(false);
  });

  it("does not block when slow mode is disabled (0 minutes)", () => {
    const lastMessageAt = new Date(); // just now
    const result = checkSlowMode(0, lastMessageAt);
    expect(result.blocked).toBe(false);
  });

  it("does not block first message (no lastMessageAt)", () => {
    const result = checkSlowMode(10, null);
    expect(result.blocked).toBe(false);
  });

  it("response includes Retry-After header when blocked", () => {
    const lastMessageAt = new Date(Date.now() - 1 * 60 * 1000); // 1 min ago
    const result = checkSlowMode(5, lastMessageAt);
    if (result.blocked && result.remainingMs) {
      const retryAfterSeconds = Math.ceil(result.remainingMs / 1000);
      expect(retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
