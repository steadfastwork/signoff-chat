/**
 * Signoff Chat — Key Backup via BIP39 Mnemonic
 *
 * A 24-word BIP39 mnemonic encodes 256 bits of entropy.
 * That entropy deterministically derives the user's ML-KEM-1024 keypair.
 *
 * Without the mnemonic (or password-encrypted secret key in localStorage),
 * historical messages on a new device CANNOT be decrypted. This is by design.
 *
 * IMPORTANT: The phrase is shown ONCE, immediately after first key generation.
 * NEVER store the phrase on the server — only { hasConfirmedBackup: true }.
 */

import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { hkdf, sha256, HKDF_SEED_INFO } from "@/lib/crypto/index";
import { toBase64 } from "@/lib/crypto/index";

// ---------------------------------------------------------------------------
// Derive ML-KEM seed from BIP39 entropy
// ---------------------------------------------------------------------------

function mnemonicToMLKEMSeed(mnemonic: string): Uint8Array {
  const bip39Seed = mnemonicToSeedSync(mnemonic); // 64 bytes from BIP39 PBKDF2
  // Derive 64-byte ML-KEM keygen seed (d ∥ z in NIST FIPS 203 notation)
  return hkdf(sha256, bip39Seed, undefined, HKDF_SEED_INFO, 64);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a fresh 24-word BIP39 mnemonic (256 bits of entropy).
 * Call this once at first key generation; show it to the user immediately.
 */
export function generateBackupMnemonic(): string {
  return generateMnemonic(wordlist, 256);
}

/**
 * Deterministically derive the ML-KEM-1024 secret key from a mnemonic.
 * Used for key recovery on a new device.
 */
export function mnemonicToSecretKey(mnemonic: string): Uint8Array {
  const seed = mnemonicToMLKEMSeed(mnemonic.trim().toLowerCase());
  const { secretKey } = ml_kem1024.keygen(seed);
  return secretKey;
}

/**
 * Derive the full keypair from a mnemonic (used during recovery to
 * re-upload the public key if needed).
 */
export function mnemonicToKeypair(mnemonic: string): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  const seed = mnemonicToMLKEMSeed(mnemonic.trim().toLowerCase());
  return ml_kem1024.keygen(seed);
}

/**
 * Verify that a mnemonic correctly produces the expected public key.
 * Returns true if the mnemonic would regenerate this public key.
 */
export function verifyMnemonic(mnemonic: string, publicKeyB64: string): boolean {
  if (!validateMnemonic(mnemonic.trim().toLowerCase(), wordlist)) return false;
  try {
    const { publicKey } = mnemonicToKeypair(mnemonic);
    const expected = Buffer.from(publicKeyB64, "base64");
    const derived = Buffer.from(publicKey);
    return expected.length === derived.length && expected.equals(derived);
  } catch {
    return false;
  }
}

/**
 * Validate that a string is a valid BIP39 mnemonic (word list check + checksum).
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim().toLowerCase(), wordlist);
}

/**
 * Generate a keypair from the mnemonic and return the public key as base64.
 * Useful when displaying the user's public key fingerprint during backup confirmation.
 */
export function mnemonicToPublicKeyB64(mnemonic: string): string {
  const { publicKey } = mnemonicToKeypair(mnemonic);
  return toBase64(publicKey);
}
