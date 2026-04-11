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

export default function AwayPage() {
  const router = useRouter();
  const { data: session, update } = useSession();

  const [awayMessage, setAwayMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenname = session?.user?.screenname ?? "you";

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      if (awayMessage.trim()) {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ awayMessage: awayMessage.trim() }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "failed to save away message.");
          setLoading(false);
          return;
        }
      }

      await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 4 }),
      });
      await update();
      router.push("/onboarding/find-friends");
    } catch {
      setError("something went wrong. try again.");
      setLoading(false);
    }
  }

  async function handleSkip() {
    setLoading(true);
    try {
      await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 4 }),
      });
      await update();
      router.push("/onboarding/find-friends");
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px] flex flex-col">
        <ProgressDots current={3} />

        <h1
          className="font-vt323 tracking-widest mb-2 text-center"
          style={{ fontSize: 32, color: "#c8860a" }}
        >
          SET YOUR AWAY MESSAGE
        </h1>

        <p className="text-sm mb-6 text-center" style={{ color: "#8a7d6e" }}>
          Your away message lets buddies know what you&apos;re up to when you&apos;re not around.
        </p>

        {/* Textarea */}
        <div className="flex flex-col gap-1.5 mb-4">
          <textarea
            value={awayMessage}
            onChange={(e) => setAwayMessage(e.target.value)}
            maxLength={140}
            rows={3}
            placeholder="I am away from my computer right now..."
            disabled={loading}
            className="rounded-lg border px-3 py-2 text-sm outline-none resize-none disabled:opacity-50"
            style={{
              background: "#0f0e0c",
              borderColor: awayMessage ? "#c8860a" : "#2a2620",
              color: "#e8ddd0",
              caretColor: "#c8860a",
            }}
          />
          <p className="text-[11px] font-mono text-right" style={{ color: "#6b6456" }}>
            {awayMessage.length}/140
          </p>
        </div>

        {/* Preview */}
        {awayMessage.trim() && (
          <div
            className="rounded-lg border px-3 py-2 mb-6 text-sm font-mono"
            style={{ background: "#0f0e0c", borderColor: "#2a2620", color: "#c8860a" }}
          >
            <span style={{ color: "#8a7d6e" }}>{screenname}: </span>
            {awayMessage}
          </div>
        )}

        {error && (
          <p className="text-sm mb-4 text-center" style={{ color: "#ef4444" }}>
            {error}
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={loading}
          className="h-[44px] rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60 disabled:cursor-not-allowed mb-3"
          style={{ background: "#c8860a", color: "#fff" }}
        >
          {loading ? "Saving..." : "Continue →"}
        </button>

        <button
          onClick={handleSkip}
          disabled={loading}
          className="text-center text-[11px] font-mono transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ color: "#6b6456" }}
        >
          skip for now
        </button>
      </div>
    </div>
  );
}
