/**
 * Integration tests — Security hardening
 *
 * Runs end-to-end against the live dev server (http://localhost:3000).
 * Prerequisites:
 *   • `npm run dev` running in apps/web
 *   • DATABASE_URL in apps/web/.env pointing to a live PostgreSQL instance
 *
 * Rate-limiting tests (4.5, 4.6) are skipped unless UPSTASH_REDIS_REST_URL
 * is set — the limiter is a no-op in dev environments without Upstash.
 *
 * NOTE: Rate-limit tests run LAST intentionally — they exhaust Redis buckets
 * (auth: 5/min per IP; postCreate: 10/min per user) which would break earlier
 * tests that need fresh sessions and POST /api/posts access.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as parseDotenv } from "dotenv";
import { encode } from "next-auth/jwt";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/lib/deletion";
import { deriveAvatarColor, hashPassword } from "@/lib/auth";
import { hashEmail } from "@/lib/crypto/email";

// Read NEXTAUTH_SECRET directly from .env — tests/setup.ts overrides
// process.env.NEXTAUTH_SECRET with a test value before this module loads,
// so we bypass process.env entirely to get the dev server's actual secret.
const _envPath = resolve(__dirname, "../../.env");
const _envVars = parseDotenv(readFileSync(_envPath, "utf8"));
const SERVER_NEXTAUTH_SECRET = _envVars.NEXTAUTH_SECRET ?? "dev-secret-change-in-production";

const BASE      = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const HAS_REDIS = !!process.env.UPSTASH_REDIS_REST_URL;

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------

const SEC_ALPHA = { screenname: "sec_alpha", email: "sec_alpha@example.com", password: "SecAlpha123" };
const SEC_BETA  = { screenname: "sec_beta",  email: "sec_beta@example.com",  password: "SecBeta123"  };

let secAlphaId   = "";
let secBetaId    = "";
let alphaCookies = "";
let betaCookies  = "";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function postJson(url: string, body: Record<string, unknown>, cookies?: string) {
  return fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
  });
}

function getReq(url: string, cookies?: string) {
  return fetch(url, {
    headers: cookies ? { Cookie: cookies } : {},
  });
}

function patchJson(url: string, body: Record<string, unknown>, cookies?: string) {
  return fetch(url, {
    method:  "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
  });
}

function deleteReq(url: string, cookies?: string) {
  return fetch(url, {
    method:  "DELETE",
    headers: cookies ? { Cookie: cookies } : {},
  });
}

/**
 * Create a test user directly in the DB — bypasses POST /api/auth/register
 * and its auth rate limit entirely. The passwordHash is valid bcrypt but the
 * plain password is never needed (we use makeSessionCookie for auth).
 */
async function createTestUser(
  user: { screenname: string; email: string; password: string }
): Promise<string> {
  const [emailHash, passwordHash] = await Promise.all([
    Promise.resolve(hashEmail(user.email)),
    hashPassword(user.password),
  ]);
  const created = await prisma.user.create({
    data: { screenname: user.screenname, emailHash, passwordHash },
    select: { id: true },
  });
  return created.id;
}

/**
 * Craft a NextAuth session cookie directly using the JWT secret, bypassing
 * POST /api/auth/callback/credentials entirely. This avoids consuming the
 * auth rate-limit bucket (5 req/min per IP) during test setup, which would
 * block subsequent tests that rely on valid sessions.
 */
async function makeSessionCookie(userId: string, screenname: string): Promise<string> {
  const secret = SERVER_NEXTAUTH_SECRET;
  const token = await encode({
    secret,
    token: {
      sub:               userId,
      id:                userId,
      screenname,
      isGoldMember:      false,
      adminRole:         null,
      isSuspended:       false,
      suspendedUntil:    null,
      avatarColor:       deriveAvatarColor(userId),
      suspensionCheckedAt: Date.now(),
    },
    maxAge: 60 * 60, // 1 hour — long enough for any test run
  });
  return `next-auth.session-token=${token}`;
}

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await fetch(BASE, { signal: AbortSignal.timeout(5_000) }).catch(() => {
    throw new Error(`Dev server unreachable at ${BASE}. Run \`npm run dev\` in apps/web.`);
  });

  // Reset rate-limit state so repeated test runs within the same 1-minute
  // Redis sliding window don't exhaust the auth bucket (5/min per IP) and
  // block session creation in beforeAll. Uses SCAN+DEL (safe on Upstash free
  // tier — FLUSHDB is not available there).
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    let cursor = 0;
    let deleted = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: "sc:rl:*", count: 100 });
      cursor = parseInt(String(nextCursor), 10);
      if (keys.length > 0) {
        await redis.del(...(keys as [string, ...string[]]));
        deleted += keys.length;
      }
    } while (cursor !== 0);
    if (deleted > 0) console.log(`[test setup] Cleared ${deleted} rate-limit key(s) from Redis`);
  }

  for (const u of [SEC_ALPHA, SEC_BETA]) {
    const stale = await prisma.user.findFirst({
      where:  { screenname: { equals: u.screenname, mode: "insensitive" } },
      select: { id: true },
    });
    if (stale) await deleteAccount(stale.id);
  }

  secAlphaId   = await createTestUser(SEC_ALPHA);
  secBetaId    = await createTestUser(SEC_BETA);
  alphaCookies = await makeSessionCookie(secAlphaId,  SEC_ALPHA.screenname);
  betaCookies  = await makeSessionCookie(secBetaId,   SEC_BETA.screenname);
}, 20_000);

