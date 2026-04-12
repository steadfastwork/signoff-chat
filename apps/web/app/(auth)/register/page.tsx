"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { validateScreenname } from "@/lib/auth";
import { generateBackupMnemonic, mnemonicToKeypair } from "@/lib/crypto/keyBackup";
import { toBase64 } from "@/lib/crypto/index";
import { encryptAndStoreKey, cacheDecryptedKey } from "@/lib/crypto/localKey";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ?? "";

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------

type StrengthLevel = { label: string; color: string; width: string };

function getStrength(pw: string): StrengthLevel {
  if (!pw) return { label: "", color: "#2a2620", width: "0%" };
  if (pw.length < 8) return { label: "weak", color: "#dc2626", width: "33%" };
  if (pw.length < 12) return { label: "ok", color: "#c8860a", width: "66%" };
  return { label: "strong", color: "#16a34a", width: "100%" };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner({ color = "#fff", size = 14 }: { color?: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full border-2 animate-spin shrink-0"
      style={{
        width: size,
        height: size,
        borderColor: `${color}33`,
        borderTopColor: color,
      }}
      aria-hidden
    />
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onToggle}
      className="pr-3 text-xs select-none transition-colors"
      style={{ color: "#6b6456" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#c8860a")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#6b6456")}
    >
      {show ? "hide" : "show"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Screenname status
// ---------------------------------------------------------------------------

type ScrStatus = "idle" | "checking" | "ok" | "taken" | "invalid";

function ScrIndicator({ status }: { status: ScrStatus }) {
  if (status === "idle") return null;
  if (status === "checking") return <Spinner color="#c8860a" size={12} />;
  if (status === "ok") return <span className="text-sm font-semibold" style={{ color: "#16a34a" }}>✓</span>;
  return <span className="text-sm font-semibold" style={{ color: "#dc2626" }}>✗</span>;
}

function scrBorderColor(status: ScrStatus, hasValue: boolean): string {
  if (status === "ok") return "#16a34a";
  if (status === "taken" || status === "invalid") return "#dc2626";
  if (hasValue) return "#c8860a";
  return "#2a2620";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const router = useRouter();

  const [screenname, setScreenname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [scrStatus, setScrStatus] = useState<ScrStatus>("idle");
  const [scrError, setScrError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<TurnstileInstance>(null);

  const strength = getStrength(password);

  // Debounced screenname availability check
  const checkScreenname = useCallback(async (value: string) => {
    const formatErr = validateScreenname(value);
    if (formatErr) {
      setScrStatus("invalid");
      setScrError("screenname can only use letters, numbers, and underscores.");
      return;
    }
    setScrStatus("checking");
    setScrError(null);
    try {
      const res = await fetch(
        `/api/auth/check-screenname?screenname=${encodeURIComponent(value)}`
      );
      const { available } = await res.json();
      setScrStatus(available ? "ok" : "taken");
      setScrError(available ? null : "that screenname is taken. try another.");
    } catch {
      setScrStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (!screenname) {
      setScrStatus("idle");
      setScrError(null);
      return;
    }
    const t = setTimeout(() => checkScreenname(screenname), 500);
    return () => clearTimeout(t);
  }, [screenname, checkScreenname]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (scrStatus !== "ok") {
      setError(scrError ?? "fix your screenname before continuing.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("valid email is required.");
      return;
    }
    if (password.length < 8) {
      setError("password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("passwords don't match.");
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("please complete the CAPTCHA.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate encryption keypair before registering so we can include the
      // public key in the registration request. The private key never leaves
      // the client — it is PBKDF2-encrypted and stored in localStorage.
      const mnemonic = generateBackupMnemonic();
      const { publicKey, secretKey } = mnemonicToKeypair(mnemonic);
      const mlkemPublicKey = toBase64(publicKey);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenname: screenname.trim(),
          email: email.trim(),
          password,
          mlkemPublicKey,
          turnstileToken,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Reset CAPTCHA so user can try again
        turnstileRef.current?.reset();
        setTurnstileToken("");
        setError(data.error ?? "something went wrong. try again.");
        return;
      }

      // Encrypt and persist secret key to localStorage keyed by userId
      await encryptAndStoreKey(data.id, secretKey, password);

      // Cache decrypted key for this session so the app can use it immediately
      cacheDecryptedKey(data.id, secretKey);

      // Store mnemonic in sessionStorage for the backup confirmation screen.
      // Also write to localStorage as a fallback in case the session ends
      // before onboarding (e.g. user opens verification link on another device).
      sessionStorage.setItem("signoff_pending_mnemonic", mnemonic);
      localStorage.setItem("signoff_pending_mnemonic", mnemonic);

      // Redirect to "check your inbox" — email verification required before login
      router.push(`/verify-email?screenname=${encodeURIComponent(screenname.trim())}`);
    } catch {
      setError("something went wrong. try again.");
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } finally {
      setLoading(false);
    }
  }

  const fieldBorder = (hasValue: boolean) => (hasValue ? "#c8860a" : "#2a2620");

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
    >
      <div className="w-full max-w-[400px] flex flex-col gap-8">

        {/* Logo */}
        <div className="text-center select-none">
          <h1
            className="font-vt323 leading-none tracking-widest"
            style={{ fontSize: 48, color: "#c8860a" }}
          >
            SIGNOFF.CHAT
          </h1>
          <p className="text-sm italic mt-2" style={{ color: "#6b6456" }}>
            speak freely. disconnect proudly.
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8 flex flex-col gap-5"
          style={{ background: "#1a1916", borderColor: "#2a2620" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

            {/* Screenname */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="screenname" className="text-xs font-medium" style={{ color: "#8a7d6e" }}>
                screenname
              </label>
              <div
                className="flex items-center h-[42px] rounded-lg border transition-colors"
                style={{
                  background: "#0f0e0c",
                  borderColor: scrBorderColor(scrStatus, !!screenname),
                }}
              >
                <span className="pl-3 text-sm select-none" style={{ color: "#6b6456" }}>@</span>
                <input
                  id="screenname"
                  type="text"
                  value={screenname}
                  onChange={(e) => setScreenname(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="username"
                  spellCheck={false}
                  maxLength={20}
                  disabled={loading}
                  placeholder="yourname"
                  className="flex-1 bg-transparent outline-none h-full px-1.5 text-sm disabled:opacity-50"
                  style={{ color: "#e8ddd0", caretColor: "#c8860a" }}
                />
                <span className="pr-3 flex items-center">
                  <ScrIndicator status={scrStatus} />
                </span>
              </div>
              {/* Hint — always visible; turns red when there's an error */}
              <p
                className="text-xs"
                style={{ color: scrError ? "#dc2626" : "#6b6456" }}
              >
                {scrError ?? "3–20 chars · letters, numbers, underscores only"}
              </p>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium" style={{ color: "#8a7d6e" }}>
                email
              </label>
              <div
                className="flex items-center h-[42px] rounded-lg border transition-colors"
                style={{ background: "#0f0e0c", borderColor: fieldBorder(!!email) }}
              >
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                  placeholder="you@example.com"
                  className="flex-1 bg-transparent outline-none h-full px-3 text-sm disabled:opacity-50"
                  style={{ color: "#e8ddd0", caretColor: "#c8860a" }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium" style={{ color: "#8a7d6e" }}>
                password
              </label>
              <div
                className="flex items-center h-[42px] rounded-lg border transition-colors"
                style={{ background: "#0f0e0c", borderColor: fieldBorder(!!password) }}
              >
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  className="flex-1 bg-transparent outline-none h-full pl-3 text-sm disabled:opacity-50"
                  style={{ color: "#e8ddd0", caretColor: "#c8860a" }}
                />
                <EyeToggle show={showPassword} onToggle={() => setShowPassword((s) => !s)} />
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "#2a2620" }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: strength.width, background: strength.color }}
                    />
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className="text-xs font-medium" style={{ color: "#8a7d6e" }}>
                confirm password
              </label>
              <div
                className="flex items-center h-[42px] rounded-lg border transition-colors"
                style={{ background: "#0f0e0c", borderColor: fieldBorder(!!confirm) }}
              >
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  className="flex-1 bg-transparent outline-none h-full pl-3 text-sm disabled:opacity-50"
                  style={{ color: "#e8ddd0", caretColor: "#c8860a" }}
                />
                <EyeToggle show={showConfirm} onToggle={() => setShowConfirm((s) => !s)} />
              </div>
            </div>

            {/* Turnstile CAPTCHA */}
            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken("")}
                  options={{ theme: "dark", size: "normal" }}
                />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
              className="flex items-center justify-center gap-2 h-[42px] rounded-lg text-sm font-semibold mt-1 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "#c8860a", color: "#fff" }}
            >
              {loading ? (
                <>
                  <Spinner />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </button>

            {/* Error */}
            {error && (
              <p className="text-sm text-center" style={{ color: "#c8860a" }}>
                {error}
              </p>
            )}

          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm" style={{ color: "#6b6456" }}>
          Already have one?{" "}
          <Link
            href="/login"
            className="font-medium transition-opacity hover:opacity-80"
            style={{ color: "#c8860a" }}
          >
            Sign in →
          </Link>
        </p>

      </div>
    </div>
  );
}
