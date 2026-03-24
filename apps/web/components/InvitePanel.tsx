"use client";

import { useEffect, useState } from "react";

interface InviteData {
  token: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  link: string;
}

interface InvitePanelProps {
  channelName: string;
  channelType: "INVITE_ONLY" | "SECRET";
  /** API namespace — "channels" (default) or "boards" */
  apiPrefix?: "channels" | "boards";
}

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

export function InvitePanel({ channelName, channelType, apiPrefix = "channels" }: InvitePanelProps) {
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [maxUses, setMaxUses] = useState(10);
  const [screenname, setScreenname] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countdown = useCountdown(invite?.expiresAt ?? null);
  const usesLeft = invite ? invite.maxUses - invite.useCount : 0;
  const isExpired = countdown === "expired" || usesLeft <= 0;

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/${apiPrefix}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName, maxUses }),
      });
      if (res.ok) {
        setInvite(await res.json());
      } else {
        setError((await res.json()).error ?? "failed to generate invite.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async () => {
    if (!invite) return;
    await fetch(`/api/${apiPrefix}/invites`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: invite.token }),
    });
    setInvite(null);
  };

  const directInvite = async () => {
    if (!screenname.trim() || inviting) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch(
        `/api/${apiPrefix}/${channelName}/invite-member`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screenname: screenname.trim() }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setInviteMsg(`${data.screenname} added.`);
        setScreenname("");
      } else {
        setInviteMsg(data.error ?? "failed to invite.");
      }
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div>
        <h3
          className="text-sm font-semibold"
          style={{ color: "#e5e7eb", fontFamily: "var(--font-dm-sans)" }}
        >
          Invite to #{channelName}
        </h3>
        <p
          className="text-[11px] font-mono mt-0.5"
          style={{ color: "#3a3a2a" }}
        >
          Links expire in 24h · max {maxUses} uses · no permanent links
        </p>
      </div>

      {/* Invite link section */}
      {invite && !isExpired ? (
        <div
          className="rounded-xl border p-3 space-y-2"
          style={{ borderColor: "#1e1e14", background: "#111109" }}
        >
          {/* Token display */}
          <div
            className="rounded-lg px-3 py-2 font-mono text-xs break-all select-all"
            style={{ background: "#0a0a08", color: "#6b7280" }}
          >
            {invite.link}
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span style={{ color: "#3a3a2a" }}>
              expires in {countdown}
            </span>
            <span style={{ color: "#3a3a2a" }}>
              {usesLeft} use{usesLeft !== 1 ? "s" : ""} remaining
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="flex-1 h-8 rounded-lg text-xs font-mono font-bold transition-all"
              style={{
                background: copied ? "#064e3b" : "#c8860a",
                color: copied ? "#6ee7b7" : "#fff8e6",
              }}
            >
              {copied ? "copied!" : "copy link"}
            </button>
            <button
              onClick={revoke}
              className="h-8 px-3 rounded-lg text-xs font-mono border transition-colors"
              style={{ color: "#6b7280", borderColor: "#1e1e14" }}
            >
              revoke
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {isExpired && invite && (
            <p className="text-[11px] font-mono" style={{ color: "#6b7280" }}>
              your last link expired or hit its limit.
            </p>
          )}

          {/* Max uses picker */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono"
              style={{ color: "#3a3a2a" }}
            >
              max uses
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={maxUses}
              onChange={(e) =>
                setMaxUses(Math.min(50, Math.max(1, Number(e.target.value))))
              }
              className="w-16 h-7 rounded-lg text-center text-xs font-mono outline-none border"
              style={{
                background: "#111109",
                borderColor: "#1e1e14",
                color: "#9ca3af",
              }}
            />
          </div>

          <button
            onClick={generate}
            disabled={generating}
            className="w-full h-9 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-50"
            style={{ background: "#c8860a", color: "#fff8e6" }}
          >
            {generating ? "generating…" : "generate invite link"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-[11px] font-mono" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      {/* Divider */}
      <div
        className="border-t"
        style={{ borderColor: "#1e1e14" }}
      />

      {/* Direct invite by screenname */}
      <div className="space-y-2">
        <p
          className="text-xs font-mono"
          style={{ color: "#3a3a2a" }}
        >
          or invite by screenname
        </p>
        <div className="flex gap-2">
          <input
            value={screenname}
            onChange={(e) => setScreenname(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void directInvite();
            }}
            placeholder="screenname"
            className="flex-1 h-8 rounded-lg px-3 text-xs font-mono outline-none border"
            style={{
              background: "#111109",
              borderColor: "#1e1e14",
              color: "#9ca3af",
            }}
          />
          <button
            onClick={directInvite}
            disabled={!screenname.trim() || inviting}
            className="h-8 px-3 rounded-lg text-xs font-mono border transition-colors disabled:opacity-40"
            style={{
              color: "#c8860a",
              borderColor: "#c8860a33",
            }}
          >
            {inviting ? "…" : "add"}
          </button>
        </div>
        {inviteMsg && (
          <p
            className="text-[11px] font-mono"
            style={{
              color: inviteMsg.includes("added") ? "#6ee7b7" : "#ef4444",
            }}
          >
            {inviteMsg}
          </p>
        )}
      </div>

      <p
        className="text-[10px] font-mono leading-relaxed"
        style={{ color: "#2a2a1a" }}
      >
        {channelType === "SECRET"
          ? `this is a secret ${apiPrefix === "boards" ? "board" : "channel"} — links never reveal its members.`
          : "links never reveal who created them or the member list."}
      </p>
    </div>
  );
}
