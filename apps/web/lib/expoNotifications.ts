/**
 * Expo Push Notification sender — server side only.
 *
 * Philosophy:
 *   - Notifications exist to help users, not to re-engage them.
 *   - We NEVER send: "X is online", engagement bait, view counts, marketing.
 *   - Server logs: { type, deliveredAt } only — never notification content.
 *   - Fire-and-forget: notification failures never block the request that
 *     triggered them.
 */

import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ---------------------------------------------------------------------------
// Internal push helper
// ---------------------------------------------------------------------------

interface PushPayload {
  to:    string;
  title: string;
  body:  string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

async function send(token: string, payload: Omit<PushPayload, "to">): Promise<void> {
  if (!token.startsWith("ExponentPushToken")) return;

  const msg: PushPayload = { to: token, sound: "default", ...payload };

  const res = await fetch(EXPO_PUSH_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Accept":        "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(msg),
  });

  if (!res.ok) {
    // Non-blocking — log failure without content
    console.error(`[push] delivery failed for token …${token.slice(-6)}: HTTP ${res.status}`);
  }
}

/**
 * Resolve a user's push token. Returns null if they have none / disabled.
 */
async function getToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { expoPushToken: true },
  });
  return user?.expoPushToken ?? null;
}

/**
 * Core delivery function — fetches token, sends, logs { type, deliveredAt }.
 * Content is NEVER logged.
 */
async function deliver(
  recipientId: string,
  type: string,
  payload: Omit<PushPayload, "to">
): Promise<void> {
  try {
    const token = await getToken(recipientId);
    if (!token) return;

    await send(token, payload);

    // Log only delivery metadata — no content, no user data
    console.info(`[push] ${JSON.stringify({ type, deliveredAt: new Date().toISOString() })}`);
  } catch (err) {
    // Never let notification failures propagate
    console.error(`[push] error for type=${type}:`, (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Typed notification senders
// ---------------------------------------------------------------------------

/**
 * "[screenname] wants to be your buddy"
 */
export async function notifyBuddyRequest(
  recipientId: string,
  senderScreenname: string
): Promise<void> {
  await deliver(recipientId, "buddyRequest", {
    title: `${senderScreenname} wants to be your buddy`,
    body:  "Tap to accept or view their profile.",
    data:  { type: "buddyRequest", screenname: senderScreenname },
  });
}

/**
 * "[screenname] is now your buddy"
 */
export async function notifyBuddyAccepted(
  recipientId: string,
  accepterScreenname: string
): Promise<void> {
  await deliver(recipientId, "buddyAccepted", {
    title: `${accepterScreenname} is now your buddy`,
    body:  "",
    data:  { type: "buddyAccepted", screenname: accepterScreenname },
  });
}

/**
 * "[screenname] nudged your post"
 * preview: first 60 chars of post content
 */
export async function notifyPostNudged(
  recipientId: string,
  senderScreenname: string,
  postId: string,
  preview: string
): Promise<void> {
  await deliver(recipientId, "postNudged", {
    title: `${senderScreenname} nudged your post`,
    body:  preview.slice(0, 60),
    data:  { type: "postNudged", postId, screenname: senderScreenname },
  });
}

/**
 * "[screenname] replied" + preview
 */
export async function notifyPostReplied(
  recipientId: string,
  senderScreenname: string,
  postId: string,
  preview: string
): Promise<void> {
  await deliver(recipientId, "postReplied", {
    title: `${senderScreenname} replied`,
    body:  preview.slice(0, 60),
    data:  { type: "postReplied", postId, screenname: senderScreenname },
  });
}

/**
 * "New comment in [board]" / "[screenname] on '[postTitle]'"
 */
export async function notifyBoardComment(
  recipientId: string,
  boardName: string,
  senderScreenname: string,
  postId: string,
  postTitle: string
): Promise<void> {
  await deliver(recipientId, "boardComment", {
    title: `New comment in ${boardName}`,
    body:  `${senderScreenname} on '${postTitle.slice(0, 40)}'`,
    data:  { type: "boardComment", boardName, postId, screenname: senderScreenname },
  });
}

/**
 * "# [channel]" / "[screenname]: [preview]"
 * Only sent when: the user is NOT currently in that channel screen.
 * The client tracks the active channel and passes it at subscribe time;
 * the server never knows which screen is active — we send and let the
 * client-side notification handler suppress if the user is on that screen.
 */
export async function notifyChannelMessage(
  recipientId: string,
  channelName: string,
  senderScreenname: string,
  preview: string
): Promise<void> {
  await deliver(recipientId, "channelMessage", {
    title: `#${channelName}`,
    body:  `${senderScreenname}: ${preview.slice(0, 60)}`,
    data:  { type: "channelMessage", channelName, screenname: senderScreenname },
  });
}

/**
 * "[screenname] sent you a tip 👋"
 * Amount included in data only — not in visible notification body.
 */
export async function notifyTipReceived(
  recipientId: string,
  senderScreenname: string,
  amountCents: number
): Promise<void> {
  await deliver(recipientId, "tipReceived", {
    title: `${senderScreenname} sent you a tip 👋`,
    body:  "",
    data:  { type: "tipReceived", screenname: senderScreenname, amountCents },
  });
}

// ---------------------------------------------------------------------------
// Notifications we deliberately DO NOT send:
//
//   ✗ "X is online now"           — surveillance
//   ✗ "You haven't posted in X days" — engagement bait
//   ✗ "X people viewed your post" — we don't track views
//   ✗ Any marketing / re-engagement notification
// ---------------------------------------------------------------------------
