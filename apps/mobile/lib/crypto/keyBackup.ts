/**
 * Mobile — Key Backup via BIP39 Mnemonic
 *
 * Mirrors /apps/web/lib/crypto/keyBackup.ts — kept separate since
 * the monorepo shared-packages layer isn't live yet.
 */

import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

const HKDF_SEED_INFO = new TextEncoder().encode("signoff-mlkem-seed");

function mnemonicToMLKEMSeed(mnemonic: string): Uint8Array {
  const bip39Seed = mnemonicToSeedSync(mnemonic);
  return hkdf(sha256, bip39Seed, undefined, HKDF_SEED_INFO, 64);
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Generate a fresh 24-word BIP39 mnemonic (256 bits of entropy). */
export function generateBackupMnemonic(): string {
  return generateMnemonic(wordlist, 256);
}

/** Derive the ML-KEM-1024 keypair from a 24-word mnemonic. */
export function mnemonicToKeypair(mnemonic: string): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  const seed = mnemonicToMLKEMSeed(mnemonic.trim().toLowerCase());
  return ml_kem1024.keygen(seed);
}

/** Derive only the secret key (used for key recovery). */
export function mnemonicToSecretKey(mnemonic: string): Uint8Array {
  return mnemonicToKeypair(mnemonic).secretKey;
}

/** Verify that a mnemonic produces the expected public key (base64). */
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

/** Validate BIP39 word list + checksum. */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim().toLowerCase(), wordlist);
}

/** Return the public key as base64 given a mnemonic. */
export function mnemonicToPublicKeyB64(mnemonic: string): string {
  return toBase64(mnemonicToKeypair(mnemonic).publicKey);
}
