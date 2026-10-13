# Deploying signoff.chat to Vercel

## Prerequisites

- Vercel account (Hobby or Pro — Pro required for cron jobs)
- Postgres database (Neon recommended — free tier works)
- Pusher account (free Sandbox tier works for small teams)
- Stripe account (for Gold plan and tips)
- UploadThing account (for file uploads)
- Upstash Redis account (for rate limiting)

---

## 1. Database setup

1. Create a Postgres database on [Neon](https://neon.tech) or your preferred provider.
2. Copy the connection string — it should look like:
   ```
   postgresql://user:password@host/dbname?sslmode=require
   ```
3. Run migrations locally against the production DB to verify connectivity:
   ```bash
   DATABASE_URL="your-connection-string" npx prisma migrate deploy
   ```
   The Vercel build command runs `prisma migrate deploy` automatically on every deploy, so this step is just a sanity check.

---

## 2. Pusher setup

1. Create an app at [pusher.com](https://pusher.com).
2. Go to **App Keys** and note:
   - App ID → `PUSHER_APP_ID`
   - Key → `PUSHER_KEY` and `NEXT_PUBLIC_PUSHER_KEY`
   - Secret → `PUSHER_SECRET`
   - Cluster → `PUSHER_CLUSTER` and `NEXT_PUBLIC_PUSHER_CLUSTER`
3. Enable **client events** in app settings if you use client-to-client messaging.

---

## 3. Stripe setup

1. In the [Stripe Dashboard](https://dashboard.stripe.com), create a product **signoff Gold** with a recurring monthly price (e.g. $4/mo).
2. Copy the **Price ID** → `STRIPE_GOLD_PRICE_ID`
3. Copy your **publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. Copy your **secret key** → `STRIPE_SECRET_KEY`

### Webhook

1. In Stripe → **Developers → Webhooks**, click **Add endpoint**.
2. Endpoint URL: `https://signoff.chat/api/stripe/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `invoice.payment_failed`
4. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

> For local development use `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

---

## 4. UploadThing setup

1. Create an app at [uploadthing.com](https://uploadthing.com).
2. Copy **Secret Key** → `UPLOADTHING_SECRET`
3. Copy **App ID** → `UPLOADTHING_APP_ID`

---

## 5. Upstash Redis setup

1. Create a database at [upstash.com](https://upstash.com) (choose the same region as your Vercel deployment).
2. Go to **REST API** and copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

## 6. Generate secrets

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# NEXT_PUBLIC_ENCRYPTION_SALT (hex, 32 bytes)
openssl rand -hex 32

# CRON_SECRET
openssl rand -hex 32
```

> **Warning:** `NEXT_PUBLIC_ENCRYPTION_SALT` is used to derive encryption keys from user passphrases. Changing it after launch will make all existing encrypted messages unreadable.

---

## 7. Vercel project setup

1. Import your GitHub repo at [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Next.js** (auto-detected).
3. The build command is set in `vercel.json`:
   ```
   prisma generate && prisma migrate deploy && next build
   ```
4. Add all environment variables from `.env.example` under **Settings → Environment Variables**.
   - Set scope to **Production** for live keys and **Preview** for test keys.

---

## 8. Cron jobs

Cron jobs are defined in `vercel.json` and run automatically on Vercel Pro:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/cleanup-channel-messages` | 3:00 AM UTC daily | Trim channels to 500 messages |
| `/api/cron/archive-board-posts` | 4:00 AM UTC daily | Archive board posts older than 30 days |
| `/api/cron/cleanup-invite-links` | 5:00 AM UTC daily | Delete expired/revoked/used invite links |
| `/api/cron/rotate-channel-keys` | Every 6 hours | Rotate channel encryption keys |

All cron routes require `Authorization: Bearer <CRON_SECRET>` — Vercel sends this automatically when `CRON_SECRET` is set in environment variables.

To trigger a cron job manually:
```bash
curl -X POST https://signoff.chat/api/cron/cleanup-channel-messages \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 9. Health check

```bash
curl https://signoff.chat/api/health
```

Expected response (200):
```json
{
  "status": "ok",
  "db": "connected",
  "pusher": "configured",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

If `status` is `"degraded"` (503), check `db` and `pusher` fields to identify the issue.

---

## 10. First deploy checklist

- [ ] All environment variables set in Vercel
- [ ] `prisma migrate deploy` ran successfully (check build logs)
- [ ] `/api/health` returns `{ "status": "ok" }`
- [ ] Stripe webhook endpoint active and receiving events
- [ ] Pusher app events flowing (open a channel, send a message)
- [ ] File upload working (try uploading an avatar)
- [ ] Gold subscription checkout working (use Stripe test card `4242 4242 4242 4242`)
- [ ] Cron jobs visible in Vercel → your project → **Cron Jobs** tab

---

## Rollback

If a deploy breaks production, roll back instantly in Vercel:

1. Go to your project → **Deployments**
2. Find the last good deployment
3. Click **⋯ → Promote to Production**

The database migration has already run, so only roll back the app code — not the DB schema — unless you also ran a migration that needs reverting (use `prisma migrate resolve --rolled-back <migration_name>` in that case).
