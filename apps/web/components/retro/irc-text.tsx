"use client";

import { parseIrcSegments } from "@/lib/irc-format";

// Render an IRC message honoring mIRC color/bold/italic/underline control codes.
export function IrcText({ text }: { text: string }) {
  const segs = parseIrcSegments(text);
  return (
    <>
      {segs.map((s, i) => (
        <span
          key={i}
          style={{
            color: s.color,
            fontWeight: s.bold ? "bold" : undefined,
            fontStyle: s.italic ? "italic" : undefined,
            textDecoration: s.underline ? "underline" : undefined,
          }}
        >
          {s.text}
        </span>
      ))}
    </>
  );
}
