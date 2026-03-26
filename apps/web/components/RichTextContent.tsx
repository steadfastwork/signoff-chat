"use client";

/**
 * RichTextContent
 *
 * Renders server-sanitized HTML from the rich text editor.
 * Content is sanitized on the server via sanitizeRichText() before storage,
 * so dangerouslySetInnerHTML is safe here.
 *
 * Apply the `rich-content` className for shared Tiptap-compatible styles
 * defined in globals.css.
 */

interface RichTextContentProps {
  html: string;
  className?: string;
  /** If true, clamp to 2 lines and add "read more" */
  clamp?: boolean;
}

export function RichTextContent({ html, className = "", clamp = false }: RichTextContentProps) {
  // Plain text fallback — if no HTML tags, wrap in <p> for consistent rendering
  const content =
    html && !html.trim().startsWith("<")
      ? `<p>${html}</p>`
      : html;

  return (
    <div
      className={`rich-content${clamp ? " line-clamp-3" : ""} ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