afterAll(async () => {
  for (const id of [secAlphaId, secBetaId]) {
    if (id) await deleteAccount(id).catch(() => {});
  }
});

// ===========================================================================
// ACCESS CONTROL
// ===========================================================================

describe("4.7 — Unauthenticated requests are rejected with 401", () => {
  it("GET /api/posts with no session cookie → 401", async () => {
    const res = await getReq(`${BASE}/api/posts`);
    expect(res.status).toBe(401);
  });

  it("POST /api/posts with no session cookie → 401", async () => {
    const res = await postJson(`${BASE}/api/posts`, { content: "no auth" });
    expect(res.status).toBe(401);
  });

  it("GET /api/buddies with no session cookie → 401", async () => {
    const res = await getReq(`${BASE}/api/buddies`);
    expect(res.status).toBe(401);
  });
});

describe("4.8 — Cannot delete another user's post", () => {
  let alphaPostId = "";

  it("alpha creates a post", async () => {
    // Create via Prisma directly — bypasses Pusher (no try/catch in route) and
    // avoids consuming alpha's postCreate rate-limit bucket before test 4.6.
    const post = await prisma.post.create({
      data: { content: "Alpha owns this post", authorId: secAlphaId, privacy: "PUBLIC" },
    });
    expect(post).not.toBeNull();
    alphaPostId = post.id;
  });

  it("beta attempts to DELETE alpha's post → 403 Forbidden", async () => {
    expect(alphaPostId, "alpha's post must be created first").toBeTruthy();

    const res = await deleteReq(`${BASE}/api/posts/${alphaPostId}`, betaCookies);
    expect(res.status).toBe(403);
  });

  it("alpha's post still exists in the DB after beta's failed attempt", async () => {
    const post = await prisma.post.findUnique({ where: { id: alphaPostId } });
    expect(post).not.toBeNull();
  });
});

describe("4.9 — Cannot edit another user's profile", () => {
  it("PATCH /api/users/[screenname] has no handler — returns 405 Method Not Allowed", async () => {
    // Profile editing lives at /api/profile (session-scoped), not /api/users/:screenname
    const res = await patchJson(
      `${BASE}/api/users/${SEC_ALPHA.screenname}`,
      { bio: "attempt to overwrite" },
      betaCookies
    );
    expect(res.status).toBe(405);
  });

  it("PATCH /api/profile with beta's session updates only beta's own record", async () => {
    const res  = await patchJson(`${BASE}/api/profile`, { bio: "beta's bio" }, betaCookies);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.screenname).toBe(SEC_BETA.screenname);

    // Alpha's bio must be untouched
    const alpha = await prisma.user.findUnique({
      where:  { id: secAlphaId },
      select: { bio: true },
    });
    expect(alpha?.bio).not.toBe("beta's bio");
  });
});

