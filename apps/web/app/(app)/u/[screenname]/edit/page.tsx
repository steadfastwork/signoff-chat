"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useUploadThing } from "@/lib/uploadthing";
import { useTheme, COLOR_SCHEMES, type ColorScheme } from "@/components/ThemeProvider";
import { getSoundPack, setSoundPack, previewSound, type SoundPack } from "@/lib/sounds";

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
  const { colorScheme, setColorScheme } = useTheme();

  const [bio, setBio] = useState("");
  const [awayMessage, setAwayMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(true); // track unsaved changes
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sound pack state
  const [soundPack, setSoundPackState] = useState<SoundPack>("off");

  // Feed privacy state
  const [feedVisibility, setFeedVisibilityState] = useState<"PUBLIC" | "BUDDIES" | "PRIVATE">("PUBLIC");

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
        setAvatarUrl(d.avatarUrl ?? null);
        initialRef.current = { bio: b, awayMessage: a };

        // Sync color scheme from DB to localStorage/DOM on load
        if (d.profileTheme) {
          setColorScheme(d.profileTheme as ColorScheme);
        }
        if (d.soundPack) {
          setSoundPack(d.soundPack);
          setSoundPackState(d.soundPack);
        }
        if (d.feedVisibility) {
          setFeedVisibilityState(d.feedVisibility);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Initialize sound pack from localStorage
  useEffect(() => {
    setSoundPackState(getSoundPack());
  }, []);

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

  const { startUpload, isUploading } = useUploadThing("profileImage", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.serverData?.url) {
        setAvatarUrl(res[0].serverData.url);
      }
      setUploadError(null);
    },
    onUploadError: () => {
      setUploadError("upload failed. please try again.");
    },
  });

  const handlePhotoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) startUpload([file]);
      e.target.value = "";
    },
    [startUpload]
  );

  const handleClearPhoto = useCallback(async () => {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearAvatar: true }),
    });
    setAvatarUrl(null);
  }, []);

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
        body: JSON.stringify({
          bio: bio.trim(),
          awayMessage: awayMessage.trim(),
        }),
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

  const handleSoundPackSelect = async (pack: SoundPack) => {
    setSoundPack(pack);
    setSoundPackState(pack);
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soundPack: pack === "off" ? null : pack }),
    }).catch(() => {});
  };

  const handleFeedVisibilitySelect = async (value: "PUBLIC" | "BUDDIES" | "PRIVATE") => {
    setFeedVisibilityState(value);
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedVisibility: value }),
    }).catch(() => {});
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
              className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ background: "#1a1a12" }}
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt="profile photo" width={56} height={56} className="w-full h-full object-cover" unoptimized />
              ) : (
                <span className="text-lg font-bold font-mono" style={{ color: "#3a3a2a" }}>
                  {session?.user?.screenname?.slice(0, 2).toUpperCase() ?? "??"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#e5e7eb" }}>
                Profile photo
              </p>
              {session?.user?.isGoldMember ? (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <label
                    className="text-xs font-mono px-3 py-1.5 rounded-lg border cursor-pointer transition-opacity hover:opacity-80"
                    style={{ color: "#c8860a", borderColor: "#c8860a44" }}
                  >
                    {isUploading ? "uploading…" : avatarUrl ? "change photo" : "upload photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploading} />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleClearPhoto}
                      className="text-xs font-mono px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-80"
                      style={{ color: "#6b7280", borderColor: "#2a2a1a" }}
                    >
                      remove
                    </button>
                  )}
                  {uploadError && (
                    <p className="w-full text-[11px] font-mono" style={{ color: "#ef4444" }}>{uploadError}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-mono" style={{ color: "#3a3a2a" }}>🔒</span>
                  <p className="text-xs font-mono" style={{ color: "#3a3a2a" }}>Gold members only</p>
                </div>
              )}
            </div>
          </div>

          {/* App color scheme — Gold only, instant-apply */}
          {session?.user?.isGoldMember && (
            <div className="space-y-2">
              <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
                app color scheme
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SCHEMES.map((scheme) => {
                  const active = colorScheme === scheme.id;
                  return (
                    <button
                      key={scheme.id}
                      type="button"
                      onClick={() => setColorScheme(scheme.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all"
                      style={{
                        background: scheme.bg,
                        borderColor: active ? scheme.accent : "#1e1e14",
                        color: scheme.accent,
                        boxShadow: active ? `0 0 0 1px ${scheme.accent}` : undefined,
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: scheme.accent }}
                      />
                      {scheme.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sound pack — Gold only, instant-apply */}
          {session?.user?.isGoldMember && (
            <div className="space-y-2">
              <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
                sound pack
              </label>
              <div className="flex flex-col gap-2">
                {(["off", "classic", "retro", "minimal"] as SoundPack[]).map((pack) => {
                  const active = soundPack === pack;
                  return (
                    <div key={pack} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSoundPackSelect(pack)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex-1 text-left"
                        style={{
                          background: active ? "#1a1a12" : "#0a0a08",
                          borderColor: active ? "#c8860a" : "#1e1e14",
                          color: active ? "#c8860a" : "#6b7280",
                          boxShadow: active ? "0 0 0 1px #c8860a44" : undefined,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full border flex-shrink-0"
                          style={{
                            background: active ? "#c8860a" : "transparent",
                            borderColor: active ? "#c8860a" : "#3a3a2a",
                          }}
                        />
                        {pack}
                      </button>
                      {pack !== "off" && (
                        <button
                          type="button"
                          onClick={() => previewSound(pack)}
                          className="text-[10px] font-mono px-2 py-1.5 rounded-lg border transition-opacity hover:opacity-80"
                          style={{ color: "#6b7280", borderColor: "#1e1e14", background: "#0a0a08" }}
                        >
                          preview
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feed privacy */}
          <div className="space-y-2">
            <label className="text-xs font-mono" style={{ color: "#6b7280" }}>
              who can see your posts?
            </label>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: "PUBLIC",  label: "everyone",     desc: "your posts are visible to all users" },
                  { value: "BUDDIES", label: "buddies only",  desc: "only accepted buddies can see your posts" },
                  { value: "PRIVATE", label: "only me",       desc: "your posts are hidden from everyone else" },
                ] as const
              ).map(({ value, label, desc }) => {
                const active = feedVisibility === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleFeedVisibilitySelect(value)}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all"
                    style={{
                      background: active ? "#1a1a12" : "#0a0a08",
                      borderColor: active ? "#c8860a" : "#1e1e14",
                      boxShadow: active ? "0 0 0 1px #c8860a44" : undefined,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full border flex-shrink-0 mt-1"
                      style={{
                        background: active ? "#c8860a" : "transparent",
                        borderColor: active ? "#c8860a" : "#3a3a2a",
                      }}
                    />
                    <div>
                      <p className="text-xs font-mono" style={{ color: active ? "#c8860a" : "#6b7280" }}>
                        {label}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "#2a2a1a", fontFamily: "var(--font-dm-sans)" }}>
                        {desc}
                      </p>
                    </div>
                  </button>
                );
              })}
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

        {/* Encryption recovery */}
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
                encryption keys
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                restore keys from your 24-word recovery phrase on a new device.
              </p>
            </div>
            <Link
              href="/recover-keys"
              className="flex-shrink-0 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg)" }}
            >
              restore →
            </Link>
          </div>
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
