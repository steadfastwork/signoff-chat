"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

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

function pickQuizPositions(total: number): number[] {
  const positions: number[] = [];
  while (positions.length < 3) {
    const pos = Math.floor(Math.random() * total);
    if (!positions.includes(pos)) positions.push(pos);
  }
  return positions.sort((a, b) => a - b);
}

export default function KeysPage() {
  const router = useRouter();
  const { update } = useSession();

  const [mnemonic, setMnemonic] = useState<string[] | null>(null);
  const [noMnemonic, setNoMnemonic] = useState(false);
  const [step, setStep] = useState<"show" | "quiz">("show");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quiz state
  const [quizPositions, setQuizPositions] = useState<number[]>([]);
  const [quizInputs, setQuizInputs] = useState<string[]>(["", "", ""]);
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    // Check sessionStorage first; fall back to localStorage for users who
    // verified their email in a separate tab/device after registration.
    const stored =
      sessionStorage.getItem("signoff_pending_mnemonic") ??
      localStorage.getItem("signoff_pending_mnemonic");
    if (!stored) {
      setNoMnemonic(true);
      return;
    }
    const words = stored.trim().split(/\s+/);
    setMnemonic(words);
    setQuizPositions(pickQuizPositions(words.length));
  }, []);

  const handleCopy = useCallback(() => {
    if (!mnemonic) return;
    navigator.clipboard.writeText(mnemonic.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [mnemonic]);

  async function handleSkipToAway() {
    setLoading(true);
    try {
      await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 3 }),
      });
      await update();
      router.push("/onboarding/away");
    } catch {
      setLoading(false);
    }
  }

  async function handleQuizContinue() {
    if (!mnemonic) return;
    setQuizError(null);

    const allCorrect = quizPositions.every(
      (pos, idx) =>
        quizInputs[idx].trim().toLowerCase() === mnemonic[pos].toLowerCase()
    );

    if (!allCorrect) {
      setQuizError("one or more words are incorrect. check your phrase and try again.");
      return;
    }

    setLoading(true);
    try {
      // Mark backup as confirmed
      await fetch("/api/profile/mlkem-pubkey", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasConfirmedBackup: true }),
      });

      // Clear mnemonic from both storage locations
      sessionStorage.removeItem("signoff_pending_mnemonic");
      localStorage.removeItem("signoff_pending_mnemonic");

      // Advance step
      await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 3 }),
      });
      await update();
      router.push("/onboarding/away");
    } catch {
      setError("something went wrong. try again.");
      setLoading(false);
    }
  }

  // No mnemonic found — already set up
  if (noMnemonic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[520px] flex flex-col items-center">
          <ProgressDots current={2} />
          <h1
            className="font-vt323 tracking-widest mb-4 text-center"
            style={{ fontSize: 32, color: "#c8860a" }}
          >
            SAVE YOUR RECOVERY PHRASE
          </h1>
          <p className="text-sm mb-8 text-center" style={{ color: "#8a7d6e" }}>
            Your encryption keys have been set up already.
          </p>
          <button
            onClick={handleSkipToAway}
            disabled={loading}
            className="h-[44px] px-8 rounded-lg font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "#c8860a", color: "#fff" }}
          >
            {loading ? "Loading..." : "Continue →"}
          </button>
        </div>
      </div>
    );
  }

  if (!mnemonic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#c8860a" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px] flex flex-col">
        <ProgressDots current={2} />

        <h1
          className="font-vt323 tracking-widest mb-2 text-center"
          style={{ fontSize: 32, color: "#c8860a" }}
        >
          SAVE YOUR RECOVERY PHRASE
        </h1>

        {step === "show" && (
          <>
            <p className="text-sm mb-6 text-center" style={{ color: "#8a7d6e" }}>
              Write down these 24 words in order and keep them somewhere safe.
            </p>

            {/* Word grid — 4 columns */}
            <div
              className="rounded-lg border p-4 mb-4 grid gap-2"
              style={{
                background: "#0f0e0c",
                borderColor: "#2a2620",
                gridTemplateColumns: "repeat(4, 1fr)",
              }}
            >
              {mnemonic.map((word, i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-1 px-1 py-0.5 rounded"
                  style={{ background: "#1a1916" }}
                >
                  <span
                    className="font-mono text-[10px] w-5 text-right shrink-0 select-none"
                    style={{ color: "#4a4438" }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="font-mono text-xs font-semibold truncate"
                    style={{ color: "#e8ddd0" }}
                  >
                    {word}
                  </span>
                </div>
              ))}
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="text-xs font-mono mb-4 self-center transition-opacity hover:opacity-80"
              style={{ color: copied ? "#16a34a" : "#6b6456" }}
            >
              {copied ? "✓ copied to clipboard" : "copy to clipboard"}
            </button>

            {/* Warning */}
            <p
              className="text-[11px] font-mono text-center mb-6"
              style={{ color: "#c8860a" }}
            >
              ⚠ never share this phrase. store it offline.
            </p>

            <button
              onClick={() => setStep("quiz")}
              className="h-[44px] rounded-lg font-semibold text-sm"
              style={{ background: "#c8860a", color: "#fff" }}
            >
              I&apos;ve saved my phrase →
            </button>
          </>
        )}

        {step === "quiz" && (
          <>
            <p className="text-sm mb-6 text-center" style={{ color: "#8a7d6e" }}>
              Verify your phrase. Enter the words at these positions:
            </p>

            <div className="flex flex-col gap-4 mb-6">
              {quizPositions.map((pos, idx) => (
                <div key={pos} className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono" style={{ color: "#8a7d6e" }}>
                    word #{pos + 1}
                  </label>
                  <input
                    type="text"
                    value={quizInputs[idx]}
                    onChange={(e) => {
                      const next = [...quizInputs];
                      next[idx] = e.target.value;
                      setQuizInputs(next);
                      setQuizError(null);
                    }}
                    disabled={loading}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={`word #${pos + 1}`}
                    className="h-[42px] rounded-lg border px-3 text-sm font-mono outline-none disabled:opacity-50"
                    style={{
                      background: "#0f0e0c",
                      borderColor: quizInputs[idx] ? "#c8860a" : "#2a2620",
                      color: "#e8ddd0",
                      caretColor: "#c8860a",
                    }}
                  />
                </div>
              ))}
            </div>

            {quizError && (
              <p className="text-sm mb-4 text-center" style={{ color: "#ef4444" }}>
                {quizError}
              </p>
            )}
            {error && (
              <p className="text-sm mb-4 text-center" style={{ color: "#ef4444" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleQuizContinue}
              disabled={
                loading ||
                quizInputs.some((v) => !v.trim())
              }
              className="h-[44px] rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60 disabled:cursor-not-allowed mb-3"
              style={{ background: "#c8860a", color: "#fff" }}
            >
              {loading ? "Verifying..." : "Continue →"}
            </button>

            <button
              onClick={() => {
                setStep("show");
                setQuizInputs(["", "", ""]);
                setQuizError(null);
              }}
              disabled={loading}
              className="text-center text-[11px] font-mono transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ color: "#6b6456" }}
            >
              ← back to phrase
            </button>
          </>
        )}
      </div>
    </div>
  );
}
