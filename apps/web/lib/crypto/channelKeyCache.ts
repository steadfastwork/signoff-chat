/**
 * In-memory cache of decrypted channel session keys.
 *
 * Keyed by `<channelId>_<keyVersion>`. Cleared when the module is garbage-
 * collected (i.e., on full page navigation). This means the user doesn't need
 * to re-enter their password for every message in a session.
 */

const cache = new Map<string, Uint8Array>();

export function cacheSessionKey(
  channelId: string,
  keyVersion: number,
  sessionKey: Uint8Array
): void {
  cache.set(`${channelId}_${keyVersion}`, sessionKey);
}

export function getCachedSessionKey(
  channelId: string,
  keyVersion: number
): Uint8Array | null {
  return cache.get(`${channelId}_${keyVersion}`) ?? null;
}

export function clearChannelCache(channelId: string): void {
  const prefix = `${channelId}_`;
  Array.from(cache.keys())
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => cache.delete(k));
}
