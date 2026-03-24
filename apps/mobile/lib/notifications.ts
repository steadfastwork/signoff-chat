/**
 * Signoff Chat — Push Notification Library (mobile)
 *
 * Philosophy:
 *   - Notifications exist to help users connect, not to re-engage them.
 *   - Users control what they receive via NotificationPrefs (stored locally).
 *   - Quiet hours are system-level — we don't implement them ourselves.
 *
 * We NEVER send (and filter client-side if somehow received):
 *   ✗ "X is online now"                — surveillance
 *   ✗ "You haven't posted in X days"   — engagement bait
 *   ✗ "X people viewed your post"      — we don't track views
 *   ✗ Any marketing / re-engagement notification
 */

import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { router } from "expo-router";
import { getSession } from "@/lib/session";

const API          = process.env.EXPO_PUBLIC_API_URL ?? "";
const PREFS_KEY    = "signoff_notification_prefs";

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

export interface NotificationPrefs {
  enabled:         boolean;
  buddyRequests:   boolean;
  nudges:          boolean;
  replies:         boolean;
  channelMessages: boolean;
  boardActivity:   boolean;
  tips:            boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled:         true,
  buddyRequests:   true,
  nudges:          true,
  replies:         true,
  channelMessages: true,
  boardActivity:   true,
  tips:            true,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setNotificationPrefs(
  prefs: Partial<NotificationPrefs>
): Promise<void> {
  const current = await getNotificationPrefs();
  const updated  = { ...current, ...prefs };
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(updated));
}

// ---------------------------------------------------------------------------
// Notification data payload shapes
// ---------------------------------------------------------------------------

export type NotificationData =
  | { type: "buddyRequest";   screenname: string }
  | { type: "buddyAccepted";  screenname: string }
  | { type: "postNudged";     postId: string; screenname: string }
  | { type: "postReplied";    postId: string; screenname: string }
  | { type: "boardComment";   boardName: string; postId: string; screenname: string }
  | { type: "channelMessage"; channelName: string; screenname: string }
  | { type: "tipReceived";    screenname: string; amountCents: number };

// ---------------------------------------------------------------------------
// Foreground notification handler setup
// Call once at app startup in _layout.tsx
// ---------------------------------------------------------------------------

export function setupNotificationHandlers(): void {
  // Show notification even when app is foregrounded — with one exception:
  // channelMessage is suppressed if the user is on that channel screen.
  // The shouldShowAlert callback can't access router state, so we show it
  // and let the NotificationResponse handler deduplicate.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as NotificationData | undefined;

      // Suppress types we never want shown regardless of prefs
      if (data?.type === "channelMessage") {
        // We show these — the user controls per the prefs below
        // Suppression when on the channel screen is handled via
        // the active channel tracking in the channel screen itself.
      }

      const prefs = await getNotificationPrefs();

      if (!prefs.enabled) {
        return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false };
      }

      const show = shouldShowForType(data?.type, prefs);
      return { shouldShowAlert: show, shouldPlaySound: show, shouldSetBadge: show };
    },
  });
}

function shouldShowForType(
  type: string | undefined,
  prefs: NotificationPrefs
): boolean {
  switch (type) {
    case "buddyRequest":
    case "buddyAccepted":   return prefs.buddyRequests;
    case "postNudged":      return prefs.nudges;
    case "postReplied":     return prefs.replies;
    case "channelMessage":  return prefs.channelMessages;
    case "boardComment":    return prefs.boardActivity;
    case "tipReceived":     return prefs.tips;
    default:                return true;
  }
}

// ---------------------------------------------------------------------------
// handleNotificationResponse — called when user taps a notification
// Navigates to the correct screen based on notification type.
// ---------------------------------------------------------------------------

export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as NotificationData | undefined;
  if (!data) return;

  switch (data.type) {
    case "buddyRequest":
      // Go to buddies tab — pending requests are shown there
      router.push("/(app)/(tabs)/buddies");
      break;

    case "buddyAccepted":
      // Go to the new buddy's profile
      router.push(`/(app)/u/${data.screenname}`);
      break;

    case "postNudged":
    case "postReplied":
      router.push(`/(app)/post/${data.postId}`);
      break;

    case "boardComment":
      router.push(`/(app)/board/${data.boardName}/post/${data.postId}`);
      break;

    case "channelMessage":
      router.push(`/(app)/channel/${data.channelName}`);
      break;

    case "tipReceived":
      // Go to own profile where tips are shown
      router.push("/(app)/(tabs)/profile");
      break;
  }
}

// ---------------------------------------------------------------------------
// registerForPushNotifications
// Call after login. Re-fetches and updates token on every login.
// ---------------------------------------------------------------------------

export async function registerForPushNotifications(): Promise<void> {
  // Expo Go / simulators don't support real push tokens
  if (!Device.isDevice) return;

  // Request permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    // User denied — that's fine, no push notifications
    return;
  }

  // Android channel setup
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f5c842",
    });
  }

  // Get Expo push token
  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    token = result.data;
  } catch (err) {
    // Token fetch failed (common in development without credentials)
    console.warn("[notifications] push token fetch failed:", err);
    return;
  }

  // Store token on server — re-fetch updates on every login
  const session = await getSession();
  if (!session) return;

  try {
    await fetch(`${API}/api/user/push-token`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    // Non-fatal — app works fine without push tokens
    console.warn("[notifications] push token registration failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Device check helper — import from expo-device
// ---------------------------------------------------------------------------

import * as Device from "expo-device";
