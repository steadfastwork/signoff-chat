/**
 * Signoff Chat — Input Sanitization
 *
 * All user-generated text content must pass through stripHtml() before
 * storage. This prevents stored-XSS attacks where malicious HTML/script
 * tags could be rendered to other users.
 *
 * Note: We strip rather than escape, since our frontend renders plain text
 * (no innerHTML). Stripping gives cleaner stored values.
 */

// ---------------------------------------------------------------------------
// HTML stripping
// ---------------------------------------------------------------------------

/**
 * Strip all HTML/XML tags and decode common HTML entities.
 * Apply to every text field that comes from user input before writing to DB.
 */
export function stripHtml(input: string): string {
  if (!input) return "";
  return (
    input
      // Remove all HTML tags (including malformed ones)
      .replace(/<[^>]+>/g, "")
      // Decode named entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;|&#x27;|&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&hellip;/g, "…")
      // Decode hex numeric entities (e.g., &#x41; → A)
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      // Decode decimal numeric entities (e.g., &#65; → A)
      .replace(/&#([0-9]+);/g, (_, dec) =>
        String.fromCharCode(parseInt(dec, 10))
      )
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Rich text sanitization
// ---------------------------------------------------------------------------

/**
 * Allowed HTML tags and their permitted attributes.
 * Used to sanitize rich-text HTML from the editor before storage.
 * Everything else is stripped — no scripts, no event handlers, no style.
 */
const RICH_ALLOWED_TAGS = new Set([
  "p", "br", "strong", "em", "s", "code", "pre",
  "ul", "ol", "li", "blockquote", "a", "h2", "h3",
]);

/**
 * Sanitize editor-produced HTML for storage.
 * Allows only the safe inline/block tags above; strips all others.
 * <a> tags: only `href` is preserved, and only for http/https URLs.
 */
export function sanitizeRichText(html: string): string {
  if (!html) return "";
  return html
    // Strip all tags, keeping only allowed ones
    .replace(/<(\/?)([a-z][a-z0-9]*)([^>]*)>/gi, (_match, close, tag, attrs) => {
      const t = tag.toLowerCase();
      if (!RICH_ALLOWED_TAGS.has(t)) return "";
      if (close) return `</${t}>`;
      if (t === "a") {
        const hrefMatch = attrs.match(/\shref="([^"]{1,2048})"/i);
        if (hrefMatch) {
          try {
            const url = new URL(hrefMatch[1]);
            if (url.protocol === "http:" || url.protocol === "https:") {
              return `<a href="${url.toString()}" target="_blank" rel="noopener noreferrer">`;
            }
          } catch { /* ignore bad URLs */ }
        }
        return "<a>";
      }
      return `<${t}>`;
    })
    .trim();
}

/**
 * Count visible characters in HTML (tags excluded).
 * Use for enforcing character limits on rich-text content.
 */
export function richTextLength(html: string): number {
  return html.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").length;
}

// ---------------------------------------------------------------------------
// URL sanitization
// ---------------------------------------------------------------------------

/** Allowed URL protocols for media and links */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validate and sanitize a URL.
 * Returns null for dangerous protocols (javascript:, data:, vbscript:, etc.)
 * or malformed URLs.
 *
 * Use on mediaUrl fields and any user-supplied URL before storage.
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Short text (tags, screennames, etc.)
// ---------------------------------------------------------------------------

/**
 * Normalize a short text field: trim whitespace, collapse inner runs of
 * whitespace to single spaces. Does NOT strip characters — use only for
 * fields that are validated separately (e.g., tags, display names).
 */
export function sanitizeShortText(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}
