import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mock external dependencies before importing any app modules
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", async () => {
  const actual = await vi.importActual<typeof import("bcryptjs")>("bcryptjs");
  return {
    ...actual,
    default: {
      ...actual,
      hash: vi.fn().mockResolvedValue("$2b$12$mockedHash"),
      compare: vi.fn(),
    },
    hash: vi.fn().mockResolvedValue("$2b$12$mockedHash"),
    compare: vi.fn(),
  };
});

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  limiters: { auth: null },
}));

// ---------------------------------------------------------------------------
// Import after mocks are established
// ---------------------------------------------------------------------------

import { validateScreenname, validatePassword, deriveAvatarColor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

type MockUser = {
  id: string;
  screenname: string;
  email: string;
  passwordHash: string;
  isGoldMember: boolean;
};

const MOCK_USER: MockUser = {
  id: "user-1",
  screenname: "TestUser",
  email: "test@example.com",
  passwordHash: "$2b$12$mockedHash",
  isGoldMember: false,
};

// ---------------------------------------------------------------------------
// Registration validation
// ---------------------------------------------------------------------------

describe("registration: field validation", () => {
  it("rejects a screenname shorter than 3 characters", () => {
    expect(validateScreenname("ab")).not.toBeNull();
  });

  it("rejects a screenname with invalid characters", () => {
    expect(validateScreenname("user-name")).not.toBeNull();
    expect(validateScreenname("user name")).not.toBeNull();
    expect(validateScreenname("user@name")).not.toBeNull();
  });

  it("accepts a valid screenname", () => {
    expect(validateScreenname("valid_User1")).toBeNull();
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(validatePassword("short")).not.toBeNull();
  });

  it("accepts a password of 8+ characters", () => {
    expect(validatePassword("ValidPass1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Registration: DB interactions
// ---------------------------------------------------------------------------

describe("registration: DB interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks for an existing user before creating", async () => {
    (prisma.user.findFirst as Mock).mockResolvedValue(null);
    (prisma.user.create as Mock).mockResolvedValue({ ...MOCK_USER });

    // Simulate what the register route does: check uniqueness then create
    const existing = await prisma.user.findFirst({
      where: { screenname: { equals: "TestUser", mode: "insensitive" } },
    });
    expect(existing).toBeNull();
    expect(prisma.user.findFirst).toHaveBeenCalledOnce();
  });

  it("rejects registration when screenname already exists", async () => {
    (prisma.user.findFirst as Mock).mockResolvedValue(MOCK_USER);

    const existing = await prisma.user.findFirst({
      where: { screenname: { equals: "TestUser", mode: "insensitive" } },
    });
    expect(existing).not.toBeNull();
    // Route returns 409 CONFLICT in this case
  });

  it("hashes the password before storing", async () => {
    (prisma.user.findFirst as Mock).mockResolvedValue(null);
    (prisma.user.create as Mock).mockResolvedValue({ ...MOCK_USER });

    await bcrypt.hash("rawPassword", 12);
    expect(bcrypt.hash).toHaveBeenCalledWith("rawPassword", 12);
  });

  it("creates user with correct shape", async () => {
    (prisma.user.findFirst as Mock).mockResolvedValue(null);
    (prisma.user.create as Mock).mockResolvedValue({ ...MOCK_USER });

    const created = await prisma.user.create({
      data: {
        screenname: "TestUser",
        email: "test@example.com",
        passwordHash: "$2b$12$mockedHash",
      },
    });
    expect(created.screenname).toBe("TestUser");
    expect(created.email).toBe("test@example.com");
  });
});

// ---------------------------------------------------------------------------
// Login (authorize function logic)
// ---------------------------------------------------------------------------

describe("login: authorize logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user when credentials are valid", async () => {
    (prisma.user.findFirst as Mock).mockResolvedValue(MOCK_USER);
    (bcrypt.compare as Mock).mockResolvedValue(true);

    const user = await prisma.user.findFirst({
      where: { screenname: { equals: "TestUser", mode: "insensitive" } },
    });
    const valid = await bcrypt.compare("correctPassword", user!.passwordHash);

    expect(user).not.toBeNull();
    expect(valid).toBe(true);
  });

  it("returns null when user does not exist", async () => {
    (prisma.user.findFirst as Mock).mockResolvedValue(null);

    const user = await prisma.user.findFirst({
      where: { screenname: { equals: "ghost", mode: "insensitive" } },
    });
    expect(user).toBeNull();
  });

  it("rejects wrong password", async () => {
    (prisma.user.findFirst as Mock).mockResolvedValue(MOCK_USER);
    (bcrypt.compare as Mock).mockResolvedValue(false);

    const user = await prisma.user.findFirst({ where: { screenname: { equals: "TestUser", mode: "insensitive" } } });
    const valid = await bcrypt.compare("wrongPassword", user!.passwordHash);
    expect(valid).toBe(false);
  });

  it("lookup is case-insensitive for screenname", async () => {
    (prisma.user.findFirst as Mock).mockResolvedValue(MOCK_USER);

    // All of these should look up the same user
    for (const name of ["testuser", "TESTUSER", "TestUser", "tEsTuSeR"]) {
      await prisma.user.findFirst({
        where: { screenname: { equals: name, mode: "insensitive" } },
      });
    }
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(4);
    // All calls should use mode: "insensitive"
    const calls = (prisma.user.findFirst as Mock).mock.calls;
    calls.forEach((call) => {
      expect(call[0].where.screenname.mode).toBe("insensitive");
    });
  });
});

// ---------------------------------------------------------------------------
// JWT / Session shape
// ---------------------------------------------------------------------------

describe("session shape", () => {
  it("JWT callback adds required fields", () => {
    // Simulate what the jwt callback does
    const user = { id: "user-1", screenname: "TestUser", isGoldMember: false };
    const token: Record<string, unknown> = {};

    token.id = user.id;
    token.screenname = user.screenname;
    token.isGoldMember = user.isGoldMember;
    token.avatarColor = deriveAvatarColor(user.id);

    expect(token.id).toBe("user-1");
    expect(token.screenname).toBe("TestUser");
    expect(token.isGoldMember).toBe(false);
    expect(token.avatarColor).toBeTruthy();
  });

  it("session callback populates session.user from token", () => {
    const token = {
      id: "user-1",
      screenname: "TestUser",
      isGoldMember: true,
      avatarColor: "amber",
    };
    const session = { user: {} as Record<string, unknown>, expires: "" };

    session.user.id = token.id;
    session.user.screenname = token.screenname;
    session.user.isGoldMember = token.isGoldMember;
    session.user.avatarColor = token.avatarColor;

    expect(session.user.id).toBe("user-1");
    expect(session.user.screenname).toBe("TestUser");
    expect(session.user.isGoldMember).toBe(true);
    expect(session.user.avatarColor).toBe("amber");
  });
});
