"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BoardPostDetail } from "@/components/BoardPostDetail";
import type { BoardPostData } from "@/components/BoardPostCard";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PostDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-[26px] h-[26px] rounded-lg" style={{ background: "var(--surface)" }} />
        <div className="h-3 rounded w-24" style={{ background: "var(--surface)" }} />
      </div>
      <div className="h-6 rounded w-3/4 mb-3" style={{ background: "var(--card)" }} />
      <div className="space-y-2 mb-4">
        <div className="h-3 rounded w-full" style={{ background: "var(--card)" }} />
        <div className="h-3 rounded w-5/6" style={{ background: "var(--card)" }} />
        <div className="h-3 rounded w-4/6" style={{ background: "var(--card)" }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BoardPostPage() {
  const params = useParams();
  const { data: session } = useSession();
  const boardName = params.boardName as string;
  const postId = params.postId as string;

  const [post, setPost] = useState<BoardPostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchPost = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardName}/posts/${postId}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    if (res.ok) {
      setPost(await res.json());
    } else {
      setNotFound(true);
    }
  }, [boardName, postId]);

  useEffect(() => {
    setLoading(true);
    fetchPost().finally(() => setLoading(false));
  }, [fetchPost]);

  // ---- Not found ----
  if (notFound) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-3"
        style={{ background: "var(--bg)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
          post not found.
        </p>
        <Link href={`/boards/${boardName}`} className="text-xs font-mono" style={{ color: "var(--teal)" }}>
          ← back to board
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
        {/* Back nav */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/boards/${boardName}`}
            className="text-sm font-mono"
            style={{ color: "var(--text-dim)" }}
          >
            ←
          </Link>
          <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
            {boardName}
          </span>
        </div>

        {/* Content */}
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {loading ? (
            <PostDetailSkeleton />
          ) : post ? (
            <BoardPostDetail
              post={post}
              boardName={boardName}
              currentUserId={session?.user?.id}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
