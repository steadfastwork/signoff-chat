"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function Spinner() {
  return (
    <span
      className="inline-block w-[14px] h-[14px] rounded-full border-2 animate-spin shrink-0"
      style={{ borderColor: "rgba(200,134,10,0.25)", borderTopColor: "#c8860a" }}
      aria-hidden
    />
  );
}

function VerifyEmailContent() {
  const params = useSearchParams();
  const screenname = params.get("screenname") ?? "";

  const [resendState, setResendState] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleResend() {
    if (!screenname || resendState === "loading" || resendState === "sent") return;
    setResendState("loading");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenname }),
      });
      setResendState(res.ok ? "sent" : "error");
    } catch {
      setResendState("error");
    }
  }

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
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8 flex flex-col gap-4"
          style={{ background: "#1a1916", borderColor: "#2a2620" }}
        >
          {/* Icon */}
          <div className="text-center text-3xl select-none">✉</div>

          <h2
            className="text-center font-semibold text-base"
            style={{ color: "#e8ddd0" }}
          >
            Check your inbox
          </h2>

          <p className="text-sm text-center" style={{ color: "#8a7d6e" }}>
            We sent a verification link to the email address you registered
            with. Click it to activate your account.
          </p>

          <p className="text-xs text-center" style={{ color: "#6b6055" }}>
            The link expires in 24 hours.
          </p>

          {/* Resend */}
          <div className="mt-2">
            {resendState === "sent" ? (
              <p className="text-sm text-center rounded-lg px-3 py-2.5" style={{ background: "#0d1f0d", color: "#4ade80" }}>
                New verification email sent.
              </p>
            ) : resendState === "error" ? (
              <p className="text-sm text-center" style={{ color: "#c8860a" }}>
                Something went wrong. Try again in a moment.
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendState === "loading" || !screenname}
                className="w-full flex items-center justify-center gap-2 h-[40px] rounded-lg text-sm font-medium border transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderColor: "#2a2620", color: "#8a7d6e", background: "transparent" }}
              >
                {resendState === "loading" ? (
                  <><Spinner /> Sending...</>
                ) : (
                  "Resend verification email"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm" style={{ color: "#6b6055" }}>
          Already verified?{" "}
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

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
