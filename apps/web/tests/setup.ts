// ---------------------------------------------------------------------------
// Global test setup — runs before every test file
// ---------------------------------------------------------------------------

// Minimal env vars required to import modules without crashing
process.env.NEXTAUTH_SECRET = "test-secret-min-32-chars-xxxxxxxx";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_ENCRYPTION_SALT = "a".repeat(64);
process.env.CRON_SECRET = "test-cron-secret-min-32-chars-xxx";
// Leave Upstash/Pusher/Stripe unset → graceful no-ops in rate limiter etc.
