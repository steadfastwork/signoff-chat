# Privacy Architecture

This document lists every data point Signoff Chat stores, why it is needed,
and how long it is retained. It is the authoritative reference for compliance,
security review, and future feature work.

---

## Principles

- **Collect nothing you don't need.** If a field isn't in this document, it should not be in the schema.
- **No soft deletes.** Every deletion is immediate and permanent. There is no archive, no recycle bin, no grace period.
- **No plaintext PII.** Email addresses and IP addresses are never stored in plaintext.
- **No tracking across sessions.** The IP hash salt rotates daily; yesterday's hashes cannot be correlated with today's.

---

## User Account

| Field | What it is | Why stored | Retention |
|---|---|---|---|
| `id` | UUID primary key | Row identity, foreign keys | Until account deleted |
| `screenname` | Public display name | Identity within the app | Until account deleted |
| `emailHash` | sha256(normalize(email) + EMAIL_PEPPER) | Uniqueness enforcement, password-reset lookup | Until account deleted |
| `passwordHash` | bcrypt hash (cost 12) | Authentication | Until account deleted |
| `bio` | Free-text bio (≤160 chars) | User-visible profile content | Until cleared or account deleted |
| `awayMessage` | Free-text away message (≤140 chars) | Buddy-list presence | Until cleared or account deleted |
| `status` | ONLINE / AWAY / IDLE / INVISIBLE / OFFLINE | Presence display | Reflects current state only; no history |
| `isGoldMember` | Boolean | Feature gating, message expiry | Until account deleted |
| `profileTheme` | String token | UI personalization | Until cleared or account deleted |
| `stripeCustomerId` | Stripe customer ID | Subscription management | Until account deleted |
| `createdAt` | Account creation timestamp | Anti-spam, moderation | Until account deleted |

**Not stored:** plaintext email, IP address, last-seen timestamp, login history, device fingerprint, geolocation.

---

## Email

Email is captured at registration and immediately discarded after hashing.

```
emailHash = sha256( normalize(email) + EMAIL_PEPPER )
```

- `normalize` = `.trim().toLowerCase()`
- `EMAIL_PEPPER` is a 32-byte random secret stored in the environment, never in the database
- The hash is one-way and pepper-protected; a database dump reveals nothing usable without the pepper
- Pepper must never change after launch (would invalidate all existing hashes)

Password-reset flow (when implemented): user supplies email → hash it → look up `emailHash` → send reset token to the address they provided. The plaintext never touches the database.

---

## IP Addresses

IP addresses are used only for rate limiting and are never stored in plaintext.

```
hashedIp = sha256( rawIp + RATE_LIMIT_SALT ).slice(0, 16)  // 16 hex chars
```

- `RATE_LIMIT_SALT` is a 16-byte random secret rotated **daily at midnight UTC** by `/api/cron/rotate-rate-limit-salt`
- After rotation, all previous hashed IPs are uncorrelatable with new ones
- The 16-char hash is used as a Redis key with a 24-hour TTL; it is never written to the database
- Rotation is automated; optionally managed via AWS SSM Parameter Store

---

## Posts & Replies

| Field | Why stored | Retention |
|---|---|---|
| `content` | User-authored content | Until deleted by user or account deleted |
| `privacy` | PUBLIC / BUDDIES_ONLY / PRIVATE | Controls visibility |
| `mediaUrl`, `mediaType` | Attached media | Until post deleted |
| `createdAt` | Display ordering | Until post deleted |

---

## Channel Messages

| Field | Why stored | Retention |
|---|---|---|
| `content` | Message content | Until `expiresAt` (see below) |
| `authorId` | Attribution | Until message purged |
| `expiresAt` | Message lifetime | — |
| `deliveredToAll` | Determines expiry override | — |

**Expiry policy (set at send time):**

| Condition | Lifetime |
|---|---|
| `deliveredToAll = true` | 24 hours |
| Gold member message | 90 days |
| Regular message | 30 days (DB default) |

The cron `/api/cron/purge-messages` runs daily at 3am UTC and hard-deletes all rows where `expiresAt < now()`. No archive is kept.

---

## Buddy Relations

| Field | Why stored | Retention |
|---|---|---|
| `requesterId`, `addresseeId` | Relationship endpoints | Until unfriended or account deleted |
| `status` | PENDING / ACCEPTED / BLOCKED | Current state only |

**Not stored:** when the request was sent, when it was accepted.

On decline or withdrawal: the row is hard-deleted immediately. No record that a request ever existed is kept.

---

## Invite Links

| Field | Why stored | Retention |
|---|---|---|
| `token` | Redemption key | Until exhausted or expired |
| `channelId` / `boardId` | Invite target | Until link deleted |
| `usesRemaining` | Enforce use limit | Decremented on each use |
| `expiresAt` | Time limit | Hard-deleted when `< now()` |
| `isRevoked` | Manual revocation | Hard-deleted when `true` |

**Not stored:** who created the link, how many times it has been used historically, maximum use count.

When `usesRemaining` reaches 0 the row is hard-deleted inline at redemption time. The cron `/api/cron/cleanup-invite-links` runs daily at 5am UTC as a safety net.

---

## Board Posts & Comments

Retained until the author deletes them or the account is deleted. The cron
`/api/cron/archive-board-posts` archives (not deletes) posts after 30 days;
this is a visibility change, not a data change.

---

## Rate Limiting (Redis)

Keys written to Upstash Redis:

| Key pattern | Value | TTL |
|---|---|---|
| `auth:h:<hashedIp>` | Request count | 24 hours |

No PII is ever written to Redis. The `h:` prefix signals that the identifier is a hash. TTL is enforced by Redis; no manual cleanup needed. The 24-hour window aligns with the daily salt rotation.

---

## Logs

| System | Retention | PII scrubbing |
|---|---|---|
| Vercel / CloudWatch | 7 days | IP and email fields stripped at ingest |
| Upstash Redis | 24 hours (TTL) | Hashed IPs only — no plaintext |
| Sentry (if enabled) | Per Sentry project settings | `ip`, `email`, `x-forwarded-for`, `x-real-ip` in `scrubFields` |

Error reports must never contain raw IP addresses or email addresses. Use the
`scrubFields` / `denyUrls` Sentry config to enforce this.

---

## Account Deletion

`DELETE /api/user/delete` requires password confirmation and immediately and
permanently deletes (in FK-safe order):

1. BoardCommentNudge
2. BoardNudge
3. SavedBoardPost
4. BoardComment
5. BoardPost
6. ChannelMessage
7. Nudge (post nudges)
8. Reply
9. Post
10. BoardMember
11. ChannelMember
12. BuddyRelation (all sides)
13. User row
14. Stripe subscription cancelled
15. Redis keys deleted

There is no grace period. There is no recovery. The response says so explicitly.

---

## Stripe

Stripe stores billing information (card details, billing address) under our
Stripe Customer ID. We store only the `stripeCustomerId` foreign key. Card
data never touches our servers or database. Stripe's data retention policies
apply to data held on their side.

---

## What We Deliberately Do Not Store

- Plaintext email addresses
- IP addresses (raw or hashed persistently)
- Last-seen / last-active timestamps
- Login history or session logs
- Device identifiers or fingerprints
- Geolocation data
- Read receipts or message delivery metadata beyond `deliveredToAll`
- Who created an invite link
- When a buddy request was sent or accepted
