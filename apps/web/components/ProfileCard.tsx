"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { StatusDot } from "@/components/StatusDot";
import type { StatusValue } from "@/components/StatusDot";
import { formatTimestamp } from "@/lib/utils";
import TipButton from "@/components/TipButton";
import { CurrentlyDisplay } from "@/components/currently/CurrentlyDisplay";
import { type CurrentlyData, hasCurrently } from "@/lib/currently";
import { BadgeList } from "@/components/badges/BadgeList";

// ---------------------------------------------------------------------------
// Avatar colors — consistent with rest of app
// ---------------------------------------------------------------------------

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  amber:   { bg: "#78350f", text: "#fcd34d" },
  rose:    { bg: "#881337", text: "#fda4af" },
  sky:     { bg: "#0c4a6e", text: "#7dd3fc" },
  emerald: { bg: "#064e3b", text: "#6ee7b7" },
  violet:  { bg: "#4c1d95", text: "#c4b5fd" },
  orange:  { bg: "#7c2d12", text: "#fdba74" },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileData {
  id: string;
  screenname: string;
  bio: string | null;
  awayMessage: string | null;
  currently?: CurrentlyData | null;
  status: string;
  isGoldMember: boolean;
  avatarColor: string;
  avatarUrl?: string | null;
  profileTheme?: string | null;
  postCount: number;
  buddyCount: number;
  joinedAt: string;
  relationship: "self" | "buddy" | "pending" | "none" | "blocked";
  pendingDirection: "sent" | "received" | null;
  badges?: { id: string; badge: string; awardedAt: string }[];
}

interface ProfileCardProps {
  profile: ProfileData;
  onRelationshipChange?: (
    relationship: ProfileData["relationship"],
    pendingDirection: "sent" | "received" | null
  ) => void;
  currentlyEditorOpen?: boolean;
  onOpenCurrentlyEditor?: () => void;
}

// ---------------------------------------------------------------------------
// Status label
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  ONLINE: "online",
  AWAY: "away",
  IDLE: "idle",
  INVISIBLE: "invisible",
  OFFLINE: "offline",
};

// ---------------------------------------------------------------------------
// Dot menu (block / report)
// ---------------------------------------------------------------------------

