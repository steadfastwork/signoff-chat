/**
 * E2E Journey Tests — full user-flow integration tests.
 *
 * Runs end-to-end against the live dev server (http://localhost:3000).
 * Prerequisites:
 *   • `npm run dev` running in apps/web
 *   • DATABASE_URL in apps/web/.env pointing to a live PostgreSQL instance
 *
 * Run with:
 *   npx vitest run tests/e2e/journeys.test.ts
 *
 * Notes on Soketi / Pusher:
 *   Routes that call pusherServer.trigger() may return 500 when SOKETI_*
 *   env vars are not configured. In those cases the DB write still commits
 *   (it happens before the trigger call), so tests verify state via Prisma.
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

// ---------------------------------------------------------------------------
// Read the dev server's actual NEXTAUTH_SECRET from .env — tests/setup.ts
// overrides process.env.NEXTAUTH_SECRET with a placeholder before this runs.
// ---------------------------------------------------------------------------

const _envPath = resolve(__dirname, "../../.env");
const _envVars = parseDotenv(readFileSync(_envPath, "utf8"));
const SERVER_NEXTAUTH_SECRET =
  _envVars.NEXTAUTH_SECRET ?? "dev-secret-change-in-production";
const CRON_SECRET =
  process.env.CRON_SECRET ?? "test-cron-secret-min-32-chars-xxx";

const BASE = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Unique suffix to prevent name collisions across parallel or repeated runs.
const ts = String(Date.now()).slice(-8);

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function postJson(url: string, body: Record<string, unknown>, cookies?: string) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
  });
}

function getReq(url: string, cookies?: string) {
  return fetch(url, { headers: cookies ? { Cookie: cookies } : {} });
}

function patchJson(url: string, body: Record<string, unknown>, cookies?: string) {
  return fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
  });
}

function deleteJson(url: string, body: Record<string, unknown>, cookies?: string) {
  return fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// createTestUser — inserts directly into DB (bypasses auth rate limit)
// ---------------------------------------------------------------------------

async function createTestUser(user: {
  screenname: string;
  email: string;
  password: string;
}): Promise<string> {
  const [emailHash, passwordHash] = await Promise.all([
    Promise.resolve(hashEmail(user.email)),
    hashPassword(user.password),
  ]);
  const stale = await prisma.user.findFirst({
    where: { screenname: { equals: user.screenname, mode: "insensitive" } },
    select: { id: true },
  });
  if (stale) await deleteAccount(stale.id);
  const created = await prisma.user.create({
    data: { screenname: user.screenname, emailHash, passwordHash },
    select: { id: true },
  });
  return created.id;
}

// ---------------------------------------------------------------------------
// makeSessionCookie — mints a NextAuth JWT matching the dev server's secret
// ---------------------------------------------------------------------------

async function makeSessionCookie(
  userId: string,
  screenname: string
): Promise<string> {
  const token = await encode({
    secret: SERVER_NEXTAUTH_SECRET,
    token: {
      sub:                  userId,
      id:                   userId,
      screenname,
      isGoldMember:         false,
      adminRole:            null,
      isSuspended:          false,
      suspendedUntil:       null,
      avatarColor:          deriveAvatarColor(userId),
      suspensionCheckedAt:  Date.now(),
    },
    maxAge: 60 * 60,
  });
  return `next-auth.session-token=${token}`;
}

// ---------------------------------------------------------------------------
// Global pre-flight: verify dev server is up + clear rate-limit buckets
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await fetch(BASE, { signal: AbortSignal.timeout(5_000) }).catch(() => {
    throw new Error(
      `Dev server unreachable at ${BASE}. Run \`npm run dev\` in apps/web.`
    );
  });

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    let cursor = 0;
    do {
      const [next, keys] = await redis.scan(cursor, { match: "sc:rl:*", count: 100 });
      cursor = parseInt(String(next), 10);
      if (keys.length > 0) await redis.del(...(keys as [string, ...string[]]));
    } while (cursor !== 0);
  }
}, 15_000);

// ===========================================================================
// JOURNEY 1 — New User Onboarding
// ===========================================================================

describe("Journey 1 — New User Onboarding", () => {
  const j1 = {
    screenname: `j1u${ts}`,
    email:      `j1u${ts}@example.com`,
    password:   "Journey1Pass!",
  };
  let j1UserId  = "";
  let j1Cookies = "";

  afterAll(async () => {
    if (j1UserId) await deleteAccount(j1UserId).catch(() => {});
  });

  it("1.1 — registers via POST /api/auth/register → 201", async () => {
    // Clean up any leftover from a previous run
    const stale = await prisma.user.findFirst({
      where:  { screenname: { equals: j1.screenname, mode: "insensitive" } },
      select: { id: true },
    });
    if (stale) await deleteAccount(stale.id);

    const res  = await postJson(`${BASE}/api/auth/register`, j1);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(typeof body.id).toBe("string");
    j1UserId = body.id;
  });

  it("1.2 — email is stored as a hash, not the plaintext address", async () => {
    const user = await prisma.user.findUnique({
      where:  { id: j1UserId },
      select: { emailHash: true },
    });
    expect(user?.emailHash).toBeDefined();
    expect(user?.emailHash).not.toBe(j1.email);
    // A hash of an email address must not look like an email
    expect(user?.emailHash).not.toMatch(/@/);
  });

  it("1.3 — default status is ONLINE", async () => {
    const user = await prisma.user.findUnique({
      where:  { id: j1UserId },
      select: { status: true },
    });
    expect(user?.status).toBe("ONLINE");
  });

  it("1.4 — PATCH /api/profile with awayMessage succeeds", async () => {
    j1Cookies = await makeSessionCookie(j1UserId, j1.screenname);
    const res = await patchJson(
      `${BASE}/api/profile`,
      { awayMessage: "out for a walk" },
      j1Cookies
    );
    expect(res.status).toBe(200);
  });

  it("1.5 — awayMessage is persisted in the database", async () => {
    const user = await prisma.user.findUnique({
      where:  { id: j1UserId },
      select: { awayMessage: true },
    });
    expect(user?.awayMessage).toBe("out for a walk");
  });
});

// ===========================================================================
// JOURNEY 2 — Making a Buddy
// ===========================================================================

describe("Journey 2 — Making a Buddy", () => {
  const j2alice = { screenname: `j2alice${ts}`, email: `j2a${ts}@example.com`, password: "AlicePass1!" };
  const j2bob   = { screenname: `j2bob${ts}`,   email: `j2b${ts}@example.com`, password: "BobPass1!"   };

  let aliceId      = "";
  let bobId        = "";
  let aliceCookies = "";
  let bobCookies   = "";
  let alicePostId  = "";
  let relationId   = "";

  beforeAll(async () => {
    aliceId      = await createTestUser(j2alice);
    bobId        = await createTestUser(j2bob);
    aliceCookies = await makeSessionCookie(aliceId, j2alice.screenname);
    bobCookies   = await makeSessionCookie(bobId,   j2bob.screenname);
  }, 15_000);

  afterAll(async () => {
    await deleteAccount(aliceId).catch(() => {});
    await deleteAccount(bobId).catch(() => {});
  });

  it("2.1 — alice sends a buddy request to bob", async () => {
    const res  = await postJson(
      `${BASE}/api/buddies`,
      { targetScreenname: j2bob.screenname },
      aliceCookies
    );
    // Route calls pusherServer.trigger — may 500 if Soketi not configured;
    // the BuddyRelation record is written before the trigger so check DB.
    const body = res.status === 201 ? await res.json() : null;
    if (body) relationId = body.id;

    const rel = await prisma.buddyRelation.findFirst({
      where: { requesterId: aliceId, addresseeId: bobId },
    });
    expect(rel).not.toBeNull();
    expect(rel!.status).toBe("PENDING");
    if (!relationId) relationId = rel!.id;
  });

  it("2.2 — BuddyRelation has no createdAt field (privacy spec §3)", async () => {
    const rel = await prisma.buddyRelation.findFirst({
      where: { requesterId: aliceId, addresseeId: bobId },
    });
    // The schema intentionally omits createdAt on BuddyRelation
    expect((rel as Record<string, unknown>).createdAt).toBeUndefined();
  });

  it("2.3 — GET /api/buddies/requests shows alice's pending request for bob", async () => {
    const res  = await getReq(`${BASE}/api/buddies/requests`, bobCookies);
    const body = await res.json();
    expect(res.status).toBe(200);
    const request = (body as { id: string; screenname: string }[]).find(
      (r) => r.screenname === j2alice.screenname
    );
    expect(request).toBeDefined();
  });

  it("2.4 — bob accepts alice's buddy request", async () => {
    // PATCH /api/buddies/[requesterId] — aliceId is the requester
    await patchJson(
      `${BASE}/api/buddies/${aliceId}`,
      { action: "accept" },
      bobCookies
    );
    // Route may 500 due to Soketi — verify via DB
    const rel = await prisma.buddyRelation.findFirst({
      where: { requesterId: aliceId, addresseeId: bobId },
    });
    expect(rel!.status).toBe("ACCEPTED");
  });

  it("2.5 — alice creates a post (via Prisma to avoid Soketi dependency)", async () => {
    const post = await prisma.post.create({
      data: { content: "hello buddies!", authorId: aliceId, privacy: "PUBLIC" },
    });
    alicePostId = post.id;
    expect(alicePostId).toBeTruthy();
  });

  it("2.6 — bob's feed includes alice's post", async () => {
    const res  = await getReq(`${BASE}/api/posts`, bobCookies);
    const body = await res.json();
    expect(res.status).toBe(200);
    const ids = (body.posts as { id: string }[]).map((p) => p.id);
    expect(ids).toContain(alicePostId);
  });

  it("2.7 — bob nudges alice's post → nudgedByMe:true, count:1", async () => {
    const res  = await postJson(
      `${BASE}/api/posts/${alicePostId}/nudge`,
      {},
      bobCookies
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.nudgedByMe).toBe(true);
    expect(body.count).toBe(1);
  });

  it("2.8 — bob un-nudges alice's post → nudgedByMe:false, count:0", async () => {
    const res  = await postJson(
      `${BASE}/api/posts/${alicePostId}/nudge`,
      {},
      bobCookies
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.nudgedByMe).toBe(false);
    expect(body.count).toBe(0);
  });
});

// ===========================================================================
// JOURNEY 3 — Channel Privacy
// ===========================================================================

describe("Journey 3 — Channel Privacy (SECRET channel)", () => {
  const j3alice = { screenname: `j3alice${ts}`, email: `j3a${ts}@example.com`, password: "AlicePass3!" };
  const j3bob   = { screenname: `j3bob${ts}`,   email: `j3b${ts}@example.com`, password: "BobPass3!"   };
  const j3carol = { screenname: `j3carol${ts}`, email: `j3c${ts}@example.com`, password: "CarolPass3!" };

  let aliceId      = "";
  let bobId        = "";
  let carolId      = "";
  let aliceCookies = "";
  let bobCookies   = "";
  let carolCookies = "";

  const channelName = `j3ch${ts}`;  // e.g. "j3ch12345678" — valid slug
  let inviteToken   = "";
  let messageId     = "";

  beforeAll(async () => {
    aliceId      = await createTestUser(j3alice);
    bobId        = await createTestUser(j3bob);
    carolId      = await createTestUser(j3carol);
    aliceCookies = await makeSessionCookie(aliceId, j3alice.screenname);
    bobCookies   = await makeSessionCookie(bobId,   j3bob.screenname);
    carolCookies = await makeSessionCookie(carolId, j3carol.screenname);
  }, 15_000);

  afterAll(async () => {
    await deleteAccount(aliceId).catch(() => {});
    await deleteAccount(bobId).catch(() => {});
    await deleteAccount(carolId).catch(() => {});
  });

  it("3.1 — alice creates a SECRET channel → 201", async () => {
    const res = await postJson(
      `${BASE}/api/channels`,
      { name: channelName, type: "SECRET", slowModeMinutes: 0 },
      aliceCookies
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("SECRET");
  });

  it("3.2 — carol (non-member) GET messages → 404 not 403", async () => {
    const res = await getReq(
      `${BASE}/api/channels/${channelName}/messages`,
      carolCookies
    );
    expect(res.status).toBe(404);
  });

  it("3.3 — alice generates an invite link", async () => {
    const res  = await postJson(
      `${BASE}/api/channels/invites`,
      { channelName, maxUses: 5 },
      aliceCookies
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe("string");
    inviteToken = body.token;
  });

  it("3.4 — invite response does not expose who created the link (no createdById)", async () => {
    const res  = await postJson(
      `${BASE}/api/channels/invites`,
      { channelName, maxUses: 1 },
      aliceCookies
    );
    const body = await res.json();
    expect(body.createdById).toBeUndefined();
    expect(body.creatorId).toBeUndefined();
    expect(body.createdBy).toBeUndefined();
    expect(body.generatedBy).toBeUndefined();
  });

  it("3.5 — bob joins the channel via the invite token", async () => {
    const res  = await postJson(
      `${BASE}/api/invites/${inviteToken}`,
      {},
      bobCookies
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channelName).toBe(channelName);

    // Verify membership in DB
    const channel = await prisma.channel.findUnique({ where: { name: channelName } });
    const member  = await prisma.channelMember.findUnique({
      where: { userId_channelId: { userId: bobId, channelId: channel!.id } },
    });
    expect(member).not.toBeNull();
  });

  it("3.6 — bob sends a message in the channel", async () => {
    // Route calls pusherServer.trigger — may 500 if Soketi not configured.
    // The message IS written to DB before trigger, so verify via DB.
    await postJson(
      `${BASE}/api/channels/${channelName}/messages`,
      { content: "secret channel message" },
      bobCookies
    );
    const channel = await prisma.channel.findUnique({ where: { name: channelName } });
    const msg     = await prisma.channelMessage.findFirst({
      where:   { channelId: channel!.id, authorId: bobId },
      orderBy: { createdAt: "desc" },
    });
    expect(msg).not.toBeNull();
    expect(msg!.content).toBe("secret channel message");
    messageId = msg!.id;
  });

  it("3.7 — message expiresAt is approximately 30 days from now", async () => {
    const msg = await prisma.channelMessage.findUnique({ where: { id: messageId } });
    expect(msg!.expiresAt).not.toBeNull();
    const daysUntilExpiry =
      (msg!.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    // Should be between 29 and 31 days
    expect(daysUntilExpiry).toBeGreaterThan(29);
    expect(daysUntilExpiry).toBeLessThan(31);
  });

  it("3.8 — carol still gets 404 after bob joins (she is still not a member)", async () => {
    const res = await getReq(
      `${BASE}/api/channels/${channelName}/messages`,
      carolCookies
    );
    expect(res.status).toBe(404);
  });

  it("3.9 — bob (member) can GET messages and sees his message", async () => {
    const res  = await getReq(
      `${BASE}/api/channels/${channelName}/messages`,
      bobCookies
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    const ids = (body.messages as { id: string }[]).map((m) => m.id);
    expect(ids).toContain(messageId);
  });
});

// ===========================================================================
// JOURNEY 4 — Board Community
// ===========================================================================

describe("Journey 4 — Board Community", () => {
  const j4creator = { screenname: `j4cre${ts}`, email: `j4cre${ts}@example.com`, password: "CreatorPass4!" };
  const j4u50     = { screenname: `j4u50${ts}`, email: `j4u50${ts}@example.com`, password: "User50Pass4!"  };
  const j4u51     = { screenname: `j4u51${ts}`, email: `j4u51${ts}@example.com`, password: "User51Pass4!"  };

  let creatorId      = "";
  let u50Id          = "";
  let u51Id          = "";
  let creatorCookies = "";
  let u50Cookies     = "";
  let u51Cookies     = "";

  const boardName = `j4b${ts}`;   // e.g. "j4b12345678"
  let boardId     = "";
  let boardPostId = "";

  beforeAll(async () => {
    creatorId      = await createTestUser(j4creator);
    u50Id          = await createTestUser(j4u50);
    u51Id          = await createTestUser(j4u51);
    creatorCookies = await makeSessionCookie(creatorId, j4creator.screenname);
    u50Cookies     = await makeSessionCookie(u50Id,     j4u50.screenname);
    u51Cookies     = await makeSessionCookie(u51Id,     j4u51.screenname);
  }, 15_000);

  afterAll(async () => {
    await deleteAccount(creatorId).catch(() => {});
    await deleteAccount(u50Id).catch(() => {});
    await deleteAccount(u51Id).catch(() => {});
  });

  it("4.1 — creator creates a PUBLIC board → 201", async () => {
    const res  = await postJson(
      `${BASE}/api/boards`,
      {
        name:           boardName,
        displayName:    "Test Board 4",
        vibeStatement:  "A board for journey test 4.",
        type:           "PUBLIC",
      },
      creatorCookies
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    boardId = body.id;
    expect(typeof boardId).toBe("string");
  });

  it("4.2 — board creator is a founding member in the DB", async () => {
    const member = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: creatorId, boardId } },
    });
    expect(member).not.toBeNull();
    expect(member!.isFoundingMember).toBe(true);
  });

  it("4.3 — 50th member (memberCount < 50) is a founding member", async () => {
    // Set memberCount to 49 (simulating 48 members between creator and u50)
    await prisma.board.update({
      where: { id: boardId },
      data:  { memberCount: 49 },
    });

    const res  = await postJson(
      `${BASE}/api/boards/${boardName}/join`,
      {},
      u50Cookies
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isFoundingMember).toBe(true);
  });

  it("4.4 — 51st member (memberCount = 50) is NOT a founding member", async () => {
    // After u50 joined at memberCount=49, the route incremented to 50.
    const board = await prisma.board.findUnique({ where: { id: boardId }, select: { memberCount: true } });
    expect(board!.memberCount).toBe(50);

    const res  = await postJson(
      `${BASE}/api/boards/${boardName}/join`,
      {},
      u51Cookies
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isFoundingMember).toBe(false);
  });

  it("4.5 — creator creates a board post → 201", async () => {
    const res  = await postJson(
      `${BASE}/api/boards/${boardName}/posts`,
      { title: "First board post", body: "Welcome to the board." },
      creatorCookies
    );
    expect(res.status).toBe(201);
    const post = await res.json();
    boardPostId = post.id;
    expect(typeof boardPostId).toBe("string");
  });

  it("4.6 — u50 nudges the board post → nudgedByMe:true, nudgeCount:1", async () => {
    const res  = await postJson(
      `${BASE}/api/boards/${boardName}/posts/${boardPostId}/nudge`,
      {},
      u50Cookies
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nudgedByMe).toBe(true);
    expect(body.nudgeCount).toBe(1);
  });

  it("4.7 — u50 comments on the board post → 201", async () => {
    const res = await postJson(
      `${BASE}/api/boards/${boardName}/posts/${boardPostId}/comments`,
      { body: "Great first post!" },
      u50Cookies
    );
    expect(res.status).toBe(201);
    const comment = await res.json();
    expect(comment.body).toBe("Great first post!");

    // Verify in DB
    const dbComment = await prisma.boardComment.findUnique({
      where: { id: comment.id },
    });
    expect(dbComment).not.toBeNull();
    expect(dbComment!.authorId).toBe(u50Id);
  });
});

// ===========================================================================
// JOURNEY 5 — Block & Safety
// ===========================================================================

describe("Journey 5 — Block & Safety", () => {
  const j5alice = { screenname: `j5alice${ts}`, email: `j5a${ts}@example.com`, password: "AlicePass5!" };
  const j5bob   = { screenname: `j5bob${ts}`,   email: `j5b${ts}@example.com`, password: "BobPass5!"   };
  const j5dave  = { screenname: `j5dave${ts}`,  email: `j5d${ts}@example.com`, password: "DavePass5!"  };

  let aliceId      = "";
  let bobId        = "";
  let daveId       = "";
  let aliceCookies = "";
  let bobCookies   = "";
  let daveCookies  = "";
  let alicePostId  = "";
  let davePostId   = "";

  beforeAll(async () => {
    aliceId      = await createTestUser(j5alice);
    bobId        = await createTestUser(j5bob);
    daveId       = await createTestUser(j5dave);
    aliceCookies = await makeSessionCookie(aliceId, j5alice.screenname);
    bobCookies   = await makeSessionCookie(bobId,   j5bob.screenname);
    daveCookies  = await makeSessionCookie(daveId,  j5dave.screenname);

    // Make alice and bob buddies so bob sees alice's feed posts
    await prisma.buddyRelation.create({
      data: { requesterId: aliceId, addresseeId: bobId, status: "ACCEPTED" },
    });

    // alice and dave: no relation yet (alice will block dave)

    // alice posts
    const alicePost = await prisma.post.create({
      data: { content: "alice's post", authorId: aliceId, privacy: "PUBLIC" },
    });
    alicePostId = alicePost.id;
  }, 15_000);

  afterAll(async () => {
    await deleteAccount(aliceId).catch(() => {});
    await deleteAccount(bobId).catch(() => {});
    await deleteAccount(daveId).catch(() => {});
  });

  it("5.1 — bob's feed contains alice's post (they are buddies)", async () => {
    const res  = await getReq(`${BASE}/api/posts`, bobCookies);
    const body = await res.json();
    expect(res.status).toBe(200);
    const ids = (body.posts as { id: string }[]).map((p) => p.id);
    expect(ids).toContain(alicePostId);
  });

  it("5.2 — alice blocks dave → 200", async () => {
    const res = await postJson(
      `${BASE}/api/users/${j5dave.screenname}/block`,
      {},
      aliceCookies
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.blocked).toBe(true);
  });

  it("5.3 — after being blocked, dave cannot find alice in user search", async () => {
    // Block is bidirectional in getExcludedUserIds — alice should not appear
    // in dave's search results. This tests the full block enforcement in search.
    const res  = await getReq(
      `${BASE}/api/users/search?q=${j5alice.screenname}`,
      daveCookies
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    const found = (body as { screenname: string }[]).find(
      (u) => u.screenname === j5alice.screenname
    );
    expect(found).toBeUndefined();
  });

  it("5.4 — dave's buddy request to alice is rejected (block prevents it)", async () => {
    // The buddy POST route checks for BuddyRelation.status=BLOCKED.
    // The Block model is separate — if block enforcement is only via Block model
    // and not BuddyRelation, this test surfaces the inconsistency.
    const res = await postJson(
      `${BASE}/api/buddies`,
      { targetScreenname: j5alice.screenname },
      daveCookies
    );
    // Expect 403 (blocked) or 404 (hidden user) — not 201
    expect([403, 404]).toContain(res.status);
  });

  it("5.5 — bob blocks alice → 200", async () => {
    const res = await postJson(
      `${BASE}/api/users/${j5alice.screenname}/block`,
      {},
      bobCookies
    );
    expect(res.status).toBe(200);
    expect((await res.json()).blocked).toBe(true);
  });

  it("5.6 — alice's posts are no longer visible in bob's feed after block", async () => {
    const res  = await getReq(`${BASE}/api/posts`, bobCookies);
    const body = await res.json();
    expect(res.status).toBe(200);
    const ids = (body.posts as { id: string }[]).map((p) => p.id);
    expect(ids).not.toContain(alicePostId);
  });

  it("5.7 — bob mutes dave and dave's posts disappear from bob's feed", async () => {
    // Make bob and dave buddies so dave's posts appear in bob's feed
    await prisma.buddyRelation.create({
      data: { requesterId: bobId, addresseeId: daveId, status: "ACCEPTED" },
    });
    const davePost = await prisma.post.create({
      data: { content: "dave's post", authorId: daveId, privacy: "PUBLIC" },
    });
    davePostId = davePost.id;

    // Verify dave's post is visible to bob before mute
    const beforeRes  = await getReq(`${BASE}/api/posts`, bobCookies);
    const beforeBody = await beforeRes.json();
    const beforeIds  = (beforeBody.posts as { id: string }[]).map((p) => p.id);
    expect(beforeIds).toContain(davePostId);

    // Bob mutes dave
    const muteRes = await postJson(
      `${BASE}/api/users/${j5dave.screenname}/mute`,
      {},
      bobCookies
    );
    expect(muteRes.status).toBe(200);
    expect((await muteRes.json()).muted).toBe(true);

    // Dave's post should now be gone from bob's feed
    const afterRes  = await getReq(`${BASE}/api/posts`, bobCookies);
    const afterBody = await afterRes.json();
    const afterIds  = (afterBody.posts as { id: string }[]).map((p) => p.id);
    expect(afterIds).not.toContain(davePostId);
  });
});

// ===========================================================================
// JOURNEY 6 — Account Deletion
// ===========================================================================

describe("Journey 6 — Account Deletion", () => {
  const j6user = {
    screenname: `j6u${ts}`,
    email:      `j6u${ts}@example.com`,
    password:   "DeleteMe6Pass!",
  };

  let j6UserId    = "";
  let j6Cookies   = "";
  let j6PostId    = "";
  let j6ChannelId = "";
  let j6BoardId   = "";

  beforeAll(async () => {
    j6UserId  = await createTestUser(j6user);
    j6Cookies = await makeSessionCookie(j6UserId, j6user.screenname);

    // Create content for this user
    const post = await prisma.post.create({
      data: { content: "j6 farewell post", authorId: j6UserId, privacy: "PUBLIC" },
    });
    j6PostId = post.id;

    // Create a channel and join it
    const ch = await prisma.channel.create({
      data: {
        name:            `j6ch${ts}`,
        type:            "PUBLIC",
        slowModeMinutes: 0,
        creatorId:       j6UserId,
      },
    });
    j6ChannelId = ch.id;
    await prisma.channelMember.create({
      data: { userId: j6UserId, channelId: j6ChannelId },
    });

    // Create a board and join it
    const board = await prisma.board.create({
      data: {
        name:          `j6b${ts}`,
        displayName:   "J6 Board",
        vibeStatement: "Temporary board for journey 6.",
        type:          "PUBLIC",
        creatorId:     j6UserId,
        memberCount:   1,
      },
    });
    j6BoardId = board.id;
    await prisma.boardMember.create({
      data: { userId: j6UserId, boardId: j6BoardId, isFoundingMember: true },
    });
  }, 15_000);

  // No afterAll — the test itself deletes the account (that's the whole point).
  // If the deletion test fails, clean up manually.
  afterAll(async () => {
    if (j6UserId) {
      const still = await prisma.user.findUnique({ where: { id: j6UserId } });
      if (still) await deleteAccount(j6UserId).catch(() => {});
    }
  });

  it("6.1 — setup: user has a post, channel membership, and board membership", async () => {
    const post    = await prisma.post.findUnique({ where: { id: j6PostId } });
    const chMem   = await prisma.channelMember.findFirst({ where: { userId: j6UserId } });
    const boardMem = await prisma.boardMember.findFirst({ where: { userId: j6UserId } });
    expect(post).not.toBeNull();
    expect(chMem).not.toBeNull();
    expect(boardMem).not.toBeNull();
  });

  it("6.2 — DELETE /api/user/delete with correct password → 200", async () => {
    const res = await deleteJson(
      `${BASE}/api/user/delete`,
      { password: j6user.password },
      j6Cookies
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/permanently deleted/i);
  });

  it("6.3 — user record is gone from the database", async () => {
    const user = await prisma.user.findUnique({ where: { id: j6UserId } });
    expect(user).toBeNull();
  });

  it("6.4 — user's posts are gone from the database", async () => {
    const post = await prisma.post.findUnique({ where: { id: j6PostId } });
    expect(post).toBeNull();
  });

  it("6.5 — channel membership is gone from the database", async () => {
    const mem = await prisma.channelMember.findFirst({ where: { userId: j6UserId } });
    expect(mem).toBeNull();
  });

  it("6.6 — board membership is gone from the database", async () => {
    const mem = await prisma.boardMember.findFirst({ where: { userId: j6UserId } });
    expect(mem).toBeNull();
  });
});

// ===========================================================================
// JOURNEY 7 — Message Expiry
// ===========================================================================

describe("Journey 7 — Message Expiry (cron purge)", () => {
  const j7alice = { screenname: `j7alice${ts}`, email: `j7a${ts}@example.com`, password: "AlicePass7!" };

  let aliceId      = "";
  let aliceCookies = "";
  const channelName = `j7ch${ts}`;
  let channelId    = "";
  let messageId    = "";

  beforeAll(async () => {
    aliceId      = await createTestUser(j7alice);
    aliceCookies = await makeSessionCookie(aliceId, j7alice.screenname);

    // Create a PUBLIC channel (creator is auto-joined)
    const res = await postJson(
      `${BASE}/api/channels`,
      { name: channelName, type: "PUBLIC", slowModeMinutes: 0 },
      aliceCookies
    );
    expect(res.status).toBe(201);
    const ch = await prisma.channel.findUnique({ where: { name: channelName } });
    channelId = ch!.id;
  }, 15_000);

  afterAll(async () => {
    await deleteAccount(aliceId).catch(() => {});
  });

  it("7.1 — alice sends a message in the channel", async () => {
    // Route calls pusherServer.trigger — may 500 if Soketi not configured.
    // The message IS written before trigger, so verify via DB.
    await postJson(
      `${BASE}/api/channels/${channelName}/messages`,
      { content: "this message will expire" },
      aliceCookies
    );
    const msg = await prisma.channelMessage.findFirst({
      where:   { channelId, authorId: aliceId },
      orderBy: { createdAt: "desc" },
    });
    expect(msg).not.toBeNull();
    expect(msg!.content).toBe("this message will expire");
    messageId = msg!.id;
  });

  it("7.2 — message appears in GET /messages before expiry", async () => {
    const res  = await getReq(
      `${BASE}/api/channels/${channelName}/messages`,
      aliceCookies
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    const ids = (body.messages as { id: string }[]).map((m) => m.id);
    expect(ids).toContain(messageId);
  });

  it("7.3 — set expiresAt to the past in DB (force expiry)", async () => {
    const past = new Date(Date.now() - 1_000);
    await prisma.channelMessage.update({
      where: { id: messageId },
      data:  { expiresAt: past },
    });
    const msg = await prisma.channelMessage.findUnique({ where: { id: messageId } });
    expect(msg!.expiresAt!.getTime()).toBeLessThan(Date.now());
  });

  it("7.4 — POST /api/cron/purge-messages deletes the expired message", async () => {
    const res  = await fetch(`${BASE}/api/cron/purge-messages`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBeGreaterThanOrEqual(1);
  });

  it("7.5 — message is gone from GET /messages after purge", async () => {
    const res  = await getReq(
      `${BASE}/api/channels/${channelName}/messages`,
      aliceCookies
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    const ids = (body.messages as { id: string }[]).map((m) => m.id);
    expect(ids).not.toContain(messageId);
  });

  it("7.6 — message is gone from the database after purge", async () => {
    const msg = await prisma.channelMessage.findUnique({ where: { id: messageId } });
    expect(msg).toBeNull();
  });
});
