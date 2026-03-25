"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelSettings {
  id: string;
  name: string;
  description: string | null;
  type: "PUBLIC" | "INVITE_ONLY" | "SECRET";
  slowModeMinutes: number;
  memberCap: number | null;
  tags: string[];
  creatorId: string;
}

interface Member {
  userId: string;
  joinedAt: string;
  mutedUntil: string | null;
  user: { id: string; screenname: string; isGoldMember: boolean };
}

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  amber:   { bg: "#78350f", text: "#fcd34d" },
  rose:    { bg: "#881337", text: "#fda4af" },
  sky:     { bg: "#0c4a6e", text: "#7dd3fc" },
  emerald: { bg: "#064e3b", text: "#6ee7b7" },
  violet:  { bg: "#4c1d95", text: "#c4b5fd" },
  orange:  { bg: "#7c2d12", text: "#fdba74" },
};

function hashColor(id: string): string {
  const keys = Object.keys(AVATAR_COLORS);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return keys[h % keys.length];
}

const MUTE_DURATIONS = [
  { label: "10 minutes", minutes: 10 },
  { label: "1 hour",     minutes: 60 },
  { label: "24 hours",   minutes: 60 * 24 },
  { label: "7 days",     minutes: 60 * 24 * 7 },
  { label: "permanent",  minutes: 60 * 24 * 365 * 10 },
];

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export default function ChannelSettingsPage() {
  const { channelName } = useParams() as { channelName: string };
  const router = useRouter();
  const { data: session } = useSession();

  const [channel, setChannel] = useState<ChannelSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChannelSettings["type"]>("PUBLIC");
  const [slowModeMinutes, setSlowModeMinutes] = useState(10);
  const [memberCap, setMemberCap] = useState<number | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Member action state
  const [acting, setActing] = useState<string | null>(null);
  const [mutePickerId, setMutePickerId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/channels/${channelName}`).then((r) => r.json()),
      fetch(`/api/channels/${channelName}/members`).then((r) => r.json()),
    ])
      .then(([channelData, memberData]) => {
        if (channelData.error) { setNotFound(true); return; }
        setChannel(channelData);
        setDescription(channelData.description ?? "");
        setType(channelData.type);
        setSlowModeMinutes(channelData.slowModeMinutes);
        setMemberCap(channelData.memberCap);
        setTagsInput((channelData.tags ?? []).join(", "));
        if (Array.isArray(memberData)) setMembers(memberData);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [channelName]);

  // Redirect non-creators away
  useEffect(() => {
    if (!loading && channel && session?.user?.id) {
      const isCreator = channel.creatorId === session.user.id;
      if (!isCreator && !(session.user as { isAdmin?: boolean }).isAdmin) {
        router.replace(`/channels/${channelName}`);
      }
    }
  }, [loading, channel, session, channelName, router]);

  const saveSettings = async () => {
    if (saving || !channel) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
        .filter(Boolean)
        .slice(0, 5);

      const res = await fetch(`/api/channels/${channelName}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, type, slowModeMinutes, memberCap, tags }),
      });
      if (res.ok) {
        const updated = await res.json();
        setChannel((c) => c ? { ...c, ...updated } : c);
        setTagsInput((updated.tags ?? []).join(", "));
        setSaveMsg("saved!");
        setTimeout(() => setSaveMsg(null), 2000);
      } else {
        const e = await res.json();
        setSaveMsg(e.error ?? "failed to save.");
      }
    } finally {
      setSaving(false);
    }
  };

  const kickMember = async (userId: string, ban = false) => {
    if (!window.confirm(ban ? "Ban this member? They won't be able to rejoin." : "Kick this member?")) return;
    setActing(userId);
    try {
      const res = await fetch(`/api/channels/${channelName}/members/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ban }),
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      }
    } finally {
      setActing(null);
    }
  };

  const muteMember = async (userId: string, minutes: number) => {
    setMutePickerId(null);
    setActing(userId);
    const mutedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    try {
      const res = await fetch(`/api/channels/${channelName}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutedUntil }),
      });
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => m.userId === userId ? { ...m, mutedUntil } : m)
        );
      }
    } finally {
      setActing(null);
    }
  };

  const unmuteMember = async (userId: string) => {
    setActing(userId);
    try {
      const res = await fetch(`/api/channels/${channelName}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutedUntil: null }),
      });
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => m.userId === userId ? { ...m, mutedUntil: null } : m)
        );
      }
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg)" }}>
        <p className="text-xs font-mono animate-pulse" style={{ color: "var(--text-dim)" }}>loading…</p>
      </div>
    );
  }

  if (notFound || !channel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>channel not found.</p>
        <Link href="/channels" className="text-xs font-mono" style={{ color: "var(--teal)" }}>← channels</Link>
      </div>
    );
  }

  const nonCreatorMembers = members.filter((m) => m.userId !== channel.creatorId);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href={`/channels/${channelName}`}
            className="text-sm font-mono transition-colors"
            style={{ color: "var(--text-dim)" }}
          >
            ← back
          </Link>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
              #{channelName} — settings
            </h1>
            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-dim)" }}>
              channel owner controls
            </p>
          </div>
        </div>

        {/* ---- Channel info section ---- */}
        <section
          className="rounded-2xl border p-5 mb-6"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <h2 className="text-[11px] font-mono uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>
            channel info
          </h2>

          <div className="flex flex-col gap-4">
            {/* Description */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                rows={2}
                className="rounded-lg border px-3 py-2 text-sm bg-transparent outline-none resize-none"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              />
              <span className="text-[10px] font-mono self-end" style={{ color: "var(--text-dim)" }}>
                {200 - description.length} chars left
              </span>
            </label>

            {/* Tags */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
                tags <span style={{ fontWeight: 400 }}>(comma-separated, up to 5)</span>
              </span>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="gaming, chill, music"
                className="rounded-lg border px-3 py-2 text-sm bg-transparent outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              />
            </label>

            {/* Visibility */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>visibility</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ChannelSettings["type"])}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              >
                <option value="PUBLIC">public — anyone can join</option>
                <option value="INVITE_ONLY">invite only — invite link required</option>
                <option value="SECRET">secret — hidden from search</option>
              </select>
            </label>

            {/* Slow mode */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
                slow mode <span style={{ fontWeight: 400 }}>(minutes between messages, 0 = off)</span>
              </span>
              <input
                type="number"
                min={0}
                max={60}
                value={slowModeMinutes}
                onChange={(e) => setSlowModeMinutes(Math.max(0, Math.min(60, Number(e.target.value))))}
                className="rounded-lg border px-3 py-2 text-sm bg-transparent outline-none w-24"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              />
            </label>

            {/* Member cap */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
                member cap <span style={{ fontWeight: 400 }}>(2–500, blank = unlimited)</span>
              </span>
              <input
                type="number"
                min={2}
                max={500}
                value={memberCap ?? ""}
                onChange={(e) => setMemberCap(e.target.value ? Math.max(2, Math.min(500, Number(e.target.value))) : null)}
                placeholder="500"
                className="rounded-lg border px-3 py-2 text-sm bg-transparent outline-none w-24"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              />
            </label>
          </div>

          <div className="flex items-center gap-3 mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="h-9 px-5 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-40"
              style={{ background: "var(--amber)", color: "#fff8e6" }}
            >
              {saving ? "saving…" : "save changes"}
            </button>
            {saveMsg && (
              <span className="text-xs font-mono" style={{ color: saveMsg === "saved!" ? "var(--teal)" : "#ef4444" }}>
                {saveMsg}
              </span>
            )}
          </div>
        </section>

        {/* ---- Members section ---- */}
        <section
          className="rounded-2xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <h2 className="text-[11px] font-mono uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>
            members ({members.length})
          </h2>

          {nonCreatorMembers.length === 0 && (
            <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>
              no other members yet.
            </p>
          )}

          {nonCreatorMembers.map((m) => {
            const colors = AVATAR_COLORS[hashColor(m.user.id)];
            const isMuted = m.mutedUntil && new Date(m.mutedUntil) > new Date();
            const isActing = acting === m.userId;
            const showMutePicker = mutePickerId === m.userId;

            return (
              <div
                key={m.userId}
                className="flex items-center gap-3 py-3 border-b last:border-0"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: colors.bg }}
                >
                  <span className="text-[10px] font-bold font-mono" style={{ color: colors.text }}>
                    {m.user.screenname.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Name + muted badge */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm" style={{ color: "var(--text)" }}>
                    {m.user.screenname}
                    {m.user.isGoldMember && <span className="ml-1 text-[9px]" style={{ color: "#d4a017" }}>★</span>}
                  </span>
                  {isMuted && (
                    <span
                      className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                    >
                      muted until {new Date(m.mutedUntil!).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 relative">
                  {isActing ? (
                    <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>…</span>
                  ) : (
                    <>
                      {/* Mute / Unmute */}
                      {isMuted ? (
                        <button
                          onClick={() => unmuteMember(m.userId)}
                          className="text-[11px] font-mono transition-colors"
                          style={{ color: "var(--teal)" }}
                        >
                          unmute
                        </button>
                      ) : (
                        <button
                          onClick={() => setMutePickerId(showMutePicker ? null : m.userId)}
                          className="text-[11px] font-mono transition-colors"
                          style={{ color: "var(--text-dim)" }}
                        >
                          mute
                        </button>
                      )}

                      {/* Kick */}
                      <button
                        onClick={() => kickMember(m.userId, false)}
                        className="text-[11px] font-mono transition-colors"
                        style={{ color: "var(--text-muted)" }}
                      >
                        kick
                      </button>

                      {/* Ban */}
                      <button
                        onClick={() => kickMember(m.userId, true)}
                        className="text-[11px] font-mono transition-colors"
                        style={{ color: "#ef4444" }}
                      >
                        ban
                      </button>
                    </>
                  )}

                  {/* Mute duration picker */}
                  {showMutePicker && (
                    <div
                      className="absolute right-0 top-6 z-10 rounded-xl border shadow-lg py-1 min-w-[140px]"
                      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      {MUTE_DURATIONS.map((d) => (
                        <button
                          key={d.minutes}
                          onClick={() => muteMember(m.userId, d.minutes)}
                          className="w-full text-left px-3 py-1.5 text-[12px] font-mono transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--card)")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

      </div>
    </div>
  );
}
