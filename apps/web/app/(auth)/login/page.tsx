"use client";

import { useState, useRef, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <span
      className="inline-block w-[14px] h-[14px] rounded-full border-2 animate-spin shrink-0"
      style={{ borderColor: "rgba(255,255,255,0.25)", borderTopColor: "#fff" }}
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
// Form — wrapped in Suspense for useSearchParams
// ---------------------------------------------------------------------------

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get("registered") === "1";

  const [screenname, setScreenname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!screenname.trim() || !password || loading) return;

    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      screenname: screenname.trim(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("wrong screenname or password. try again.");
    } else {
      router.push("/feed");
      router.refresh();
    }
  }

  const borderColor = (hasValue: boolean) =>
    hasValue ? "#c8860a" : "#2a2620";

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
          {justRegistered && !error && (
            <p className="text-sm rounded-lg px-3 py-2.5" style={{ background: "#0d1f0d", color: "#4ade80" }}>
              account created — sign in below.
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

            {/* Screenname */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="screenname" className="text-xs font-medium" style={{ color: "#8a7d6e" }}>
                screenname
              </label>
              <div
                className="flex items-center h-[42px] rounded-lg border transition-colors"
                style={{ background: "#0f0e0c", borderColor: borderColor(!!screenname) }}
              >
                <span className="pl-3 text-sm select-none" style={{ color: "#6b6456" }}>@</span>
                <input
                  ref={inputRef}
                  id="screenname"
                  type="text"
                  value={screenname}
                  onChange={(e) => setScreenname(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="username"
                  spellCheck={false}
                  disabled={loading}
                  placeholder="yourname"
                  className="flex-1 bg-transparent outline-none h-full px-1.5 text-sm disabled:opacity-50"
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
                style={{ background: "#0f0e0c", borderColor: borderColor(!!password) }}
              >
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  className="flex-1 bg-transparent outline-none h-full pl-3 text-sm disabled:opacity-50"
                  style={{ color: "#e8ddd0", caretColor: "#c8860a" }}
                />
                <EyeToggle show={showPassword} onToggle={() => setShowPassword((s) => !s)} />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !screenname.trim() || !password}
              className="flex items-center justify-center gap-2 h-[42px] rounded-lg text-sm font-semibold mt-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#c8860a", color: "#fff" }}
            >
              {loading ? (
                <>
                  <Spinner />
                  Signing in...
                </>
              ) : (
                "Sign in"
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
          New here?{" "}
          <Link
            href="/register"
            className="font-medium transition-opacity hover:opacity-80"
            style={{ color: "#c8860a" }}
          >
            Get a screenname →
          </Link>
        </p>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
