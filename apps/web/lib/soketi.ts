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

const soketiPort   = process.env.SOKETI_PORT ?? "443";
const soketiUseTLS = process.env.SOKETI_USE_TLS !== "false";

export const soketiServer = new Pusher({
  appId:  process.env.SOKETI_APP_ID!,
  key:    process.env.SOKETI_APP_KEY!,
  secret: process.env.SOKETI_APP_SECRET!,
  host:   process.env.SOKETI_HOST!,
  port:   soketiPort,
  useTLS: soketiUseTLS,
});

// ---------------------------------------------------------------------------
// Client (browser / React Native)
// ---------------------------------------------------------------------------

const clientPort   = parseInt(process.env.NEXT_PUBLIC_SOKETI_PORT ?? "443", 10);
const clientUseTLS = process.env.NEXT_PUBLIC_SOKETI_USE_TLS !== "false";

export const soketiClient =
  typeof window !== "undefined"
    ? new PusherClient(process.env.NEXT_PUBLIC_SOKETI_KEY!, {
        wsHost:            process.env.NEXT_PUBLIC_SOKETI_HOST!,
        wsPort:            clientPort,
        wssPort:           clientPort,
        forceTLS:          clientUseTLS,
        cluster:           "",
        enabledTransports: ["ws", "wss"],
        authEndpoint:      "/api/pusher/auth",
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
