"use client";

import { type TimeSeparator as TTimeSeparator } from "@/lib/chat";

export function TimeSeparator({ item }: { item: TTimeSeparator }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
      <span
        className="text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ color: "#6b7280", background: "#0f0f08", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {item.label}
      </span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}
