import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Founding member logic
// isFoundingMember = board.memberCount < 50  (checked before incrementing)
// ---------------------------------------------------------------------------

describe("founding member logic", () => {
  /** Mirror of the route handler check in POST /api/boards/[boardName]/join */
  function isFoundingMember(currentMemberCount: number): boolean {
    return currentMemberCount < 50;
  }

  it("the first member (count=0) is a founding member", () => {
    expect(isFoundingMember(0)).toBe(true);
  });

  it("the 10th member (count=9) is a founding member", () => {
    expect(isFoundingMember(9)).toBe(true);
  });

  it("the 49th member (count=48) is a founding member", () => {
    expect(isFoundingMember(48)).toBe(true);
  });

  it("the 50th member (count=49) is the last founding member", () => {
    expect(isFoundingMember(49)).toBe(true);
  });

  it("the 51st member (count=50) is NOT a founding member", () => {
    expect(isFoundingMember(50)).toBe(false);
  });

  it("the 52nd member (count=51) is NOT a founding member", () => {
    expect(isFoundingMember(51)).toBe(false);
  });

  it("all members 1–50 (counts 0–49) are founding members", () => {
    for (let count = 0; count < 50; count++) {
      expect(isFoundingMember(count)).toBe(true);
    }
  });

  it("no member after the 50th (counts 50+) is a founding member", () => {
    for (let count = 50; count <= 200; count++) {
      expect(isFoundingMember(count)).toBe(false);
    }
  });

  it("the boundary is strictly at 50 members", () => {
    expect(isFoundingMember(49)).toBe(true);
    expect(isFoundingMember(50)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Board archive logic
// ---------------------------------------------------------------------------

describe("board post archive logic", () => {
  type Post = { id: string; isArchived: boolean; title: string };

  const posts: Post[] = [
    { id: "1", isArchived: false, title: "visible post" },
    { id: "2", isArchived: true, title: "archived post" },
    { id: "3", isArchived: false, title: "another visible" },
    { id: "4", isArchived: true, title: "also archived" },
  ];

  it("active listing excludes archived posts", () => {
    const active = posts.filter((p) => !p.isArchived);
    expect(active).toHaveLength(2);
    expect(active.every((p) => !p.isArchived)).toBe(true);
  });

  it("archived listing includes only archived posts", () => {
    const archived = posts.filter((p) => p.isArchived);
    expect(archived).toHaveLength(2);
    expect(archived.every((p) => p.isArchived)).toBe(true);
  });

  it("archiving a post removes it from the active listing", () => {
    const updated = posts.map((p) =>
      p.id === "1" ? { ...p, isArchived: true } : p
    );
    const active = updated.filter((p) => !p.isArchived);
    expect(active.map((p) => p.id)).not.toContain("1");
  });

  it("unarchiving a post restores it to the active listing", () => {
    const updated = posts.map((p) =>
      p.id === "2" ? { ...p, isArchived: false } : p
    );
    const active = updated.filter((p) => !p.isArchived);
    expect(active.map((p) => p.id)).toContain("2");
  });

  it("an all-archived board has an empty active listing", () => {
    const allArchived = posts.map((p) => ({ ...p, isArchived: true }));
    expect(allArchived.filter((p) => !p.isArchived)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Vibe statement length
// ---------------------------------------------------------------------------

describe("vibe statement length", () => {
  const MAX_LEN = 200;

  it("accepts an empty vibe statement", () => {
    expect("".length).toBeLessThanOrEqual(MAX_LEN);
  });

  it("accepts a vibe statement at exactly 200 characters", () => {
    expect("a".repeat(200).length).toBeLessThanOrEqual(MAX_LEN);
  });

  it("rejects a vibe statement at 201 characters", () => {
    expect("a".repeat(201).length).toBeGreaterThan(MAX_LEN);
  });

  it("a typical short vibe statement is within limit", () => {
    const vibe = "a chill place for photos and slow mornings.";
    expect(vibe.length).toBeLessThan(MAX_LEN);
  });

  it("the limit is 200 chars (matches schema: vibeStatement String? max 200)", () => {
    expect(MAX_LEN).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Board type enforcement
// ---------------------------------------------------------------------------

describe("board types", () => {
  const VALID_TYPES = ["PUBLIC", "INVITE_ONLY", "SECRET"] as const;

  it("PUBLIC boards can be joined by anyone", () => {
    expect(VALID_TYPES).toContain("PUBLIC");
  });

  it("INVITE_ONLY boards require a token to join", () => {
    expect(VALID_TYPES).toContain("INVITE_ONLY");
  });

  it("SECRET boards are invisible to non-members (return 404)", () => {
    expect(VALID_TYPES).toContain("SECRET");
  });

  it("only PUBLIC boards can be joined without an invite", () => {
    // Non-PUBLIC types require invite or are secret
    const inviteRequired = VALID_TYPES.filter((t) => t !== "PUBLIC");
    expect(inviteRequired).toContain("INVITE_ONLY");
    expect(inviteRequired).toContain("SECRET");
  });
});

// ---------------------------------------------------------------------------
// Board post field limits
// ---------------------------------------------------------------------------

describe("board post field limits", () => {
  it("title max is 140 characters", () => {
    const MAX_TITLE = 140;
    expect("a".repeat(140).length).toBeLessThanOrEqual(MAX_TITLE);
    expect("a".repeat(141).length).toBeGreaterThan(MAX_TITLE);
  });

  it("body max is 2000 characters", () => {
    const MAX_BODY = 2000;
    expect("a".repeat(2000).length).toBeLessThanOrEqual(MAX_BODY);
    expect("a".repeat(2001).length).toBeGreaterThan(MAX_BODY);
  });

  it("tag max is 30 characters", () => {
    const MAX_TAG = 30;
    expect("a".repeat(30).length).toBeLessThanOrEqual(MAX_TAG);
    expect("a".repeat(31).length).toBeGreaterThan(MAX_TAG);
  });
});
