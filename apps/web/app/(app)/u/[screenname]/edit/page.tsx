"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Password strength (reused from register pattern in the codebase)
// ---------------------------------------------------------------------------

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3;
}

const STRENGTH_LABEL = ["", "weak", "fair", "strong"];
const STRENGTH_COLOR = ["", "#ef4444", "#f59e0b", "#22c55e"];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EditProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [bio, setBio] = useState("");
  const [awayMessage, setAwayMessage] = useState("");
  const [saved, setSaved] = useState(true); // track unsaved changes
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password section
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const initialRef = useRef({ bio: "", awayMessage: "" });

  // Load current profile
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        const b = d.bio ?? "";
        const a = d.awayMessage ?? "";
        setBio(b);
        setAwayMessage(a);
        initialRef.current = { bio: b, awayMessage: a };
      });
  }, [status]);

  // Track unsaved changes
  useEffect(() => {
    const isDirty =
      bio !== initialRef.current.bio ||
      awayMessage !== initialRef.current.awayMessage;
    setSaved(!isDirty);
  }, [bio, awayMessage]);

  // Warn on browser refresh / close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!saved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saved]);

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Redirect non-owners trying to edit someone else's profile
  // (edit page is only accessible via /u/me/edit or /u/[own-name]/edit)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bio.trim(), awayMessage: awayMessage.trim() }),
      });

      if (!res.ok) {
        setSaveError((await res.json()).error ?? "failed to save.");
        return;
      }

      initialRef.current = { bio: bio.trim(), awayMessage: awayMessage.trim() };
      setSaved(true);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwSaving) return;
    setPwError(null);
    setPwSuccess(false);

    if (newPw !== confirmPw) {
      setPwError("passwords don't match.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("new password must be at least 8 characters.");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });

      if (!res.ok) {
        setPwError((await res.json()).error ?? "failed to change password.");
        return;
      }

      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => {
        setPwSuccess(false);
        setPwOpen(false);
      }, 2000);
    } finally {
      setPwSaving(false);
    }
  };

  const strength = passwordStrength(newPw);

  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0d0d0b" }}
      >
        <p className="text-xs font-mono animate-pulse" style={{ color: "#3a3a2a" }}>
          loading…
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0d0d0b", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => {
              if (!saved) {
                if (!confirm("You have unsaved changes. Leave anyway?")) return;
              }
              router.back();
            }}
            className="text-sm font-mono"
            style={{ color: "#3a3a2a" }}
          >
            ←
          </button>
          <h1 className="text-lg font-bold" style={{ color: "#e5e7eb" }}>
            Edit profile
          </h1>
          {!saved && (
            <span
              className="ml-auto text-[10px] font-mono italic"
              style={{ color: "#c8860a66" }}
            >
              unsaved changes
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Profile photo — Gold only */}
          <div
            className="rounded-2xl border p-4 flex items-center gap-4"
            style={{ borderColor: "#1a1a12", background: "#0a0a08" }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#1a1a12" }}
            >
              <span className="text-lg font-bold font-mono" style={{ color: "#3a3a2a" }}>
                {session?.user?.screenname?.slice(0, 2).toUpperCase() ?? "??"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#e5e7eb" }}>
                Profile photo
              </p>
              {session?.user?.isGoldMember ? (
                <button
                  type="button"
                  disabled
                  className="mt-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border opacity-50 cursor-not-allowed"
                  style={{ color: "#c8860a", borderColor: "#c8860a33" }}
                >
                  upload photo (coming soon)
                </button>
              ) : (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-mono" style={{ color: "#3a3a2a" }}>
                    🔒
                  </span>
                  <p className="text-xs font-mono" style={{ color: "#3a3a2a" }}>
                    Gold members only
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
                bio
              </label>
              <span
                className="text-[10px] font-mono tabular-nums"
                style={{ color: bio.length > 140 ? "#f59e0b" : "#2a2a1a" }}
              >
                {160 - bio.length}
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="A few words about yourself…"
              rows={3}
              className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none"
              style={{
                background: "#111109",
                borderColor: "#1e1e14",
                color: "#d1d5db",
                fontFamily: "var(--font-dm-sans)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#c8860a44")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e14")}
            />
          </div>

          {/* Away message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
                away message
              </label>
              <span
                className="text-[10px] font-mono tabular-nums"
                style={{ color: awayMessage.length > 120 ? "#f59e0b" : "#2a2a1a" }}
              >
                {140 - awayMessage.length}
              </span>
            </div>
            <input
              value={awayMessage}
              onChange={(e) => setAwayMessage(e.target.value.slice(0, 140))}
              placeholder="gone for a walk · back later"
              className="w-full h-10 rounded-xl border px-3 text-sm outline-none"
              style={{
                background: "#111109",
                borderColor: "#1e1e14",
                color: "#d1d5db",
                fontFamily: "var(--font-dm-sans)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#c8860a44")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e14")}
            />
            <p className="text-[10px] font-mono" style={{ color: "#2a2a1a" }}>
              shown on your buddy list
            </p>
          </div>

          {/* Error / success */}
          {saveError && (
            <p className="text-[11px] font-mono" style={{ color: "#ef4444" }}>
              {saveError}
            </p>
          )}
          {saveSuccess && (
            <p className="text-[11px] font-mono" style={{ color: "#22c55e" }}>
              saved.
            </p>
          )}

          {/* Save button */}
          <button
            type="submit"
            disabled={saving || saved}
            className="w-full rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-40"
            style={{
              background: "#c8860a",
              color: "#fff8e6",
              height: "42px",
            }}
          >
            {saving ? "saving…" : saved ? "no changes" : "save changes"}
          </button>
        </form>

        {/* ---- Password change ---- */}
        <div
          className="mt-6 rounded-2xl border overflow-hidden"
          style={{ borderColor: "#1a1a12" }}
        >
          <button
            type="button"
            onClick={() => setPwOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-mono transition-colors"
            style={{ color: "#6b7280", background: "#0a0a08" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "#111109")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "#0a0a08")
            }
          >
            <span>change password</span>
            <span
              className="text-xs transition-transform"
              style={{
                transform: pwOpen ? "rotate(180deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              ▾
            </span>
          </button>

          {pwOpen && (
            <form
              onSubmit={handlePasswordChange}
              className="px-4 pb-4 pt-2 space-y-4"
              style={{ background: "#0a0a08", borderTop: "1px solid #1a1a12" }}
            >
              {/* Current password */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
                  current password
                </label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  required
                  className="w-full h-10 rounded-xl border px-3 text-sm outline-none"
                  style={{
                    background: "#111109",
                    borderColor: "#1e1e14",
                    color: "#d1d5db",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#c8860a44")}
                  onBlur={(e) => (e.target.style.borderColor = "#1e1e14")}
                />
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
                  new password
                </label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                  minLength={8}
                  className="w-full h-10 rounded-xl border px-3 text-sm outline-none"
                  style={{
                    background: "#111109",
                    borderColor: "#1e1e14",
                    color: "#d1d5db",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#c8860a44")}
                  onBlur={(e) => (e.target.style.borderColor = "#1e1e14")}
                />
                {newPw && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="h-1 flex-1 rounded-full transition-colors"
                          style={{
                            background:
                              strength >= n
                                ? STRENGTH_COLOR[strength]
                                : "#1e1e14",
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: STRENGTH_COLOR[strength] }}
                    >
                      {STRENGTH_LABEL[strength]}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
                  confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  className="w-full h-10 rounded-xl border px-3 text-sm outline-none"
                  style={{
                    background: "#111109",
                    borderColor:
                      confirmPw && confirmPw !== newPw
                        ? "#ef444444"
                        : "#1e1e14",
                    color: "#d1d5db",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#c8860a44")}
                  onBlur={(e) =>
                    (e.target.style.borderColor =
                      confirmPw && confirmPw !== newPw ? "#ef444444" : "#1e1e14")
                  }
                />
              </div>

              {pwError && (
                <p className="text-[11px] font-mono" style={{ color: "#ef4444" }}>
                  {pwError}
                </p>
              )}
              {pwSuccess && (
                <p className="text-[11px] font-mono" style={{ color: "#22c55e" }}>
                  password changed.
                </p>
              )}

              <button
                type="submit"
                disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                className="w-full h-10 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-40"
                style={{ background: "#1a1a12", color: "#6b7280" }}
              >
                {pwSaving ? "updating…" : "update password"}
              </button>
            </form>
          )}
        </div>

        {/* View profile link */}
        <div className="mt-6 text-center">
          <Link
            href={`/u/${session?.user?.screenname ?? "me"}`}
            className="text-xs font-mono"
            style={{ color: "#3a3a2a" }}
          >
            view your profile →
          </Link>
        </div>
      </div>
    </div>
  );
}
