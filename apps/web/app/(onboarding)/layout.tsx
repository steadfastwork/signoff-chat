"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

function SkipButton() {
  const { update } = useSession();
  const [skipping, setSkipping] = useState(false);

  async function handleSkip() {
    if (skipping) return;
    setSkipping(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
      await update();
    } finally {
      window.location.href = "/feed";
    }
  }

  return (
    <button
      type="button"
      onClick={handleSkip}
      disabled={skipping}
      className="text-[11px] font-mono transition-colors disabled:opacity-40"
      style={{ color: "var(--text-dim)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
    >
      {skipping ? "skipping…" : "skip setup →"}
    </button>
  );
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}
    >
      {/* Skip link — top-right corner on every onboarding screen */}
      <div className="flex justify-end px-6 pt-4">
        <SkipButton />
      </div>

      {children}
    </div>
  );
}
