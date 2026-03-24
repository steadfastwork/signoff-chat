/**
 * Integration tests — Auth system
 *
 * Runs end-to-end against the live dev server (http://localhost:3000).
 * Prerequisites:
 *   • `npm run dev` running in apps/web
 *   • DATABASE_URL in apps/web/.env pointing to a live PostgreSQL instance
 *
 * Tests use fetch for HTTP calls and prisma for DB assertions / setup teardown.
 * The mobile login endpoint (/api/auth/mobile/login) is used for login tests
 * because it returns JSON directly and handles suspension as a 403 rather than
 * an HTML redirect, making assertions straightforward.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashEmail } from "@/lib/crypto/email";
import { deleteAccount } from "@/lib/deletion";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE         = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const REGISTER_URL = `${BASE}/api/auth/register`;
const LOGIN_URL    = `${BASE}/api/auth/mobile/login`;

const TEST_USER = {
  screenname: "test_user_1",
  email:      "testuser1@example.com",
  password:   "securepass123",
} as const;

// Shared state — populated by test 1.1, consumed by later tests.
let registeredUserId: string | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(url: string, body: Record<string, string>) {
  return fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Global setup — clean slate before the suite runs
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Verify the dev server is reachable before running any test.
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(5_000) });
  } catch {
    throw new Error(
      `Dev server unreachable at ${BASE}. ` +
      "Run `npm run dev` in apps/web before executing integration tests."
    );
  }

  // Remove any leftover test user from a previous (failed) run.
  const stale = await prisma.user.findFirst({
    where:  { screenname: { equals: TEST_USER.screenname, mode: "insensitive" } },
    select: { id: true },
  });
  if (stale) await deleteAccount(stale.id);
}, 15_000);

// ---------------------------------------------------------------------------
// REGISTRATION
// ---------------------------------------------------------------------------

describe("1.1 — valid registration", () => {
  it("returns 201 and a user id", async () => {
    const res  = await post(REGISTER_URL, TEST_USER);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(typeof body.id).toBe("string");
    expect(body.screenname).toBe(TEST_USER.screenname);

    // Persist for downstream tests
    registeredUserId = body.id;
  });

  it("stores emailHash in DB — not the raw email string", async () => {
    expect(registeredUserId, "test 1.1a must pass first").toBeTruthy();

    const user = await prisma.user.findUnique({ where: { id: registeredUserId! } });
    expect(user).not.toBeNull();

    // emailHash must be set and non-empty
    expect(user!.emailHash).toBeTruthy();

    // Must match sha256(email + pepper)
    const expected = hashEmail(TEST_USER.email);
    expect(user!.emailHash).toBe(expected);
  });

  it("does not store the raw email address anywhere on the user record", async () => {
    const user = await prisma.user.findUnique({ where: { id: registeredUserId! } });
    expect(user).not.toBeNull();

    // Stringify every field and assert the plaintext email is absent
    const serialised = JSON.stringify(user);
    expect(serialised).not.toContain(TEST_USER.email);
  });
});

describe("1.2 — duplicate screenname rejected", () => {
  it("returns 409 when the same screenname is re-used", async () => {
    const res  = await post(REGISTER_URL, {
      screenname: TEST_USER.screenname,
      email:      "other_address@example.com",
      password:   "anotherPass123",
    });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/taken|already/i);
  });
});

describe("1.3 — invalid screenname formats rejected", () => {
  const cases: Array<{ screenname: string; reason: string }> = [
    { screenname: "ab",                                       reason: "too short (2 chars)"     },
    { screenname: "this_screenname_is_way_too_long_for_our_system", reason: "too long (> 20 chars)" },
    { screenname: "has spaces",                               reason: "contains space"           },
    { screenname: "has@symbol",                               reason: "contains @"               },
    { screenname: "has-hyphen",                               reason: "contains hyphen"          },
  ];

  cases.forEach(({ screenname, reason }) => {
    it(`returns 400 for "${screenname}" (${reason})`, async () => {
      const res  = await post(REGISTER_URL, {
        screenname,
        email:    `throwaway-${Date.now()}@example.com`,
        password: "ValidPass123",
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBeTruthy();
    });
  });
});

describe("1.4 — weak password rejected", () => {
  it("returns 400 for a password under 8 characters", async () => {
    const res  = await post(REGISTER_URL, {
      screenname: "pw_test_xyz",
      email:      "pwtest@example.com",
      password:   "abc",
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/password/i);
  });
});

describe("1.5 — raw IP not stored on user record", () => {
  it("user record contains no IP address fields", async () => {
    const user = await prisma.user.findUnique({ where: { id: registeredUserId! } });
    expect(user).not.toBeNull();

    const serialised = JSON.stringify(user);

    // IPv4 pattern
    expect(serialised).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    // IPv6 segment pattern
    expect(serialised).not.toMatch(/[0-9a-f]{4}:[0-9a-f]{4}/i);
  });
});

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------

describe("1.6 — valid login by screenname", () => {
  it("returns 200 with a token and session fields", async () => {
    const res  = await post(LOGIN_URL, {
      screenname: TEST_USER.screenname,
      password:   TEST_USER.password,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.userId).toBe(registeredUserId);
    expect(body.screenname).toBe(TEST_USER.screenname);
  });
});

describe("1.7 — wrong password fails", () => {
  it("returns 401 with a generic error that does not reveal which field was wrong", async () => {
    const res  = await post(LOGIN_URL, {
      screenname: TEST_USER.screenname,
      password:   "wrongpassword",
    });
    const body = await res.json();

    expect(res.status).toBe(401);

    // Message must not hint that the screenname exists
    expect(body.error).not.toMatch(/wrong password|incorrect password/i);
    expect(body.error).not.toMatch(/screenname.*not found|user.*not found|no such user/i);

    // Expected generic phrasing
    expect(body.error).toMatch(/invalid credentials/i);
  });
});

describe("1.8 — login by email is not supported", () => {
  it("returns 400 when an email field is sent instead of screenname", async () => {
    // Send { email, password } — no screenname key.
    // The endpoint requires screenname, so it should return 400.
    const res  = await post(LOGIN_URL, {
      email:    TEST_USER.email,
      password: TEST_USER.password,
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SUSPENDED USER
// ---------------------------------------------------------------------------

describe("1.9 — suspended user cannot authenticate", () => {
  it("returns 403 when the account is suspended", async () => {
    expect(registeredUserId, "test 1.1a must pass first").toBeTruthy();

    // Suspend directly in DB
    await prisma.user.update({
      where: { id: registeredUserId! },
      data:  { isSuspended: true },
    });

    const res  = await post(LOGIN_URL, {
      screenname: TEST_USER.screenname,
      password:   TEST_USER.password,
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/suspend/i);
  });

  it("lifts suspension and allows login again", async () => {
    await prisma.user.update({
      where: { id: registeredUserId! },
      data:  { isSuspended: false },
    });

    const res = await post(LOGIN_URL, {
      screenname: TEST_USER.screenname,
      password:   TEST_USER.password,
    });

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// CLEANUP — run last; exercises the deleteAccount function itself
// ---------------------------------------------------------------------------

describe("cleanup — deleteAccount removes all user data", () => {
  it("deletes the test user and all related records", async () => {
    expect(registeredUserId, "test 1.1a must pass first").toBeTruthy();

    await deleteAccount(registeredUserId!);

    const gone = await prisma.user.findUnique({ where: { id: registeredUserId! } });
    expect(gone).toBeNull();
  });
});
