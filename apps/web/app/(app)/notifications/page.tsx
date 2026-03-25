"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuddyRequestItem {
  requesterId: string;
  screenname: string;
  isGoldMember: boolean;
  createdAt: string;
}

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  amber:   { bg: "#78350f", text: "#fcd34d" },
  rose:    { bg: "#881337", text: "#fda4af" },
  sky:     { bg: "#0c4a6e", text: "#7dd3fc" },
  emerald: { bg: "#064e3b", text: "#6ee7b7" },
  violet:  { bg: "#4c1d95", text: "#c4b5fd" },
  orange:  { bg: "#7c2d12", text: "#fdba74" },
};

function hashColor(id: string): string {
  const keys = Object.keys(AVATAR_COLORS);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return keys[h % keys.length];
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const [requests, setRequests] = useState<BuddyRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/buddies/requests")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => { if (Array.isArray(data)) setRequests(data); })
        .catch(() => {})
        .finally(() => setLoading(false));

    load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(load, 15_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  const accept = async (requesterId: string) => {
    if (acting) return;
    setActing(requesterId);
    try {
      const res = await fetch(`/api/buddies/${requesterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
      }
    } finally {
      setActing(null);
    }
  };

  const decline = async (requesterId: string) => {
    if (acting) return;
    setActing(requesterId);
    try {
      const res = await fetch(`/api/buddies/${requesterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.requesterId !== requesterId));
      }
    } finally {
      setActing(null);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text)" }}
          >
            Notifications
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            buddy requests and activity
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl animate-pulse"
                style={{ background: "var(--surface)" }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && requests.length === 0 && (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="text-2xl mb-2">🔔</p>
            <p className="text-sm font-mono" style={{ color: "var(--text-dim)" }}>
              no pending notifications
            </p>
          </div>
        )}

        {/* Buddy request section */}
        {!loading && requests.length > 0 && (
          <div>
            <p
              className="text-[10px] font-mono uppercase tracking-[0.15em] mb-2 px-1"
              style={{ color: "var(--text-dim)" }}
            >
              buddy requests ({requests.length})
            </p>
            <div className="flex flex-col gap-2">
              {requests.map((req) => {
                const colors = AVATAR_COLORS[hashColor(req.requesterId)];
                const isActing = acting === req.requesterId;
                return (
                  <div
                    key={req.requesterId}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    {/* Avatar */}
                    <Link href={`/u/${req.screenname}`} className="flex-shrink-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: colors.bg }}
                      >
                        <span
                          className="text-[11px] font-bold font-mono"
                          style={{ color: colors.text }}
                        >
                          {req.screenname.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/u/${req.screenname}`}
                          className="text-sm font-semibold hover:underline"
                          style={{ color: "var(--text)" }}
                        >
                          {req.screenname}
                        </Link>
                        {req.isGoldMember && (
                          <span className="text-[10px]" style={{ color: "#d4a017" }}>★</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        wants to add you as a buddy
                        <span className="ml-1.5 font-mono" style={{ color: "var(--text-dim)" }}>
                          · {timeAgo(req.createdAt)}
                        </span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => accept(req.requesterId)}
                        disabled={!!acting}
                        className="h-8 px-3 rounded-lg text-[11px] font-mono font-bold transition-all disabled:opacity-40"
                        style={{ background: "var(--teal)", color: "var(--bg)" }}
                      >
                        {isActing ? "…" : "accept"}
                      </button>
                      <button
                        onClick={() => decline(req.requesterId)}
                        disabled={!!acting}
                        className="h-8 px-3 rounded-lg text-[11px] font-mono border transition-all disabled:opacity-40"
                        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)")
                        }
                      >
                        {isActing ? "…" : "decline"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
