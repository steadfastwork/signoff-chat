/**
 * Server-side AES-256-GCM email encryption/decryption.
 *
 * Used only for digest delivery — encrypted email is stored alongside the
 * one-way emailHash so we can send digest emails without ever storing plaintext.
 *
 * Key: EMAIL_ENCRYPTION_KEY env var — 64-char hex (32 bytes).
 * Server-only: never import from client code.
 */

import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.EMAIL_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    throw new Error("EMAIL_ENCRYPTION_KEY must be a 64-char hex string");
  }
  return Buffer.from(hex, "hex");
}

export function encryptEmail(plaintext: string): { encrypted: string; nonce: string } {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack: enc || tag (last 16 bytes = auth tag)
  const payload = Buffer.concat([enc, tag]);
  return {
    encrypted: payload.toString("base64"),
    nonce: iv.toString("base64"),
  };
}

export function decryptEmail(encrypted: string, nonce: string): string {
  const key = getKey();
  const iv = Buffer.from(nonce, "base64");
  const payload = Buffer.from(encrypted, "base64");
  // Last 16 bytes are the auth tag
  const tag = payload.slice(-16);
  const enc = payload.slice(0, -16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final("utf8");
}
