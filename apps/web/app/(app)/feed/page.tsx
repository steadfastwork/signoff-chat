"use client";

import { useState } from "react";
import { Feed } from "@/components/Feed";
import { AwayFeed } from "@/components/away/AwayFeed";

type Tab = "away" | "posts";

export default function FeedPage() {
  const [tab, setTab] = useState<Tab>("away");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header + tabs */}
      <div className="flex items-center justify-between mb-5">
        <h1
          className="font-vt323 select-none"
          style={{ fontSize: 22, color: "var(--amber)", lineHeight: 1 }}
        >
          // {tab === "away" ? "away" : "posts"}
        </h1>

        {/* Pill tabs */}
        <div
          className="flex items-center rounded-xl overflow-hidden border"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={() => setTab("away")}
            className="px-3.5 py-1.5 text-xs font-mono transition-colors"
            style={{
              background: tab === "away" ? "var(--amber-tint)" : "transparent",
              color: tab === "away" ? "var(--amber)" : "var(--text-dim)",
            }}
          >
            away
          </button>
          <button
            onClick={() => setTab("posts")}
            className="px-3.5 py-1.5 text-xs font-mono transition-colors"
            style={{
              background: tab === "posts" ? "var(--amber-tint)" : "transparent",
              color: tab === "posts" ? "var(--amber)" : "var(--text-dim)",
            }}
          >
            posts
          </button>
        </div>
      </div>

      {tab === "away" ? <AwayFeed /> : <Feed />}
    </div>
  );
}
