"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CreateBoardPanel } from "@/components/CreateBoardPanel";

interface BoardSummary {
  id: string;
  name: string;
  displayName: string;
  vibeStatement: string;
  type: "PUBLIC" | "INVITE_ONLY" | "SECRET";
  memberCount: number;
  isFoundingMember?: boolean;
}

function TypeBadge({ type }: { type: "PUBLIC" | "INVITE_ONLY" | "SECRET" }) {
  if (type === "PUBLIC") return null;
  return (
    <span
      className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
      style={{
        background:
          type === "INVITE_ONLY" ? "rgba(251,191,36,0.08)" : "rgba(139,92,246,0.08)",
        color: type === "INVITE_ONLY" ? "#f59e0b" : "#a78bfa",
        border: `1px solid ${
          type === "INVITE_ONLY" ? "rgba(251,191,36,0.2)" : "rgba(139,92,246,0.2)"
        }`,
      }}
    >
      {type === "INVITE_ONLY" ? "🔒 invite only" : "👁 secret"}
    </span>
  );
}

function BoardCard({
  board,
  showFoundingBadge,
}: {
  board: BoardSummary;
  showFoundingBadge?: boolean;
}) {
  const initial = board.displayName.charAt(0).toUpperCase();

  return (
    <Link
      href={`/boards/${board.name}`}
      className="flex items-start gap-3 px-4 py-3.5 rounded-2xl border transition-all"
      style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = "#2a2a1a";
        el.style.background = "#111109";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = "#1a1a12";
        el.style.background = "#0a0a08";
      }}
    >
      {/* Board icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-bold"
        style={{ background: "#1a1a12", color: "#3a3a2a" }}
      >
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold"
            style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
          >
            {board.displayName}
          </span>
          <TypeBadge type={board.type} />
          {showFoundingBadge && board.isFoundingMember && (
            <span
              className="text-[9px] font-mono px-1 py-0.5 rounded"
              style={{
                background: "rgba(200,134,10,0.08)",
                color: "#c8860a",
                border: "1px solid rgba(200,134,10,0.2)",
              }}
            >
              ✦ founding
            </span>
          )}
        </div>

        <p
          className="text-xs mt-0.5 line-clamp-1 italic"
          style={{ color: "#4b5563", fontFamily: "var(--font-dm-sans)" }}
        >
          {board.vibeStatement}
        </p>

        <p className="text-[11px] font-mono mt-1" style={{ color: "#2a2a1a" }}>
          {board.memberCount.toLocaleString()} member
          {board.memberCount !== 1 ? "s" : ""}
        </p>
      </div>
    </Link>
  );
}

export default function BoardsPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BoardSummary[]>([]);
  const [myBoards, setMyBoards] = useState<BoardSummary[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingMine, setLoadingMine] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session?.user?.id) { setLoadingMine(false); return; }
    fetch("/api/boards?mine=true")
      .then((r) => r.json())
      .then((d) => setMyBoards(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingMine(false));
  }, [session?.user?.id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(`/api/boards?q=${encodeURIComponent(query)}`);
        const d = await res.json();
        setResults(Array.isArray(d) ? d : []);
      } finally {
        setLoadingSearch(false);
      }
    }, 250);
  }, [query]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0d0d0b", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e7eb" }}>
              Boards
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
              async topic communities — no algorithms, just vibes
            </p>
          </div>
          {session && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="h-9 px-4 rounded-xl text-sm font-mono font-bold transition-all"
              style={{
                background: showCreate ? "#1a1a12" : "#2dd4bf",
                color: showCreate ? "#6b7280" : "#0d0d0b",
              }}
            >
              {showCreate ? "cancel" : "+ create"}
            </button>
          )}
        </div>

        {/* Create panel */}
        {showCreate && (
          <div
            className="rounded-2xl border mb-6"
            style={{ borderColor: "#1e1e14", background: "#111109" }}
          >
            <CreateBoardPanel onClose={() => setShowCreate(false)} />
          </div>
        )}

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-xl border px-3 h-10 mb-6"
          style={{ borderColor: "#1e1e14", background: "#111109" }}
        >
          <span className="text-sm" style={{ color: "#3a3a2a" }}>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search boards…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "#d1d5db" }}
          />
          {loadingSearch && (
            <span className="text-[10px] font-mono animate-pulse" style={{ color: "#3a3a2a" }}>
              …
            </span>
          )}
        </div>

        {/* Your boards */}
        {session && !loadingMine && myBoards.length > 0 && (
          <section className="mb-8">
            <h2
              className="text-[11px] font-mono uppercase tracking-widest mb-3"
              style={{ color: "#3a3a2a" }}
            >
              your boards
            </h2>
            <div className="flex flex-col gap-2">
              {myBoards.map((b) => (
                <BoardCard key={b.id} board={b} showFoundingBadge />
              ))}
            </div>
          </section>
        )}

        {/* Search results / all boards */}
        <section>
          <h2
            className="text-[11px] font-mono uppercase tracking-widest mb-3"
            style={{ color: "#3a3a2a" }}
          >
            {query.length > 0 ? "results" : "all public boards"}
          </h2>

          {results.length === 0 && !loadingSearch ? (
            <p className="text-sm italic py-4" style={{ color: "#2a2a1a" }}>
              {query.length > 0
                ? `no boards match "${query}"`
                : "no boards yet — start one!"}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((b) => (
                <BoardCard key={b.id} board={b} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
