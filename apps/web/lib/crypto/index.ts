/**
 * Signoff Chat — Hybrid Post-Quantum Encryption
 *
 * Scheme: ML-KEM-1024 (FIPS 203) for key encapsulation
 *       + AES-256-GCM for symmetric encryption
 *
 * Both must fail simultaneously for any message to be compromised.
 * Same hybrid approach as Apple iMessage PQ3 (2024) and Signal PQXDH (2023).
 */

import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes, hexToBytes } from "@noble/hashes/utils.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HKDF_INFO = new TextEncoder().encode("signoff-v1");
const HKDF_SEED_INFO = new TextEncoder().encode("signoff-mlkem-seed");

// ML-KEM-1024 ciphertext is always 1568 bytes — used when packing member keys
const MLKEM_CIPHERTEXT_BYTES = 1568;
const IV_BYTES = 12;
// AES-256-GCM: 32-byte key + 16-byte GCM tag → wrapped key blob = 48 bytes
const WRAPPED_KEY_BYTES = 48;
export const PACKED_MEMBER_KEY_BYTES = MLKEM_CIPHERTEXT_BYTES + IV_BYTES + WRAPPED_KEY_BYTES; // 1628

// ---------------------------------------------------------------------------
// Environment — NEXT_PUBLIC_ so it's available in browser for E2E crypto
// ---------------------------------------------------------------------------

function getEncryptionSalt(): Uint8Array {
  const saltHex =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ENCRYPTION_SALT) ?? "";
  if (!saltHex || saltHex.length !== 64) {
    throw new Error(
      "NEXT_PUBLIC_ENCRYPTION_SALT must be set to a 64-char hex string (32 bytes). " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  return hexToBytes(saltHex);
}

// ---------------------------------------------------------------------------
// Portable base64 helpers (Node + browser)
// ---------------------------------------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Step 1 — Key generation
// ---------------------------------------------------------------------------

/**
 * Generate an ML-KEM-1024 keypair for a new user.
 *
 * publicKey  → store in User.mlkemPublicKey (base64), share freely
 * secretKey  → NEVER send to server; store client-side only:
 *              Web:     localStorage, encrypted with PBKDF2(password)
 *              Mobile:  expo-secure-store
 *              Desktop: Electron safeStorage (OS keychain)
 */
export function generateUserKeypair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return ml_kem1024.keygen();
}

// ---------------------------------------------------------------------------
// Step 3 — Encrypt a message (1-to-1 or per-recipient)
// ---------------------------------------------------------------------------

export function encryptMessage(
  plaintext: string,
  recipientPublicKey: Uint8Array
): { ciphertext: Uint8Array; encapsulatedKey: Uint8Array; iv: Uint8Array } {
  // 1. ML-KEM encapsulate: produces cipherText + sharedSecret
  const { cipherText: encapsulatedKey, sharedSecret } =
    ml_kem1024.encapsulate(recipientPublicKey);

  // 2. Derive 256-bit AES key via HKDF-SHA256
  const aesKey = hkdf(sha256, sharedSecret, getEncryptionSalt(), HKDF_INFO, 32);

  // 3. AES-256-GCM encrypt
  const iv = randomBytes(IV_BYTES);
  const ciphertext = gcm(aesKey, iv).encrypt(new TextEncoder().encode(plaintext));

  return { ciphertext, encapsulatedKey, iv };
}

// ---------------------------------------------------------------------------
// Step 4 — Decrypt a message
// ---------------------------------------------------------------------------

export function decryptMessage(
  ciphertext: Uint8Array,
  encapsulatedKey: Uint8Array,
  iv: Uint8Array,
  recipientSecretKey: Uint8Array
): string {
  // 1. ML-KEM decapsulate: recover sharedSecret
  const sharedSecret = ml_kem1024.decapsulate(encapsulatedKey, recipientSecretKey);

  // 2. Re-derive the same AES key
  const aesKey = hkdf(sha256, sharedSecret, getEncryptionSalt(), HKDF_INFO, 32);

  // 3. AES-256-GCM decrypt
  const plainBytes = gcm(aesKey, iv).decrypt(ciphertext);
  return new TextDecoder().decode(plainBytes);
}

