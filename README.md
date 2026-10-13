# Signoff Chat

**A retro instant messenger for the browser. Sign on to AIM/ICQ and IRC from one classic early-2000s buddy-list UI.**

[Try it at www.signoff.chat](https://www.signoff.chat) · MIT licensed

Signoff Chat brings back the buddy list, away messages and door sounds, backed by real protocols.
Accounts live on a hosted [open-oscar-server](https://github.com/mk6i/open-oscar-server), so you can
chat from the web app or sign on with a vintage AIM client and talk to the same people.

## Features

- 🟢 **Buddy list with live presence**: online, away, idle and warning levels
- 💬 **Real-time one-on-one IMs**, with away messages and auto-replies
- 🏠 **Chat rooms**
- 🌐 **IRC** on real networks (Libera.Chat, OFTC, EsperNet, Rizon, Undernet) over TLS
- 🚪 **The sounds**: door open and slam, message chime, buddy sign-on
- 🖥️ **Web, desktop (Electron) and mobile (Expo)** clients

## How it works

```
Browser ─HTTP▶ Next.js API ─HTTP (shared secret)▶ Gateway ─TOC▶ open-oscar-server  ◀── vintage AIM clients (:5190)
                                                     │  └────IRC (TLS)▶ Libera, OFTC, …
Browser ◀────────── Pusher (WebSocket) ◀─────────────┘  relays IMs, presence, IRC events
```

- **`apps/web`**: Next.js 14 app (UI and API routes), NextAuth credentials sign-in, Prisma + Postgres for
  message history, profiles and IRC configs. Deployed on Vercel.
- **`apps/gateway`**: a small Node/TypeScript service that holds one live OSCAR (TOC2) session per
  signed-in user, plus their IRC connections, and relays inbound events to Pusher. Deployed on Fly.io.
  The browser never talks to it directly. See [`apps/gateway/README.md`](apps/gateway/README.md).
- **`infra/oscar`**: Fly.io config for open-oscar-server, the source of truth for AIM/ICQ identity,
  buddies and presence. See [`infra/oscar/README.md`](infra/oscar/README.md).
- **`apps/desktop`** (Electron) and **`apps/mobile`** (Expo): thin shells around the web app.
- **`packages/*`**: shared types, validators, config and API client.

## Running it yourself

You need Node 18+, a Postgres database, a [Pusher Channels](https://pusher.com) app, and somewhere
to run the gateway and an open-oscar-server (the configs here target [Fly.io](https://fly.io)).

```bash
git clone https://github.com/steadfastwork/signoff-chat.git
cd signoff-chat
npm install
```

**1. OSCAR server**: follow [`infra/oscar/README.md`](infra/oscar/README.md), or run open-oscar-server
locally and point the gateway at it.

**2. Gateway** (`apps/gateway`)

| Variable | Description |
| --- | --- |
| `GATEWAY_SECRET` | Shared secret; must match the web app |
| `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` | From your Pusher dashboard |
| `OSCAR_HOST`, `OSCAR_TOC_PORT`, `OSCAR_API_URL` | Where the OSCAR server's TOC port and management API live |
| `PORT` | Defaults to `8787` |

```bash
npm run dev -w @signoff/gateway
```

**3. Web app** (`apps/web`): copy [`apps/web/.env.example`](apps/web/.env.example) to `apps/web/.env.local`

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | e.g. `http://localhost:3000` |
| `GATEWAY_URL`, `GATEWAY_SECRET` | Where your gateway runs, plus the shared secret |
| `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` | Same Pusher app as the gateway |
| `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | Same values, exposed to the browser |
| `EMAIL_PEPPER` | `openssl rand -hex 32`; required in production, never change it after launch |
| `RATE_LIMIT_SALT`, `CRON_SECRET` | Optional; IP-hash salt and cron-route protection |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional; rate limiting is off when unset |
| `CLOUDFLARE_TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` | Optional; bot check on sign-up and login |

```bash
npm run db:push -w @signoff/web   # create the schema
npm run dev -w @signoff/web       # http://localhost:3000
```

The desktop app loads `https://www.signoff.chat` by default; set `SIGNOFF_APP_URL` to point it at a
local server instead.

## Project docs

- [`SECURITY.md`](SECURITY.md): rate limiting, input sanitization, access control
- [`PRIVACY-ARCHITECTURE.md`](PRIVACY-ARCHITECTURE.md): what's stored and how
- [`apps/desktop/DESKTOP-BUILD.md`](apps/desktop/DESKTOP-BUILD.md) and [`apps/mobile/APPSTORE.md`](apps/mobile/APPSTORE.md): building the native clients

## Contributing

Issues and pull requests are welcome. For anything big, open an issue first so we can talk it through.

## License

[MIT](LICENSE) © Steadfast Work LLC

AIM and ICQ are trademarks of their respective owners. Signoff Chat is an independent project and is
not affiliated with or endorsed by them.
