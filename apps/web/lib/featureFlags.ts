import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const BOARDS_ENABLED = "boards";
export const TIPS_ENABLED   = "tips";
export const RADICAL_UX     = "RADICAL_UX";

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

// ---------------------------------------------------------------------------
// RADICAL_UX flag — supports env-var kill switch + gradual rollout
// ---------------------------------------------------------------------------

/**
 * Determines whether the RADICAL_UX experience should be shown.
 *
 * Priority order:
 *   1. DISABLE_RADICAL_UX=true env var — always returns false (nuclear kill switch)
 *   2. Feature flag enabled=false in DB — always returns false
 *   3. rolloutPercent — deterministically buckets users; 100 = everyone
 *
 * Falls safe: if the DB is unavailable, returns false (old UX).
 */
export async function isRadicalUXEnabled(userId?: string): Promise<boolean> {
  // 1. Infrastructure-level kill switch (Vercel env var — no DB needed)
  if (process.env.DISABLE_RADICAL_UX === "true") return false;

  // 2. Database flag + rollout percent
  try {
    const flag = await prisma.featureFlag.findUnique({
      where:  { key: RADICAL_UX },
      select: { enabled: true, rolloutPercent: true },
    });

    if (!flag?.enabled) return false;

    const pct = flag.rolloutPercent ?? 0;
    if (pct >= 100) return true;
    if (pct <= 0)   return false;

    // Deterministic user bucketing: same user always gets the same result
    if (!userId) return false;
    const hash = parseInt(userId.slice(-4), 36) % 100;
    return hash < pct;
  } catch {
    // DB unavailable → fail safe to old UX
    return false;
  }
}

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
