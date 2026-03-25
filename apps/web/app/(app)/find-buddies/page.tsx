"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StatusDot, type StatusValue } from "@/components/StatusDot";

interface UserResult {
  id: string;
  screenname: string;
  isGoldMember: boolean;
  status: StatusValue;
  bio: string | null;
  requestSent?: boolean;
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

export default function FindBuddiesPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendRequest = async (user: UserResult) => {
    if (sendingTo) return;
    setSendingTo(user.id);
    try {
      const res = await fetch("/api/buddies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetScreenname: user.screenname }),
      });
      if (res.ok) {
        setResults((prev) =>
          prev.map((u) => u.id === user.id ? { ...u, requestSent: true } : u)
        );
      }
    } finally {
      setSendingTo(null);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Find buddies
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            search by screenname to add someone
          </p>
        </div>

        {/* Search input */}
        <div
          className="flex items-center gap-2 rounded-xl border px-3 h-11 mb-6"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <span className="text-sm" style={{ color: "var(--text-dim)" }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="type a screenname…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text)" }}
          />
          {loading && (
            <span
              className="text-[10px] font-mono animate-pulse"
              style={{ color: "var(--text-dim)" }}
            >
              …
            </span>
          )}
        </div>

        {/* Results */}
        {searched && results.length === 0 && !loading && (
          <p
            className="text-sm italic py-4 text-center"
            style={{ color: "var(--text-dim)" }}
          >
            no users found for &ldquo;{query}&rdquo;
          </p>
        )}

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((user) => {
              const colorKey = hashColor(user.id);
              const colors = AVATAR_COLORS[colorKey];
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  {/* Avatar */}
                  <Link href={`/u/${user.screenname}`} className="relative flex-shrink-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: colors.bg }}
                    >
                      <span
                        className="text-[11px] font-bold font-mono"
                        style={{ color: colors.text }}
                      >
                        {user.screenname.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <StatusDot status={user.status} size="sm" bg="var(--surface)" />
                    </span>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/u/${user.screenname}`}
                        className="text-sm font-semibold hover:underline"
                        style={{ color: "var(--text)" }}
                      >
                        {user.screenname}
                      </Link>
                      {user.isGoldMember && (
                        <span className="text-[10px]" style={{ color: "#d4a017" }}>★</span>
                      )}
                    </div>
                    {user.bio && (
                      <p
                        className="text-xs mt-0.5 truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {user.bio}
                      </p>
                    )}
                  </div>

                  {/* Add buddy button */}
                  {user.requestSent ? (
                    <span
                      className="text-[11px] font-mono flex-shrink-0"
                      style={{ color: "var(--teal)" }}
                    >
                      ✓ sent
                    </span>
                  ) : (
                    <button
                      onClick={() => sendRequest(user)}
                      disabled={sendingTo === user.id}
                      className="flex-shrink-0 h-8 px-3 rounded-lg text-[11px] font-mono font-bold transition-all disabled:opacity-40"
                      style={{ background: "var(--teal)", color: "var(--bg)" }}
                    >
                      {sendingTo === user.id ? "…" : "+ add"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {query.length < 2 && !loading && (
          <p
            className="text-sm text-center py-8"
            style={{ color: "var(--text-dim)" }}
          >
            type at least 2 characters to search
          </p>
        )}
      </div>
    </div>
  );
}
