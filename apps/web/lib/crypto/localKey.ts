/**
 * Client-side ML-KEM secret key storage.
 *
 * Encrypted (PBKDF2 + AES-256-GCM) secret key is persisted to localStorage
 * under `signoff_sk_<userId>` so it survives browser closes.
 *
 * The decrypted raw key is cached in sessionStorage under `signoff_dsk_<userId>`
 * for the duration of the tab session (cleared when tab closes).
 */

const LS_KEY = (id: string) => `signoff_sk_${id}`;
const SS_KEY = (id: string) => `signoff_dsk_${id}`;
const PBKDF2_ITERATIONS = 300_000;

interface Stored {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
}

function ab2b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b642u8(s: string): Uint8Array<ArrayBuffer> {
  const binary = atob(s);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    usage
  );
}

function fixedBuffer(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(arr.length);
  out.set(arr);
  return out;
}

// ---------------------------------------------------------------------------
// localStorage — encrypted persistence
// ---------------------------------------------------------------------------

/** PBKDF2-encrypt the ML-KEM secretKey and save it to localStorage. */
export async function encryptAndStoreKey(
  userId: string,
  secretKey: Uint8Array,
  password: string
): Promise<void> {
  const salt = fixedBuffer(crypto.getRandomValues(new Uint8Array(32)));
  const iv = fixedBuffer(crypto.getRandomValues(new Uint8Array(12)));
  const key = await deriveKey(password, salt, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, fixedBuffer(secretKey));
  const stored: Stored = {
    v: 1,
    salt: ab2b64(salt),
    iv: ab2b64(iv),
    ct: ab2b64(ct),
  };
  localStorage.setItem(LS_KEY(userId), JSON.stringify(stored));
}

/** Load and decrypt the ML-KEM secretKey from localStorage. Throws if missing or wrong password. */
export async function loadAndDecryptKey(
  userId: string,
  password: string
): Promise<Uint8Array> {
  const raw = localStorage.getItem(LS_KEY(userId));
  if (!raw) throw new Error("no stored key");
  const { salt, iv, ct } = JSON.parse(raw) as Stored;
  const key = await deriveKey(password, b642u8(salt), ["decrypt"]);
  const ctBytes = b642u8(ct);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b642u8(iv) },
    key,
    ctBytes
  );
  return new Uint8Array(plain);
}

/** Whether a PBKDF2-encrypted key exists in localStorage for this userId. */
export function hasEncryptedKey(userId: string): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(LS_KEY(userId)) !== null;
}

/** Remove the encrypted key from localStorage. */
export function removeEncryptedKey(userId: string): void {
  localStorage.removeItem(LS_KEY(userId));
}

// ---------------------------------------------------------------------------
// sessionStorage — decrypted key cache (tab-lifetime only)
// ---------------------------------------------------------------------------

/** Cache the raw decrypted secretKey in sessionStorage. */
export function cacheDecryptedKey(userId: string, secretKey: Uint8Array): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SS_KEY(userId), ab2b64(secretKey));
}

/** Read the cached decrypted secretKey. Returns null if not cached. */
export function getCachedSecretKey(userId: string): Uint8Array | null {
  if (typeof sessionStorage === "undefined") return null;
  const b64 = sessionStorage.getItem(SS_KEY(userId));
  if (!b64) return null;
  try {
    return b642u8(b64);
  } catch {
    return null;
  }
}

/** Clear the cached key from sessionStorage. */
export function clearCachedKey(userId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SS_KEY(userId));
}
