# Signoff Chat

A retro-styled, terminal-aesthetic social chat app. Features a global feed, direct messaging, buddy list with live presence, and profile management.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, IBM Plex Mono + VT323 fonts
- **Backend:** Next.js API routes, Prisma ORM, PostgreSQL
- **Real-time:** Pusher (live presence, buddy status, post/DM streaming)
- **Auth:** NextAuth.js with credentials provider
- **File Storage:** Uploadthing (profile images)

---

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or hosted, e.g. Supabase, Neon, Railway)
- Pusher account — create a Channels app at [pusher.com](https://pusher.com)
- Uploadthing account — create an app at [uploadthing.com](https://uploadthing.com)

---

## Local Setup

### 1. Clone and install

```bash
cd signoff-chat
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in all values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret — run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your app URL (`http://localhost:3000` for local) |
| `PUSHER_APP_ID` | From Pusher dashboard |
| `PUSHER_KEY` | From Pusher dashboard |
| `PUSHER_SECRET` | From Pusher dashboard |
| `PUSHER_CLUSTER` | From Pusher dashboard (e.g. `us2`) |
| `NEXT_PUBLIC_PUSHER_KEY` | Same as `PUSHER_KEY` |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Same as `PUSHER_CLUSTER` |
| `UPLOADTHING_SECRET` | From Uploadthing dashboard |
| `UPLOADTHING_APP_ID` | From Uploadthing dashboard |

### 3. Set up the database

Push the Prisma schema to your database:

```bash
npm run db:push
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Generate Prisma client + production build |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to database (no migration files) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Re-generate Prisma client |

---

## Project Structure

```
signoff-chat/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth handler
│   │   ├── buddies/              # Add/remove/list buddies
│   │   ├── messages/[userId]/    # Direct messages
│   │   ├── posts/                # Feed posts
│   │   │   └── [postId]/comments/
│   │   ├── profile/              # User profile CRUD
│   │   ├── pusher/auth/          # Pusher channel auth
│   │   └── uploadthing/          # File upload handler
│   ├── dm/[userId]/              # Direct message page
│   ├── login/                    # Sign-in page
│   ├── profile/                  # Profile edit page
│   ├── register/                 # Registration page
│   └── page.tsx                  # Global feed (home)
├── components/
│   ├── Avatar.tsx
│   ├── BuddyList.tsx             # Live presence sidebar
│   ├── CommentSection.tsx        # Real-time comments
│   ├── DirectMessagePanel.tsx    # Real-time DM chat
│   ├── Feed.tsx                  # Global post feed
│   ├── Navbar.tsx
│   ├── NewPostForm.tsx
│   ├── PostCard.tsx
│   └── SessionProvider.tsx
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── prisma.ts                 # Prisma client singleton
│   ├── pusher.ts                 # Pusher server + client
│   ├── uploadthing.ts            # Uploadthing helpers
│   └── utils.ts                  # cn(), formatTimestamp(), etc.
├── prisma/
│   └── schema.prisma
├── types/
│   └── next-auth.d.ts            # Session type augmentation
└── .env.example
```

---

## Features

- **Register / Login** — username + password credentials
- **Global Feed** — post updates (up to 500 chars), real-time via Pusher
- **Comments** — threaded comments on posts, live-streamed
- **Direct Messages** — private 1:1 chat with real-time delivery
- **Buddy List** — add buddies, see who's online via Pusher presence channels
- **Profile** — edit display name, bio, upload profile photo via Uploadthing
