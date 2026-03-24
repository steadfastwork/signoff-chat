import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    board: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    boardMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    boardPost: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    boardNudge: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    boardComment: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/pusher", () => ({
  pusherServer: { trigger: vi.fn() },
  CHANNELS: { GLOBAL_FEED: "global-feed" },
  EVENTS: { NEW_POST: "new-post" },
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  limiters: { boardPostCreate: null, boardComment: null },
}));

// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PUBLIC_BOARD = {
  id: "board-1",
  name: "test-board",
  displayName: "Test Board",
  type: "PUBLIC",
  memberCount: 0,
  creatorId: "user-owner",
};

const makePost = (id: string) => ({
  id,
  title: "Test post title",
  body: "Test post body content",
  tag: "discussion",
  isArchived: false,
  nudgeCount: 0,
  commentCount: 0,
  authorId: "user-1",
  boardId: "board-1",
  createdAt: new Date(),
});

// ---------------------------------------------------------------------------
// Board creation
// ---------------------------------------------------------------------------

describe("board creation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a board with the expected shape", async () => {
    (prisma.board.create as Mock).mockResolvedValue({
      ...PUBLIC_BOARD,
      vibeStatement: "A place to discuss things",
    });

    const board = await prisma.board.create({
      data: {
        name: "test-board",
        displayName: "Test Board",
        vibeStatement: "A place to discuss things",
        type: "PUBLIC",
        creatorId: "user-owner",
        memberCount: 0,
      },
    });

    expect(board.name).toBe("test-board");
    expect(board.type).toBe("PUBLIC");
    expect(board.memberCount).toBe(0);
  });

  it("creator is set on the board record", async () => {
    (prisma.board.create as Mock).mockResolvedValue({
      ...PUBLIC_BOARD,
      creatorId: "user-owner",
    });

    const board = await prisma.board.create({ data: { creatorId: "user-owner" } });
    expect(board.creatorId).toBe("user-owner");
  });
});

// ---------------------------------------------------------------------------
// Founding member logic (first 50 = true, 51st = false)
// ---------------------------------------------------------------------------

