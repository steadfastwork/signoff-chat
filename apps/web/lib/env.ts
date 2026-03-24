/**
 * Signoff Chat — Environment Variable Validation
 *
 * Uses Zod to parse and type-check process.env at import time.
 * Import `env` anywhere you need typed access to environment variables.
 */

import { z } from "zod";

const hexString32 = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, "Must be 64 lowercase hex chars (32 bytes). Generate: openssl rand -hex 32");

const schema = z.object({
  // ---------------------------------------------------------------------------
  // Core
  // ---------------------------------------------------------------------------
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),

  // ---------------------------------------------------------------------------
  // Hybrid Post-Quantum Encryption
  // IMPORTANT: Never change NEXT_PUBLIC_ENCRYPTION_SALT after launch —
  //            it would invalidate all existing ciphertext.
  // ---------------------------------------------------------------------------
  NEXT_PUBLIC_ENCRYPTION_SALT: hexString32,

  // ---------------------------------------------------------------------------
  // Cron job authentication
  // ---------------------------------------------------------------------------
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 chars"),

  // ---------------------------------------------------------------------------
  // Upstash Redis — rate limiting
  // Required for production. Rate limiting is silently disabled in dev if absent.
  // ---------------------------------------------------------------------------
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // ---------------------------------------------------------------------------
  // Privacy — email hashing & IP hashing
  // EMAIL_PEPPER: rotate only if deliberately invalidating all logins.
  // RATE_LIMIT_SALT: rotated daily by cron (rotate-rate-limit-salt).
  //   Previous-day IP hashes become uncorrelatable after rotation.
  // ---------------------------------------------------------------------------
  EMAIL_PEPPER: z.string().min(16, "EMAIL_PEPPER must be at least 16 chars. Generate: openssl rand -hex 32").optional(),
  RATE_LIMIT_SALT: z.string().min(8, "RATE_LIMIT_SALT must be at least 8 chars. Generate: openssl rand -hex 16").optional(),

  // ---------------------------------------------------------------------------
  // Soketi (self-hosted Pusher-protocol real-time)
  // See: https://soketi.app  /  Deploy on ECS Fargate (quay.io/soketi/soketi)
  // ---------------------------------------------------------------------------
  SOKETI_APP_ID: z.string().optional(),
  SOKETI_APP_KEY: z.string().optional(),
  SOKETI_APP_SECRET: z.string().optional(),
  SOKETI_HOST: z.string().optional(),
  NEXT_PUBLIC_SOKETI_KEY: z.string().optional(),
  NEXT_PUBLIC_SOKETI_HOST: z.string().optional(),

  // ---------------------------------------------------------------------------
  // Resend (transactional email — receives raw address, never stored)
  // ---------------------------------------------------------------------------
  RESEND_API_KEY: z.string().optional(),

  // ---------------------------------------------------------------------------
  // Stripe
  // ---------------------------------------------------------------------------
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_GOLD_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // ---------------------------------------------------------------------------
  // UploadThing
  // ---------------------------------------------------------------------------
  UPLOADTHING_SECRET: z.string().optional(),
  UPLOADTHING_APP_ID: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

const _result = schema.safeParse(process.env);

if (!_result.success) {
  const errors = _result.error.flatten().fieldErrors;
  const missing = Object.entries(errors)
    .map(([k, v]) => `  ${k}: ${(v as string[]).join(", ")}`)
    .join("\n");
  // In production, throw hard. In dev, warn so the app still starts for
  // incremental adoption of new env vars.
  const msg = `\n[env] Invalid or missing environment variables:\n${missing}\n`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(msg);
  } else {
    console.warn(msg);
  }
}

export const env: Env = (_result.success ? _result.data : process.env) as Env;
