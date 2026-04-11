"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex gap-2 justify-center mb-8">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-colors"
          style={{ background: i <= current ? "#c8860a" : "#2a2620" }}
        />
      ))}
    </div>
  );
}

type SearchResult = {
  id: string;
  screenname: string;
  isGoldMember: boolean;
  bio: string | null;
};

export default function FindFriendsPage() {
  const router = useRouter();
  const { update } = useSession();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function sendRequest(screenname: string) {
    try {
      const res = await fetch("/api/buddies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetScreenname: screenname }),
      });
      if (res.ok || res.status === 409) {
        setRequested((prev) => new Set([...prev, screenname]));
      }
    } catch {
      // ignore
    }
  }

  async function handleContinue() {
    setLoading(true);
    try {
      await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 5 }),
      });
      await update();
      router.push("/onboarding/done");
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px] flex flex-col">
        <ProgressDots current={4} />

        <h1
          className="font-vt323 tracking-widest mb-2 text-center"
          style={{ fontSize: 32, color: "#c8860a" }}
        >
          FIND YOUR BUDDIES
        </h1>

        <p className="text-sm mb-6 text-center" style={{ color: "#8a7d6e" }}>
          Search by screenname to add friends to your buddy list.
        </p>

        {/* Search input */}
        <div className="relative mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search screennames..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full h-[42px] rounded-lg border px-3 text-sm outline-none"
            style={{
              background: "#0f0e0c",
              borderColor: query ? "#c8860a" : "#2a2620",
              color: "#e8ddd0",
              caretColor: "#c8860a",
            }}
          />
          {searching && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 animate-spin"
              style={{ borderColor: "#c8860a33", borderTopColor: "#c8860a" }}
            />
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div
            className="rounded-lg border mb-6 overflow-hidden"
            style={{ borderColor: "#2a2620" }}
          >
            {results.map((user, idx) => (
              <div
                key={user.id}
                className="flex items-center justify-between px-3 py-2"
                style={{
                  background: idx % 2 === 0 ? "#0f0e0c" : "#1a1916",
                  borderBottom:
                    idx < results.length - 1 ? "1px solid #2a2620" : "none",
                }}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium" style={{ color: "#e8ddd0" }}>
                    {user.screenname}
                    {user.isGoldMember && (
                      <span className="ml-1 text-[10px]" style={{ color: "#c8860a" }}>
                        ★
                      </span>
                    )}
                  </span>
                  {user.bio && (
                    <span className="text-[11px] truncate max-w-[280px]" style={{ color: "#6b6456" }}>
                      {user.bio}
                    </span>
                  )}
                </div>

                {requested.has(user.screenname) ? (
                  <span
                    className="text-xs font-mono"
                    style={{ color: "#16a34a" }}
                  >
                    ✓ requested
                  </span>
                ) : (
                  <button
                    onClick={() => sendRequest(user.screenname)}
                    className="text-xs px-3 h-[28px] rounded font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "#c8860a", color: "#fff" }}
                  >
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {query.trim().length >= 2 && results.length === 0 && !searching && (
          <p className="text-sm text-center mb-6" style={{ color: "#6b6456" }}>
            no users found matching &ldquo;{query}&rdquo;
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={loading}
          className="h-[44px] rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60 disabled:cursor-not-allowed mb-3"
          style={{ background: "#c8860a", color: "#fff" }}
        >
          {loading ? "Loading..." : "Continue →"}
        </button>

        <button
          onClick={handleContinue}
          disabled={loading}
          className="text-center text-[11px] font-mono transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: "#6b6456" }}
        >
          skip for now
        </button>
      </div>
    </div>
  );
}
