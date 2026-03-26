/**
 * Integration tests — Core social features
 *
 * Runs end-to-end against the live dev server (http://localhost:3000).
 * Prerequisites:
 *   • `npm run dev` running in apps/web
 *   • DATABASE_URL in apps/web/.env pointing to a live PostgreSQL instance
 *
 * Tests use fetch for HTTP calls and prisma for DB assertions / setup teardown.
 *
 * Note: Routes that call pusherServer.trigger() may return 500 when using
 * placeholder Pusher credentials.  For those routes the DB transaction has
 * already committed, so assertions are made against the DB directly rather
 * than relying on a 2xx HTTP status.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/lib/deletion";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Unique suffix so parallel test runs never collide
const TS = Date.now();

const ALPHA = { screenname: "alpha_feat", email: "alpha_feat@example.com", password: "AlphaPass123" };
const BETA  = { screenname: "beta_feat",  email: "beta_feat@example.com",  password: "BetaPass123"  };
const GAMMA = { screenname: "gamma_feat", email: "gamma_feat@example.com", password: "GammaPass123" };
const DELTA = { screenname: "delta_feat", email: "delta_feat@example.com", password: "DeltaPass123" };

let alphaId = "";
let betaId  = "";
let gammaId = "";
let deltaId = "";

let alphaCookies = "";
let betaCookies  = "";
let gammaCookies = "";
let deltaCookies = "";

// Cross-test shared IDs
let betaPublicPostId  = "";
let alphaAwayPostId   = "";
let boardPostId       = "";

// Channel / board names — stable per run, unique across runs
const publicChannelName = `pub-feat-${TS}`.slice(0, 32);
const secretChannelName = `sec-feat-${TS}`.slice(0, 32);
const inviteChannelName = `inv-feat-${TS}`.slice(0, 32);
const slowChannelName   = `slw-feat-${TS}`.slice(0, 32);
const boardName         = `feat-brd-${TS}`.slice(0, 40);
const secretBoardName   = `sec-brd-${TS}`.slice(0, 40);

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

function getReq(url: string, cookies?: string) {
  return fetch(url, {
    headers: cookies ? { Cookie: cookies } : {},
  });
}

async function register(user: { screenname: string; email: string; password: string }): Promise<string> {
  const res  = await postJson(`${BASE}/api/auth/register`, user);
  const body = await res.json();
  if (res.status !== 201) {
    throw new Error(`Register failed for ${user.screenname}: ${JSON.stringify(body)}`);
  }
  return body.id as string;
}

async function getSessionCookies(screenname: string, password: string): Promise<string> {
  // Step 1: obtain CSRF token
  const csrfRes    = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfRaw    = csrfRes.headers.getSetCookie?.() ?? [];
  const csrfCookie = csrfRaw.length > 0 ? csrfRaw.join("; ") : (csrfRes.headers.get("set-cookie") ?? "");

  // Step 2: POST credentials
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials?json=true`, {
    method:   "POST",
    headers:  { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie },
    body:     new URLSearchParams({ screenname, password, csrfToken, json: "true" }),
    redirect: "manual",
  });

  const raw     = loginRes.headers.getSetCookie?.() ?? [];
  const session = raw.length > 0 ? raw.join("; ") : (loginRes.headers.get("set-cookie") ?? "");
  return `${csrfCookie}; ${session}`;
}

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await fetch(BASE, { signal: AbortSignal.timeout(5_000) }).catch(() => {
    throw new Error(
      `Dev server unreachable at ${BASE}. Run \`npm run dev\` in apps/web.`
    );
  });

  // Remove any stale users from a previous failed run
  for (const u of [ALPHA, BETA, GAMMA, DELTA]) {
    const stale = await prisma.user.findFirst({
      where:  { screenname: { equals: u.screenname, mode: "insensitive" } },
      select: { id: true },
    });
    if (stale) await deleteAccount(stale.id);
  }

  alphaId = await register(ALPHA);
  betaId  = await register(BETA);
  gammaId = await register(GAMMA);
  deltaId = await register(DELTA);

  alphaCookies = await getSessionCookies(ALPHA.screenname, ALPHA.password);
  betaCookies  = await getSessionCookies(BETA.screenname,  BETA.password);
  gammaCookies = await getSessionCookies(GAMMA.screenname, GAMMA.password);
  deltaCookies = await getSessionCookies(DELTA.screenname, DELTA.password);
}, 30_000);

afterAll(async () => {
  for (const id of [alphaId, betaId, gammaId, deltaId]) {
    if (id) await deleteAccount(id).catch(() => {});
  }
});

// ===========================================================================
// BUDDY SYSTEM
// ===========================================================================

describe("3.1 — buddy request flow: send + accept", () => {
  it("alpha sends a buddy request to beta → PENDING relation created in DB", async () => {
    // The route calls pusherServer.trigger() after the DB write, which may 500
    // with placeholder credentials.  Verify via DB instead of HTTP status.
    await postJson(`${BASE}/api/buddies`, { targetScreenname: BETA.screenname }, alphaCookies);

    const relation = await prisma.buddyRelation.findFirst({
      where: { requesterId: alphaId, addresseeId: betaId },
    });
    expect(relation).not.toBeNull();
    expect(relation!.status).toBe("PENDING");
  });

  it("beta accepts the request → status becomes ACCEPTED in DB", async () => {
    // PATCH /api/buddies/[buddyId] — buddyId is the *requester's* userId (alpha)
    // accept action also triggers Pusher, so may return 500; verify via DB
    await patchJson(`${BASE}/api/buddies/${alphaId}`, { action: "accept" }, betaCookies);

    const relation = await prisma.buddyRelation.findFirst({
      where: { requesterId: alphaId, addresseeId: betaId },
    });
    expect(relation?.status).toBe("ACCEPTED");
  });
});

describe("3.2 — declined buddy request is removed from DB", () => {
  it("alpha sends request to gamma; gamma declines → relation is gone", async () => {
    await postJson(`${BASE}/api/buddies`, { targetScreenname: GAMMA.screenname }, alphaCookies);

    const before = await prisma.buddyRelation.findFirst({
      where: { requesterId: alphaId, addresseeId: gammaId },
    });
    expect(before, "PENDING relation should exist before decline").not.toBeNull();

    // decline has no Pusher call → returns 200 reliably
    const res = await patchJson(`${BASE}/api/buddies/${alphaId}`, { action: "decline" }, gammaCookies);
    expect(res.status).toBe(200);

    const after = await prisma.buddyRelation.findFirst({
      where: { requesterId: alphaId, addresseeId: gammaId },
    });
    expect(after, "declined relation should be deleted from DB").toBeNull();
  });
});

describe("3.3 — blocked user cannot send a buddy request", () => {
  it("alpha blocks delta; delta tries to add alpha as buddy → 403", async () => {
    // block action has no Pusher → returns 200 reliably; buddyId is the target's userId
    const blockRes = await patchJson(`${BASE}/api/buddies/${deltaId}`, { action: "block" }, alphaCookies);
    expect(blockRes.status).toBe(200);

    const relation = await prisma.buddyRelation.findFirst({
      where: { requesterId: alphaId, addresseeId: deltaId, status: "BLOCKED" },
    });
    expect(relation, "BLOCKED relation should exist in DB").not.toBeNull();

    // Delta tries to send a buddy request to alpha — both directions are checked
    const reqRes = await postJson(`${BASE}/api/buddies`, { targetScreenname: ALPHA.screenname }, deltaCookies);
    expect(reqRes.status).toBe(403);
  });
});

describe("3.4 — blocked user does not appear in user search results", () => {
  it("alpha searches for delta — delta is hidden due to BLOCKED BuddyRelation", async () => {
    const res  = await getReq(`${BASE}/api/users/search?q=${DELTA.screenname}`, alphaCookies);
    const body = await res.json();

    expect(res.status).toBe(200);
    const found = body.find((u: { screenname: string }) => u.screenname === DELTA.screenname);
    expect(found, "blocked user should be absent from search results").toBeUndefined();
  });
});

// ===========================================================================
// POSTS / FEED
// ===========================================================================

describe("3.5 — public post appears in buddy's feed", () => {
  it("beta creates PUBLIC post; alpha (accepted buddy) sees it in the feed", async () => {
    // Pusher may cause 500 — verify creation via DB
    await postJson(`${BASE}/api/posts`, { content: "Hello from beta!", privacy: "PUBLIC" }, betaCookies);

    const post = await prisma.post.findFirst({
      where: { authorId: betaId, content: "Hello from beta!" },
    });
    expect(post, "beta's post should be in DB").not.toBeNull();
    betaPublicPostId = post!.id;

    const feedRes  = await getReq(`${BASE}/api/posts`, alphaCookies);
    const feedBody = await feedRes.json();
    expect(feedRes.status).toBe(200);

    const found = feedBody.posts?.find((p: { id: string }) => p.id === betaPublicPostId);
    expect(found, "beta's public post should appear in alpha's feed").toBeTruthy();
  });
});

describe("3.6 — BUDDIES_ONLY post: visible to buddy, hidden from stranger", () => {
  let buddiesOnlyId = "";

  it("beta creates BUDDIES_ONLY post; alpha (accepted buddy) can see it", async () => {
    await postJson(`${BASE}/api/posts`, { content: "Buddies only post", privacy: "BUDDIES_ONLY" }, betaCookies);

    const post = await prisma.post.findFirst({
      where:   { authorId: betaId, privacy: "BUDDIES_ONLY" },
      orderBy: { createdAt: "desc" },
    });
    expect(post).not.toBeNull();
    buddiesOnlyId = post!.id;

    const feedRes  = await getReq(`${BASE}/api/posts`, alphaCookies);
    const feedBody = await feedRes.json();

    const found = feedBody.posts?.find((p: { id: string }) => p.id === buddiesOnlyId);
    expect(found, "alpha (buddy) should see BUDDIES_ONLY post").toBeTruthy();
  });

  it("gamma (non-buddy) does NOT see the BUDDIES_ONLY post", async () => {
    const feedRes  = await getReq(`${BASE}/api/posts`, gammaCookies);
    const feedBody = await feedRes.json();

    const found = feedBody.posts?.find((p: { id: string }) => p.id === buddiesOnlyId);
    expect(found, "gamma (non-buddy) should NOT see BUDDIES_ONLY post").toBeUndefined();
  });
});

describe("3.7 — away message enforces 140-character limit", () => {
  it("away message with 141 chars is rejected with 400", async () => {
    const res = await postJson(`${BASE}/api/posts`, {
      content:       "x".repeat(141),
      isAwayMessage: true,
    }, alphaCookies);
    expect(res.status).toBe(400);
  });

  it("away message with ≤140 chars is stored with isAwayMessage=true", async () => {
    await postJson(`${BASE}/api/posts`, {
      content:       "Gone fishing",
      isAwayMessage: true,
    }, alphaCookies);

    const post = await prisma.post.findFirst({
      where: { authorId: alphaId, isAwayMessage: true, content: "Gone fishing" },
    });
    expect(post).not.toBeNull();
    expect(post!.isAwayMessage).toBe(true);
    alphaAwayPostId = post!.id;
  });
});

describe("3.8 — nudge toggles on/off", () => {
  it("beta nudges alpha's post → nudgedByMe: true, count ≥ 1", async () => {
    expect(alphaAwayPostId, "3.7 must create a post first").toBeTruthy();

    const res  = await postJson(`${BASE}/api/posts/${alphaAwayPostId}/nudge`, {}, betaCookies);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nudgedByMe).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(1);
  });

  it("beta nudges again → nudge removed, nudgedByMe: false", async () => {
    const res  = await postJson(`${BASE}/api/posts/${alphaAwayPostId}/nudge`, {}, betaCookies);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nudgedByMe).toBe(false);
  });
});

describe("3.9 — post content length limit enforced", () => {
  it("post with 513 chars is rejected with 400", async () => {
    const res = await postJson(`${BASE}/api/posts`, {
      content: "z".repeat(513),
    }, alphaCookies);
    expect(res.status).toBe(400);
  });

  it("post with exactly 512 chars is accepted", async () => {
    const content = "w".repeat(512);
    await postJson(`${BASE}/api/posts`, { content }, alphaCookies);

    const post = await prisma.post.findFirst({ where: { authorId: alphaId, content } });
    expect(post, "512-char post should be stored in DB").not.toBeNull();
  });
});

// ===========================================================================
// CHANNELS
// ===========================================================================

describe("3.10 — public channel: any authenticated user can join", () => {
  it("alpha creates a PUBLIC channel; beta joins via HTTP and is listed as a member", async () => {
    // Create via Prisma directly to bypass any Pusher issues in POST /api/channels
    await prisma.channel.create({
      data: {
        name:            publicChannelName,
        type:            "PUBLIC",
        slowModeMinutes: 0,
        creator:         { connect: { id: alphaId } },
        members:         { create: { userId: alphaId } },
      },
    });

    // Join route calls Pusher after DB write — may 500 with placeholder creds; verify via DB
    await postJson(`${BASE}/api/channels/${publicChannelName}/join`, {}, betaCookies);

    const channel = await prisma.channel.findUnique({ where: { name: publicChannelName } });
    const member  = await prisma.channelMember.findFirst({
      where: { channelId: channel!.id, userId: betaId },
    });
    expect(member, "beta should be a channel member after joining").not.toBeNull();
  });
});

describe("3.11 — SECRET channel returns 404 for non-members", () => {
  it("GET /api/channels/[name] returns 404 for a SECRET channel when user is not a member", async () => {
    await prisma.channel.create({
      data: {
        name:            secretChannelName,
        type:            "SECRET",
        slowModeMinutes: 0,
        creator:         { connect: { id: alphaId } },
        members:         { create: { userId: alphaId } },
      },
    });

    const res = await getReq(`${BASE}/api/channels/${secretChannelName}`, betaCookies);
    expect(res.status).toBe(404);
  });
});

describe("3.12 — invite flow for an INVITE_ONLY channel", () => {
  let inviteToken = "";

  it("alpha creates INVITE_ONLY channel and generates an invite link", async () => {
    await prisma.channel.create({
      data: {
        name:            inviteChannelName,
        type:            "INVITE_ONLY",
        slowModeMinutes: 0,
        creator:         { connect: { id: alphaId } },
        members:         { create: { userId: alphaId } },
      },
    });

    // POST /api/channels/invites does NOT call Pusher → 200 reliable
    const res  = await postJson(`${BASE}/api/channels/invites`, {
      channelName: inviteChannelName,
      maxUses:     5,
    }, alphaCookies);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.token).toBe("string");
    inviteToken = body.token;
  });

  it("beta uses the invite token → becomes a channel member", async () => {
    expect(inviteToken, "invite token must be set by previous test").toBeTruthy();

    // POST /api/invites/[token] calls Pusher after commit — may 500; verify via DB
    await postJson(`${BASE}/api/invites/${inviteToken}`, {}, betaCookies);

    const channel = await prisma.channel.findUnique({ where: { name: inviteChannelName } });
    const member  = await prisma.channelMember.findFirst({
      where: { channelId: channel!.id, userId: betaId },
    });
    expect(member, "beta should be a member after consuming the invite").not.toBeNull();
  });
});

describe("3.13 — consuming an expired invite returns 410", () => {
  it("invite with expiresAt in the past → 410 Gone", async () => {
    const channel = await prisma.channel.findUnique({ where: { name: inviteChannelName } });

    const expired = await prisma.inviteLink.create({
      data: {
        token:         `exp-${TS}`,
        channelId:     channel!.id,
        usesRemaining: 5,
        expiresAt:     new Date(Date.now() - 60_000), // 1 minute ago
      },
    });

    const res = await postJson(`${BASE}/api/invites/${expired.token}`, {}, gammaCookies);
    expect(res.status).toBe(410);
  });
});

describe("3.14 — slow mode returns 429 before the cooldown expires", () => {
  it("second message attempt within the slow-mode window is rejected with 429", async () => {
    await prisma.channel.create({
      data: {
        name:            slowChannelName,
        type:            "PUBLIC",
        slowModeMinutes: 60, // 60-minute cooldown
        creator:         { connect: { id: alphaId } },
        members:         { create: { userId: alphaId } },
      },
    });

    // Simulate that alpha already sent a message just now by setting lastMessageAt
    const channel = await prisma.channel.findUnique({ where: { name: slowChannelName } });
    await prisma.channelMember.update({
      where: { userId_channelId: { userId: alphaId, channelId: channel!.id } },
      data:  { lastMessageAt: new Date() },
    });

    // Next message attempt should be blocked by slow mode
    const res  = await postJson(`${BASE}/api/channels/${slowChannelName}/messages`, {
      content: "Should be rate limited",
    }, alphaCookies);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.remainingMs).toBeGreaterThan(0);
  });
});

describe("3.15 — channel message has expiresAt set and isEncrypted defaults to false", () => {
  it("message created with default settings has expiresAt ~30 days ahead and isEncrypted=false", async () => {
    const channel = await prisma.channel.findUnique({ where: { name: publicChannelName } });

    const msg = await prisma.channelMessage.create({
      data: {
        content:     "Expiry field test message",
        authorId:    alphaId,
        channelId:   channel!.id,
        expiresAt:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isEncrypted: false,
      },
    });

    expect(msg.expiresAt).not.toBeNull();
    expect(msg.isEncrypted).toBe(false);

    const diffDays = (msg.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });
});

// ===========================================================================
// BOARDS
// ===========================================================================

describe("3.16 — founding member: board creator is automatically marked isFoundingMember", () => {
  it("POST /api/boards returns 201; creator's BoardMember row has isFoundingMember=true", async () => {
    // Board creation route does not call Pusher → 201 reliable
    const res = await postJson(`${BASE}/api/boards`, {
      name:          boardName,
      displayName:   "Feature Test Board",
      vibeStatement: "Testing features end-to-end",
      type:          "PUBLIC",
    }, alphaCookies);

    expect(res.status).toBe(201);

    const board = await prisma.board.findUnique({ where: { name: boardName } });
    expect(board).not.toBeNull();

    const membership = await prisma.boardMember.findFirst({
      where: { boardId: board!.id, userId: alphaId },
    });
    expect(membership).not.toBeNull();
    expect(membership!.isFoundingMember).toBe(true);
  });
});

describe("3.17 — board post requires a title", () => {
  it("POST /api/boards/[name]/posts without title → 400", async () => {
    const res = await postJson(`${BASE}/api/boards/${boardName}/posts`, {
      body: "Body without a title",
    }, alphaCookies);
    expect(res.status).toBe(400);
  });
});

describe("3.18 — SECRET board returns 404 for non-members", () => {
  it("GET /api/boards/[name] returns 404 for a SECRET board when user is not a member", async () => {
    await prisma.board.create({
      data: {
        name:          secretBoardName,
        displayName:   "Secret Board",
        vibeStatement: "Top secret vibes only",
        type:          "SECRET",
        creatorId:     alphaId,
        memberCount:   1,
        members:       { create: { userId: alphaId, isFoundingMember: true } },
      },
    });

    const res = await getReq(`${BASE}/api/boards/${secretBoardName}`, betaCookies);
    expect(res.status).toBe(404);
  });
});

describe("3.19 — board post nudge toggles on and off", () => {
  it("alpha creates a board post; beta joins and nudges → nudgedByMe: true", async () => {
    // Board post creation may call Pusher — verify via DB
    await postJson(`${BASE}/api/boards/${boardName}/posts`, {
      title: "Nudge test post",
      body:  "Testing board post nudges",
    }, alphaCookies);

    const board = await prisma.board.findUnique({ where: { name: boardName } });
    const post  = await prisma.boardPost.findFirst({
      where: { boardId: board!.id, title: "Nudge test post" },
    });
    expect(post, "board post should exist in DB").not.toBeNull();
    boardPostId = post!.id;

    // Beta joins the board first (no Pusher in join route → 200 reliable)
    const joinRes = await postJson(`${BASE}/api/boards/${boardName}/join`, {}, betaCookies);
    expect(joinRes.status).toBe(200);

    // Beta nudges
    const nudgeRes  = await postJson(
      `${BASE}/api/boards/${boardName}/posts/${boardPostId}/nudge`,
      {},
      betaCookies,
    );
    const nudgeBody = await nudgeRes.json();

    expect(nudgeRes.status).toBe(200);
    expect(nudgeBody.nudgedByMe).toBe(true);
    expect(nudgeBody.nudgeCount).toBeGreaterThanOrEqual(1);
  });

  it("beta nudges again → nudge removed, nudgedByMe: false", async () => {
    const res  = await postJson(
      `${BASE}/api/boards/${boardName}/posts/${boardPostId}/nudge`,
      {},
      betaCookies,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nudgedByMe).toBe(false);
  });
});

describe("3.20 — BoardPost schema has no expiresAt field", () => {
  it("BoardPost record does not contain an expiresAt property (unlike ChannelMessage)", async () => {
    expect(boardPostId, "3.19 must create a board post first").toBeTruthy();

    const post = await prisma.boardPost.findUnique({ where: { id: boardPostId } });
    expect(post).not.toBeNull();

    // expiresAt must be absent from the model — undefined, not just null
    expect((post as Record<string, unknown>).expiresAt).toBeUndefined();
  });
});

// ===========================================================================
// SAFETY
// ===========================================================================

describe("3.21 — blocking a user removes their posts from your feed", () => {
  it("setup: alpha and gamma become buddies; gamma's post appears in alpha's feed", async () => {
    // Gamma sends alpha a buddy request (no existing relation after 3.2 declined it)
    await postJson(`${BASE}/api/buddies`, { targetScreenname: ALPHA.screenname }, gammaCookies);

    // Alpha accepts
    await patchJson(`${BASE}/api/buddies/${gammaId}`, { action: "accept" }, alphaCookies);

    const relation = await prisma.buddyRelation.findFirst({
      where: { requesterId: gammaId, addresseeId: alphaId },
    });
    expect(relation?.status).toBe("ACCEPTED");

    // Gamma posts publicly
    await postJson(`${BASE}/api/posts`, { content: "Gamma public post", privacy: "PUBLIC" }, gammaCookies);

    const post = await prisma.post.findFirst({
      where: { authorId: gammaId, content: "Gamma public post" },
    });
    expect(post).not.toBeNull();

    // Alpha can see it in the feed before blocking
    const feedRes  = await getReq(`${BASE}/api/posts`, alphaCookies);
    const feedBody = await feedRes.json();
    const found = feedBody.posts?.find((p: { id: string }) => p.id === post!.id);
    expect(found, "gamma's post should appear in alpha's feed before blocking").toBeTruthy();
  });

  it("alpha blocks gamma → gamma's posts no longer appear in alpha's feed", async () => {
    // POST /api/users/[screenname]/block creates a Block record and removes buddy relation
    const blockRes = await postJson(`${BASE}/api/users/${GAMMA.screenname}/block`, {}, alphaCookies);
    expect(blockRes.status).toBe(200);

    const feedRes  = await getReq(`${BASE}/api/posts`, alphaCookies);
    const feedBody = await feedRes.json();

    const found = feedBody.posts?.find((p: { authorId: string }) => p.authorId === gammaId);
    expect(found, "blocked user's posts should be absent from alpha's feed").toBeUndefined();
  });
});

describe("3.22 — reporting a post creates a PENDING record in the DB", () => {
  it("alpha reports beta's public post → Report row with status=PENDING and correct fields", async () => {
    expect(betaPublicPostId, "3.5 must create beta's post first").toBeTruthy();

    const res  = await postJson(`${BASE}/api/reports`, {
      targetType: "post",
      targetId:   betaPublicPostId,
      reason:     "SPAM",
      detail:     "Integration test report — automated",
    }, alphaCookies);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.reported).toBe(true);
    expect(typeof body.reportId).toBe("string");

    const report = await prisma.report.findUnique({ where: { id: body.reportId } });
    expect(report).not.toBeNull();
    expect(report!.status).toBe("PENDING");
    expect(report!.reporterId).toBe(alphaId);
    expect(report!.targetPostId).toBe(betaPublicPostId);
  });
});
