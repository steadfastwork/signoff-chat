"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex gap-2 justify-center mb-8">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-colors"
          style={{ background: i <= current ? "#c8860a" : "#2a2620" }}
        />
      ))}
    </div>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(false);

  async function handleGetStarted() {
    setLoading(true);
    try {
      await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 1 }),
      });
      await update();
      router.push("/onboarding/account");
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px] flex flex-col items-center">
        <ProgressDots current={0} />

        {/* Logo */}
        <h1
          className="font-vt323 leading-none tracking-widest mb-4"
          style={{ fontSize: 56, color: "#c8860a" }}
        >
          SIGNOFF.CHAT
        </h1>

        <p className="text-lg font-medium mb-2 text-center" style={{ color: "#e8ddd0" }}>
          The internet&apos;s favorite IM client is back.
        </p>
        <p className="text-sm mb-10 text-center" style={{ color: "#6b6456" }}>
          Set up your account in a few quick steps.
        </p>

        <button
          onClick={handleGetStarted}
          disabled={loading}
          className="h-[44px] px-8 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "#c8860a", color: "#fff" }}
        >
          {loading ? "Loading..." : "Get Started →"}
        </button>
      </div>
    </div>
  );
}
