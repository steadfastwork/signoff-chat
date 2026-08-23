# open-oscar-server on Fly.io

SIGNOFF's AIM/ICQ backbone. Canonical store for AIM/ICQ identity, buddies, and presence.
The web app never talks to this directly — the **gateway** (separate Fly app) holds per-user
TOC sessions to it and relays to Pusher. Real vintage AIM clients can also connect to `:5190`.

## Ports
| Port | Purpose | Exposed? |
| --- | --- | --- |
| 5190/tcp | OSCAR/BOS (real AIM clients) | **public** (needs dedicated IPv4) |
| 9898/tcp | TOC (our gateway + TOC clients) | **public** |
| 8080/tcp | Management REST API (create users, sessions, rooms) | private 6PN only |
| 8081/tcp | Web API | private 6PN only |
| 4000/udp | legacy ICQ | not exposed (v1) |

## One-time deploy
```bash
git clone https://github.com/mk6i/open-oscar-server ~/signoff-oscar-deploy
cp ~/signoff-chat/infra/oscar/fly.toml ~/signoff-oscar-deploy/fly.toml
cd ~/signoff-oscar-deploy
fly launch --no-deploy --name signoff-oscar     # if not already created; keep this fly.toml
fly volumes create oscar_data --size 1 --region iad
fly ips allocate-v4                               # dedicated IP for raw TCP (~$2/mo); note the address
fly secrets set OSCAR_ADVERTISED_LISTENERS_PLAIN="LOCAL://oscar.signoff.chat:5190"
fly deploy
```

## DNS
Add an **A record** `oscar` → the IPv4 from `fly ips allocate-v4`, so `oscar.signoff.chat`
resolves. Must match `OSCAR_ADVERTISED_LISTENERS_PLAIN`. If on Cloudflare, set **DNS only**
(grey cloud) — the proxy can't carry raw TCP on 5190/9898.

## Create the first account
The management API is private, so tunnel to it:
```bash
fly proxy 8080:8080 -a signoff-oscar        # leave running
# in another shell:
curl -X POST http://localhost:8080/user -d '{"screen_name":"craig","password":"choose-one"}'
```

## Backups
Single SQLite file at `/data/oscar.sqlite`. One volume is expected (SQLite is single-writer);
protect it with periodic backups rather than a second volume — TODO: litestream or a scheduled
`fly ssh sftp get` of `/data/oscar.sqlite`.
