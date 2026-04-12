import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const BOARDS_ENABLED = "boards";
export const TIPS_ENABLED = "tips";

/**
 * Look up a feature flag by key.
 *
 * Uses React's `cache()` for per-request deduplication — a single DB query
 * is made per unique key per request, no matter how many components call it.
 *
 * Fails safe: if the DB is unreachable, the feature stays hidden.
 */
export const getFeatureFlag = cache(async (key: string): Promise<boolean> => {
  try {
    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    return flag?.enabled ?? false;
  } catch {
    return false;
  }
});

/**
 * Convenience: invalidate the flag after a toggle so React's cache
 * returns the fresh value on the next request.
 *
 * React's cache is per-request only, so in practice the new value
 * is reflected on the very next request automatically. This helper
 * exists as a no-op placeholder so the API layer has a consistent
 * contract if we ever add an external cache layer later.
 */
export async function invalidateFlagCache(_key: string): Promise<void> {
  // No-op: React cache is request-scoped; no external cache to bust.
}
