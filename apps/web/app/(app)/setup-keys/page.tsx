"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isValidMnemonic } from "@/lib/crypto/keyBackup";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickConfirmWords(
  words: string[]
): Array<{ index: number; word: string }> {
  // Pick 3 non-overlapping positions to confirm
  const positions = new Set<number>();
  while (positions.size < 3) {
    positions.add(Math.floor(Math.random() * words.length));
  }
  return Array.from(positions)
    .sort((a, b) => a - b)
    .map((i) => ({ index: i, word: words[i] }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SetupKeysPage() {
  const router = useRouter();
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [step, setStep] = useState<"show" | "confirm">("show");
  const [confirmWords, setConfirmWords] = useState<
    Array<{ index: number; word: string }>
  >([]);
  const [inputs, setInputs] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("signoff_pending_mnemonic");
    if (!stored || !isValidMnemonic(stored)) {
      // No mnemonic — user navigated here directly or already confirmed
      router.replace("/feed");
      return;
    }
    setMnemonic(stored);
    setWords(stored.split(" "));
  }, [router]);

  const toConfirmStep = useCallback(() => {
    if (!words.length) return;
    setConfirmWords(pickConfirmWords(words));
    setInputs(["", "", ""]);
    setError(null);
    setStep("confirm");
  }, [words]);

  const handleCopy = useCallback(async () => {
    if (!mnemonic) return;
    await navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [mnemonic]);

  const handleConfirm = useCallback(async () => {
    if (saving) return;

    // Verify inputs
    for (let i = 0; i < confirmWords.length; i++) {
      if (inputs[i].trim().toLowerCase() !== confirmWords[i].word.toLowerCase()) {
        setError(
          `word #${confirmWords[i].index + 1} is incorrect. check your phrase and try again.`
        );
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/mlkem-pubkey", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasConfirmedBackup: true }),
      });
      if (!res.ok) throw new Error("failed to confirm");
      sessionStorage.removeItem("signoff_pending_mnemonic");
      router.push("/feed");
      router.refresh();
    } catch {
      setError("something went wrong. try again.");
    } finally {
      setSaving(false);
    }
  }, [saving, confirmWords, inputs, router]);

  if (!mnemonic) return null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ fontFamily: "var(--font-dm-sans)", background: "var(--bg)" }}
    >
      <div className="w-full max-w-[520px] flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="text-2xl mb-2">🔒</div>
          <h1
            className="font-vt323 tracking-widest text-3xl"
            style={{ color: "var(--amber)" }}
          >
            SAVE YOUR RECOVERY PHRASE
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            {step === "show"
              ? "These 24 words are the only way to recover your encryption keys on a new device. Write them down somewhere safe."
              : "Confirm you've saved your phrase by entering the requested words."}
          </p>
        </div>

        {step === "show" && (
          <>
            {/* Word grid */}
            <div
              className="rounded-xl border p-5"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="grid grid-cols-4 gap-2">
                {words.map((word, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                  >
                    <span
                      className="text-[10px] font-mono w-5 text-right shrink-0"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {word}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Copy + warning */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-mono py-2 rounded-lg border transition-colors"
                style={{
                  borderColor: "var(--border)",
                  color: copied ? "var(--teal)" : "var(--text-muted)",
                  background: "var(--surface)",
                }}
              >
                {copied ? "✓ copied" : "copy to clipboard"}
              </button>
              <p
                className="text-xs text-center font-mono"
                style={{ color: "#c8860a" }}
              >
                ⚠ never share this phrase. store it offline.
              </p>
              <button
                type="button"
                onClick={toConfirmStep}
                className="h-[42px] rounded-lg text-sm font-semibold transition-opacity"
                style={{ background: "#c8860a", color: "#fff" }}
              >
                I&apos;ve saved my phrase →
              </button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div
              className="rounded-xl border p-5 flex flex-col gap-4"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              {confirmWords.map(({ index }, i) => (
                <div key={index} className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    word #{index + 1}
                  </label>
                  <input
                    type="text"
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    value={inputs[i]}
                    onChange={(e) => {
                      const next = [...inputs];
                      next[i] = e.target.value;
                      setInputs(next);
                      setError(null);
                    }}
                    className="h-[38px] rounded-lg border px-3 text-sm outline-none"
                    style={{
                      background: "var(--bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                      fontFamily: "var(--font-dm-sans)",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#c8860a")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </div>
              ))}
            </div>

            {error && (
              <p className="text-sm text-center font-mono" style={{ color: "#dc2626" }}>
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("show")}
                className="flex-1 h-[42px] rounded-lg text-sm font-semibold border transition-opacity"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                  background: "var(--surface)",
                }}
              >
                ← back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving || inputs.some((v) => !v.trim())}
                className="flex-1 h-[42px] rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ background: "#c8860a", color: "#fff" }}
              >
                {saving ? "saving…" : "confirm"}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
