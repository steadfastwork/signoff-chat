"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { generateBackupMnemonic, mnemonicToKeypair } from "@/lib/crypto/keyBackup";
import { toBase64 } from "@/lib/crypto/index";
import { storeSecretKey, loadSecretKey } from "@/lib/crypto/keyStore";
import { cacheDecryptedKey, hasEncryptedKey, encryptAndStoreKey } from "@/lib/crypto/localKey";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "banner" | "password" | "generating" | "mnemonic" | "confirm" | "done";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickConfirmWords(words: string[]): Array<{ index: number; word: string }> {
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

export function EncryptionSetupPrompt() {
  const { data: session } = useSession();
  const [step, setStep] = useState<Step | null>(null); // null = loading
  const [dismissed, setDismissed] = useState(false);
  const [newKeyToast, setNewKeyToast] = useState(false);

  // Password step
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Mnemonic step
  const [mnemonic, setMnemonic] = useState("");
  const [words, setWords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Confirm step
  const [confirmWords, setConfirmWords] = useState<Array<{ index: number; word: string }>>([]);
  const [inputs, setInputs] = useState<string[]>(["", "", ""]);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // On mount: check if user needs encryption set up
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    (async () => {
      try {
        const data = await fetch("/api/profile/mlkem-pubkey").then((r) => r.json()) as {
          hasPublicKey: boolean;
        };

        if (!data.hasPublicKey) {
          // Brand-new user — check IndexedDB first, then localStorage
          const idxKey = await loadSecretKey(userId);
          if (idxKey) {
            // Has local key but no server key — upload it silently
            cacheDecryptedKey(userId, idxKey);
            setStep("done");
            return;
          }
          setStep("banner"); // needs setup
          return;
        }

        // Has a server public key — check for local secret key
        const idxKey = await loadSecretKey(userId);
        if (idxKey) {
          cacheDecryptedKey(userId, idxKey);
          setStep("done");
          return;
        }

        // Check legacy localStorage
        if (hasEncryptedKey(userId)) {
          setStep("done"); // legacy key present; will be decrypted on demand
          return;
        }

        // No local key at all — silently regenerate and update server
        const newMnemonic = generateBackupMnemonic();
        const { publicKey, secretKey } = mnemonicToKeypair(newMnemonic);
        const mlkemPublicKey = toBase64(publicKey);

        await storeSecretKey(userId, secretKey);
        cacheDecryptedKey(userId, secretKey);

        await fetch("/api/profile/mlkem-pubkey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mlkemPublicKey }),
        });

        setStep("done");
        setNewKeyToast(true);
        setTimeout(() => setNewKeyToast(false), 5000);
      } catch {
        setStep("done"); // fail silently
      }
    })();
  }, [session?.user?.id]);

  const openModal = useCallback(() => {
    setPassword("");
    setPasswordError(null);
    setStep("password");
  }, []);

  const handlePasswordSubmit = useCallback(async () => {
    if (!password || !session?.user?.id) return;
    setPasswordError(null);
    setStep("generating");

    try {
      const newMnemonic = generateBackupMnemonic();
      const { publicKey, secretKey } = mnemonicToKeypair(newMnemonic);
      const mlkemPublicKey = toBase64(publicKey);

      // Store in both IndexedDB (raw) and localStorage (password-encrypted)
      await storeSecretKey(session.user.id, secretKey);
      await encryptAndStoreKey(session.user.id, secretKey, password);
      cacheDecryptedKey(session.user.id, secretKey);

      // Upload public key to server
      const res = await fetch("/api/profile/mlkem-pubkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mlkemPublicKey }),
      });
      if (!res.ok) throw new Error("upload failed");

      // Move to mnemonic display
      const w = newMnemonic.split(" ");
      setMnemonic(newMnemonic);
      setWords(w);
      setConfirmWords(pickConfirmWords(w));
      setInputs(["", "", ""]);
      setStep("mnemonic");
    } catch {
      setPasswordError("something went wrong. try again.");
      setStep("password");
    }
  }, [password, session?.user?.id]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [mnemonic]);

  const handleConfirm = useCallback(async () => {
    if (saving) return;
    for (let i = 0; i < confirmWords.length; i++) {
      if (inputs[i].trim().toLowerCase() !== confirmWords[i].word.toLowerCase()) {
        setConfirmError(
          `word #${confirmWords[i].index + 1} is incorrect. check your phrase and try again.`
        );
        return;
      }
    }
    setSaving(true);
    setConfirmError(null);
    try {
      await fetch("/api/profile/mlkem-pubkey", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasConfirmedBackup: true }),
      });
      setStep("done");
    } catch {
      setConfirmError("something went wrong. try again.");
    } finally {
      setSaving(false);
    }
  }, [saving, confirmWords, inputs]);

  // Toast for silent key generation (new device / cleared data)
  if (newKeyToast) {
    return (
      <div
        className="fixed bottom-[60px] md:bottom-4 left-1/2 -translate-x-1/2 z-40
                   flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border
                   max-w-[400px] w-[calc(100%-2rem)] pointer-events-none"
        style={{
          background: "#0f1f0f",
          borderColor: "#22c55e33",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        <span className="text-base shrink-0">🔒</span>
        <p className="text-sm" style={{ color: "#86efac" }}>
          Encryption keys saved to this browser.
        </p>
      </div>
    );
  }

  // Nothing to show while loading, already done, or dismissed
  if (!step || step === "done" || dismissed) return null;

  const isModal = step !== "banner";

  return (
    <>
      {/* Banner — new user, no keys yet */}
      {step === "banner" && (
        <div
          className="fixed bottom-[60px] md:bottom-4 left-1/2 -translate-x-1/2 z-40
                     flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border
                     max-w-[480px] w-[calc(100%-2rem)]"
          style={{
            background: "#1a1916",
            borderColor: "#c8860a44",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          <span className="text-lg shrink-0">🔒</span>
          <p className="text-sm flex-1" style={{ color: "var(--text-muted)" }}>
            <span className="font-semibold" style={{ color: "var(--text)" }}>
              Set up end-to-end encryption
            </span>
            {" "}to protect your messages.
          </p>
          <button
            onClick={openModal}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: "#c8860a", color: "#fff" }}
          >
            set up
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 text-lg leading-none opacity-40 hover:opacity-70 transition-opacity"
            style={{ color: "var(--text)" }}
            aria-label="dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Modal overlay */}
      {isModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget && step !== "generating") {
              setStep("banner");
            }
          }}
        >
          <div
            className="w-full max-w-[480px] rounded-2xl border p-6 flex flex-col gap-5"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  className="font-vt323 tracking-widest text-2xl"
                  style={{ color: "#c8860a" }}
                >
                  {step === "password" && "SET UP ENCRYPTION"}
                  {step === "generating" && "GENERATING KEYS…"}
                  {step === "mnemonic" && "SAVE YOUR RECOVERY PHRASE"}
                  {step === "confirm" && "CONFIRM YOUR PHRASE"}
                </h2>
                <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
                  {step === "password" &&
                    "Enter your password to encrypt your private key before it's stored on this device."}
                  {step === "generating" && "Creating your ML-KEM-1024 keypair…"}
                  {step === "mnemonic" &&
                    "Write these 24 words down. They're the only way to restore your keys on a new device."}
                  {step === "confirm" &&
                    "Enter the requested words to confirm you've saved your phrase."}
                </p>
              </div>
              {step !== "generating" && (
                <button
                  onClick={() => setStep("banner")}
                  className="text-xl leading-none shrink-0 opacity-40 hover:opacity-70 transition-opacity mt-0.5"
                  style={{ color: "var(--text)" }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Password step */}
            {step === "password" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "#8a7d6e" }}>
                    your password
                  </label>
                  <div
                    className="flex items-center h-[42px] rounded-lg border transition-colors"
                    style={{
                      background: "var(--bg)",
                      borderColor: password ? "#c8860a" : "var(--border)",
                    }}
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && password && handlePasswordSubmit()}
                      autoComplete="current-password"
                      placeholder="your account password"
                      className="flex-1 bg-transparent outline-none h-full pl-3 text-sm"
                      style={{ color: "var(--text)", caretColor: "#c8860a" }}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((s) => !s)}
                      className="pr-3 text-xs select-none transition-colors"
                      style={{ color: "#6b6456" }}
                    >
                      {showPassword ? "hide" : "show"}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs" style={{ color: "#dc2626" }}>{passwordError}</p>
                  )}
                </div>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={!password}
                  className="h-[42px] rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: "#c8860a", color: "#fff" }}
                >
                  generate keys
                </button>
              </div>
            )}

            {/* Generating step */}
            {step === "generating" && (
              <div className="flex items-center justify-center py-6">
                <span
                  className="inline-block w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: "#c8860a33", borderTopColor: "#c8860a" }}
                />
              </div>
            )}

            {/* Mnemonic step */}
            {step === "mnemonic" && (
              <div className="flex flex-col gap-4">
                <div
                  className="rounded-xl border p-4"
                  style={{ background: "var(--bg)", borderColor: "var(--border)" }}
                >
                  <div className="grid grid-cols-4 gap-2">
                    {words.map((word, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span
                          className="text-[10px] font-mono w-4 text-right shrink-0"
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
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleCopy}
                    className="text-xs font-mono py-2 rounded-lg border transition-colors"
                    style={{
                      borderColor: "var(--border)",
                      color: copied ? "var(--teal)" : "var(--text-muted)",
                      background: "var(--bg)",
                    }}
                  >
                    {copied ? "✓ copied" : "copy to clipboard"}
                  </button>
                  <p className="text-xs text-center font-mono" style={{ color: "#c8860a" }}>
                    ⚠ never share this phrase. store it offline.
                  </p>
                  <button
                    onClick={() => setStep("confirm")}
                    className="h-[42px] rounded-lg text-sm font-semibold"
                    style={{ background: "#c8860a", color: "#fff" }}
                  >
                    I&apos;ve saved my phrase →
                  </button>
                </div>
              </div>
            )}

            {/* Confirm step */}
            {step === "confirm" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  {confirmWords.map(({ index }, i) => (
                    <div key={index} className="flex flex-col gap-1.5">
                      <label className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
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
                          setConfirmError(null);
                        }}
                        className="h-[38px] rounded-lg border px-3 text-sm outline-none"
                        style={{
                          background: "var(--bg)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#c8860a")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      />
                    </div>
                  ))}
                  {confirmError && (
                    <p className="text-xs font-mono" style={{ color: "#dc2626" }}>
                      {confirmError}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("mnemonic")}
                    className="flex-1 h-[42px] rounded-lg text-sm font-semibold border"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                      background: "var(--bg)",
                    }}
                  >
                    ← back
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={saving || inputs.some((v) => !v.trim())}
                    className="flex-1 h-[42px] rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: "#c8860a", color: "#fff" }}
                  >
                    {saving ? "saving…" : "confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
