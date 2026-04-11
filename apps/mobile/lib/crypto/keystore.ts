/**
 * Mobile secret-key storage via expo-secure-store.
 *
 * The ML-KEM-1024 secret key is stored in the OS keychain (iOS Keychain /
 * Android Keystore) under the WHEN_UNLOCKED_THIS_DEVICE_ONLY access policy
 * so it is never included in iCloud / Android cloud backups.
 *
 * The raw Uint8Array is base64-encoded for SecureStore (string-only API).
 */

import * as SecureStore from "expo-secure-store";

const KEY = (userId: string) => `signoff_sk_${userId}`;

function toB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromB64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Persist the raw ML-KEM-1024 secret key in the OS keychain. */
export async function storeSecretKey(
  userId: string,
  secretKey: Uint8Array
): Promise<void> {
  await SecureStore.setItemAsync(KEY(userId), toB64(secretKey), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/** Load the raw ML-KEM-1024 secret key from the OS keychain. Returns null if not present. */
export async function loadSecretKey(userId: string): Promise<Uint8Array | null> {
  const b64 = await SecureStore.getItemAsync(KEY(userId));
  if (!b64) return null;
  try {
    return fromB64(b64);
  } catch {
    return null;
  }
}

/** Remove the secret key from the OS keychain (on sign-out / account deletion). */
export async function removeSecretKey(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(KEY(userId));
}

/** Whether a secret key is stored for this userId. */
export async function hasStoredSecretKey(userId: string): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(KEY(userId));
    return val !== null;
  } catch {
    return false;
  }
}
