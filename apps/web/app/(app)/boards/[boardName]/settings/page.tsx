"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoardSettings {
  id: string;
  name: string;
  displayName: string;
  vibeStatement: string;
  type: "PUBLIC" | "INVITE_ONLY" | "SECRET";
  creatorId: string;
}

interface Member {
  userId: string;
  joinedAt: string;
  isFoundingMember: boolean;
  isModerator: boolean;
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

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export default function BoardSettingsPage() {
  const { boardName } = useParams() as { boardName: string };
  const router = useRouter();
  const { data: session } = useSession();

  const [board, setBoard] = useState<BoardSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Settings form state
  const [displayName, setDisplayName] = useState("");
  const [vibeStatement, setVibeStatement] = useState("");
  const [type, setType] = useState<BoardSettings["type"]>("PUBLIC");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Member action state
  const [modToggles, setModToggles] = useState<Record<string, boolean>>({});
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/boards/${boardName}`).then((r) => r.json()),
      fetch(`/api/boards/${boardName}/members`).then((r) => r.json()),
    ])
      .then(([boardData, memberData]) => {
        if (boardData.error) { setNotFound(true); return; }
        setBoard(boardData);
        setDisplayName(boardData.displayName);
        setVibeStatement(boardData.vibeStatement);
        setType(boardData.type);
        if (Array.isArray(memberData)) setMembers(memberData);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [boardName]);

  // Redirect non-creators away
  useEffect(() => {
    if (!loading && board && session?.user?.id && board.creatorId !== session.user.id) {
      router.replace(`/boards/${boardName}`);
    }
  }, [loading, board, session, boardName, router]);

  const saveSettings = async () => {
    if (saving || !board) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/boards/${boardName}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, vibeStatement, type }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBoard((b) => b ? { ...b, ...updated } : b);
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

  const toggleMod = async (userId: string, currentlyMod: boolean) => {
    setModToggles((t) => ({ ...t, [userId]: true }));
    try {
      const res = await fetch(`/api/boards/${boardName}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isModerator: !currentlyMod }),
      });
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => m.userId === userId ? { ...m, isModerator: !currentlyMod } : m)
        );
      }
    } finally {
      setModToggles((t) => ({ ...t, [userId]: false }));
    }
  };

  const removeMember = async (userId: string, ban = false) => {
    if (!window.confirm(ban ? "Ban this member?" : "Remove this member?")) return;
    setRemoving(userId);
    try {
      const res = await fetch(`/api/boards/${boardName}/members/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ban }),
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      }
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg)" }}>
        <p className="text-xs font-mono animate-pulse" style={{ color: "var(--text-dim)" }}>loading…</p>
      </div>
    );
  }

  if (notFound || !board) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>board not found.</p>
        <Link href="/boards" className="text-xs font-mono" style={{ color: "var(--teal)" }}>← boards</Link>
      </div>
    );
  }

  const mods = members.filter((m) => m.isModerator);
  const nonMods = members.filter((m) => m.userId !== board.creatorId && !m.isModerator);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href={`/boards/${boardName}`}
            className="text-sm font-mono"
            style={{ color: "var(--text-dim)" }}
          >
            ←
          </Link>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
              {board.displayName} — settings
            </h1>
            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-dim)" }}>
              /boards/{boardName}
            </p>
          </div>
        </div>

        {/* ---- Board info section ---- */}
        <section
          className="rounded-2xl border p-5 mb-6"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <h2 className="text-[11px] font-mono uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>
            board info
          </h2>

          <div className="flex flex-col gap-4">
            {/* Display name */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
                className="rounded-lg border px-3 py-2 text-sm bg-transparent outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              />
            </label>

            {/* Vibe statement */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>vibe statement</span>
              <textarea
                value={vibeStatement}
                onChange={(e) => setVibeStatement(e.target.value.slice(0, 200))}
                rows={2}
                className="rounded-lg border px-3 py-2 text-sm bg-transparent outline-none resize-none"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              />
              <span className="text-[10px] font-mono self-end" style={{ color: "var(--text-dim)" }}>
                {200 - vibeStatement.length}
              </span>
            </label>

            {/* Type */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>visibility</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as BoardSettings["type"])}
                className="rounded-lg border px-3 py-2 text-sm bg-transparent outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              >
                <option value="PUBLIC">public — anyone can join</option>
                <option value="INVITE_ONLY">invite only — invite link required</option>
                <option value="SECRET">secret — hidden from search</option>
              </select>
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

        {/* ---- Moderators section ---- */}
        <section
          className="rounded-2xl border p-5 mb-6"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <h2 className="text-[11px] font-mono uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>
            moderators ({mods.length})
          </h2>

          {mods.length === 0 && (
            <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>
              no moderators yet — appoint some from the members list below.
            </p>
          )}

          {mods.map((m) => {
            const colorKey = hashColor(m.user.id);
            const colors = AVATAR_COLORS[colorKey];
            return (
              <div key={m.userId} className="flex items-center gap-3 py-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: colors.bg }}
                >
                  <span className="text-[10px] font-bold font-mono" style={{ color: colors.text }}>
                    {m.user.screenname.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="flex-1 text-sm" style={{ color: "var(--text)" }}>
                  {m.user.screenname}
                  {m.user.isGoldMember && <span className="ml-1 text-[9px]" style={{ color: "#d4a017" }}>★</span>}
                </span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded mr-2"
                  style={{ background: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                >
                  mod
                </span>
                <button
                  onClick={() => toggleMod(m.userId, true)}
                  disabled={!!modToggles[m.userId]}
                  className="text-[11px] font-mono transition-colors disabled:opacity-40"
                  style={{ color: "var(--text-dim)" }}
                >
                  {modToggles[m.userId] ? "…" : "remove mod"}
                </button>
              </div>
            );
          })}
        </section>

        {/* ---- Members section ---- */}
        <section
          className="rounded-2xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <h2 className="text-[11px] font-mono uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>
            members ({members.length})
          </h2>

          {nonMods.length === 0 && (
            <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>
              no other members yet.
            </p>
          )}

          {nonMods.map((m) => {
            const colorKey = hashColor(m.user.id);
            const colors = AVATAR_COLORS[colorKey];
            return (
              <div key={m.userId} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: colors.bg }}
                >
                  <span className="text-[10px] font-bold font-mono" style={{ color: colors.text }}>
                    {m.user.screenname.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                <span className="flex-1 text-sm" style={{ color: "var(--text)" }}>
                  {m.user.screenname}
                  {m.user.isGoldMember && <span className="ml-1 text-[9px]" style={{ color: "#d4a017" }}>★</span>}
                  {m.isFoundingMember && (
                    <span className="ml-1.5 text-[10px] font-mono" style={{ color: "var(--amber)" }}>✦</span>
                  )}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMod(m.userId, false)}
                    disabled={!!modToggles[m.userId]}
                    className="text-[11px] font-mono transition-colors disabled:opacity-40"
                    style={{ color: "#a78bfa" }}
                  >
                    {modToggles[m.userId] ? "…" : "make mod"}
                  </button>
                  <button
                    onClick={() => removeMember(m.userId, false)}
                    disabled={removing === m.userId}
                    className="text-[11px] font-mono transition-colors disabled:opacity-40"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {removing === m.userId ? "…" : "kick"}
                  </button>
                  <button
                    onClick={() => removeMember(m.userId, true)}
                    disabled={removing === m.userId}
                    className="text-[11px] font-mono transition-colors disabled:opacity-40"
                    style={{ color: "#ef4444" }}
                  >
                    ban
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
