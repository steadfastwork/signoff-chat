"use client";

import Link from "next/link";

interface TipButtonProps {
  screenname: string;
}

export default function TipButton({ screenname }: TipButtonProps) {
  return (
    <Link
      href={`/u/${screenname}/tip`}
      className="text-xs font-mono transition-colors"
      style={{ color: "var(--text-muted)" }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.color = "var(--amber)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")
      }
    >
      leave a tip →
    </Link>
  );
}
