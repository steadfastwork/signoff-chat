# @signoff/gateway

Holds one live OSCAR (TOC2) session per online user and relays inbound protocol
events to **Pusher**; accepts outbound actions as authenticated HTTP from the
Next.js app. The browser never talks to this directly.

```
Browser ─HTTP▶ Next API ─HTTP(x-gateway-secret)▶ Gateway ─TOC▶ open-oscar-server
Browser ◀─Pusher WS──────────── Gateway (relays IM/presence) ◀────────┘
```

## HTTP API (all POST, require header `x-gateway-secret: $GATEWAY_SECRET`)
| Route | Body | Effect |
| --- | --- | --- |
| `/login` | `{screenname, password}` | Opens/validates an OSCAR session. 401 on bad creds. NextAuth calls this to authenticate. |
| `/logout` | `{screenname}` | Closes the session. |
| `/heartbeat` | `{screenname}` | Refreshes the 15-min idle TTL. |
| `/im` | `{screenname, dest, message, auto?}` | Sends an IM. |
| `/buddies/add` | `{screenname, names[]}` | Adds buddies. |
| `/away` | `{screenname, message}` | Sets/clears away (empty clears). |
| `GET /health` | — | Liveness (no auth). |

## Pusher relay
Publishes to `private-user-<normalized-screenname>` (lowercased, alnum):
- `im` → `{from, message, auto}`
- `buddy` → `{name, online, warnLevel, idleMinutes, userClass}`
- `session-closed` → `{}`

The web app subscribes to that channel (auth via existing `/api/pusher/auth`).

## Env
`GATEWAY_SECRET` (matches Vercel), `PUSHER_APP_ID/KEY/SECRET/CLUSTER`,
`OSCAR_HOST` (default `signoff-oscar.internal`), `OSCAR_TOC_PORT` (9898), `PORT` (8787).

## Deploy (Fly)
```bash
cd apps/gateway
fly launch --no-deploy --name signoff-gateway     # region iad
# pull GATEWAY_SECRET from Vercel so it matches, then set all secrets:
fly secrets set GATEWAY_SECRET=<same-as-vercel> PUSHER_APP_ID=2188456 \
  PUSHER_KEY=493e92a81b70d9a2aea5 PUSHER_SECRET=<secret> PUSHER_CLUSTER=us2
fly deploy --remote-only
```
Public endpoint: `https://signoff-gateway.fly.dev` (already set as `GATEWAY_URL` in Vercel).

## Notes / v1 limitations
- Single instance holds all sessions in memory; a restart drops sessions (users
  re-establish on next login). Multi-instance needs per-user sticky routing.
- IRC support (Phase 4) plugs in here as a second connection type per user.
