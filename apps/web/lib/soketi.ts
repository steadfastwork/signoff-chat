/**
 * Signoff Chat — Real-time (Soketi)
 *
 * Soketi is a self-hosted, open-source Pusher-protocol compatible server.
 * We run it on AWS ECS Fargate (quay.io/soketi/soketi:latest).
 *
 * Server side: `pusher` npm package pointed at our Soketi host.
 * Client side: `pusher-js` configured with Soketi's WebSocket endpoint.
 *
 * Infrastructure:
 *   0.5 vCPU / 1 GB RAM  → ~5,000 concurrent connections
 *   Scale trigger at ~15,000: 1 vCPU / 2 GB
 *   State backend: Upstash Redis (same instance as rate limiting)
 */

import Pusher from "pusher";
import PusherClient from "pusher-js";

// ---------------------------------------------------------------------------
// Server (API routes only — never import in client components)
// ---------------------------------------------------------------------------

// Managed Pusher (Channels). We keep the `soketi*` export names — they're just
// a Pusher-protocol client/server — so the rest of the app is unchanged.
export const soketiServer = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER || "us2",
  useTLS:  true,
});

// ---------------------------------------------------------------------------
// Client (browser / React Native)
// ---------------------------------------------------------------------------

// The Pusher app KEY is a public client credential (it ships in browser JS by
// design), so we fall back to the literal if the NEXT_PUBLIC_* env isn't inlined
// at build. The secret stays server-side only.
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY || "493e92a81b70d9a2aea5";
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2";

export const soketiClient =
  typeof window !== "undefined"
    ? new PusherClient(PUSHER_KEY, {
        cluster:      PUSHER_CLUSTER,
        forceTLS:     true,
        authEndpoint: "/api/pusher/auth",
      })
    : (null as unknown as PusherClient);

// ---------------------------------------------------------------------------
// Channel name helpers
// ---------------------------------------------------------------------------

export const CHANNELS = {
  GLOBAL_FEED: "global-feed",
  PRESENCE: "presence-signoff",
  /** Private channel for personal notifications (DMs, buddy requests, etc.) */
  privateUser: (userId: string) => `private-user-${userId}`,
  /** Each user subscribes here to receive status updates from their buddies */
  presenceBuddies: (userId: string) => `presence-buddies-${userId}`,
  dm: (userId1: string, userId2: string) => {
    const sorted = [userId1, userId2].sort();
    return `private-dm-${sorted[0]}-${sorted[1]}`;
  },
  /** Presence channel for a channel room — tracks who is currently viewing */
  channelRoom: (channelName: string) => `presence-channel-${channelName}`,
};

// ---------------------------------------------------------------------------
// Event name constants
// ---------------------------------------------------------------------------

export const EVENTS = {
  NEW_POST: "new-post",
  NEW_COMMENT: "new-comment",
  NEW_DM: "new-dm",
  USER_ONLINE: "member_added",
  USER_OFFLINE: "member_removed",
  STATUS_CHANGE: "status-change",
  BUDDY_REQUEST: "buddy-request",
  BUDDY_ACCEPTED: "buddy-accepted",
  CURRENTLY_CHANGED: "user-currently-changed",
  AWAY_MESSAGE_CHANGED: "buddy-away-changed",
  // Typing events (client-to-client via Soketi client events)
  TYPING: "client-typing",
  STOPPED_TYPING: "client-stopped-typing",
  // Channel events
  CHANNEL_MESSAGE: "new-message",
  CHANNEL_THREAD_REPLY: "thread-reply",
  CHANNEL_MEMBER_JOINED: "member-joined",
  CHANNEL_MEMBER_LEFT: "member-left",
};

// ---------------------------------------------------------------------------
// Backwards-compat aliases (used in existing API routes / components)
// ---------------------------------------------------------------------------

/** @deprecated use soketiServer */
export const pusherServer = soketiServer;
/** @deprecated use soketiClient */
export const pusherClient = soketiClient;
