"use client";

/**
 * useKeyInit — auto-initialise encryption keys for a signed-in user.
 *
 * On each mount (in the app shell) this hook:
 *   1. Checks IndexedDB / localStorage for an existing secret key (fast-path).
 *   2. If not found, asks the server whether a public key is on file.
 *   3a. No server key  → generates a fresh ML-KEM-1024 keypair, stores the
 *       secret key in IndexedDB, uploads the public key, stashes the 24-word
 *       mnemonic in sessionStorage, then redirects to /setup-keys.
 *   3b. Server key found but no local copy → redirects to /recover-keys.
 *
 * Pages listed in SKIP_PATHS are excluded from the redirect check to avoid
 * redirect loops.
 */

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { toBase64 } from "@/lib/crypto/index";
import { generateBackupMnemonic, mnemonicToKeypair } from "@/lib/crypto/keyBackup";
import { storeSecretKey, hasStoredSecretKey } from "@/lib/crypto/keyStore";
import { hasEncryptedKey } from "@/lib/crypto/localKey";

const SKIP_PATHS = [
  "/setup-keys",
  "/recover-keys",
  "/login",
  "/register",
  "/onboarding",
];

export function useKeyInit() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const didRun = useRef(false);

  useEffect(() => {
    if (authStatus !== "authenticated" || !session?.user?.id) return;
    if (SKIP_PATHS.some((p) => pathname?.startsWith(p))) return;
    if (didRun.current) return;
    didRun.current = true;

    const userId = session.user.id;

    async function init() {
      // Fast-path: key already stored on this device
      const [inIDB, inLS] = await Promise.all([
        hasStoredSecretKey(userId).catch(() => false),
        Promise.resolve(hasEncryptedKey(userId)),
      ]);
      if (inIDB || inLS) return;

      // Check server
      let data: { hasPublicKey: boolean } | null = null;
      try {
        const res = await fetch("/api/profile/mlkem-pubkey");
        if (!res.ok) return; // Don't block app on network failure
        data = (await res.json()) as { hasPublicKey: boolean };
      } catch {
        return;
      }

      if (!data.hasPublicKey) {
        // First device ever — generate a fresh keypair
        const mnemonic = generateBackupMnemonic();
        const { publicKey, secretKey } = mnemonicToKeypair(mnemonic);

        // Persist secret key locally
        await storeSecretKey(userId, secretKey);

        // Upload public key to server
        try {
          const up = await fetch("/api/profile/mlkem-pubkey", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mlkemPublicKey: toBase64(publicKey) }),
          });
          if (!up.ok) return;
        } catch {
          return;
        }

        // Stash mnemonic in sessionStorage so setup-keys page can display it
        sessionStorage.setItem("signoff_pending_mnemonic", mnemonic);
        router.push("/setup-keys");
      } else {
        // Has a server public key but no local secret key → must recover
        router.push("/recover-keys");
      }
    }

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, session?.user?.id, pathname]);
}
