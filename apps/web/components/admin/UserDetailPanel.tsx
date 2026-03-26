"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface UserDetail {
  id: string;
  screenname: string;
  emailHashTail: string;
  isGoldMember: boolean;
  adminRole: string | null;
  adminNotes: string | null;
  status: string;
  isSuspended: boolean;
  suspendedAt: string | null;
  suspendedUntil: string | null;
  suspendReason: string | null;
  warningCount: number;
  createdAt: string;
  bio: string | null;
  _count: { posts: number; reports: number };
}

interface Props {
  userId: string;
  onClose: () => void;
  onAction: () => void;
}

function Btn({
  label,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 12px",
        background: danger ? "rgba(239,68,68,0.1)" : "#1a1916",
        border: `1px solid ${danger ? "rgba(239,68,68,0.35)" : "#2a2620"}`,
        borderRadius: 5,
        color: danger ? "#ef4444" : "#e8ddd0",
        fontSize: 12,
        fontFamily: "IBM Plex Mono, monospace",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

export default function UserDetailPanel({ userId, onClose, onAction }: Props) {
  const { data: session } = useSession();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewerRole = session?.user?.adminRole;
  const isSuperViewer = viewerRole === "SUPER_ADMIN";

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        setNotes(data.adminNotes ?? "");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const doAction = async (
    action: string,
    extra?: { reason?: string; note?: string; suspendDays?: number; adminNotes?: string }
  ) => {
    if (acting) return;
    setActing(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setConfirm(null);
      setConfirmInput("");
      onAction();
    } finally {
      setActing(null);
    }
  };

  const saveNotes = async () => {
    await doAction("update-notes", { adminNotes: notes });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  if (loading || !user) {
    return (
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 100,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            width: 380,
            height: "100%",
            background: "#111110",
            borderLeft: "1px solid #2a2620",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ color: "#6b6456", fontFamily: "IBM Plex Mono, monospace", fontSize: 13 }}>
            Loading…
          </span>
        </div>
      </div>
    );
  }

  const canGrantAdmin = isSuperViewer && !user.adminRole && !user.isSuspended && user.warningCount === 0;
  const canRevokeAdmin = isSuperViewer && user.adminRole === "ADMIN";
  const canPromote = isSuperViewer && user.adminRole === "ADMIN";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 100,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: 380,
          height: "100vh",
          background: "#111110",
          borderLeft: "1px solid #2a2620",
          zIndex: 101,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #2a2620",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 14,
              color: "#e8ddd0",
              fontWeight: 600,
            }}
          >
            @{user.screenname}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#6b6456",
              fontSize: 18,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "16px 20px", flex: 1 }}>
          {/* Info grid */}
          <div style={{ marginBottom: 20 }}>
            {[
              ["Status", user.isSuspended ? "SUSPENDED" : user.status],
              ["Admin role", user.adminRole ?? "—"],
              ["Joined", new Date(user.createdAt).toLocaleDateString()],
              ["Email tail", `…${user.emailHashTail}`],
              ["Warnings", user.warningCount.toString()],
              ["Posts", user._count.posts.toString()],
              ["Reports against", user._count.reports.toString()],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid #1a1916",
                }}
              >
                <span style={{ color: "#6b6456", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {k}
                </span>
                <span style={{ color: "#e8ddd0", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {v}
                </span>
              </div>
            ))}
            {/* Gold row with inline toggle */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid #1a1916",
              }}
            >
              <span style={{ color: "#6b6456", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                Gold
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#e8ddd0", fontSize: 12, fontFamily: "IBM Plex Mono, monospace" }}>
                  {user.isGoldMember ? "★ Active" : "No"}
                </span>
                <Btn
                  label={user.isGoldMember ? "Revoke" : "Grant"}
                  onClick={() => doAction(user.isGoldMember ? "revoke-gold" : "grant-gold")}
                  disabled={!!acting}
                  danger={user.isGoldMember}
                />
              </div>
            </div>
          </div>

          {user.bio && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#6b6456", marginBottom: 4, fontFamily: "IBM Plex Mono, monospace" }}>
                BIO
              </div>
              <p style={{ fontSize: 13, color: "#8a7d6e", margin: 0 }}>{user.bio}</p>
            </div>
          )}

          {user.suspendReason && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 6,
                padding: "10px 12px",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 11, color: "#6b6456", marginBottom: 4, fontFamily: "IBM Plex Mono, monospace" }}>
                SUSPEND REASON
              </div>
              <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{user.suspendReason}</p>
              {user.suspendedUntil && (
                <p style={{ fontSize: 11, color: "#8a7d6e", margin: "4px 0 0" }}>
                  Until: {new Date(user.suspendedUntil).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 6,
                padding: "8px 12px",
                marginBottom: 12,
                color: "#ef4444",
                fontSize: 12,
                fontFamily: "IBM Plex Mono, monospace",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#6b6456", marginBottom: 10, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.06em" }}>
              MODERATION ACTIONS
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Btn label="Warn" onClick={() => setConfirm("warn")} disabled={!!acting} />
              {user.isSuspended ? (
                <Btn label="Unsuspend" onClick={() => doAction("unsuspend")} disabled={!!acting} />
              ) : (
                <>
                  <Btn label="Suspend 7d" onClick={() => setConfirm("suspend-7")} disabled={!!acting} />
                  <Btn label="Suspend 30d" onClick={() => setConfirm("suspend-30")} disabled={!!acting} />
                  <Btn label="Suspend 90d" onClick={() => setConfirm("suspend-90")} disabled={!!acting} />
                </>
              )}
              <Btn label="Permanent ban" onClick={() => setConfirm("perm-ban")} danger disabled={!!acting} />
              <Btn label="Delete account" onClick={() => setConfirm("delete")} danger disabled={!!acting} />
            </div>
          </div>

          {/* Confirmation dialogs */}
          {confirm === "warn" && (
            <ConfirmBox
              title="Issue warning"
              confirmLabel="Warn user"
              onConfirm={() => doAction("warn")}
              onCancel={() => setConfirm(null)}
            />
          )}
          {(confirm === "suspend-7" || confirm === "suspend-30" || confirm === "suspend-90") && (
            <ConfirmBox
              title={`Suspend for ${confirm === "suspend-7" ? "7" : confirm === "suspend-30" ? "30" : "90"} days`}
              confirmLabel="Suspend"
              onConfirm={() =>
                doAction("suspend", {
                  suspendDays: confirm === "suspend-7" ? 7 : confirm === "suspend-30" ? 30 : 90,
                })
              }
              onCancel={() => setConfirm(null)}
              danger
            />
          )}
          {confirm === "perm-ban" && (
            <ConfirmBox
              title="Permanent ban"
              confirmLabel="Type PERMANENT to confirm"
              requireInput="PERMANENT"
              inputValue={confirmInput}
              onInputChange={setConfirmInput}
              onConfirm={() => doAction("permanent-ban")}
              onCancel={() => { setConfirm(null); setConfirmInput(""); }}
              danger
            />
          )}
          {confirm === "delete" && (
            <ConfirmBox
              title="Delete account"
              confirmLabel={`Type @${user.screenname} to confirm`}
              requireInput={`@${user.screenname}`}
              inputValue={confirmInput}
              onInputChange={setConfirmInput}
              onConfirm={() => doAction("delete")}
              onCancel={() => { setConfirm(null); setConfirmInput(""); }}
              danger
            />
          )}

          {/* Super admin section */}
          {isSuperViewer && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#6b6456", marginBottom: 10, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.06em" }}>
                ADMIN ACCESS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {canGrantAdmin && (
                  <Btn label="Grant admin" onClick={() => setConfirm("grant-admin")} disabled={!!acting} />
                )}
                {canRevokeAdmin && (
                  <Btn label="Revoke admin" onClick={() => setConfirm("revoke-admin")} danger disabled={!!acting} />
                )}
                {canPromote && (
                  <Btn label="Promote to Super Admin" onClick={() => setConfirm("promote")} danger disabled={!!acting} />
                )}
              </div>
              {!canGrantAdmin && !user.adminRole && (
                <p style={{ fontSize: 11, color: "#6b6456", marginTop: 8 }}>
                  {user.isSuspended ? "Cannot grant admin: user is suspended." : user.warningCount > 0 ? "Cannot grant admin: user has warnings." : ""}
                </p>
              )}
              {confirm === "grant-admin" && (
                <ConfirmBox
                  title="Grant admin access"
                  confirmLabel="Grant admin"
                  onConfirm={() => doAction("grant-admin", { reason: "Granted via admin panel" })}
                  onCancel={() => setConfirm(null)}
                />
              )}
              {confirm === "revoke-admin" && (
                <ConfirmBox
                  title="Revoke admin access"
                  confirmLabel="Revoke admin"
                  onConfirm={() => doAction("revoke-admin")}
                  onCancel={() => setConfirm(null)}
                  danger
                />
              )}
              {confirm === "promote" && (
                <ConfirmBox
                  title="Promote to Super Admin"
                  confirmLabel="This cannot be undone via UI. Confirm?"
                  onConfirm={() => doAction("promote-super-admin")}
                  onCancel={() => setConfirm(null)}
                  danger
                />
              )}
            </div>
          )}

          {/* Internal notes */}
          <div>
            <div style={{ fontSize: 11, color: "#6b6456", marginBottom: 8, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.06em" }}>
              INTERNAL NOTES
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                background: "#0a0a09",
                border: "1px solid #2a2620",
                borderRadius: 6,
                padding: "8px 10px",
                color: "#e8ddd0",
                fontSize: 12,
                fontFamily: "IBM Plex Mono, monospace",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder="Internal notes (never shown to user)…"
            />
            <button
              onClick={saveNotes}
              disabled={!!acting}
              style={{
                marginTop: 8,
                padding: "6px 14px",
                background: "#1a1916",
                border: "1px solid #2a2620",
                borderRadius: 5,
                color: notesSaved ? "#2dd4bf" : "#e8ddd0",
                fontSize: 12,
                fontFamily: "IBM Plex Mono, monospace",
                cursor: "pointer",
              }}
            >
              {notesSaved ? "Saved" : "Save notes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ConfirmBox({
  title,
  confirmLabel,
  requireInput,
  inputValue,
  onInputChange,
  onConfirm,
  onCancel,
  danger,
}: {
  title: string;
  confirmLabel: string;
  requireInput?: string;
  inputValue?: string;
  onInputChange?: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const ready = !requireInput || inputValue === requireInput;

  return (
    <div
      style={{
        background: "#0a0a09",
        border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : "#2a2620"}`,
        borderRadius: 6,
        padding: "12px 14px",
        marginBottom: 16,
      }}
    >
      <p style={{ fontSize: 13, color: "#e8ddd0", margin: "0 0 8px", fontFamily: "IBM Plex Mono, monospace" }}>
        {title}
      </p>
      {requireInput && onInputChange && (
        <input
          type="text"
          value={inputValue ?? ""}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={confirmLabel}
          style={{
            width: "100%",
            background: "#111110",
            border: "1px solid #2a2620",
            borderRadius: 4,
            padding: "6px 8px",
            color: "#e8ddd0",
            fontSize: 12,
            fontFamily: "IBM Plex Mono, monospace",
            outline: "none",
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        />
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onConfirm}
          disabled={!ready}
          style={{
            padding: "6px 14px",
            background: danger ? "rgba(239,68,68,0.15)" : "rgba(200,134,10,0.12)",
            border: `1px solid ${danger ? "rgba(239,68,68,0.4)" : "rgba(200,134,10,0.4)"}`,
            borderRadius: 4,
            color: danger ? "#ef4444" : "#c8860a",
            fontSize: 12,
            fontFamily: "IBM Plex Mono, monospace",
            cursor: ready ? "pointer" : "not-allowed",
            opacity: ready ? 1 : 0.5,
          }}
        >
          {requireInput ? "Confirm" : confirmLabel}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 14px",
            background: "none",
            border: "1px solid #2a2620",
            borderRadius: 4,
            color: "#8a7d6e",
            fontSize: 12,
            fontFamily: "IBM Plex Mono, monospace",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
