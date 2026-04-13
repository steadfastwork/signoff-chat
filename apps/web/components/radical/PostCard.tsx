"use client";

import Image from "next/image";
import { formatTimestamp, getInitials } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostType    = "AWAY" | "THOUGHT" | "QUOTE" | "PHOTO";
export type AwayStatus = "ONLINE" | "AWAY" | "OFFLINE";

export interface PostCardUser {
  screenname: string;
  avatarColor?: string; // from deriveAvatarColor: amber|rose|sky|emerald|violet|orange
  isGoldMember: boolean;
}

export interface PostCardPost {
  id:             string;
  postType:       PostType;
  user:           PostCardUser;
  awayMessage?:   string;   // AWAY: from content field
  bodyText?:      string;   // THOUGHT
  quoteText?:     string;   // QUOTE
  quoteAttrib?:   string;   // QUOTE
  imageUrl?:      string;   // PHOTO
  imageCaption?:  string;   // PHOTO
  tags:           string[];
  nudgeCount:     number;
  echoCount:      number;
  hasNudged:      boolean;
  createdAt:      Date | string;
  awayStatus:     AwayStatus;
  currentlyFields?: { emoji: string; label: string }[];
  echoOf?: { user: { screenname: string } } | null;
}

export interface PostCardProps {
  post:          PostCardPost;
  onNudge:       (postId: string) => void;
  onEcho:        (postId: string) => void;
  onReply:       (postId: string) => void;
  onTagClick:    (tag: string) => void;
  onUserClick:   (screenname: string) => void;
  className?:    string;
}

// ---------------------------------------------------------------------------
// Avatar color palettes (maps deriveAvatarColor output to hex pairs)
// ---------------------------------------------------------------------------

const AVATAR_PALETTE: Record<string, { bg: string; fg: string }> = {
  amber:   { bg: "#2d1800", fg: "#e8961a" },
  rose:    { bg: "#2d0f1a", fg: "#fb7185" },
  sky:     { bg: "#0a1d2d", fg: "#38bdf8" },
  emerald: { bg: "#0a2418", fg: "#34d17a" },
  violet:  { bg: "#1e1030", fg: "#a78bfa" },
  orange:  { bg: "#2d1200", fg: "#fb923c" },
};

const STATUS_COLOR: Record<AwayStatus, string> = {
  ONLINE:  "var(--green)",
  AWAY:    "var(--away)",
  OFFLINE: "var(--snow5)",
};

// ---------------------------------------------------------------------------
// MiniAvatar
// ---------------------------------------------------------------------------

