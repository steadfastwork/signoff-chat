"use client";

/**
 * Key Recovery Page
 *
 * Allows an authenticated user who has lost their local encryption key
 * (e.g., cleared localStorage, new device) to restore it using their
 * 24-word BIP39 recovery phrase.
 *
 * Flow:
 *   1. User enters their 24 words (space-separated or word-by-word)
 *   2. Client fetches the user's stored public key from the server
 *   3. Client verifies the mnemonic produces the same public key
 *   4. Client derives the secret key, PBKDF2-encrypts it, stores in localStorage
 *   5. Caches decrypted key in sessionStorage for this session
 *   6. Redirect to feed
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { isValidMnemonic, verifyMnemonic, mnemonicToSecretKey } from "@/lib/crypto/keyBackup";
import { encryptAndStoreKey, cacheDecryptedKey, hasEncryptedKey } from "@/lib/crypto/localKey";

type Step = "phrase" | "password" | "verifying" | "done" | "nokey";

export default function RecoverKeysPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>("phrase");

  // Phrase step
  const [phraseInput, setPhraseInput] = useState("");
  const [phraseError, setPhraseError] = useState<string | null>(null);

  // Password step
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const phraseRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // If user already has a local key, nothing to recover
    if (session?.user?.id && hasEncryptedKey(session.user.id)) {
      router.replace("/feed");
    }
  }, [session?.user?.id, router]);

  useEffect(() => {
    phraseRef.current?.focus();
  }, []);

  const handlePhraseNext = useCallback(() => {
    setPhraseError(null);
    const normalized = phraseInput.trim().toLowerCase().replace(/\s+/g, " ");
    if (!isValidMnemonic(normalized)) {
      setPhraseError("invalid recovery phrase — check all 24 words and try again.");
      return;
    }
    setStep("password");
  }, [phraseInput]);

  const handleRestore = useCallback(async () => {
    if (!session?.user?.id || saving) return;
    setSaving(true);
    setPasswordError(null);

    try {
      // Fetch the user's stored public key from the server
      const res = await fetch("/api/profile/mlkem-pubkey");
      if (!res.ok) throw new Error("could not reach server");
      const data = (await res.json()) as { hasPublicKey: boolean; mlkemPublicKey: string | null };

      if (!data.hasPublicKey || !data.mlkemPublicKey) {
        setStep("nokey");
        return;
      }

      const normalized = phraseInput.trim().toLowerCase().replace(/\s+/g, " ");

      // Verify mnemonic matches the stored public key
      if (!verifyMnemonic(normalized, data.mlkemPublicKey)) {
        setPasswordError("recovery phrase does not match the keys on this account. check each word carefully.");
        setSaving(false);
        return;
      }

      // Derive the secret key and encrypt it for this device
      const secretKey = mnemonicToSecretKey(normalized);
      await encryptAndStoreKey(session.user.id, secretKey, password);
      cacheDecryptedKey(session.user.id, secretKey);

      setStep("done");
      setTimeout(() => router.push("/feed"), 1500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "something went wrong. try again.");
    } finally {
      setSaving(false);
    }
  }, [session?.user?.id, saving, phraseInput, password, router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ fontFamily: "var(--font-dm-sans)", background: "var(--bg)" }}
    >
      <div className="w-full max-w-[480px] flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="text-2xl mb-2">🔑</div>
          <h1
            className="font-vt323 tracking-widest text-3xl"
            style={{ color: "var(--amber)" }}
          >
            RESTORE ENCRYPTION KEYS
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            {step === "phrase" && "Enter your 24-word recovery phrase to restore your encryption keys on this device."}
            {step === "password" && "Set a password to encrypt your keys on this device."}
            {step === "verifying" && "Verifying your recovery phrase…"}
            {step === "done" && "Keys restored successfully."}
            {step === "nokey" && "No encryption keys found on this account."}
          </p>
        </div>

        {/* Phrase entry */}
        {step === "phrase" && (
          <div
            className="rounded-xl border p-5 flex flex-col gap-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                recovery phrase (24 words separated by spaces)
              </label>
              <textarea
                ref={phraseRef}
                value={phraseInput}
                onChange={(e) => { setPhraseInput(e.target.value); setPhraseError(null); }}
                placeholder="word1 word2 word3 … word24"
                rows={4}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border px-3 py-2.5 text-sm font-mono outline-none resize-none"
                style={{
                  background: "var(--bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                  caretColor: "var(--amber)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--amber)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePhraseNext();
                }}
              />
              {phraseError && (
                <p className="text-xs font-mono" style={{ color: "#ef4444" }}>
                  {phraseError}
                </p>
              )}
              <p className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
                {phraseInput.trim().split(/\s+/).filter(Boolean).length} / 24 words entered
              </p>
            </div>

            <button
              type="button"
              onClick={handlePhraseNext}
              disabled={phraseInput.trim().split(/\s+/).filter(Boolean).length < 24}
              className="h-[42px] rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: "var(--amber)", color: "#fff8e6" }}
            >
              next →
            </button>
          </div>
        )}

        {/* Password entry */}
        {step === "password" && (
          <div
            className="rounded-xl border p-5 flex flex-col gap-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                password (to encrypt your keys on this device)
              </label>
              <div
                className="flex items-center h-[42px] rounded-lg border transition-colors"
                style={{ background: "var(--bg)", borderColor: password ? "var(--amber)" : "var(--border)" }}
              >
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && password && void handleRestore()}
                  autoComplete="current-password"
                  placeholder="your account password"
                  className="flex-1 bg-transparent outline-none h-full pl-3 text-sm"
                  style={{ color: "var(--text)", caretColor: "var(--amber)" }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((s) => !s)}
                  className="pr-3 text-xs select-none"
                  style={{ color: "var(--text-dim)" }}
                >
                  {showPassword ? "hide" : "show"}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs font-mono" style={{ color: "#ef4444" }}>
                  {passwordError}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep("phrase"); setPasswordError(null); }}
                className="h-[42px] flex-shrink-0 px-4 rounded-lg text-sm font-semibold border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg)" }}
              >
                ← back
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={!password || saving}
                className="flex-1 h-[42px] rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ background: "var(--amber)", color: "#fff8e6" }}
              >
                {saving ? "restoring…" : "restore keys"}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div
            className="rounded-xl border p-6 flex flex-col items-center gap-3 text-center"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <span className="text-3xl">✓</span>
            <p className="text-sm font-semibold" style={{ color: "var(--teal)" }}>
              Keys restored successfully
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Your encryption keys are now available on this device. Redirecting to feed…
            </p>
          </div>
        )}

        {/* No key on account */}
        {step === "nokey" && (
          <div
            className="rounded-xl border p-6 flex flex-col items-center gap-3 text-center"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <span className="text-3xl">🔓</span>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              No encryption keys found
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              This account doesn&apos;t have encryption keys set up yet. You can set them up from the app.
            </p>
            <Link
              href="/feed"
              className="text-xs font-mono"
              style={{ color: "var(--amber)" }}
            >
              → go to feed
            </Link>
          </div>
        )}

        {/* Back link */}
        {step !== "done" && step !== "nokey" && (
          <p className="text-center text-xs" style={{ color: "var(--text-dim)" }}>
            <Link href="/feed" style={{ color: "var(--text-dim)" }}>
              cancel and go back
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
