import { describe, it, expect } from "vitest";
import { validateScreenname, validatePassword, deriveAvatarColor } from "@/lib/auth";

// ---------------------------------------------------------------------------
// validateScreenname
// ---------------------------------------------------------------------------

describe("validateScreenname", () => {
  it("returns an error for empty string", () => {
    expect(validateScreenname("")).not.toBeNull();
  });

  it("returns an error for a single character", () => {
    expect(validateScreenname("a")).not.toBeNull();
  });

  it("returns an error for 2 characters (below minimum)", () => {
    expect(validateScreenname("ab")).not.toBeNull();
    expect(validateScreenname("ab")).toContain("3");
  });

  it("accepts exactly 3 characters (minimum)", () => {
    expect(validateScreenname("abc")).toBeNull();
  });

  it("accepts exactly 20 characters (maximum)", () => {
    expect(validateScreenname("a".repeat(20))).toBeNull();
  });

  it("rejects 21 characters (over maximum)", () => {
    expect(validateScreenname("a".repeat(21))).not.toBeNull();
    expect(validateScreenname("a".repeat(21))).toContain("20");
  });

  it("accepts lowercase letters", () => {
    expect(validateScreenname("abc")).toBeNull();
  });

  it("accepts uppercase letters", () => {
    expect(validateScreenname("ABC")).toBeNull();
  });

  it("accepts digits", () => {
    expect(validateScreenname("user123")).toBeNull();
  });

  it("accepts underscores", () => {
    expect(validateScreenname("user_name")).toBeNull();
  });

  it("accepts leading underscore", () => {
    expect(validateScreenname("_user")).toBeNull();
  });

  it("accepts mixed case and digits and underscore", () => {
    expect(validateScreenname("Craig_K47")).toBeNull();
  });

  it("rejects hyphens", () => {
    expect(validateScreenname("user-name")).not.toBeNull();
  });

  it("rejects spaces", () => {
    expect(validateScreenname("user name")).not.toBeNull();
  });

  it("rejects @ symbol", () => {
    expect(validateScreenname("user@name")).not.toBeNull();
  });

  it("rejects dots", () => {
    expect(validateScreenname("user.name")).not.toBeNull();
  });

  it("rejects HTML-injectable characters", () => {
    expect(validateScreenname("<script>")).not.toBeNull();
    expect(validateScreenname("foo&bar")).not.toBeNull();
    expect(validateScreenname('say"hi')).not.toBeNull();
  });

  it("returns null (no error) for all valid cases", () => {
    const valid = ["abc", "User_1", "ALLCAPS", "mix3d_CaSe", "a".repeat(20)];
    valid.forEach((name) => expect(validateScreenname(name)).toBeNull());
  });
});

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------

describe("validatePassword", () => {
  it("returns an error for empty string", () => {
    expect(validatePassword("")).not.toBeNull();
  });

  it("returns an error for 1 character", () => {
    expect(validatePassword("a")).not.toBeNull();
  });

  it("returns an error for 7 characters (below minimum)", () => {
    expect(validatePassword("1234567")).not.toBeNull();
    expect(validatePassword("1234567")).toContain("8");
  });

  it("accepts exactly 8 characters (minimum)", () => {
    expect(validatePassword("12345678")).toBeNull();
  });

  it("accepts long passwords", () => {
    expect(validatePassword("a".repeat(128))).toBeNull();
  });

  it("accepts all character types: symbols, spaces, unicode", () => {
    expect(validatePassword("p@$$w0rd!")).toBeNull();
    expect(validatePassword("correct horse battery")).toBeNull();
    expect(validatePassword("日本語パスワード")).toBeNull();
  });

  it("does not impose a maximum length", () => {
    expect(validatePassword("a".repeat(1000))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deriveAvatarColor
// ---------------------------------------------------------------------------

describe("deriveAvatarColor", () => {
  const VALID_COLORS = ["amber", "rose", "sky", "emerald", "violet", "orange"];

  it("always returns one of the 6 valid colors", () => {
    const ids = [
      "user_1",
      "user_2",
      "abc123",
      "x".repeat(36),
      "",
      "0",
    ];
    ids.forEach((id) => {
      expect(VALID_COLORS).toContain(deriveAvatarColor(id));
    });
  });

  it("is deterministic — same id always returns same color", () => {
    const id = "test-user-id-abc";
    expect(deriveAvatarColor(id)).toBe(deriveAvatarColor(id));
  });

  it("different ids can produce different colors", () => {
    const results = new Set(
      Array.from({ length: 100 }, (_, i) => deriveAvatarColor(`user-${i}`))
    );
    // With 100 users we should see more than 1 distinct color
    expect(results.size).toBeGreaterThan(1);
  });
});
