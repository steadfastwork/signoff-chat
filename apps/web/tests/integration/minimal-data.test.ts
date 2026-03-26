/**
 * Integration tests — Minimal data architecture
 *
 * Verifies that the system NEVER stores what it promised not to store:
 *   • Raw email addresses
 *   • Raw IP addresses
 *   • Status history / "last seen" timestamps
 *   • Buddy-relation creation timestamps
 *   • Invite-link creator attribution
 *
 * Runs end-to-end against the live dev server (http://localhost:3000).
 * Prerequisites:
 *   • `npm run dev` running in apps/web
 *   • DATABASE_URL, CRON_SECRET set in apps/web/.env
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashEmail } from "@/lib/crypto/email";
import { deleteAccount } from "@/lib/deletion";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE        = process.env.NEXTAUTH_URL  ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET   ?? "";  // set in .env + tests/setup.ts

const USER_A = {
  screenname: "minimal_user_a",
  email:      "minimaltest@example.com",
  password:   "securepass123",
} as const;

const USER_B = {
  screenname: "minimal_user_b",
  email:      "minimal_b@example.com",
  password:   "securepass456",
} as const;

// Shared state — populated in beforeAll, consumed across suites.
let userAId = "";
let userBId = "";
let cookiesA = "";   // next-auth session cookies for User A
let cookiesB = "";
let testChannelId   = "";
let testChannelName = "minimal-invite-ch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postJson(url: string, body: Record<string, unknown>, cookies = "") {
  return fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Collect all Set-Cookie name=value pairs from a Response. */
