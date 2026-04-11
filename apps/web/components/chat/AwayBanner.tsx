"use client";

import Link from "next/link";

interface AwayBannerProps {
  userId: string;
  screenname: string;
  awayMessage: string;
  /** ISO timestamp of when the away message was set */
  setAt?: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AwayBanner({ userId, screenname, awayMessage, setAt }: AwayBannerProps) {
  return (
    <div
      className="mx-4 my-2 px-3 py-2 rounded-xl flex items-start gap-2.5"
      style={{
        background: "#1a150a",
        border: "1px solid #3a2a0a",
      }}
    >
      <span className="text-amber-400 mt-0.5 text-sm flex-shrink-0">✦</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link
            href={`/u/${screenname}`}
            className="text-xs font-mono font-semibold hover:underline"
            style={{ color: "#fcd34d" }}
          >
            {screenname}
          </Link>
          <span className="text-[10px] font-mono" style={{ color: "#78716c" }}>is away</span>
          {setAt && (
            <span className="text-[10px] font-mono" style={{ color: "#4b4b3a" }}>
              · {relativeTime(setAt)}
            </span>
          )}
        </div>
        <p
          className="text-sm italic mt-0.5 leading-snug"
          style={{ color: "#d6c897" }}
        >
          {awayMessage}
        </p>
        <Link
          href={`/dm/${userId}?quote=${encodeURIComponent(awayMessage)}`}
          className="text-[10px] font-mono mt-1 inline-block hover:underline"
          style={{ color: "#92400e" }}
        >
          reply →
        </Link>
      </div>
    </div>
  );
}
