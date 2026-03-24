"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { pusherClient } from "@/lib/pusher";
import { formatTimestamp } from "@/lib/utils";

interface ReplyAuthor {
  id: string;
  screenname: string;
  isGoldMember: boolean;
}

interface Reply {
  id: string;
  content: string;
  createdAt: string;
  author: ReplyAuthor;
}

export function CommentSection({
  postId,
  onCommentAdded,
}: {
  postId: string;
  onCommentAdded?: () => void;
}) {
  const { data: session } = useSession();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then((r) => r.json())
      .then((data) => { setReplies(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    const ch = pusherClient.subscribe(`global-feed-${postId}`);
    ch.bind("new-comment", (reply: Reply) => {
      setReplies((prev) => {
        if (prev.some((r) => r.id === reply.id)) return prev;
        onCommentAdded?.();
        return [...prev, reply];
      });
    });
    return () => pusherClient.unsubscribe(`global-feed-${postId}`);
  }, [postId, onCommentAdded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || submitting || !session) return;
    setSubmitting(true);
    try {
      await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input }),
      });
      setInput("");
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="mt-3 border-l-2 border-green-950 pl-4">
      {loading && <p className="text-green-800 text-xs animate-pulse">loading...</p>}

      <div className="flex flex-col gap-2 mb-3">
        {replies.map((r) => (
          <div key={r.id} className="flex flex-col gap-0.5">
            <span className="text-green-600 text-xs font-bold">
              {r.author.screenname}
              {r.author.isGoldMember && (
                <span className="ml-0.5" style={{ color: "#d4a017" }}>★</span>
              )}
              <span className="ml-2 text-green-800 font-normal">{formatTimestamp(r.createdAt)}</span>
            </span>
            <p className="text-green-300 text-xs break-words">{r.content}</p>
          </div>
        ))}
      </div>

      {session && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <span className="text-green-700 text-xs self-center">&gt;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="reply..."
            maxLength={256}
            className="flex-1 bg-transparent border-b border-green-950 focus:border-green-700 outline-none text-green-200 text-xs font-mono placeholder-green-900 py-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || submitting}
            className="text-green-700 hover:text-green-400 text-xs disabled:opacity-30"
          >
            [send]
          </button>
        </form>
      )}
    </div>
  );
}
