# Signoff Chat — Security Architecture

This document describes the security decisions made in Signoff Chat, the rationale
behind each, and guidance for operators deploying the application.

---

## 1. Rate Limiting

**Implementation:** Upstash Redis + `@upstash/ratelimit` (sliding window algorithm)
**Config:** `lib/ratelimit.ts`

Rate limiting operates at two layers:

### Layer 1 — Middleware (IP-based, before session)
Applied in `middleware.ts` to auth endpoints to prevent brute-force attacks before
any session is established.

| Route | Limit | Identifier |
|---|---|---|
| `POST /api/auth/register` | 5 req/min | IP |
| `POST /api/auth/signin` | 5 req/min | IP |
| `POST /api/auth/callback/credentials` | 5 req/min | IP |

The same limits are also applied in-route (`app/api/auth/register/route.ts`) as a
defence-in-depth measure in case the middleware is bypassed (e.g., internal routing).

### Layer 2 — Per-route (user-based, after session)
Applied at the top of each relevant POST handler, identified by `session.user.id`.

| Route | Limit | Window |
|---|---|---|
| `POST /api/posts` | 10 | 1 min |
| `POST /api/channels/[name]/messages` | 30 | 1 min |
| `POST /api/boards/[name]/posts` | 5 | 1 min |
| `POST /api/boards/[name]/posts/[id]/comments` | 20 | 1 min |
| `GET /api/users/search` | 20 | 1 min |
| `POST /api/tips` | 5 | 1 hour |
| `POST /api/channels/invites` | 10 per channel | 1 hour |
| `POST /api/boards/invites` | 10 per board | 1 hour |

**Graceful degradation:** If `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
are not set, all rate limiting is silently disabled. This allows the app to run in
development without Upstash. **Rate limiting must be enabled in production.**

**Response headers on 429:**
```
X-RateLimit-Limit: <window limit>
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <Unix timestamp ms>
Retry-After: <seconds until reset>
```

Channel slow-mode (configurable per-channel cooldown stored in `Channel.slowModeMinutes`)
is enforced separately from the global rate limit — both checks run independently.

---

## 2. Input Sanitization

**Implementation:** `lib/sanitize.ts`

### HTML Stripping
All user-generated text content is stripped of HTML tags and decoded of HTML entities
before storage. This prevents stored-XSS attacks where malicious markup could be
rendered to other users.

Function: `stripHtml(input)` — removes `<tags>`, decodes `&amp;`, `&lt;`, `&#x41;`,
numeric entities, etc.

Applied to:
- Post `content` (`/api/posts`)
- Channel message `content` (`/api/channels/[name]/messages`)
- Board post `title` and `body` (`/api/boards/[name]/posts`)
- Board comment `body` (`/api/boards/[name]/posts/[id]/comments`)
- Tip `message` (`/api/tips`)

### URL Sanitization
`sanitizeUrl(url)` validates that user-supplied URLs use only `http:` or `https:`
protocols. Returns `null` for:
- `javascript:` URIs (XSS vector)
- `data:` URIs (data exfiltration / phishing)
- `vbscript:` and other dangerous schemes
- Malformed / non-parseable URLs

Applied to all `mediaUrl` fields.

### Screenname Validation
Screennames are validated server-side in `lib/auth.ts`:
- 3–20 characters
- Only `[a-zA-Z0-9_]` allowed (no HTML-injectable characters)
- Case-insensitive uniqueness enforced at DB level with `mode: "insensitive"`

---

## 3. Channel & Board Access Enforcement

### SECRET channels and boards
- All routes (`GET /messages`, `POST /messages`, `GET /posts`, `POST /posts`, etc.)
  return **404** (not 403) for non-members. This prevents membership enumeration —
  an attacker cannot distinguish "channel doesn't exist" from "you're not a member".
- Authentication is required before the membership check.

### INVITE_ONLY channels and boards
- `POST /join` returns 403 if no valid invite token is provided.
- Direct join without a token is rejected.
- Invite validation checks: token exists, not revoked, not expired, use count < maxUses.

### Access check order (all protected routes)
1. Parse + validate session → 401 if absent
2. Resolve channel/board → 404 if not found
3. Check membership → 404 (SECRET) or 403 (INVITE_ONLY) if not member
4. Process request

---

## 4. Invite Link Security

**Token generation:** `crypto.randomBytes(6).toString("hex")` → 12-character hex token
(48 bits of entropy, ~2.8 × 10¹⁴ possible values).

This was upgraded from the original 4-byte (8-char, 32-bit) tokens to resist
brute-force guessing attacks on short-lived links.

**Validation checks applied on redemption:**
- Token must exist in DB
- `isRevoked` must be `false`
- `expiresAt` must be in the future
- `useCount` must be < `maxUses`

**Member list privacy:** The invite redemption endpoint never reveals whether a
specific user is already a member. It returns a generic error only.

**Rate limit:** 10 tokens/hour per user per channel or board (keyed on
`invite:{userId}:{channelOrBoardId}`).

---

## 5. Blocked User Enforcement

When user A blocks user B (or vice versa), the following protections are applied:

| Action | Enforcement |
|---|---|
| View B's profile | 404 (hidden entirely) — `GET /api/users/[screenname]` |
| View B's posts on feed | B's posts excluded from A's feed — `GET /api/posts` (buddy filter already excludes non-buddies; blocking removes any prior buddy relation) |
| See B's channel messages | Filtered from response — `GET /api/channels/[name]/messages` |
| Tip B | Blocked at payment intent creation — `POST /api/tips` |
| Add B as buddy | Rejected — `POST /api/buddies` checks both directions |
| Search for B | B excluded from results — `GET /api/users/search` |