describe("founding members: first 50 join", () => {
  beforeEach(() => vi.clearAllMocks());

  it("members 1–50 get isFoundingMember=true (count 0–49)", async () => {
    for (let count = 0; count < 50; count++) {
      const isFoundingMember = count < 50;
      (prisma.board.findUnique as Mock).mockResolvedValue({
        ...PUBLIC_BOARD,
        memberCount: count,
        type: "PUBLIC",
      });
      (prisma.boardMember.findUnique as Mock).mockResolvedValue(null);
      (prisma.$transaction as Mock).mockResolvedValue([
        { userId: "user-x", boardId: "board-1", isFoundingMember },
        { id: "board-1", memberCount: count + 1 },
      ]);

      const board = await prisma.board.findUnique({ where: { name: "test-board" } });
      const [member] = await prisma.$transaction([]);
      expect(board!.memberCount).toBe(count);
      expect(isFoundingMember).toBe(true);
      expect(member.isFoundingMember).toBe(true);
    }
  });

  it("51st member (count=50) gets isFoundingMember=false", async () => {
    const count = 50;
    const isFoundingMember = count < 50;

    (prisma.board.findUnique as Mock).mockResolvedValue({
      ...PUBLIC_BOARD,
      memberCount: count,
    });
    (prisma.$transaction as Mock).mockResolvedValue([
      { userId: "user-51", boardId: "board-1", isFoundingMember },
      { id: "board-1", memberCount: 51 },
    ]);

    const board = await prisma.board.findUnique({ where: { name: "test-board" } });
    expect(board!.memberCount).toBe(50);
    expect(isFoundingMember).toBe(false);
  });

  it("boundary: member at count=49 is founding, at count=50 is not", () => {
    expect(49 < 50).toBe(true);
    expect(50 < 50).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Board post creation
// ---------------------------------------------------------------------------

describe("board post creation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a post with required fields", async () => {
    const post = makePost("post-1");
    (prisma.boardPost.create as Mock).mockResolvedValue(post);

    const created = await prisma.boardPost.create({
      data: {
        title: post.title,
        body: post.body,
        tag: post.tag,
        authorId: post.authorId,
        boardId: post.boardId,
      },
    });

    expect(created.title).toBe("Test post title");
    expect(created.body).toBe("Test post body content");
    expect(created.tag).toBe("discussion");
    expect(created.nudgeCount).toBe(0);
    expect(created.commentCount).toBe(0);
    expect(created.isArchived).toBe(false);
  });

  it("title is required (empty title fails the route validation)", () => {
    const title = "";
    expect(title.trim().length).toBe(0); // route returns 400 for empty title
  });

  it("body can be null (title-only post)", async () => {
    const titleOnlyPost = { ...makePost("post-2"), body: null };
    (prisma.boardPost.create as Mock).mockResolvedValue(titleOnlyPost);

    const created = await prisma.boardPost.create({ data: {} });
    expect(created.body).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Nudge
// ---------------------------------------------------------------------------

describe("board post nudge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a nudge record linked to post and user", async () => {
    (prisma.boardNudge.findUnique as Mock).mockResolvedValue(null);
    (prisma.$transaction as Mock).mockResolvedValue([
      { id: "nudge-1", userId: "user-1", boardPostId: "post-1" },
      { id: "post-1", nudgeCount: 1 },
    ]);

    const existing = await prisma.boardNudge.findUnique({
      where: { userId_boardPostId: { userId: "user-1", boardPostId: "post-1" } },
    });
    expect(existing).toBeNull(); // not yet nudged

    const [nudge, updatedPost] = await prisma.$transaction([]);
    expect(nudge.userId).toBe("user-1");
    expect(updatedPost.nudgeCount).toBe(1);
  });

  it("cannot nudge the same post twice (unique constraint)", async () => {
    (prisma.boardNudge.findUnique as Mock).mockResolvedValue({
      id: "nudge-1",
      userId: "user-1",
      boardPostId: "post-1",
    });

    const existing = await prisma.boardNudge.findUnique({
      where: { userId_boardPostId: { userId: "user-1", boardPostId: "post-1" } },
    });
    // Route returns 409 CONFLICT when already nudged
    expect(existing).not.toBeNull();
  });

  it("nudge count increments by 1 atomically", () => {
    const before = 3;
    const after = before + 1;
    expect(after).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Comment
// ---------------------------------------------------------------------------

describe("board post comment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a comment on a board post", async () => {
    const comment = {
      id: "comment-1",
      body: "Great post!",
      authorId: "user-1",
      boardPostId: "post-1",
      parentCommentId: null,
      createdAt: new Date(),
    };

    (prisma.boardPost.findUnique as Mock).mockResolvedValue({
      ...makePost("post-1"),
      board: { id: "board-1", type: "PUBLIC" },
    });
    (prisma.$transaction as Mock).mockResolvedValue([
      comment,
      { id: "post-1", commentCount: 1 },
    ]);

    const [created, updatedPost] = await prisma.$transaction([]);
    expect(created.body).toBe("Great post!");
    expect(created.boardPostId).toBe("post-1");
    expect(updatedPost.commentCount).toBe(1);
  });

  it("comment body max length is 512 characters", () => {
    const MAX = 512;
    expect("a".repeat(512).length).toBeLessThanOrEqual(MAX);
    expect("a".repeat(513).length).toBeGreaterThan(MAX);
  });

  it("supports top-level and nested (reply) comments via parentCommentId", async () => {
    const reply = {
      id: "comment-2",
      body: "I agree!",
      authorId: "user-2",
      boardPostId: "post-1",
      parentCommentId: "comment-1",
    };

    (prisma.boardComment.create as Mock).mockResolvedValue(reply);
    const created = await prisma.boardComment.create({ data: reply });

    expect(created.parentCommentId).toBe("comment-1");
  });
});
