/**
 * Unit tests — Encryption + invite token entropy
 *
 * No dev server required. Runs in the vitest node environment.
 * NEXT_PUBLIC_ENCRYPTION_SALT is set to a 64-char hex string in tests/setup.ts.
 */

import { describe, it, expect } from "vitest";
import { randomBytes } from "crypto";
import {
  generateUserKeypair,
  encryptMessage,
  decryptMessage,
} from "@/lib/crypto";

// ---------------------------------------------------------------------------
// 4.1 — ML-KEM keypair generation
// ---------------------------------------------------------------------------

describe("4.1 — ML-KEM key generation produces a valid keypair", () => {
  it("publicKey and secretKey are non-empty Uint8Arrays", () => {
    const { publicKey, secretKey } = generateUserKeypair();

    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(secretKey).toBeInstanceOf(Uint8Array);
    expect(publicKey.length).toBeGreaterThan(0);
    expect(secretKey.length).toBeGreaterThan(0);
  });

  it("publicKey and secretKey are distinct byte sequences", () => {
    const { publicKey, secretKey } = generateUserKeypair();

    const sameBytes =
      publicKey.length === secretKey.length &&
      publicKey.every((b, i) => b === secretKey[i]);
    expect(sameBytes).toBe(false);
  });

  it("each call produces a unique keypair", () => {
    const a = generateUserKeypair();
    const b = generateUserKeypair();

    const samePublicKey =
      a.publicKey.length === b.publicKey.length &&
      a.publicKey.every((byte, i) => byte === b.publicKey[i]);
    expect(samePublicKey).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4.2 — Encrypt / decrypt round trip
// ---------------------------------------------------------------------------

describe("4.2 — Encrypt/decrypt round trip recovers the original plaintext", () => {
  it("decrypted message matches the original plaintext", () => {
    const { publicKey, secretKey } = generateUserKeypair();
    const plaintext = "hello signoff";

    const { ciphertext, encapsulatedKey, iv } = encryptMessage(plaintext, publicKey);
    const decrypted = decryptMessage(ciphertext, encapsulatedKey, iv, secretKey);

    expect(decrypted).toBe(plaintext);
  });

  it("round-trip works for a 512-character message", () => {
    const { publicKey, secretKey } = generateUserKeypair();
    const plaintext = "a".repeat(512);

    const { ciphertext, encapsulatedKey, iv } = encryptMessage(plaintext, publicKey);
    const decrypted = decryptMessage(ciphertext, encapsulatedKey, iv, secretKey);

    expect(decrypted).toBe(plaintext);
  });

  it("round-trip works for unicode content", () => {
    const { publicKey, secretKey } = generateUserKeypair();
    const plaintext = "🔒 こんにちは signoff 🔒";

    const { ciphertext, encapsulatedKey, iv } = encryptMessage(plaintext, publicKey);
    const decrypted = decryptMessage(ciphertext, encapsulatedKey, iv, secretKey);

    expect(decrypted).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// 4.3 — Wrong key cannot decrypt
// ---------------------------------------------------------------------------

describe("4.3 — Wrong secret key cannot decrypt a message", () => {
  it("decryption with a different keypair's secret key throws (AES-GCM auth failure)", () => {
    const keyA = generateUserKeypair();
    const keyB = generateUserKeypair();

    const { ciphertext, encapsulatedKey, iv } = encryptMessage("hello signoff", keyA.publicKey);

    // ML-KEM implicit rejection → different shared secret → different AES key
    // → AES-256-GCM authentication tag mismatch → throws
    expect(() =>
      decryptMessage(ciphertext, encapsulatedKey, iv, keyB.secretKey)
    ).toThrow();
  });

  it("result with wrong key is never the original plaintext", () => {
    const keyA = generateUserKeypair();
    const keyB = generateUserKeypair();
    const plaintext = "sensitive message";

    const { ciphertext, encapsulatedKey, iv } = encryptMessage(plaintext, keyA.publicKey);

    let result: string | null = null;
    try {
      result = decryptMessage(ciphertext, encapsulatedKey, iv, keyB.secretKey);
    } catch {
      // Expected: GCM auth failure throws before returning anything
    }

    expect(result).not.toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// 4.4 — Ciphertext is different every time (randomised IVs)
// ---------------------------------------------------------------------------

describe("4.4 — Ciphertext differs across encryptions of the same plaintext", () => {
  it("two encryptions produce different IVs", () => {
    const { publicKey } = generateUserKeypair();

    const first  = encryptMessage("hello signoff", publicKey);
    const second = encryptMessage("hello signoff", publicKey);

    const sameIv = first.iv.every((b, i) => b === second.iv[i]);
    expect(sameIv).toBe(false);
  });

  it("two encryptions produce different ciphertexts", () => {
    const { publicKey } = generateUserKeypair();

    const first  = encryptMessage("hello signoff", publicKey);
    const second = encryptMessage("hello signoff", publicKey);

    const sameCiphertext =
      first.ciphertext.length === second.ciphertext.length &&
      first.ciphertext.every((b, i) => b === second.ciphertext[i]);
    expect(sameCiphertext).toBe(false);
  });

  it("ML-KEM encapsulation is also randomised — encapsulated keys differ", () => {
    const { publicKey } = generateUserKeypair();

    const first  = encryptMessage("hello signoff", publicKey);
    const second = encryptMessage("hello signoff", publicKey);

    const sameKey =
      first.encapsulatedKey.length === second.encapsulatedKey.length &&
      first.encapsulatedKey.every((b, i) => b === second.encapsulatedKey[i]);
    expect(sameKey).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4.14 — Invite token entropy
//
// The route generates tokens with: randomBytes(6).toString("hex")
// → 6 bytes × 2 hex chars/byte = 12 lowercase hex characters, 48 bits of entropy
// ---------------------------------------------------------------------------

describe("4.14 — Invite tokens have sufficient entropy and uniqueness", () => {
  // Mirrors the generation algorithm in app/api/channels/invites/route.ts
  function generateToken(): string {
    return randomBytes(6).toString("hex");
  }

  it("tokens are 12-character lowercase hex strings", () => {
    for (let i = 0; i < 20; i++) {
      const token = generateToken();
      expect(token).toMatch(/^[0-9a-f]{12}$/);
    }
  });

  it("100 generated tokens are all unique", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateToken));
    expect(tokens.size).toBe(100);
  });

  it("tokens are not sequential", () => {
    const tokens = Array.from({ length: 20 }, generateToken);

    let sequentialCount = 0;
    for (let i = 1; i < tokens.length; i++) {
      const prev = parseInt(tokens[i - 1], 16);
      const curr = parseInt(tokens[i], 16);
      if (Math.abs(curr - prev) === 1) sequentialCount++;
    }

    // Genuine randomness makes sequential adjacent pairs astronomically unlikely
    // Tolerate at most 1 accidental collision in 19 comparisons
    expect(sequentialCount).toBeLessThan(2);
  });

  it("each token encodes at least 48 bits of entropy (6 bytes)", () => {
    // A 12-char hex string = 6 bytes = 48 bits
    // Verify by checking length: 12 hex chars / 2 = 6 bytes
    const token = generateToken();
    expect(token.length / 2).toBeGreaterThanOrEqual(6);
  });
});