**Channel message filtering:** The messages GET handler queries blocked relations and
adds `authorId: { notIn: blockedIds }` to the Prisma query when the viewer is
authenticated. Non-authenticated viewers (public channels) see all messages.

**Note:** Blocked user checks at the channel message level are soft-filters (DB query
filtering), not hard access controls. Two users who have blocked each other can
technically still be members of the same channel — they simply won't see each other's
messages. This is intentional (matches the behaviour of Discord, Slack, etc.).

---

## 6. CSRF Protection

**Implementation:** `middleware.ts`

All `POST`, `PUT`, `PATCH`, `DELETE` requests to `/api/**` (except the exclusions
below) are checked for a valid `Origin` header.

**Logic:**
```
if (Origin header present) AND (Origin !== NEXTAUTH_URL origin):
    → reject with 403
```

If no `Origin` header is present, the request passes (handles native clients, server-to-server,
and same-origin requests that browsers send without Origin for some methods).

**Excluded routes** (server-to-server, no browser Origin):
- `/api/auth/**` — NextAuth handles its own CSRF via double-submit cookie
- `/api/stripe/webhook` — signed by Stripe; Origin not present
- `/api/cron/**` — authenticated via `Authorization: Bearer <CRON_SECRET>`

**Why not use CSRF tokens?** NextAuth's JWT session is stored in a `HttpOnly; SameSite=Lax`
cookie. `SameSite=Lax` prevents cross-site form submissions (the most common CSRF vector)
while allowing top-level navigation. The Origin check adds a second layer.

---

## 7. Content Security Policy

**Implementation:** `next.config.mjs`

CSP is delivered via the `Content-Security-Policy` HTTP response header on every route.

```
default-src 'self'
script-src  'self' 'unsafe-inline' [+ 'unsafe-eval' in dev] https://js.stripe.com
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com
font-src    'self' data: https://fonts.gstatic.com
img-src     'self' data: blob: https://utfs.io https://uploadthing.com
connect-src 'self' wss://*.pusher.com https://*.pusher.com https://api.stripe.com
            https://q.stripe.com https://uploadthing.com https://utfs.io
frame-src   https://js.stripe.com https://hooks.stripe.com
frame-ancestors 'none'
base-uri    'self'
form-action 'self'
upgrade-insecure-requests  (production only)
```

**Known relaxations and why:**
- `unsafe-inline` scripts: Required by Next.js App Router for hydration. Removing it
  would require per-request nonces (a significant architectural change).
- `unsafe-eval`: Only enabled in development for Next.js fast refresh.

**Additional headers applied to every response:**
| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing attacks |
| `X-Frame-Options` | `DENY` | Prevent clickjacking (belt-and-suspenders with `frame-ancestors 'none'`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer info sent to third parties |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Restrict browser feature access |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS (production only) |

---

## 8. Environment Variable Validation

**Implementation:** `lib/env.ts` (Zod)

All environment variables are validated at startup using Zod. In **development**, invalid
or missing variables produce a console warning but do not crash the server (to support
incremental adoption). In **production**, a missing or malformed required variable throws
and prevents the server from starting.

**Required in production:**
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | JWT signing key (min 32 chars) |
| `NEXTAUTH_URL` | Canonical app URL — used for CSRF Origin check |
| `NEXT_PUBLIC_ENCRYPTION_SALT` | 64 hex chars — HKDF domain separator for PQC crypto |
| `CRON_SECRET` | Auth token for cron job routes (min 32 chars) |

**Strongly recommended:**
| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Rate limiting backend |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting backend |

**CRITICAL — never change after launch:**
- `NEXT_PUBLIC_ENCRYPTION_SALT`: Changing this breaks decryption of all existing
  AES-256-GCM ciphertexts stored in the database.

Generate required secrets:
```sh
# NEXTAUTH_SECRET
openssl rand -base64 32

# NEXT_PUBLIC_ENCRYPTION_SALT (64 hex chars = 32 bytes)
openssl rand -hex 32

# CRON_SECRET
openssl rand -base64 48
```

---

## 9. Authentication

- Passwords hashed with **bcrypt** (cost factor 12)
- Sessions stored as **signed JWTs** (`HttpOnly; SameSite=Lax; Secure` in production)
- Screennames stored in JWT payload to avoid DB round-trips on every request
- Case-insensitive screenname lookup uses Prisma `mode: "insensitive"` (PostgreSQL `ILIKE`)
- Password minimum: 8 characters (enforced client and server)

---

## 10. Post-Quantum Encryption

See `lib/crypto/index.ts` and `lib/crypto/keyBackup.ts`.

- **Scheme:** ML-KEM-1024 (NIST FIPS 203) + AES-256-GCM + HKDF-SHA256
- **Secret keys** are never sent to the server — stored client-side only
- **Key rotation:** Channel session keys auto-rotate every 7 days via cron
- **Key backup:** 24-word BIP39 mnemonic (256-bit entropy) for cross-device recovery
- **Library:** `@noble/post-quantum` (audited, zero-dependency)

---

## 11. Reporting Security Issues

Please report security vulnerabilities privately to **security@signoff.chat**.

Do not open public GitHub issues for security bugs. We aim to respond within 48 hours
and release a fix within 7 days for critical issues.

---

*Last updated: 2026-03-23*
