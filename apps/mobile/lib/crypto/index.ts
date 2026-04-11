/**
 * Mobile — Hybrid Post-Quantum Encryption
 *
 * ML-KEM-1024 (FIPS 203) + AES-256-GCM.
 * Mirrors /apps/web/lib/crypto/index.ts — kept separate until the
 * shared-packages layer is ready.
 */

import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";

const HKDF_INFO = new TextEncoder().encode("signoff-v1");
const IV_BYTES = 12;
const MLKEM_CIPHERTEXT_BYTES = 1568;
const WRAPPED_KEY_BYTES = 48;
export const PACKED_MEMBER_KEY_BYTES = MLKEM_CIPHERTEXT_BYTES + IV_BYTES + WRAPPED_KEY_BYTES;

// ---------------------------------------------------------------------------
// Env salt
// ---------------------------------------------------------------------------

function getEncryptionSalt(): Uint8Array {
  const saltHex = process.env.EXPO_PUBLIC_ENCRYPTION_SALT ?? "";
  if (!saltHex || saltHex.length !== 64) {
    throw new Error("EXPO_PUBLIC_ENCRYPTION_SALT must be a 64-char hex string.");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// base64 helpers
// ---------------------------------------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// ---------------------------------------------------------------------------
// Keypair generation
// ---------------------------------------------------------------------------

export function generateUserKeypair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return ml_kem1024.keygen();
}

// ---------------------------------------------------------------------------
// 1-to-1 message encryption / decryption
// ---------------------------------------------------------------------------

export function encryptMessage(
  plaintext: string,
  recipientPublicKey: Uint8Array
): { ciphertext: Uint8Array; encapsulatedKey: Uint8Array; iv: Uint8Array } {
  const { cipherText: encapsulatedKey, sharedSecret } =
    ml_kem1024.encapsulate(recipientPublicKey);
  const aesKey = hkdf(sha256, sharedSecret, getEncryptionSalt(), HKDF_INFO, 32);
  const iv = randomBytes(IV_BYTES);
  const ciphertext = gcm(aesKey, iv).encrypt(new TextEncoder().encode(plaintext));
  return { ciphertext, encapsulatedKey, iv };
}

export function decryptMessage(
  ciphertext: Uint8Array,
  encapsulatedKey: Uint8Array,
  iv: Uint8Array,
  recipientSecretKey: Uint8Array
): string {
  const sharedSecret = ml_kem1024.decapsulate(encapsulatedKey, recipientSecretKey);
  const aesKey = hkdf(sha256, sharedSecret, getEncryptionSalt(), HKDF_INFO, 32);
  const plainBytes = gcm(aesKey, iv).decrypt(ciphertext);
  return new TextDecoder().decode(plainBytes);
}

// ---------------------------------------------------------------------------
// Channel group encryption
// ---------------------------------------------------------------------------

export function generateSessionKey(): Uint8Array {
  return randomBytes(32);
}

function packMemberKey(ct: Uint8Array, iv: Uint8Array, wk: Uint8Array): string {
  const packed = new Uint8Array(PACKED_MEMBER_KEY_BYTES);
  packed.set(ct, 0);
  packed.set(iv, MLKEM_CIPHERTEXT_BYTES);
  packed.set(wk, MLKEM_CIPHERTEXT_BYTES + IV_BYTES);
  return toBase64(packed);
}

function unpackMemberKey(b64: string) {
  const packed = fromBase64(b64);
  return {
    mlkemCipherText: packed.slice(0, MLKEM_CIPHERTEXT_BYTES),
    iv: packed.slice(MLKEM_CIPHERTEXT_BYTES, MLKEM_CIPHERTEXT_BYTES + IV_BYTES),
    wrappedKey: packed.slice(MLKEM_CIPHERTEXT_BYTES + IV_BYTES),
  };
}

export function encryptSessionKeyForMember(
  sessionKey: Uint8Array,
  memberPublicKey: Uint8Array
): string {
  const { cipherText: ct, sharedSecret } = ml_kem1024.encapsulate(memberPublicKey);
  const aesKey = hkdf(sha256, sharedSecret, getEncryptionSalt(), HKDF_INFO, 32);
  const iv = randomBytes(IV_BYTES);
  const wk = gcm(aesKey, iv).encrypt(sessionKey);
  return packMemberKey(ct, iv, wk);
}

export function decryptSessionKey(
  packedMemberKey: string,
  recipientSecretKey: Uint8Array
): Uint8Array {
  const { mlkemCipherText, iv, wrappedKey } = unpackMemberKey(packedMemberKey);
  const sharedSecret = ml_kem1024.decapsulate(mlkemCipherText, recipientSecretKey);
  const aesKey = hkdf(sha256, sharedSecret, getEncryptionSalt(), HKDF_INFO, 32);
  return gcm(aesKey, iv).decrypt(wrappedKey);
}

export function encryptWithSessionKey(
  plaintext: string,
  sessionKey: Uint8Array
): { ciphertext: Uint8Array; iv: Uint8Array } {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = gcm(sessionKey, iv).encrypt(new TextEncoder().encode(plaintext));
  return { ciphertext, iv };
}

export function decryptWithSessionKey(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  sessionKey: Uint8Array
): string {
  return new TextDecoder().decode(gcm(sessionKey, iv).decrypt(ciphertext));
}

export type EncryptedKeysMap = Record<string, string>;