describe("4.10 — Admin routes are inaccessible to regular users", () => {
  it("GET /api/admin/reports as a regular authenticated user → 403", async () => {
    const res = await getReq(`${BASE}/api/admin/reports`, alphaCookies);
    expect(res.status).toBe(403);
  });

  it("GET /api/admin/reports with no session → 401", async () => {
    const res = await getReq(`${BASE}/api/admin/reports`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// INPUT SANITIZATION
// ===========================================================================

describe("4.11 — XSS attempt in post content is sanitized before storage", () => {
  let xssPostId = "";

  it("post content with <script> tags is stored with tags stripped", async () => {
    const raw = '<script>alert("xss")</script>hello';

    // Pusher may cause 500 — verify via DB
    await postJson(`${BASE}/api/posts`, { content: raw }, alphaCookies);

    const post = await prisma.post.findFirst({
      where:   { authorId: secAlphaId },
      orderBy: { createdAt: "desc" },
    });
    expect(post).not.toBeNull();
    xssPostId = post!.id;

    // Tags stripped — stored content must contain no <script> markup
    expect(post!.content).not.toMatch(/<script/i);
    expect(post!.content).not.toMatch(/<\/script>/i);
  });

  it("GET /api/posts/[postId] returns sanitized content with no script tags", async () => {
    expect(xssPostId, "XSS post must be created first").toBeTruthy();

    const res  = await getReq(`${BASE}/api/posts/${xssPostId}`, alphaCookies);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.content).not.toMatch(/<script/i);
    expect(body.content).not.toContain("<script>");
  });
});

describe("4.12 — SQL injection attempt in user search is handled safely", () => {
  it("search query with SQL injection payload returns 200 with safe results", async () => {
    const payload = encodeURIComponent("'; DROP TABLE users; --");
    const res     = await getReq(`${BASE}/api/users/search?q=${payload}`, alphaCookies);
    const body    = await res.json();

    // Prisma parameterizes all queries — the payload is treated as a literal string
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it("users table still exists after the injection attempt", async () => {
    const count = await prisma.user.count();
    expect(count).toBeGreaterThan(0);
  });
});

describe("4.13 — Oversized request body is rejected", () => {
  it("POST /api/posts with a 10 MB body returns 413 or 400", async () => {
    const body = JSON.stringify({ content: "x".repeat(10 * 1024 * 1024) });

    const res = await fetch(`${BASE}/api/posts`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Cookie: alphaCookies },
      body,
    });

    // Next.js may reject at the HTTP layer (413) or the route validates content
    // length (512 chars max) and returns 400 — both are acceptable
    expect([400, 413]).toContain(res.status);
  }, 30_000);
});

// ===========================================================================
// INVITE LINK SECURITY
// ===========================================================================

describe("4.15 — Invite validation response does not expose member identities", () => {
  let inviteToken    = "";
  const channelName  = `sec-inv-${Date.now()}`.slice(0, 32);

  it("setup: alpha creates a SECRET channel and generates a valid invite link", async () => {
    await prisma.channel.create({
      data: {
        name:            channelName,
        type:            "SECRET",
        slowModeMinutes: 0,
        creator:         { connect: { id: secAlphaId } },
        members:         { create: { userId: secAlphaId } },
      },
    });

    const res  = await postJson(`${BASE}/api/channels/invites`, {
      channelName,
      maxUses: 5,
    }, alphaCookies);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.token).toBe("string");
    inviteToken = body.token;
  });

  it("GET /api/invites/[token] returns the channel name", async () => {
    expect(inviteToken, "invite token must be set by previous test").toBeTruthy();

    const res  = await getReq(`${BASE}/api/invites/${inviteToken}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.channelName).toBe(channelName);
  });

  it("response does not include a member list (no individual member data)", async () => {
    const res  = await getReq(`${BASE}/api/invites/${inviteToken}`);
    const body = await res.json();

    // No array of member objects with names or IDs
    expect(body.members).toBeUndefined();
    expect(body.memberIds).toBeUndefined();
    expect(body.memberScreennames).toBeUndefined();
    expect(body.memberList).toBeUndefined();
  });

  it("response does not reveal who created the invite link", async () => {
    const res  = await getReq(`${BASE}/api/invites/${inviteToken}`);
    const body = await res.json();

    // No creator attribution — privacy spec §7: no audit trail on invite links
    expect(body.createdById).toBeUndefined();
    expect(body.creatorId).toBeUndefined();
    expect(body.createdBy).toBeUndefined();
    expect(body.generatedBy).toBeUndefined();
  });
});

// ===========================================================================
// RATE LIMITING  (run last — these exhaust Redis buckets for the test IP/user)
// ===========================================================================

describe("4.5 — Auth rate limiting kicks in after 5 requests per minute", () => {
  // Skipped in dev environments without Upstash Redis — limiter is a no-op there.
  it.skipIf(!HAS_REDIS)(
    "6th rapid registration attempt returns 429 with a Retry-After header",
    async () => {
      const requests = Array.from({ length: 6 }, (_, i) =>
        postJson(`${BASE}/api/auth/register`, {
          screenname: `rl_auth_${Date.now()}_${i}`,
          email:      `rl_auth_${Date.now()}_${i}@example.com`,
          password:   "ValidPass123",
        })
      );
      const responses = await Promise.all(requests);
      const statuses  = responses.map((r) => r.status);

      expect(statuses).toContain(429);

      const limited = responses.find((r) => r.status === 429)!;
      expect(limited.headers.get("Retry-After")).not.toBeNull();
    }
  );
});

describe("4.6 — Post rate limiting kicks in after 10 posts per minute", () => {
  it.skipIf(!HAS_REDIS)(
    "11th rapid post creation returns 429",
    async () => {
      const requests = Array.from({ length: 11 }, (_, i) =>
        postJson(`${BASE}/api/posts`, { content: `Rate limit test post ${i}` }, alphaCookies)
      );
      const responses = await Promise.all(requests);
      const statuses  = responses.map((r) => r.status);

      expect(statuses).toContain(429);
    }
  );
});
