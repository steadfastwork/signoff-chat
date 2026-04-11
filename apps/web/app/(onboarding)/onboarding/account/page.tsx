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

export default function AccountPage() {
  const router = useRouter();
  const { update } = useSession();

  const [aimScreenname, setAimScreenname] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function hashScreenname(screenname: string): Promise<string> {
    const normalized = screenname.trim().toLowerCase();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      // Save AIM screenname hash if provided
      if (aimScreenname.trim()) {
        const hash = await hashScreenname(aimScreenname);
        await fetch("/api/onboarding/aim-screenname", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hash }),
        });
      }

      // Save bio if provided
      if (bio.trim()) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bio: bio.trim() }),
        });
      }

      // Advance step
      await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 2 }),
      });
      await update();
      router.push("/onboarding/keys");
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
        body: JSON.stringify({ step: 2 }),
      });
      await update();
      router.push("/onboarding/keys");
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px] flex flex-col">
        <ProgressDots current={1} />

        <h1
          className="font-vt323 tracking-widest mb-6 text-center"
          style={{ fontSize: 32, color: "#c8860a" }}
        >
          SET UP YOUR PROFILE
        </h1>

        {/* AIM Screenname */}
        <div className="flex flex-col gap-1.5 mb-5">
          <label className="text-xs font-medium" style={{ color: "#8a7d6e" }}>
            what was your AIM screenname? <span style={{ color: "#6b6456" }}>(optional)</span>
          </label>
          <input
            type="text"
            value={aimScreenname}
            onChange={(e) => setAimScreenname(e.target.value)}
            maxLength={20}
            placeholder="CoolDude123"
            disabled={loading}
            className="h-[42px] rounded-lg border px-3 text-sm outline-none bg-transparent disabled:opacity-50"
            style={{
              background: "#0f0e0c",
              borderColor: aimScreenname ? "#c8860a" : "#2a2620",
              color: "#e8ddd0",
              caretColor: "#c8860a",
            }}
          />
          <p className="text-[11px] font-mono" style={{ color: "#6b6456" }}>
            We never store your old screenname — just a privacy-preserving hash.
          </p>
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-1.5 mb-8">
          <label className="text-xs font-medium" style={{ color: "#8a7d6e" }}>
            write a bio <span style={{ color: "#6b6456" }}>(optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder="Tell people a bit about yourself..."
            disabled={loading}
            className="rounded-lg border px-3 py-2 text-sm outline-none resize-none disabled:opacity-50"
            style={{
              background: "#0f0e0c",
              borderColor: bio ? "#c8860a" : "#2a2620",
              color: "#e8ddd0",
              caretColor: "#c8860a",
            }}
          />
          <p className="text-[11px] font-mono text-right" style={{ color: "#6b6456" }}>
            {bio.length}/160
          </p>
        </div>

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
