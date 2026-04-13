"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PostCard, type PostCardPost } from "@/components/radical/PostCard";
import { useRadicalLayout, type BuddyData } from "./RadicalLayoutContext";
import { AVATAR_PALETTE } from "./avatarPalette";
import { getInitials, formatTimestamp } from "@/lib/utils";
import { parseCurrently, filledFields, CURRENTLY_META } from "@/lib/currently";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id:        string;
  content:   string;
  createdAt: string;
  author:    { id: string; screenname: string };
}

// ---------------------------------------------------------------------------
// ChatView — used inside the full-screen overlay
// ---------------------------------------------------------------------------

function ChatView({ buddy }: { buddy: BuddyData }) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/messages/${buddy.userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.messages) setMessages(data.messages); })
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
    fetch(`/api/messages/${buddy.userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.messages) setMessages(data.messages); });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {loading ? (
          <div style={{ fontSize: 12, color: "var(--snow5)", fontFamily: "var(--sans)" }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--snow5)", fontFamily: "var(--sans)", fontStyle: "italic", padding: "48px 0", textAlign: "center" }}>
            No messages yet. Say hi!
          </div>
        ) : (
          messages.map((m) => {
            const isOwn = m.author.id === session?.user?.id;
            return (
              <div key={m.id} style={{ marginBottom: 10 }}>
                <span style={{
                  fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600,
                  color: isOwn ? "var(--amber)" : "var(--snow2)",
                }}>
                  {m.author.screenname}
                </span>
                <span style={{ fontSize: 11, color: "var(--snow5)", fontFamily: "var(--sans)", marginLeft: 8 }}>
                  {formatTimestamp(m.createdAt)}
                </span>
                <div
                  style={{ margin: "3px 0 0", fontFamily: "var(--sans)", fontSize: 14, color: "var(--snow)", lineHeight: 1.5, wordBreak: "break-word" }}
                  dangerouslySetInnerHTML={{ __html: m.content }}
                />
              </div>
            );
          })
        )}
      </div>

      <div style={{
        borderTop: "1px solid var(--edge1)",
        padding: "10px 20px",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder={`Message ${buddy.screenname}…`}
          style={{
            flex: 1,
            background: "var(--fog1)", border: "1px solid var(--edge1)",
            borderRadius: "var(--rp)", padding: "9px 14px",
            fontFamily: "var(--sans)", fontSize: 14, color: "var(--snow)",
            outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            padding: "9px 16px", borderRadius: "var(--rp)",
            background: input.trim() ? "var(--ambg)" : "transparent",
            border: "1px solid var(--edge1)",
            color: input.trim() ? "var(--amber)" : "var(--snow5)",
            fontSize: 14, fontWeight: 700, fontFamily: "var(--sans)",
            cursor: input.trim() ? "pointer" : "default",
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatOverlay — full-screen overlay covering the content area (not sidebar)
// Desktop: left = 252px (sidebar width). Mobile: handled by MobileLayout.
// ---------------------------------------------------------------------------

export function ChatOverlay() {
  const { activeBuddy, setActiveBuddy } = useRadicalLayout();
  const [tab, setTab] = useState<"chat" | "posts">("chat");
  const [posts, setPosts] = useState<PostCardPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const { setActiveTag } = useRadicalLayout();

  const isOpen = activeBuddy !== null;

  // Load posts when tab switches
  useEffect(() => {
    if (tab !== "posts" || !activeBuddy) return;
    setPostsLoading(true);
    fetch(`/api/posts?userId=${activeBuddy.userId}&limit=20`)
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
      .finally(() => setPostsLoading(false));
  }, [tab, activeBuddy?.userId]);

  // Reset tab when buddy changes
  useEffect(() => { setTab("chat"); }, [activeBuddy?.userId]);

  const close = () => setActiveBuddy(null);

  const { bg, fg } = AVATAR_PALETTE[activeBuddy?.avatarColor ?? "amber"] ?? AVATAR_PALETTE.amber;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      bottom: 0,
      // On desktop: don't cover the sidebar (252px). JS-driven media check not
      // available here, so we use a CSS variable fallback with a sensible default.
      left: "var(--sidebar-width, 252px)",
      right: 0,
      zIndex: 200,
      background: "var(--ink)",
      display: "flex",
      flexDirection: "column",
      // Slide in from right
      transform: isOpen ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
      // When closed, make non-interactive to prevent invisible click traps
      pointerEvents: isOpen ? "auto" : "none",
    }}>
      {activeBuddy && (
        <>
          {/* Header */}
          <div style={{
            height: 58, flexShrink: 0,
            background: "var(--ink2)", borderBottom: "1px solid var(--edge1)",
            display: "flex", alignItems: "center", gap: 14,
            padding: "0 20px",
          }}>
            {/* Back button */}
            <button
              onClick={close}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--fog1)", border: "1px solid var(--edge1)",
                color: "var(--snow3)", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
              title="Back"
            >
              ‹
            </button>

            {/* Buddy avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: bg, color: fg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, fontFamily: "var(--sans)",
              userSelect: "none", flexShrink: 0,
            }}>
              {getInitials(activeBuddy.screenname)}
            </div>

            {/* Name + away */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--snow)", fontFamily: "var(--sans)" }}>
                {activeBuddy.screenname}
                {activeBuddy.isGold && <span style={{ fontSize: 10, color: "var(--amber)", marginLeft: 6 }}>★</span>}
              </div>
              {activeBuddy.awayMessage && (
                <div style={{
                  fontSize: 11, fontStyle: "italic", color: "var(--amber)",
                  fontFamily: "var(--serif)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {activeBuddy.awayMessage}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--edge1)", flexShrink: 0, background: "var(--ink2)" }}>
            {(["chat", "posts"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "10px 24px",
                  background: "transparent", border: "none",
                  borderBottom: tab === t ? "2px solid var(--amber)" : "2px solid transparent",
                  color: tab === t ? "var(--amber)" : "var(--snow4)",
                  fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)",
                  cursor: "pointer", textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          {tab === "chat" && <ChatView buddy={activeBuddy} />}

          {tab === "posts" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
              {postsLoading ? (
                <div style={{ fontSize: 12, color: "var(--snow5)", fontFamily: "var(--sans)" }}>Loading…</div>
              ) : posts.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--snow5)", fontFamily: "var(--sans)", fontStyle: "italic", padding: "48px 0", textAlign: "center" }}>No posts yet.</div>
              ) : (
                posts.map((p) => (
                  <PostCard
                    key={p.id} post={p}
                    onNudge={() => {}} onEcho={() => {}} onReply={() => {}}
                    onTagClick={setActiveTag} onUserClick={() => {}}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RightPanel — kept for backwards compat (now just exports ChatOverlay alias)
// This is no longer rendered in RadicalLayout; ChatOverlay is used instead.
// ---------------------------------------------------------------------------

export function RightPanel() {
  return <ChatOverlay />;
}
