// ---------------------------------------------------------------------------
// Global test setup — runs before every test file
// ---------------------------------------------------------------------------

// Minimal env vars required to import modules without crashing.
// Use ??= so the value from .env (loaded by Vitest before setup runs) is
// preserved for integration tests that need to mint JWTs matching the dev server.
process.env.NEXTAUTH_SECRET ??= "test-secret-min-32-chars-xxxxxxxx";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_ENCRYPTION_SALT = "a".repeat(64);
process.env.CRON_SECRET = "test-cron-secret-min-32-chars-xxx";
// Stripe — placeholder keeps lib/stripe.ts from throwing at import time.
// Actual Stripe API calls never run in tests; deleteAccount wraps them in try/catch.
process.env.STRIPE_SECRET_KEY = "sk_test_vitest_placeholder";
// Leave Upstash/Pusher unset → graceful no-ops in rate limiter etc.
