"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PostCard, type PostCardPost } from "@/components/radical/PostCard";
import { useRadicalLayout, type BuddyData } from "./RadicalLayoutContext";
import { AVATAR_PALETTE } from "./avatarPalette";
import { getInitials, formatTimestamp } from "@/lib/utils";
import { deriveAvatarColor } from "@/lib/auth";
import { parseCurrently, filledFields, CURRENTLY_META } from "@/lib/currently";

// ---------------------------------------------------------------------------
// RightPanel — slides in from the right when a buddy is selected
// ---------------------------------------------------------------------------

interface Message {
  id:        string;
  content:   string;
  createdAt: string;
  author:    { id: string; screenname: string };
}

type Tab = "chat" | "posts";

function ChatView({ buddy }: { buddy: BuddyData }) {
  const { data: session }  = useSession();
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/messages/${buddy.userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.messages) setMessages(data.messages);
      })
      .finally(() => setLoading(false));
  }, [buddy.userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    await fetch(`/api/messages/${buddy.userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setSending(false);
    // Re-fetch messages
    fetch(`/api/messages/${buddy.userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.messages) setMessages(data.messages); });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {/* Message list */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {loading ? (
          <div style={{ fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)" }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)", fontStyle: "italic", padding: "24px 0" }}>
            No messages yet. Say hi!
          </div>
        ) : (
          messages.map((m) => {
            const isOwn = m.author.id === session?.user?.id;
            return (
              <div key={m.id} style={{ marginBottom: 8 }}>
                <span style={{
                  fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600,
                  color: isOwn ? "var(--amber)" : "var(--snow2)",
                }}>
                  {m.author.screenname}
                </span>
                <span style={{ fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)", marginLeft: 6 }}>
                  {formatTimestamp(m.createdAt)}
                </span>
                <p style={{
                  margin: "2px 0 0",
                  fontFamily: "var(--sans)", fontSize: 13, color: "var(--snow)",
                  lineHeight: 1.5, wordBreak: "break-word",
                }}>
                  {m.content}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div style={{
        borderTop: "1px solid var(--edge1)",
        padding: "8px 12px",
        display: "flex", alignItems: "center", gap: 8,
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder={`Message ${buddy.screenname}…`}
          style={{
            flex: 1,
            background: "var(--fog1)", border: "1px solid var(--edge1)",
            borderRadius: "var(--rp)", padding: "7px 12px",
            fontFamily: "var(--sans)", fontSize: 12, color: "var(--snow)",
            outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            padding: "7px 12px", borderRadius: "var(--rp)",
            background: input.trim() ? "var(--ambg)" : "transparent",
            border: "1px solid var(--edge1)",
            color: input.trim() ? "var(--amber)" : "var(--snow5)",
            fontSize: 11, fontWeight: 700, fontFamily: "var(--sans)",
            cursor: input.trim() ? "pointer" : "default",
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

function PostsView({ buddy }: { buddy: BuddyData }) {
  const [posts,   setPosts]   = useState<PostCardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { setActiveTag } = useRadicalLayout();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/posts?userId=${buddy.userId}&limit=20`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.posts) return;
        setPosts(data.posts.map((p: any) => {
          const currently = parseCurrently(p.user.currently);
          return {
            id:           p.id,
            postType:     p.postType,
            user:         { screenname: p.user.screenname, avatarColor: p.user.avatarColor, isGoldMember: p.user.isGoldMember },
            awayMessage:  p.content || undefined,
            bodyText:     p.bodyText ?? undefined,
            quoteText:    p.quoteText ?? undefined,
            quoteAttrib:  p.quoteAttrib ?? undefined,
            imageUrl:     p.imageUrl ?? undefined,
            imageCaption: p.imageCaption ?? undefined,
            tags:         p.tags ?? [],
            nudgeCount:   p.nudgeCount,
            echoCount:    p.echoCount,
            hasNudged:    p.hasNudged,
            createdAt:    new Date(p.setAt),
            awayStatus:   (p.user.status as "ONLINE" | "AWAY" | "OFFLINE") || "OFFLINE",
            currentlyFields: filledFields(currently).map(([key]) => ({
              emoji: CURRENTLY_META[key].emoji, label: CURRENTLY_META[key].label,
            })),
            echoOf: p.echoOf ?? null,
          };
        }));
      })
      .finally(() => setLoading(false));
  }, [buddy.userId]);

  if (loading) return (
    <div style={{ padding: 14, fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)" }}>Loading…</div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      {posts.length === 0
        ? <div style={{ fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)", fontStyle: "italic", padding: "24px 0" }}>No posts yet.</div>
        : posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onNudge={() => {}}
              onEcho={() => {}}
              onReply={() => {}}
              onTagClick={setActiveTag}
              onUserClick={() => {}}
            />
          ))
      }
    </div>
  );
}

export function RightPanel() {
  const { activeBuddy, setActiveBuddy } = useRadicalLayout();
  const [tab, setTab] = useState<Tab>("chat");

  const close = () => setActiveBuddy(null);

  const { bg, fg } = AVATAR_PALETTE[activeBuddy?.avatarColor ?? "amber"] ?? AVATAR_PALETTE.amber;

  return (
    <div style={{
      width: activeBuddy ? 340 : 0,
      flexShrink: 0,
      overflow: "hidden",
      transition: "width 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
      background: "var(--ink2)",
      borderLeft: activeBuddy ? "1px solid var(--edge1)" : "none",
      display: "flex",
      flexDirection: "column",
    }}>
      {activeBuddy && (
        <>
          {/* Header */}
          <div style={{
            height: 52, flexShrink: 0,
            borderBottom: "1px solid var(--edge1)",
            display: "flex", alignItems: "center", gap: 10,
            padding: "0 14px",
          }}>
            {/* Close */}
            <button
              onClick={close}
              style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "var(--fog1)", border: "1px solid var(--edge1)",
                color: "var(--snow3)", fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ✕
            </button>

            {/* Buddy info */}
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: bg, color: fg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, fontFamily: "var(--sans)",
              userSelect: "none", flexShrink: 0,
            }}>
              {getInitials(activeBuddy.screenname)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--snow)", fontFamily: "var(--sans)" }}>
                {activeBuddy.screenname}
              </div>
              {activeBuddy.awayMessage && (
                <div style={{
                  fontSize: 10, fontStyle: "italic", color: "var(--amber)",
                  fontFamily: "var(--serif)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {activeBuddy.awayMessage}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", borderBottom: "1px solid var(--edge1)",
            flexShrink: 0,
          }}>
            {(["chat", "posts"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: "10px 0",
                  background: "transparent",
                  border: "none",
                  borderBottom: tab === t ? "2px solid var(--amber)" : "2px solid transparent",
                  color: tab === t ? "var(--amber)" : "var(--snow4)",
                  fontSize: 11, fontWeight: 600, fontFamily: "var(--sans)",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          {tab === "chat"  && <ChatView  buddy={activeBuddy} />}
          {tab === "posts" && <PostsView buddy={activeBuddy} />}
        </>
      )}
    </div>
  );
}
