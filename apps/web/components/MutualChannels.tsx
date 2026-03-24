"use client";

import Link from "next/link";

interface Channel {
  name: string;
  type: string;
}

interface MutualChannelsProps {
  channels: Channel[];
}

export function MutualChannels({ channels }: MutualChannelsProps) {
  if (channels.length === 0) return null;

  return (
    <div>
      <h3
        className="text-[10px] font-mono uppercase tracking-widest mb-2"
        style={{ color: "#c8860a66" }}
      >
        channels in common
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {channels.map((ch) => (
          <Link
            key={ch.name}
            href={`/channels/${ch.name}`}
            className="text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-colors"
            style={{
              background: "rgba(200,134,10,0.06)",
              color: "#c8860a",
              borderColor: "rgba(200,134,10,0.15)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "rgba(200,134,10,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "rgba(200,134,10,0.06)";
            }}
          >
            # {ch.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
