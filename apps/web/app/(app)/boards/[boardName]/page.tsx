"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BoardPostCard, type BoardPostData } from "@/components/BoardPostCard";
import { CreateBoardPostPanel } from "@/components/CreateBoardPostPanel";
import { InvitePanel } from "@/components/InvitePanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoardDetail {
  id: string;
  name: string;
  displayName: string;
  vibeStatement: string;
  type: "PUBLIC" | "INVITE_ONLY" | "SECRET";
  memberCount: number;
  creatorId: string;
  canManage: boolean;
  isMember: boolean;
  isFoundingMember: boolean;
  isModerator: boolean;
}

type SortOption = "recent" | "nudged" | "saved";

// ---------------------------------------------------------------------------
// TypeBadge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: BoardDetail["type"] }) {
  if (type === "PUBLIC") return null;
  return (
    <span
      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
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

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PostSkeleton() {
  return (
    <div
      className="rounded-2xl border p-4 animate-pulse"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex gap-2 mb-3">
        <div className="w-[26px] h-[26px] rounded-lg" style={{ background: "var(--border)" }} />
        <div className="h-3 rounded w-24 mt-1.5" style={{ background: "var(--border)" }} />
      </div>
      <div className="h-4 rounded w-3/4 mb-2" style={{ background: "var(--card)" }} />
      <div className="h-3 rounded w-full mb-1" style={{ background: "var(--card)" }} />
      <div className="h-3 rounded w-2/3" style={{ background: "var(--card)" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board page
// ---------------------------------------------------------------------------

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const boardName = params.boardName as string;

  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [posts, setPosts] = useState<BoardPostData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [sort, setSort] = useState<SortOption>("recent");
  const [joining, setJoining] = useState(false);

  const [rightPanel, setRightPanel] = useState<"compose" | "invite" | null>(null);

  // ---- Fetch board info ----
  useEffect(() => {
    fetch(`/api/boards/${boardName}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        setBoard(await res.json());
      })
      .catch(() => setNotFound(true));
  }, [boardName]);

  // ---- Fetch posts ----
  const fetchPosts = useCallback(
    async (cursor?: string, currentSort?: SortOption) => {
      const s = currentSort ?? sort;
      const url = `/api/boards/${boardName}/posts?sort=${s}${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      return res.json() as Promise<{ posts: BoardPostData[]; nextCursor: string | null }>;
    },
    [boardName, sort]
  );

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setNextCursor(null);
    fetchPosts(undefined, sort)
      .then((d) => {
        setPosts(d.posts ?? []);
        setNextCursor(d.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sort, boardName]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await fetchPosts(nextCursor);
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...(d.posts ?? []).filter((p) => !ids.has(p.id))];
      });
      setNextCursor(d.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const joinBoard = async () => {
    if (joining) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/boards/${boardName}/join`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBoard((b) =>
          b ? { ...b, isMember: true, isFoundingMember: data.isFoundingMember } : b
        );
        // Reload posts
        const d = await fetchPosts();
        setPosts(d.posts ?? []);
        setNextCursor(d.nextCursor);
      }
    } finally {
      setJoining(false);
    }
  };

  const handleNewPost = (post: BoardPostData) => {
    setPosts((prev) => [post, ...prev]);
    setRightPanel(null);
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  // ---- Render states ----
  if (notFound) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-3"
        style={{ background: "var(--bg)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
          board not found.
        </p>
        <Link href="/boards" className="text-xs font-mono" style={{ color: "var(--teal)" }}>
          ← browse boards
        </Link>
      </div>
    );
  }

  if (!board && !loading) return null;

  // INVITE_ONLY gate for non-members
  if (board && !board.isMember && board.type === "INVITE_ONLY") {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-4"
        style={{ background: "var(--bg)" }}
      >
        <p
          className="text-lg font-semibold"
          style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
        >
          {board.displayName}
        </p>
        <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
          {board.vibeStatement}
        </p>
        <p className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
          🔒 invite only · {board.memberCount} members
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          you need an invite link to join this board.
        </p>
        <Link href="/boards" className="text-xs font-mono" style={{ color: "var(--teal)" }}>
          ← browse boards
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Topbar */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/boards"
                className="text-sm font-mono"
                style={{ color: "var(--text-dim)" }}
              >
                ←
              </Link>

              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "var(--surface)", color: "var(--text-dim)" }}
              >
                {board?.displayName.charAt(0).toUpperCase() ?? "…"}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1
                    className="text-base font-bold"
                    style={{ color: "var(--text)" }}
                  >
                    {board?.displayName ?? "…"}
                  </h1>
                  {board && <TypeBadge type={board.type} />}
                </div>
                {board && (
                  <p
                    className="text-xs italic mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {board.vibeStatement}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {board?.isMember && (
                <button
                  onClick={() =>
                    setRightPanel((p) => (p === "compose" ? null : "compose"))
                  }
                  className="h-8 px-3 rounded-xl text-xs font-mono font-bold transition-all"
                  style={{
                    background: rightPanel === "compose" ? "var(--surface)" : "var(--teal)",
                    color: rightPanel === "compose" ? "var(--text-muted)" : "var(--bg)",
                  }}
                >
                  {rightPanel === "compose" ? "cancel" : "new post"}
                </button>
              )}
              {board && (board.type === "INVITE_ONLY" || board.type === "SECRET") && board.isMember && (
                <button
                  onClick={() =>
                    setRightPanel((p) => (p === "invite" ? null : "invite"))
                  }
                  className="h-8 px-3 rounded-xl text-xs font-mono transition-all"
                  style={{
                    background:
                      rightPanel === "invite" ? "var(--teal)" : "var(--teal-tint)",
                    color: rightPanel === "invite" ? "var(--bg)" : "var(--teal)",
                  }}
                >
                  invite
                </button>
              )}
              {board?.canManage && (
                <Link
                  href={`/boards/${boardName}/settings`}
                  className="h-8 px-3 rounded-xl text-xs font-mono flex items-center transition-all border"
                  style={{ background: "var(--surface)", color: "var(--text-muted)", borderColor: "var(--border)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--amber)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--amber)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
                  }}
                >
                  ⚙ settings
                </Link>
              )}
            </div>
          </div>

          {board && (
            <p className="text-[11px] font-mono mt-2" style={{ color: "var(--text-dim)" }}>
              {board.memberCount.toLocaleString()} member
              {board.memberCount !== 1 ? "s" : ""}
              {board.isFoundingMember && (
                <span
                  className="ml-2 font-mono"
                  style={{ color: "#c8860a66" }}
                >
                  · ✦ you&apos;re a founding member
                </span>
              )}
            </p>
          )}
        </div>

        {/* Compose / Invite panel */}
        {rightPanel === "compose" && board?.isMember && (
          <div
            className="rounded-2xl border mb-6"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <CreateBoardPostPanel
              boardName={boardName}
              onPost={handleNewPost}
              onClose={() => setRightPanel(null)}
            />
          </div>
        )}

        {rightPanel === "invite" &&
          board &&
          (board.type === "INVITE_ONLY" || board.type === "SECRET") && (
            <div
              className="rounded-2xl border mb-6"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <InvitePanel
                channelName={boardName}
                channelType={board.type as "INVITE_ONLY" | "SECRET"}
                apiPrefix="boards"
              />
            </div>
          )}

        {/* Sort tabs */}
        <div
          className="flex items-center gap-1 mb-5 border-b pb-3"
          style={{ borderColor: "var(--border)" }}
        >
          {(["recent", "nudged", "saved"] as SortOption[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="h-7 px-3 rounded-lg text-xs font-mono transition-all"
              style={{
                background: sort === s ? "rgba(45,212,191,0.10)" : "transparent",
                color: sort === s ? "var(--teal)" : "var(--text-dim)",
                border: `1px solid ${sort === s ? "rgba(45,212,191,0.25)" : "transparent"}`,
              }}
            >
              {s}
            </button>
          ))}
          <span
            className="ml-auto text-[10px] italic"
            style={{ color: "var(--text-dim)" }}
          >
            no algorithm · chronological only
          </span>
        </div>

        {/* Join CTA for non-members on PUBLIC boards */}
        {board && !board.isMember && board.type === "PUBLIC" && session && (
          <div
            className="rounded-2xl border p-4 mb-5 flex items-center justify-between"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              join to post and comment
            </p>
            <button
              onClick={joinBoard}
              disabled={joining}
              className="h-8 px-4 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-50"
              style={{ background: "var(--teal)", color: "var(--bg)" }}
            >
              {joining ? "joining…" : "join board"}
            </button>
          </div>
        )}

        {/* Posts */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm italic py-8 text-center" style={{ color: "var(--text-dim)" }}>
            {sort === "saved"
              ? "you haven't saved any posts yet."
              : "no posts yet — be the first!"}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <BoardPostCard
                key={post.id}
                post={post}
                boardName={boardName}
                canDelete={
                  !!session?.user?.id && (
                    post.author.id === session.user.id ||
                    board?.creatorId === session.user.id ||
                    !!(board?.isModerator)
                  )
                }
                onDelete={handleDeletePost}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {nextCursor && !loading && (
          <div className="py-4 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs font-mono px-4 py-2 rounded-lg border transition-colors disabled:opacity-40"
              style={{ color: "var(--text-dim)", borderColor: "var(--border)" }}
            >
              {loadingMore ? "loading…" : "load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
