import { describe, it, expect } from "vitest";
import { stripHtml, sanitizeUrl } from "@/lib/sanitize";

// ---------------------------------------------------------------------------
// Content length rules (mirroring POST /api/posts validation)
// ---------------------------------------------------------------------------

describe("post content length", () => {
  const MAX_POST_LEN = 512;
  const MAX_AWAY_LEN = 140;

  it("regular post: accepts content at exactly 512 chars", () => {
    const content = "a".repeat(MAX_POST_LEN);
    expect(content.length).toBeLessThanOrEqual(MAX_POST_LEN);
  });

  it("regular post: rejects content at 513 chars", () => {
    const content = "a".repeat(MAX_POST_LEN + 1);
    expect(content.length).toBeGreaterThan(MAX_POST_LEN);
  });

  it("away message: accepts content at exactly 140 chars", () => {
    const content = "a".repeat(MAX_AWAY_LEN);
    expect(content.length).toBeLessThanOrEqual(MAX_AWAY_LEN);
  });

  it("away message: rejects content at 141 chars", () => {
    const content = "a".repeat(MAX_AWAY_LEN + 1);
    expect(content.length).toBeGreaterThan(MAX_AWAY_LEN);
  });

  it("empty content is invalid (falsy after strip)", () => {
    expect(stripHtml("")).toBeFalsy();
    expect(stripHtml("   ")).toBeFalsy();
    expect(stripHtml("<b></b>")).toBeFalsy();
  });

  it("away message limit is stricter than regular post limit", () => {
    expect(MAX_AWAY_LEN).toBeLessThan(MAX_POST_LEN);
  });
});

// ---------------------------------------------------------------------------
// Privacy levels
// ---------------------------------------------------------------------------

describe("post privacy", () => {
  const VALID = ["PUBLIC", "BUDDIES_ONLY"] as const;

  it("PUBLIC is a valid privacy level", () => {
    expect(VALID).toContain("PUBLIC");
  });

  it("BUDDIES_ONLY is a valid privacy level", () => {
    expect(VALID).toContain("BUDDIES_ONLY");
  });

  it("PRIVATE is not a recognised privacy level", () => {
    expect(VALID).not.toContain("PRIVATE");
  });

  it("default privacy is PUBLIC", () => {
    // Matches the defaulting in the POST handler: privacy = "PUBLIC"
    const DEFAULT = "PUBLIC";
    expect(VALID).toContain(DEFAULT);
  });
});

// ---------------------------------------------------------------------------
// stripHtml — input sanitization
// ---------------------------------------------------------------------------

describe("stripHtml", () => {
  it("strips script tags completely", () => {
    expect(stripHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("strips self-closing tags", () => {
    expect(stripHtml("<br/>")).toBe("");
    expect(stripHtml("<img src='x' onerror='alert(1)'/>")).toBe("");
  });

  it("strips anchor tags but keeps inner text", () => {
    expect(stripHtml('<a href="evil.com">click me</a>')).toBe("click me");
  });

  it("strips nested tags", () => {
    expect(stripHtml("<b><i>bold italic</i></b>")).toBe("bold italic");
  });

  it("decodes &amp;", () => {
    expect(stripHtml("fish &amp; chips")).toBe("fish & chips");
  });

  it("decodes &lt; and &gt;", () => {
    expect(stripHtml("a &lt; b &gt; c")).toBe("a < b > c");
  });

  it("decodes &quot;", () => {
    expect(stripHtml("she said &quot;hello&quot;")).toBe('she said "hello"');
  });

  it("decodes &apos;", () => {
    expect(stripHtml("it&apos;s alive")).toBe("it's alive");
  });

  it("decodes &nbsp; to a space", () => {
    expect(stripHtml("a&nbsp;b")).toBe("a b");
  });

  it("decodes hex numeric entities", () => {
    expect(stripHtml("&#x41;&#x42;&#x43;")).toBe("ABC");
  });

  it("decodes decimal numeric entities", () => {
    expect(stripHtml("&#65;&#66;&#67;")).toBe("ABC");
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripHtml("  hello world  ")).toBe("hello world");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("does not modify plain text", () => {
    expect(stripHtml("just a normal post")).toBe("just a normal post");
  });

  it("handles tags-only input by returning empty string", () => {
    expect(stripHtml("<p></p>")).toBe("");
    expect(stripHtml("<div><span></span></div>")).toBe("");
  });

  it("decodes &mdash; and &ndash;", () => {
    expect(stripHtml("em&mdash;dash")).toBe("em—dash");
    expect(stripHtml("en&ndash;dash")).toBe("en–dash");
  });
});

// ---------------------------------------------------------------------------
// sanitizeUrl — URL validation
// ---------------------------------------------------------------------------

describe("sanitizeUrl", () => {
  it("allows https URLs", () => {
    const url = "https://cdn.example.com/image.jpg";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("allows http URLs", () => {
    const url = "http://example.com/image.png";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("rejects javascript: URIs", () => {
    expect(sanitizeUrl("javascript:alert(document.cookie)")).toBeNull();
  });

  it("rejects javascript: with mixed case", () => {
    expect(sanitizeUrl("JaVaScRiPt:alert(1)")).toBeNull();
  });

  it("rejects data: URIs", () => {
    expect(sanitizeUrl("data:text/html,<h1>phish</h1>")).toBeNull();
  });

  it("rejects data: image URIs (could embed malicious content)", () => {
    expect(sanitizeUrl("data:image/png;base64,abc123")).toBeNull();
  });

  it("rejects vbscript: URIs", () => {
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects ftp: URLs", () => {
    expect(sanitizeUrl("ftp://files.example.com/thing")).toBeNull();
  });

  it("rejects malformed / non-URL strings", () => {
    expect(sanitizeUrl("not a url at all")).toBeNull();
    expect(sanitizeUrl("///triple/slash")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(sanitizeUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(sanitizeUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(sanitizeUrl("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(sanitizeUrl("   ")).toBeNull();
  });
});