function DotMenu({
  targetId,
  onBlock,
}: {
  targetId: string;
  onBlock: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 rounded-lg text-sm flex items-center justify-center border transition-colors"
        style={{ borderColor: "#1e1e14", color: "#4b5563" }}
      >
        ···
      </button>
      {open && (
        <div
          className="absolute right-0 top-10 z-20 rounded-xl border overflow-hidden min-w-[120px]"
          style={{ background: "#111109", borderColor: "#1e1e14" }}
        >
          <button
            onClick={() => {
              setOpen(false);
              onBlock();
            }}
            className="w-full text-left px-4 py-2.5 text-xs font-mono transition-colors"
            style={{ color: "#ef4444" }}
            onMouseEnter={(e) =>
              ((e.target as HTMLElement).style.background = "#1a0a0a")
            }
            onMouseLeave={(e) =>
              ((e.target as HTMLElement).style.background = "transparent")
            }
          >
            block
          </button>
          <button
            onClick={() => setOpen(false)}
            className="w-full text-left px-4 py-2.5 text-xs font-mono transition-colors"
            style={{ color: "#6b7280" }}
            onMouseEnter={(e) =>
              ((e.target as HTMLElement).style.background = "#111109")
            }
            onMouseLeave={(e) =>
              ((e.target as HTMLElement).style.background = "transparent")
            }
          >
            report
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfileCard
// ---------------------------------------------------------------------------

export function ProfileCard({ profile, onRelationshipChange, currentlyEditorOpen, onOpenCurrentlyEditor }: ProfileCardProps) {
  const [loading, setLoading] = useState(false);
  const [tipsEnabled, setTipsEnabled] = useState(false);
  const colors = AVATAR_COLORS[profile.avatarColor] ?? AVATAR_COLORS.amber;

  useEffect(() => {
    fetch("/api/feature-flags/tips")
      .then((r) => r.ok ? r.json() : { enabled: false })
      .then((d) => setTipsEnabled(d.enabled ?? false))
      .catch(() => {});
  }, []);

  const sendBuddyRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/buddies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetScreenname: profile.screenname }),
      });
      if (res.ok) {
        onRelationshipChange?.("pending", "sent");
      }
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/buddies/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        onRelationshipChange?.("buddy", null);
      }
    } finally {
      setLoading(false);
    }
  };

  const withdrawRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/buddies/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });
      if (res.ok) {
        onRelationshipChange?.("none", null);
      }
    } finally {
      setLoading(false);
    }
  };

  const removeBuddy = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/buddies/${profile.id}`, { method: "DELETE" });
      if (res.ok) {
        onRelationshipChange?.("none", null);
      }
    } finally {
      setLoading(false);
    }
  };

  const blockUser = async () => {
    setLoading(true);
    try {
      await fetch(`/api/buddies/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block" }),
      });
      onRelationshipChange?.("blocked", null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar — 56px */}
        <div className="relative flex-shrink-0">
          <div
            className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center"
            style={{
              background: colors.bg,
              boxShadow: profile.isGoldMember
                ? "0 0 0 2px #c8860a"
                : undefined,
            }}
          >
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.screenname}
                width={56}
                height={56}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <span
                className="text-lg font-bold font-mono"
                style={{ color: colors.text }}
              >
                {profile.screenname.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <StatusDot
            status={profile.status as StatusValue}
            size="sm"
            bg="#0a0a08"
            className="absolute -bottom-0.5 -right-0.5"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-base font-bold"
              style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
            >
              {profile.screenname}
              {profile.isGoldMember && (
                <span className="ml-1 text-sm" style={{ color: "#d4a017" }}>
                  ★
                </span>
              )}
            </h1>
            <span
              className="text-xs font-mono"
              style={{ color: STATUS_LABEL[profile.status] === "online" ? "#22c55e" : "#4b5563" }}
            >
              {STATUS_LABEL[profile.status] ?? profile.status.toLowerCase()}
            </span>
          </div>

          {/* Badges */}
          {profile.badges && profile.badges.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <BadgeList badges={profile.badges as any} size="md" />
            </div>
          )}

          {/* Away message */}
          {profile.awayMessage && (
            <p
              className="text-[13px] italic mt-1.5 pl-2.5"
              style={{
                color: "#9ca3af",
                fontFamily: "var(--font-dm-sans)",
                borderLeft: "3px solid #c8860a44",
              }}
            >
              {profile.awayMessage}
            </p>
          )}

          {/* Currently */}
          {(hasCurrently(profile.currently) || profile.relationship === "self") && (
            <div className="mt-3">
              <CurrentlyDisplay
                currently={profile.currently ?? {}}
                size="full"
                editable={profile.relationship === "self" && !currentlyEditorOpen}
                onEdit={onOpenCurrentlyEditor}
              />
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p
              className="text-sm mt-2 leading-relaxed"
              style={{ color: "#6b7280", fontFamily: "var(--font-dm-sans)" }}
            >
              {profile.bio}
            </p>
          )}

          {/* Stats */}
          <p className="text-[13px] font-mono mt-2" style={{ color: "#3a3a2a" }}>
            {profile.postCount.toLocaleString()} post
            {profile.postCount !== 1 ? "s" : ""} ·{" "}
            {profile.buddyCount.toLocaleString()} budd
            {profile.buddyCount !== 1 ? "ies" : "y"}
          </p>

          {/* Joined */}
          <p className="text-[11px] font-mono mt-1" style={{ color: "#2a2a1a" }}>
            joined {formatTimestamp(profile.joinedAt)}
          </p>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t" style={{ borderColor: "#1a1a12" }}>
        {profile.relationship === "self" && (
          <Link
            href="/u/me/edit"
            className="h-8 px-4 rounded-xl text-xs font-mono font-bold transition-all inline-flex items-center"
            style={{ background: "#c8860a22", color: "#c8860a", border: "1px solid #c8860a33" }}
          >
            edit profile
          </Link>
        )}

        {profile.relationship === "none" && (
          <button
            onClick={sendBuddyRequest}
            disabled={loading}
            className="h-8 px-4 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-40"
            style={{ background: "#2dd4bf", color: "#0d0d0b" }}
          >
            {loading ? "…" : "add buddy"}
          </button>
        )}

        {profile.relationship === "pending" &&
          profile.pendingDirection === "sent" && (
            <button
              onClick={withdrawRequest}
              disabled={loading}
              className="h-8 px-4 rounded-xl text-xs font-mono border transition-colors disabled:opacity-40"
              style={{ color: "#6b7280", borderColor: "#1e1e14" }}
              title="Cancel buddy request"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).textContent = "cancel request";
                (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef444433";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).textContent = loading ? "…" : "pending…";
                (e.currentTarget as HTMLButtonElement).style.color = "#6b7280";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e1e14";
              }}
            >
              {loading ? "…" : "pending…"}
            </button>
          )}

        {profile.relationship === "pending" &&
          profile.pendingDirection === "received" && (
            <button
              onClick={acceptRequest}
              disabled={loading}
              className="h-8 px-4 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-40"
              style={{ background: "#2dd4bf", color: "#0d0d0b" }}
            >
              {loading ? "…" : "accept request"}
            </button>
          )}

        {profile.relationship === "buddy" && (
          <>
            <button
              onClick={removeBuddy}
              disabled={loading}
              className="h-8 px-4 rounded-xl text-xs font-mono border transition-colors disabled:opacity-40"
              style={{ color: "#22c55e", borderColor: "#22c55e33" }}
            >
              {loading ? "…" : "✓ buddies"}
            </button>
            <Link
              href={`/dm/${profile.id}`}
              className="h-8 px-4 rounded-xl text-xs font-mono font-bold transition-all inline-flex items-center"
              style={{ background: "#1a2a2a", color: "#2dd4bf", border: "1px solid #2dd4bf33" }}
            >
              message
            </Link>
          </>
        )}

        {/* Leave a tip — hidden until tips feature flag is enabled */}
        {tipsEnabled && profile.relationship !== "self" && profile.relationship !== "blocked" && (
          <TipButton screenname={profile.screenname} />
        )}

        {/* Dot menu — block / report */}
        {profile.relationship !== "self" && (
          <div className="ml-auto">
            <DotMenu targetId={profile.id} onBlock={blockUser} />
          </div>
        )}
      </div>
    </div>
  );
}
