/**
 * IndexedDB storage for ML-KEM secret key.
 *
 * Unlike localStorage this survives browser restarts and is not cleared by
 * "clear cookies" in most browsers (it lives in a separate storage bucket).
 * The key is stored raw (unencrypted) — origin-scoped IndexedDB is the
 * protection layer. Users who clear site data (Settings → Clear browsing data
 * → Indexed DB) will need to generate new keys; they'll see the toast again.
 */

const DB_NAME = "signoff_crypto";
const STORE_NAME = "keys";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist the raw ML-KEM secret key in IndexedDB under the user's id. */
export async function storeSecretKey(
  userId: string,
  secretKey: Uint8Array
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(secretKey, userId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Load the raw ML-KEM secret key from IndexedDB. Returns null if not found. */
export async function loadSecretKey(
  userId: string
): Promise<Uint8Array | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(userId);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Remove the stored key (account deletion / sign-out cleanup). */
export async function removeSecretKey(userId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(userId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Whether a key exists in IndexedDB for this userId. */
export async function hasStoredSecretKey(userId: string): Promise<boolean> {
  try {
    const key = await loadSecretKey(userId);
    return key !== null;
  } catch {
    return false;
  }
}