function MiniAvatar({
  user,
  size = 34,
  radius = 10,
  awayStatus,
  onClick,
}: {
  user:        PostCardUser;
  size?:       number;
  radius?:     number;
  awayStatus?: AwayStatus;
  onClick?:    () => void;
}) {
  const { bg, fg } = AVATAR_PALETTE[user.avatarColor ?? "amber"] ?? AVATAR_PALETTE.amber;
  const DOT = Math.round(size * 0.265);

  return (
    <div style={{ position: "relative", flexShrink: 0, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <div
        style={{
          width: size, height: size, borderRadius: radius,
          background: bg, color: fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.round(size * 0.32), fontWeight: 700, fontFamily: "var(--sans)",
          userSelect: "none",
        }}
      >
        {getInitials(user.screenname)}
      </div>

      {awayStatus && (
        <span style={{
          position: "absolute", bottom: -1, right: -1,
          width: DOT, height: DOT, borderRadius: "50%",
          background: STATUS_COLOR[awayStatus],
          border: "2px solid var(--ink2)",
        }} />
      )}

      {user.isGoldMember && (
        <span style={{
          position: "absolute", top: -3, right: -3,
          fontSize: 8, color: "var(--amber)", lineHeight: 1,
        }}>★</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostActions — shared nudge / echo / reply / more row
// ---------------------------------------------------------------------------

function PostActions({
  post, onNudge, onEcho, onReply,
}: Pick<PostCardProps, "onNudge" | "onEcho" | "onReply"> & { post: PostCardPost }) {
  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "5px 10px", borderRadius: "var(--rp)",
    border: "1px solid var(--edge1)", background: "transparent",
    fontSize: 11, fontWeight: 600, fontFamily: "var(--sans)",
    cursor: "pointer", transition: "opacity 0.15s",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {/* Nudge */}
      <button
        onClick={() => onNudge(post.id)}
        style={{
          ...btnBase,
          border: post.hasNudged ? "1px solid rgba(232,150,26,.35)" : btnBase.border,
          background: post.hasNudged ? "var(--ambg)" : "transparent",
          color: post.hasNudged ? "var(--amber)" : "var(--snow4)",
        }}
      >
        <span>👋</span>
        {post.nudgeCount > 0 && <span>{post.nudgeCount}</span>}
      </button>

      {/* Echo */}
      <button
        onClick={() => onEcho(post.id)}
        style={{ ...btnBase, color: "var(--teal)" }}
      >
        <span>↩</span>
        {post.echoCount > 0 && (
          <span style={{ color: "var(--snow4)" }}>{post.echoCount}</span>
        )}
      </button>

      {/* Reply */}
      <button
        onClick={() => onReply(post.id)}
        style={{ ...btnBase, color: "var(--snow4)" }}
      >
        <span style={{ fontSize: 12 }}>💬</span>
        <span>reply</span>
      </button>

      <div style={{ flex: 1 }} />

      {/* More */}
      <button style={{
        ...btnBase,
        width: 28, height: 28, padding: 0,
        borderRadius: "50%",
        justifyContent: "center",
        color: "var(--snow4)",
        fontSize: 14, letterSpacing: 1,
      }}>···</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TypeBar — used by THOUGHT / QUOTE / PHOTO cards
// ---------------------------------------------------------------------------

function TypeBar({
  label, labelBg, labelColor,
  barBg, barBorder,
  user, awayStatus, createdAt, onUserClick,
}: {
  label:       string;
  labelBg:     string;
  labelColor:  string;
  barBg:       string;
  barBorder:   string;
  user:        PostCardUser;
  awayStatus:  AwayStatus;
  createdAt:   Date | string;
  onUserClick: (screenname: string) => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 18px",
      background: barBg,
      borderBottom: `1px solid ${barBorder}`,
    }}>
      {/* Type pill */}
      <span style={{
        padding: "2px 8px", borderRadius: "var(--rp)",
        background: labelBg, color: labelColor,
        fontSize: 9, fontWeight: 700, fontFamily: "var(--sans)",
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        {label}
      </span>

      {/* Author + time */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
        onClick={() => onUserClick(user.screenname)}
      >
        <MiniAvatar user={user} size={20} radius={6} awayStatus={awayStatus} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--snow3)", fontFamily: "var(--sans)" }}>
          @{user.screenname}
        </span>
        <span style={{ fontSize: 10, color: "var(--snow4)", fontFamily: "var(--sans)" }}>
          {formatTimestamp(createdAt)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag chips
// ---------------------------------------------------------------------------

function TagChips({ tags, onTagClick }: { tags: string[]; onTagClick: (tag: string) => void }) {
  if (!tags.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {tags.map((t) => (
        <span
          key={t}
          onClick={() => onTagClick(t)}
          style={{
            fontSize: 10, color: "var(--amber)", cursor: "pointer",
            fontFamily: "var(--sans)", fontWeight: 600,
          }}
        >
          #{t}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card shell
// ---------------------------------------------------------------------------

const CARD_BASE: React.CSSProperties = {
  background: "var(--fog1)",
  border: "1px solid var(--edge1)",
  borderRadius: "var(--r2)",
  overflow: "hidden",
};

// ---------------------------------------------------------------------------
// AWAY card
// ---------------------------------------------------------------------------

function AwayCard({ post, onNudge, onEcho, onReply, onTagClick, onUserClick }: PostCardProps) {
  return (
    <div style={CARD_BASE}>
      <div style={{ padding: "20px 22px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
          <MiniAvatar
            user={post.user}
            size={34}
            awayStatus={post.awayStatus}
            onClick={() => onUserClick(post.user.screenname)}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{ fontSize: 13, fontWeight: 600, color: "var(--snow)", fontFamily: "var(--sans)", cursor: "pointer" }}
                onClick={() => onUserClick(post.user.screenname)}
              >
                {post.user.screenname}
              </span>

              {post.user.isGoldMember && (
                <span style={{ fontSize: 10, color: "var(--amber)" }}>★</span>
              )}

              {post.currentlyFields?.map((f, i) => (
                <span key={i} style={{
                  fontSize: 10, color: "var(--snow4)",
                  background: "var(--fog1)", border: "1px solid var(--edge1)",
                  borderRadius: "var(--rp)", padding: "1px 6px",
                  fontFamily: "var(--sans)",
                }}>
                  {f.emoji} {f.label}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: "var(--snow4)", fontFamily: "var(--sans)" }}>
              {formatTimestamp(post.createdAt)}
            </span>
            <span style={{
              fontSize: 8, fontWeight: 700, fontFamily: "var(--sans)",
              textTransform: "uppercase", letterSpacing: "0.07em",
              background: "var(--ambg)", color: "var(--amber)",
              borderRadius: "var(--rp)", padding: "2px 7px",
            }}>Away</span>
          </div>
        </div>

        {/* Echo attribution */}
        {post.echoOf && (
          <div style={{ fontSize: 11, color: "var(--snow4)", marginBottom: 8, fontFamily: "var(--sans)" }}>
            ↩ echoed from <span style={{ color: "var(--snow3)" }}>@{post.echoOf.user.screenname}</span>
          </div>
        )}

        {/* Away message */}
        <p style={{
          fontFamily: "var(--serif)",
          fontSize: "var(--away-text-size)",
          fontStyle: "italic",
          color: "var(--snow)",
          lineHeight: 1.45,
          letterSpacing: "-0.01em",
          margin: "0 0 14px",
        }}>
          {post.awayMessage}
        </p>

        <PostActions post={post} onNudge={onNudge} onEcho={onEcho} onReply={onReply} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// THOUGHT card
// ---------------------------------------------------------------------------

function ThoughtCard({ post, onNudge, onEcho, onReply, onTagClick, onUserClick }: PostCardProps) {
  const bodyLines = (post.bodyText ?? "").split("\n");

  return (
    <div style={CARD_BASE}>
      <TypeBar
        label="✍ Thought"
        labelBg="var(--fog2)" labelColor="var(--snow2)"
        barBg="var(--fog1)"  barBorder="var(--edge1)"
        user={post.user} awayStatus={post.awayStatus}
        createdAt={post.createdAt} onUserClick={onUserClick}
      />

      <div style={{ padding: "16px 18px" }}>
        {post.echoOf && (
          <div style={{ fontSize: 11, color: "var(--snow4)", marginBottom: 8, fontFamily: "var(--sans)" }}>
            ↩ echoed from <span style={{ color: "var(--snow3)" }}>@{post.echoOf.user.screenname}</span>
          </div>
        )}

        {/* Body text — line breaks as <br> */}
        <p style={{
          fontFamily: "var(--serif)",
          fontSize: "var(--thought-text-size)",
          color: "var(--snow)",
          lineHeight: 1.65,
          letterSpacing: "-0.005em",
          margin: "0 0 12px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {bodyLines.map((line, i) => (
            <span key={i}>{line}{i < bodyLines.length - 1 ? <br /> : null}</span>
          ))}
        </p>

        <TagChips tags={post.tags} onTagClick={onTagClick} />
      </div>

      <div style={{ borderTop: "1px solid var(--edge1)", background: "var(--fog1)", padding: "10px 18px" }}>
        <PostActions post={post} onNudge={onNudge} onEcho={onEcho} onReply={onReply} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QUOTE card
// ---------------------------------------------------------------------------

function QuoteCard({ post, onNudge, onEcho, onReply, onTagClick, onUserClick }: PostCardProps) {
  return (
    <div style={{ ...CARD_BASE, border: "1px solid rgba(167,139,250,.12)" }}>
      <TypeBar
        label="❝ Quote"
        labelBg="var(--lavg)" labelColor="var(--lav)"
        barBg="rgba(167,139,250,.04)" barBorder="rgba(167,139,250,.12)"
        user={post.user} awayStatus={post.awayStatus}
        createdAt={post.createdAt} onUserClick={onUserClick}
      />

      <div style={{ padding: "20px 22px 14px", position: "relative" }}>
        {/* Decorative opening quote mark */}
        <span style={{
          fontFamily: "var(--serif)",
          fontSize: 72,
          color: "rgba(167,139,250,.15)",
          lineHeight: 0.7,
          position: "absolute",
          top: 12, left: 16,
          pointerEvents: "none",
          userSelect: "none",
        }}>"</span>

        {post.echoOf && (
          <div style={{ fontSize: 11, color: "var(--snow4)", marginBottom: 8, fontFamily: "var(--sans)" }}>
            ↩ echoed from <span style={{ color: "var(--snow3)" }}>@{post.echoOf.user.screenname}</span>
          </div>
        )}

        {/* Quote text */}
        <p style={{
          fontFamily: "var(--serif)",
          fontSize: 19,
          fontStyle: "italic",
          color: "var(--snow)",
          lineHeight: 1.45,
          borderLeft: "2px solid var(--lav)",
          paddingLeft: 8,
          margin: "0 0 10px",
          wordBreak: "break-word",
        }}>
          {post.quoteText}
        </p>

        {/* Attribution */}
        {post.quoteAttrib && (
          <p style={{
            fontSize: 11, fontWeight: 500,
            color: "var(--snow4)",
            paddingLeft: 8,
            margin: "0 0 12px",
            fontFamily: "var(--sans)",
          }}>
            — {post.quoteAttrib}
          </p>
        )}

        <TagChips tags={post.tags} onTagClick={onTagClick} />
      </div>

      <div style={{ borderTop: "1px solid rgba(167,139,250,.12)", background: "var(--fog1)", padding: "10px 18px" }}>
        <PostActions post={post} onNudge={onNudge} onEcho={onEcho} onReply={onReply} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PHOTO card
// ---------------------------------------------------------------------------

function PhotoCard({ post, onNudge, onEcho, onReply, onTagClick, onUserClick }: PostCardProps) {
  return (
    <div style={{ ...CARD_BASE, border: "1px solid rgba(251,113,133,.12)" }}>
      <TypeBar
        label="📷 Photo"
        labelBg="var(--coralg)" labelColor="var(--coral)"
        barBg="rgba(251,113,133,.04)" barBorder="rgba(251,113,133,.12)"
        user={post.user} awayStatus={post.awayStatus}
        createdAt={post.createdAt} onUserClick={onUserClick}
      />

      {post.echoOf && (
        <div style={{ fontSize: 11, color: "var(--snow4)", padding: "8px 18px 0", fontFamily: "var(--sans)" }}>
          ↩ echoed from <span style={{ color: "var(--snow3)" }}>@{post.echoOf.user.screenname}</span>
        </div>
      )}

      {/* Image */}
      {post.imageUrl && (
        <div style={{
          position: "relative",
          aspectRatio: "16 / 9",
          background: "var(--ink3)",
          overflow: "hidden",
        }}>
          <Image
            src={post.imageUrl}
            alt={post.imageCaption ?? "Photo"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
          />
        </div>
      )}

      {/* Caption */}
      {post.imageCaption && (
        <div style={{ padding: "14px 18px 0" }}>
          <p style={{
            fontFamily: "var(--serif)",
            fontSize: 15,
            color: "var(--snow)",
            lineHeight: 1.5,
            margin: "0 0 10px",
          }}>
            {post.imageCaption}
          </p>
        </div>
      )}

      <div style={{
        borderTop: "1px solid rgba(251,113,133,.12)",
        background: "var(--fog1)",
        padding: "10px 18px",
        marginTop: post.imageCaption ? 0 : 14,
      }}>
        <TagChips tags={post.tags} onTagClick={onTagClick} />
        <PostActions post={post} onNudge={onNudge} onEcho={onEcho} onReply={onReply} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostCard — main export, dispatches to type-specific renderer
// ---------------------------------------------------------------------------

export function PostCard(props: PostCardProps) {
  switch (props.post.postType) {
    case "AWAY":    return <AwayCard    {...props} />;
    case "THOUGHT": return <ThoughtCard {...props} />;
    case "QUOTE":   return <QuoteCard   {...props} />;
    case "PHOTO":   return <PhotoCard   {...props} />;
    default:        return null;
  }
}
