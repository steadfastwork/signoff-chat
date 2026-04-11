"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

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

export default function DonePage() {

  const { update } = useSession();

  const [founderAwarded, setFounderAwarded] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function completeOnboarding() {
      try {
        const res = await fetch("/api/onboarding/complete", {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          setFounderAwarded(data.founderAwarded ?? false);
        }
        // Refresh JWT so onboardingComplete=true in token
        await update();
      } finally {
        setReady(true);
      }
    }
    completeOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEnter() {
    setLoading(true);
    window.location.href = "/feed";
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px] flex flex-col items-center">
        <ProgressDots current={5} />

        {!ready ? (
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ background: "#c8860a" }}
          />
        ) : (
          <>
            {founderAwarded && (
              <div className="mb-6 text-center">
                <p
                  className="font-vt323 tracking-widest leading-none"
                  style={{ fontSize: 40, color: "#c8860a" }}
                >
                  ⚡ YOU&apos;RE A FOUNDER
                </p>
                <p className="text-sm mt-2" style={{ color: "#8a7d6e" }}>
                  You&apos;re one of the first 100 members of Signoff Chat.
                </p>
              </div>
            )}

            <h1
              className="font-vt323 tracking-widest mb-4 text-center"
              style={{ fontSize: 36, color: "#c8860a" }}
            >
              WELCOME TO SIGNOFF CHAT
            </h1>

            <p className="text-sm mb-8 text-center" style={{ color: "#8a7d6e" }}>
              You&apos;re all set. Your encryption keys are active and your profile is ready.
            </p>

            <button
              onClick={handleEnter}
              disabled={loading}
              className="h-[44px] px-8 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "#c8860a", color: "#fff" }}
            >
              {loading ? "Loading..." : "Enter Signoff →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