// ---------------------------------------------------------------------------
// Step 5 — Channel group encryption
// ---------------------------------------------------------------------------

/**
 * Generate a random 32-byte channel session key.
 * This key encrypts all messages in a key epoch.
 */
export function generateSessionKey(): Uint8Array {
  return randomBytes(32);
}

/**
 * Pack a member's encapsulated session key into a single base64 blob.
 * Layout: cipherText (1568) || iv (12) || wrappedKey (48) = 1628 bytes
 */
function packMemberKey(
  mlkemCipherText: Uint8Array,
  iv: Uint8Array,
  wrappedKey: Uint8Array
): string {
  const packed = new Uint8Array(PACKED_MEMBER_KEY_BYTES);
  packed.set(mlkemCipherText, 0);
  packed.set(iv, MLKEM_CIPHERTEXT_BYTES);
  packed.set(wrappedKey, MLKEM_CIPHERTEXT_BYTES + IV_BYTES);
  return toBase64(packed);
}

function unpackMemberKey(b64: string): {
  mlkemCipherText: Uint8Array;
  iv: Uint8Array;
  wrappedKey: Uint8Array;
} {
  const packed = fromBase64(b64);
  return {
    mlkemCipherText: packed.slice(0, MLKEM_CIPHERTEXT_BYTES),
    iv: packed.slice(MLKEM_CIPHERTEXT_BYTES, MLKEM_CIPHERTEXT_BYTES + IV_BYTES),
    wrappedKey: packed.slice(MLKEM_CIPHERTEXT_BYTES + IV_BYTES),
  };
}

/**
 * Encrypt a session key for one channel member.
 * Returns a base64 blob to store in ChannelKey.encryptedKeys[userId].
 */
export function encryptSessionKeyForMember(
  sessionKey: Uint8Array,
  memberPublicKey: Uint8Array
): string {
  const { cipherText: mlkemCipherText, sharedSecret } =
    ml_kem1024.encapsulate(memberPublicKey);
  const aesKey = hkdf(sha256, sharedSecret, getEncryptionSalt(), HKDF_INFO, 32);
  const iv = randomBytes(IV_BYTES);
  const wrappedKey = gcm(aesKey, iv).encrypt(sessionKey);
  return packMemberKey(mlkemCipherText, iv, wrappedKey);
}

/**
 * Recover the session key from the packed blob using your secret key.
 */
export function decryptSessionKey(
  packedMemberKey: string,
  recipientSecretKey: Uint8Array
): Uint8Array {
  const { mlkemCipherText, iv, wrappedKey } = unpackMemberKey(packedMemberKey);
  const sharedSecret = ml_kem1024.decapsulate(mlkemCipherText, recipientSecretKey);
  const aesKey = hkdf(sha256, sharedSecret, getEncryptionSalt(), HKDF_INFO, 32);
  return gcm(aesKey, iv).decrypt(wrappedKey);
}

/**
 * Encrypt a message with a channel session key (no ML-KEM per message).
 */
export function encryptWithSessionKey(
  plaintext: string,
  sessionKey: Uint8Array
): { ciphertext: Uint8Array; iv: Uint8Array } {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = gcm(sessionKey, iv).encrypt(
    new TextEncoder().encode(plaintext)
  );
  return { ciphertext, iv };
}

/**
 * Decrypt a message encrypted with a channel session key.
 */
export function decryptWithSessionKey(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  sessionKey: Uint8Array
): string {
  const plainBytes = gcm(sessionKey, iv).decrypt(ciphertext);
  return new TextDecoder().decode(plainBytes);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Build the full encryptedKeys map for a ChannelKey record.
 * Pass all current channel members who have an mlkemPublicKey.
 */
export function buildEncryptedKeysMap(
  sessionKey: Uint8Array,
  members: Array<{ userId: string; mlkemPublicKey: string }>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of members) {
    try {
      map[m.userId] = encryptSessionKeyForMember(sessionKey, fromBase64(m.mlkemPublicKey));
    } catch {
      // Skip members with invalid public keys
    }
  }
  return map;
}

// Re-export types for convenience
export type EncryptedKeysMap = Record<string, string>; // userId → packed base64 blob

// Re-export mlkem seed derivation for keyBackup use
export { hkdf, sha256, HKDF_SEED_INFO };