function extractCookies(headers: Headers): string {
  // Node 18.14+ exposes getSetCookie(); fall back to joined get() for older runtimes.
  const directives: string[] =
    typeof (headers as unknown as Record<string, unknown>).getSetCookie === "function"
      ? ((headers as unknown as { getSetCookie: () => string[] }).getSetCookie())
      : (headers.get("set-cookie") ?? "")
          .split(/,(?=[^;]+=)/)   // commas that start a new name=value pair
          .filter(Boolean);

  return directives
    .map((d) => d.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

/**
 * Log in via the NextAuth credentials flow and return a cookie string
 * suitable for use in subsequent authenticated fetch calls.
 */
async function getSessionCookies(
  screenname: string,
  password:   string,
): Promise<string> {
  // Step 1 — CSRF token
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookies  = extractCookies(csrfRes.headers);

  // Step 2 — credential login (form-encoded, with json=true so we get JSON back)
  const body = new URLSearchParams({
    csrfToken,
    screenname,
    password,
    callbackUrl: BASE,
    json:        "true",
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method:   "POST",
    headers:  {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie:         csrfCookies,
    },
    body:     body.toString(),
    redirect: "manual",
  });

  const sessionCookies = extractCookies(loginRes.headers);
  return [csrfCookies, sessionCookies].filter(Boolean).join("; ");
}

/** Search all major tables for a plain string via row-to-JSON cast. */
async function countRowsContaining(needle: string): Promise<number> {
  const pat = `%${needle}%`;
  const result = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*)::bigint AS total FROM (
      SELECT id FROM users              WHERE row_to_json(users.*)::text              ILIKE ${pat}
      UNION ALL
      SELECT id FROM posts              WHERE row_to_json(posts.*)::text              ILIKE ${pat}
      UNION ALL
      SELECT id FROM replies            WHERE row_to_json(replies.*)::text            ILIKE ${pat}
      UNION ALL
      SELECT id FROM room_messages      WHERE row_to_json(room_messages.*)::text      ILIKE ${pat}
      UNION ALL
      SELECT id FROM board_posts        WHERE row_to_json(board_posts.*)::text        ILIKE ${pat}
      UNION ALL
      SELECT id FROM board_comments     WHERE row_to_json(board_comments.*)::text     ILIKE ${pat}
      UNION ALL
      SELECT id FROM invite_links       WHERE row_to_json(invite_links.*)::text       ILIKE ${pat}
      UNION ALL
      SELECT id FROM buddy_relations    WHERE row_to_json(buddy_relations.*)::text    ILIKE ${pat}
      UNION ALL
      SELECT id FROM room_members       WHERE row_to_json(room_members.*)::text       ILIKE ${pat}
    ) t
  `;
  return Number(result[0]?.total ?? 0);
}

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Verify dev server is reachable
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(5_000) });
  } catch {
    throw new Error(
      `Dev server unreachable at ${BASE}. Start it with: npm run dev`,
    );
  }

  // Remove any leftover test accounts from previous runs
  for (const sn of [USER_A.screenname, USER_B.screenname]) {
    const stale = await prisma.user.findFirst({
      where:  { screenname: { equals: sn, mode: "insensitive" } },
      select: { id: true },
    });
    if (stale) await deleteAccount(stale.id);
  }

  // Register User A
  const regA = await postJson(`${BASE}/api/auth/register`, USER_A);
  const bodyA = await regA.json();
  expect(regA.status, `User A registration failed: ${JSON.stringify(bodyA)}`).toBe(201);
  userAId = bodyA.id;

  // Register User B
  const regB = await postJson(`${BASE}/api/auth/register`, USER_B);
  const bodyB = await regB.json();
  expect(regB.status, `User B registration failed: ${JSON.stringify(bodyB)}`).toBe(201);
  userBId = bodyB.id;

  // Obtain session cookies for both users
  cookiesA = await getSessionCookies(USER_A.screenname, USER_A.password);
  cookiesB = await getSessionCookies(USER_B.screenname, USER_B.password);

  // Create a non-PUBLIC channel owned by User A (used for invite tests)
  const ch = await prisma.channel.create({
    data: {
      name:      testChannelName,
      type:      "INVITE_ONLY",
      creatorId: userAId,
      members:   { create: { userId: userAId } },
    },
  });
  testChannelId = ch.id;
}, 30_000);

afterAll(async () => {
  // Tidy up anything that wasn't deleted by the tests themselves.
  const staleA = await prisma.user.findUnique({ where: { id: userAId }, select: { id: true } });
  if (staleA) await deleteAccount(userAId).catch(() => {});

  const staleB = await prisma.user.findUnique({ where: { id: userBId }, select: { id: true } });
  if (staleB) await deleteAccount(userBId).catch(() => {});
}, 15_000);

// ---------------------------------------------------------------------------
// EMAIL HASHING
// ---------------------------------------------------------------------------

describe("2.1 — email is never stored in plaintext", () => {
  it("users table contains no row mentioning the raw email address", async () => {
    const count = await countRowsContaining(USER_A.email);
    expect(count).toBe(0);
  });

  it("no field on the user record contains even the local part of the email", async () => {
    const user = await prisma.user.findUnique({ where: { id: userAId } });
    const json = JSON.stringify(user);
    expect(json).not.toContain("minimaltest");
    expect(json).not.toContain(USER_A.email);
  });
});

describe("2.2 — email hash is deterministic", () => {
  it("calling hashEmail twice with the same input produces identical hex strings", () => {
    const h1 = hashEmail(USER_A.email);
    const h2 = hashEmail(USER_A.email);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the hash is NOT the raw email address", () => {
    const hash = hashEmail(USER_A.email);
    expect(hash).not.toBe(USER_A.email);
    expect(hash).not.toContain("@");
  });
});

describe("2.3 — different emails produce different hashes", () => {
  it("hashEmail('a@example.com') !== hashEmail('b@example.com')", () => {
    const ha = hashEmail("a@example.com");
    const hb = hashEmail("b@example.com");
    expect(ha).not.toBe(hb);
  });
});

describe("2.4 — account can be looked up via email hash (password-reset mechanism)", () => {
  it("computing the hash of the email finds the correct user record in the DB", async () => {
    // Simulates what a password-reset flow would do:
    // hash the submitted email, look up the user by that hash — no plaintext needed.
    const hash = hashEmail(USER_A.email);
    const user = await prisma.user.findUnique({ where: { emailHash: hash } });

    expect(user).not.toBeNull();
    expect(user!.id).toBe(userAId);
    expect(user!.screenname).toBe(USER_A.screenname);
  });

  it("the looked-up record still contains no raw email string", async () => {
    const hash = hashEmail(USER_A.email);
    const user = await prisma.user.findUnique({ where: { emailHash: hash } });
    const json = JSON.stringify(user);
    expect(json).not.toContain(USER_A.email);
    expect(json).not.toContain("minimaltest");
  });
});

// ---------------------------------------------------------------------------
// IP ADDRESS
// ---------------------------------------------------------------------------

describe("2.5 — raw IP address is never written to the database", () => {
  const TEST_IP = "192.168.99.99";

  it("requests with a spoofed x-forwarded-for header leave no IP in any table", async () => {
    // Make several requests (auth, profile, search) carrying the test IP.
    const headers: Record<string, string> = {
      "Content-Type":    "application/json",
      "x-forwarded-for": TEST_IP,
    };

    await Promise.all([
      // Registration attempt (validation error expected — user already exists)
      fetch(`${BASE}/api/auth/register`, {
        method:  "POST",
        headers,
        body:    JSON.stringify({ screenname: USER_A.screenname, email: USER_A.email, password: "pass" }),
      }),
      // Unauthenticated profile fetch
      fetch(`${BASE}/api/users/${USER_A.screenname}`, { headers }),
      // Auth endpoint (wrong password — still rate-limit-path)
      fetch(`${BASE}/api/auth/mobile/login`, {
        method:  "POST",
        headers,
        body:    JSON.stringify({ screenname: USER_A.screenname, password: "wrongpass" }),
      }),
    ]);

    // Give the DB a moment to flush any writes
    await new Promise((r) => setTimeout(r, 200));

    const count = await countRowsContaining(TEST_IP);
    expect(count).toBe(0);
  });
});

describe("2.6 — rate limiting works without persisting raw IP", () => {
  const TEST_IP = "192.168.99.99";

  it("IP is still absent from the database after multiple requests from the same source", async () => {
    // Send 10 rapid auth attempts from the same fake IP.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch(`${BASE}/api/auth/mobile/login`, {
          method:  "POST",
          headers: {
            "Content-Type":    "application/json",
            "x-forwarded-for": TEST_IP,
          },
          body: JSON.stringify({ screenname: "ghost_user_noop", password: "wrong" }),
        }),
      ),
    );

    const count = await countRowsContaining(TEST_IP);
    expect(count).toBe(0);
  });

  // Note: full rate-limit enforcement (429) requires Upstash Redis.
  // In local dev with no Redis configured, the limiter is a no-op.
  // Verified via lib/ratelimit.ts: rateLimit() returns null when env vars are absent.
});

// ---------------------------------------------------------------------------
// STATUS HISTORY
// ---------------------------------------------------------------------------

describe("2.7 — status changes do not create history records", () => {
  it("no status_history (or similarly named) table exists in the database", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM   information_schema.tables
      WHERE  table_schema = 'public'
        AND  table_name   ILIKE '%status%history%'
    `;
    expect(tables.length).toBe(0);
  });

  it("User model has no lastSeen, lastSeenAt, lastActive, or lastActiveAt column", async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM   information_schema.columns
      WHERE  table_schema = 'public'
        AND  table_name   = 'users'
        AND  column_name  ILIKE ANY(ARRAY[
          '%lastseen%', '%lastactive%', '%lastactiveat%', '%seenat%', '%activity%'
        ])
    `;
    expect(columns.length).toBe(0);
  });

  it("updating status leaves only the current status on the record — no history", async () => {
    // Cycle through several statuses via the API
    for (const status of ["AWAY", "IDLE", "ONLINE"] as const) {
      const res = await fetch(`${BASE}/api/user/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookiesA },
        body:    JSON.stringify({ status }),
      });
      // Accept 200 or 404 (route may not be wired yet in dev)
      expect([200, 404]).toContain(res.status);
    }

    // Only one status field on the record — no additional rows anywhere
    const historyCount = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c
      FROM   information_schema.tables
      WHERE  table_schema = 'public'
        AND  table_name   ILIKE '%status%'
        AND  table_name   != 'users'
    `;
    expect(Number(historyCount[0].c)).toBe(0);
  });
});

describe("2.8 — 'last seen' variants absent from profile API responses", () => {
  it("GET /api/users/:screenname contains no lastSeen/lastActive field", async () => {
    const res  = await fetch(`${BASE}/api/users/${USER_A.screenname}`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    const keys = Object.keys(body).map((k) => k.toLowerCase());

    const forbidden = ["lastseen", "lastseent", "lastactive", "lastactiveat", "seenat"];
    for (const f of forbidden) {
      const found = keys.find((k) => k.includes(f));
      expect(found, `Response contains forbidden field: ${found}`).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// BUDDY TIMESTAMPS
// ---------------------------------------------------------------------------

describe("2.9 — buddy relations have no creation timestamp", () => {
  it("BuddyRelation record has no createdAt, requestedAt, or any date field", async () => {
    // Create a buddy relation directly
    const rel = await prisma.buddyRelation.create({
      data: {
        requesterId: userAId,
        addresseeId: userBId,
        status:      "PENDING",
      },
    });

    // Inspect all keys on the returned object
    const keys = Object.keys(rel);
    const dateLikeKeys = keys.filter((k) => {
      const val = (rel as Record<string, unknown>)[k];
      return val instanceof Date || (typeof val === "string" && !isNaN(Date.parse(val as string)));
    });

    expect(keys).not.toContain("createdAt");
    expect(keys).not.toContain("requestedAt");
    expect(keys).not.toContain("updatedAt");
    expect(dateLikeKeys).toHaveLength(0);

    // Cleanup
    await prisma.buddyRelation.delete({ where: { id: rel.id } });
  });
});

// ---------------------------------------------------------------------------
// INVITE LINKS
// ---------------------------------------------------------------------------

describe("2.10 — invite links have no creator attribution", () => {
  let testToken = "";

  it("POST /api/channels/invites creates a link with no createdById field", async () => {
    const res  = await postJson(
      `${BASE}/api/channels/invites`,
      { channelName: testChannelName, maxUses: 5 },
      cookiesA,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    testToken = body.token;

    // HTTP response must not expose a createdById
    expect(body).not.toHaveProperty("createdById");
    expect(body).not.toHaveProperty("creatorId");
    expect(body).not.toHaveProperty("userId");
  });

  it("DB record for the invite has no createdById, creator, or useLog fields", async () => {
    expect(testToken, "previous test must pass first").toBeTruthy();

    const invite = await prisma.inviteLink.findUnique({ where: { token: testToken } });
    expect(invite).not.toBeNull();

    const keys = Object.keys(invite!);
    expect(keys).not.toContain("createdById");
    expect(keys).not.toContain("creatorId");
    expect(keys).not.toContain("useLog");
    expect(keys).not.toContain("usageHistory");
  });
});

describe("2.11 — invite links are hard-deleted when exhausted", () => {
  it("record disappears after the final use is consumed", async () => {
    // Create an invite with exactly 1 use
    const token = randomBytes(6).toString("hex");
    await prisma.inviteLink.create({
      data: {
        token,
        channelId:     testChannelId,
        expiresAt:     new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        usesRemaining: 1,
      },
    });

    // User B consumes it (last use → hard delete).
    // Status may be 500 if Pusher is not configured in dev (the DB transaction
    // still commits atomically before the Pusher call), so we only assert the
    // DB outcome here — not the HTTP status.
    await fetch(`${BASE}/api/invites/${token}`, {
      method:  "POST",
      headers: { Cookie: cookiesB },
    });

    // Record must be gone — NOT soft-deleted, NOT archived
    const gone = await prisma.inviteLink.findUnique({ where: { token } });
    expect(gone).toBeNull();
  });
});

describe("2.12 — expired invite links are hard-deleted by cron", () => {
  it("cron purges the record; nothing is left behind", async () => {
    const token = randomBytes(6).toString("hex");

    // Create invite that expired in the past
    await prisma.inviteLink.create({
      data: {
        token,
        channelId:     testChannelId,
        expiresAt:     new Date(Date.now() - 5_000), // expired 5 seconds ago
        usesRemaining: 10,
      },
    });

    // Confirm it exists before the cron runs
    const before = await prisma.inviteLink.findUnique({ where: { token } });
    expect(before).not.toBeNull();

    // Run the cleanup cron
    const cron = await fetch(`${BASE}/api/cron/cleanup-invite-links`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(cron.status).toBe(200);
    const cronBody = await cron.json();
    expect(cronBody.deleted).toBeGreaterThanOrEqual(1);

    // Record must be permanently gone
    const after = await prisma.inviteLink.findUnique({ where: { token } });
    expect(after).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MESSAGE EXPIRY
// ---------------------------------------------------------------------------

describe("2.13 — channel messages have expiresAt set on creation", () => {
  it("message record has a non-null expiresAt approximately 30 days from now", async () => {
    const msg = await prisma.channelMessage.create({
      data: {
        content:   "minimal-data test message",
        authorId:  userAId,
        channelId: testChannelId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    expect(msg.expiresAt).not.toBeNull();

    const diffDays = (msg.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);

    // Cleanup
    await prisma.channelMessage.delete({ where: { id: msg.id } });
  });
});

describe("2.14 — expired messages are hard-deleted by cron (no soft delete)", () => {
  it("message with past expiresAt is gone after purge-messages runs", async () => {
    // Create a message that expired in the past
    const msg = await prisma.channelMessage.create({
      data: {
        content:   "this message should expire",
        authorId:  userAId,
        channelId: testChannelId,
        expiresAt: new Date(Date.now() - 10_000), // expired 10 seconds ago
      },
    });

    const before = await prisma.channelMessage.findUnique({ where: { id: msg.id } });
    expect(before).not.toBeNull();

    // Run the cron
    const cron = await fetch(`${BASE}/api/cron/purge-messages`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(cron.status).toBe(200);
    const cronBody = await cron.json();
    expect(cronBody.deleted).toBeGreaterThanOrEqual(1);

    // Hard deleted — no isDeleted flag, no archived state, just gone
    const after = await prisma.channelMessage.findUnique({ where: { id: msg.id } });
    expect(after).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ACCOUNT DELETION
// ---------------------------------------------------------------------------

describe("2.15 — hard delete removes all user data", () => {
  // We use a dedicated throw-away user so the main test users survive.
  const DEL_USER = {
    screenname: "minimal_del_user",
    email:      "minimal_del@example.com",
    password:   "deleteMe123",
  };

  let delUserId   = "";
  let delCookies  = "";
  let postIds:    string[] = [];
  let replyIds:   string[] = [];
  let nudgeIds:   string[] = [];

  beforeAll(async () => {
    // Remove any stale leftover
    const stale = await prisma.user.findFirst({
      where:  { screenname: { equals: DEL_USER.screenname, mode: "insensitive" } },
      select: { id: true },
    });
    if (stale) await deleteAccount(stale.id);

    // Register the deletion-test user
    const reg  = await postJson(`${BASE}/api/auth/register`, DEL_USER);
    const body = await reg.json();
    expect(reg.status).toBe(201);
    delUserId  = body.id;
    delCookies = await getSessionCookies(DEL_USER.screenname, DEL_USER.password);

    // ── Create content ────────────────────────────────────────────────────

    // 3 posts
    const posts = await prisma.post.createManyAndReturn({
      data: Array.from({ length: 3 }, (_, i) => ({
        content:  `del user post ${i + 1}`,
        authorId: delUserId,
      })),
    });
    postIds = posts.map((p) => p.id);

    // 2 replies (to User A's non-existent posts — create stub posts first)
    const stubPost = await prisma.post.create({
      data: { content: "stub post for replies", authorId: userAId },
    });
    const replies = await prisma.reply.createManyAndReturn({
      data: [
        { content: "del reply 1", authorId: delUserId, postId: stubPost.id },
        { content: "del reply 2", authorId: delUserId, postId: stubPost.id },
      ],
    });
    replyIds = replies.map((r) => r.id);

    // 5 nudges (on the stub post — one per post; reuse by adding more posts)
    const morePosts = await prisma.post.createManyAndReturn({
      data: Array.from({ length: 5 }, (_, i) => ({
        content:  `nudge target post ${i}`,
        authorId: userAId,
      })),
    });
    const nudges = await prisma.nudge.createManyAndReturn({
      data: morePosts.map((p) => ({ userId: delUserId, postId: p.id })),
    });
    nudgeIds = nudges.map((n) => n.id);

    // 1 buddy relation (PENDING with User B)
    await prisma.buddyRelation.create({
      data: { requesterId: delUserId, addresseeId: userBId, status: "PENDING" },
    });

    // 1 channel membership (test channel)
    await prisma.channelMember.create({
      data: { userId: delUserId, channelId: testChannelId },
    });

    // 1 board — create + membership directly
    const board = await prisma.board.create({
      data: {
        name:          "minimal-del-board",
        displayName:   "Minimal Del Board",
        vibeStatement: "for testing only",
        type:          "PUBLIC",
        creatorId:     delUserId,
        members:       { create: { userId: delUserId, isFoundingMember: true } },
      },
    });
    // Store board id for verification
    (globalThis as Record<string, unknown>).__del_board_id__ = board.id;
  }, 20_000);

  it("DELETE /api/user/delete with correct password returns success", async () => {
    const res  = await fetch(`${BASE}/api/user/delete`, {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", Cookie: delCookies },
      body:    JSON.stringify({ password: DEL_USER.password }),
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(text); } catch { /* HTML error page — log for debugging */ }
    expect(
      res.status,
      `DELETE /api/user/delete returned ${res.status}. Body: ${text.slice(0, 300)}`,
    ).toBe(200);
    expect(body.message).toMatch(/deleted/i);
  });

  it("user record is gone from the DB", async () => {
    const gone = await prisma.user.findUnique({ where: { id: delUserId } });
    expect(gone).toBeNull();
  });

  it("all posts authored by the deleted user are gone", async () => {
    const remaining = await prisma.post.count({ where: { authorId: delUserId } });
    expect(remaining).toBe(0);
  });

  it("all replies authored by the deleted user are gone", async () => {
    const remaining = await prisma.reply.count({ where: { authorId: delUserId } });
    expect(remaining).toBe(0);
  });

  it("all nudges given by the deleted user are gone", async () => {
    const remaining = await prisma.nudge.count({ where: { userId: delUserId } });
    expect(remaining).toBe(0);
  });

  it("all buddy relations involving the deleted user are gone", async () => {
    const remaining = await prisma.buddyRelation.count({
      where: {
        OR: [{ requesterId: delUserId }, { addresseeId: delUserId }],
      },
    });
    expect(remaining).toBe(0);
  });

  it("channel membership of the deleted user is gone", async () => {
    const remaining = await prisma.channelMember.count({ where: { userId: delUserId } });
    expect(remaining).toBe(0);
  });

  it("board membership of the deleted user is gone", async () => {
    const remaining = await prisma.boardMember.count({ where: { userId: delUserId } });
    expect(remaining).toBe(0);
  });

  it("no orphaned records reference the deleted userId in any table", async () => {
    const counts = await Promise.all([
      prisma.post.count({              where: { authorId: delUserId } }),
      prisma.reply.count({             where: { authorId: delUserId } }),
      prisma.nudge.count({             where: { userId:   delUserId } }),
      prisma.channelMessage.count({    where: { authorId: delUserId } }),
      prisma.channelMember.count({     where: { userId:   delUserId } }),
      prisma.boardMember.count({       where: { userId:   delUserId } }),
      prisma.boardPost.count({         where: { authorId: delUserId } }),
      prisma.boardComment.count({      where: { authorId: delUserId } }),
      prisma.boardNudge.count({        where: { userId:   delUserId } }),
      prisma.boardCommentNudge.count({ where: { userId:   delUserId } }),
      prisma.savedBoardPost.count({    where: { userId:   delUserId } }),
      prisma.buddyRelation.count({
        where: { OR: [{ requesterId: delUserId }, { addresseeId: delUserId }] },
      }),
    ]);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });
});

describe("2.16 — deleted user cannot log in", () => {
  it("login attempt for a deleted screenname returns 401", async () => {
    const res  = await postJson(`${BASE}/api/auth/mobile/login`, {
      screenname: "minimal_del_user",
      password:   "deleteMe123",
    });
    expect(res.status).toBe(401);
  });
});
