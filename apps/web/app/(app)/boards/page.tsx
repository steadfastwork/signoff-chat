"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  canManage?: boolean;
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
  const router = useRouter();
  const initial = board.displayName.charAt(0).toUpperCase();

  return (
    <Link
      href={`/boards/${board.name}`}
      className="flex items-start gap-3 px-4 py-3.5 rounded-2xl border transition-all"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = "var(--border-bright)";
        el.style.background = "var(--surface)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = "var(--border)";
        el.style.background = "var(--bg)";
      }}
    >
      {/* Board icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-bold"
        style={{ background: "var(--surface)", color: "var(--text-dim)" }}
      >
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
          >
            {board.displayName}
          </span>
          <TypeBadge type={board.type} />
          {showFoundingBadge && board.isFoundingMember && (
            <span
              className="text-[9px] font-mono px-1 py-0.5 rounded"
              style={{
                background: "rgba(200,134,10,0.08)",
                color: "var(--amber)",
                border: "1px solid rgba(200,134,10,0.2)",
              }}
            >
              ✦ founding
            </span>
          )}
        </div>

        <p
          className="text-xs mt-0.5 line-clamp-1 italic"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}
        >
          {board.vibeStatement}
        </p>

        <p className="text-[11px] font-mono mt-1" style={{ color: "var(--text-dim)" }}>
          {board.memberCount.toLocaleString()} member
          {board.memberCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Settings button (owner only) */}
      {board.canManage && (
        <button
          onClick={(e) => { e.preventDefault(); router.push(`/boards/${board.name}/settings`); }}
          className="flex-shrink-0 text-[11px] font-mono px-2 py-1 rounded-lg border transition-all mt-0.5"
          style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
          title="board settings"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--amber)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--amber)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
        >
          ⚙
        </button>
      )}
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
      style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              Boards
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              async topic communities — no algorithms, just vibes
            </p>
          </div>
          {session && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="h-9 px-4 rounded-xl text-sm font-mono font-bold transition-all"
              style={{
                background: showCreate ? "var(--surface)" : "var(--teal)",
                color: showCreate ? "var(--text-muted)" : "var(--bg)",
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
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <CreateBoardPanel onClose={() => setShowCreate(false)} />
          </div>
        )}

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-xl border px-3 h-10 mb-6"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <span className="text-sm" style={{ color: "var(--text-dim)" }}>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search boards…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text)" }}
          />
          {loadingSearch && (
            <span className="text-[10px] font-mono animate-pulse" style={{ color: "var(--text-dim)" }}>
              …
            </span>
          )}
        </div>

        {/* Your boards */}
        {session && !loadingMine && myBoards.length > 0 && (
          <section className="mb-8">
            <h2
              className="text-[11px] font-mono uppercase tracking-widest mb-3"
              style={{ color: "var(--text-dim)" }}
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
            style={{ color: "var(--text-dim)" }}
          >
            {query.length > 0 ? "results" : "all public boards"}
          </h2>

          {results.length === 0 && !loadingSearch ? (
            <p className="text-sm italic py-4" style={{ color: "var(--text-dim)" }}>
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
