/**
 * Desktop notifications — Electron Notification API.
 *
 * Philosophy (mirrors the mobile lib):
 *   Notifications exist to help users connect, not to re-engage them.
 *
 * NEVER sent:
 *   ✗ "X is online now"                 — surveillance
 *   ✗ "You haven't posted in X days"    — engagement bait
 *   ✗ "X people viewed your post"       — we don't track views
 *   ✗ Any marketing / re-engagement notification
 *
 * Suppression rules:
 *   1. User is INVISIBLE → suppress everything.
 *   2. Window is focused AND user is on the relevant screen → suppress.
 *      (They can already see what the notification would tell them.)
 *
 * Content privacy:
 *   Notification content is NEVER logged anywhere — not here, not on the server.
 *   Previews are truncated client-side before display.
 */

import { Notification, BrowserWindow, ipcMain, app } from "electron";
import Store from "electron-store";
import path from "path";
import { spawn } from "child_process";

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export interface NotificationPrefs {
  enabled:         boolean;
  buddyRequests:   boolean;
  nudges:          boolean;
  replies:         boolean;
  channelMessages: boolean;
  boardActivity:   boolean;
  tips:            boolean;
  sounds:          boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled:         true,
  buddyRequests:   true,
  nudges:          true,
  replies:         true,
  channelMessages: true,
  boardActivity:   true,
  tips:            true,
  sounds:          true,
};

interface NotifStoreSchema {
  prefs: NotificationPrefs;
}

const notifStore = new Store<NotifStoreSchema>({
  name: "notification-preferences",
  defaults: { prefs: DEFAULT_PREFS },
});

export function getNotificationPrefs(): NotificationPrefs {
  return { ...DEFAULT_PREFS, ...notifStore.get("prefs") };
}

export function setNotificationPrefs(
  partial: Partial<NotificationPrefs>
): void {
  notifStore.set("prefs", { ...getNotificationPrefs(), ...partial });
}

// ---------------------------------------------------------------------------
// Runtime state (populated via IPC from renderer)
// ---------------------------------------------------------------------------

let mainWindow:  BrowserWindow | null = null;
let activePath:  string = "";          // current route the renderer is showing
let userStatus:  string = "OFFLINE";   // ONLINE | AWAY | IDLE | OFFLINE | INVISIBLE

// ---------------------------------------------------------------------------
// initNotifications — call once from main.ts after window is created
// ---------------------------------------------------------------------------

export function initNotifications(win: BrowserWindow): void {
  mainWindow = win;

  // Renderer reports its current route on every navigation
  ipcMain.on("active-path", (_e, p: string) => {
    activePath = p ?? "";
  });

  // Keep status in sync (tray.ts also listens to this — both is fine)
  ipcMain.on("status-changed", (_e, status: string) => {
    userStatus = status;
  });
  ipcMain.on("auth-state", (_e, payload: { status: string } | null) => {
    userStatus = payload?.status ?? "OFFLINE";
    if (!payload) activePath = "";
  });

  // Renderer can read/write preferences from a settings page
  ipcMain.handle("notif-get-prefs", () => getNotificationPrefs());
  ipcMain.handle("notif-set-prefs", (_e, partial: Partial<NotificationPrefs>) => {
    setNotificationPrefs(partial);
  });

  // DM notification triggered from renderer when a new DM arrives via Pusher
  ipcMain.on(
    "notify-dm",
    (_e, payload: { fromUserId: string; screenname: string; preview: string }) => {
      notifyDirectMessage(payload.fromUserId, payload.screenname, payload.preview);
    }
  );
}

// ---------------------------------------------------------------------------
// Suppression helpers
// ---------------------------------------------------------------------------

/** Returns true if the notification should be suppressed. */
function suppressed(
  prefKey: keyof Omit<NotificationPrefs, "enabled" | "sounds">,
  relevantPath?: string | string[]
): boolean {
  const prefs = getNotificationPrefs();

  if (!prefs.enabled)      return true;
  if (!prefs[prefKey])     return true;
  if (userStatus === "INVISIBLE") return true;

  // Suppress if the window is focused and the user is already on the relevant screen
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
    if (relevantPath === undefined) return true; // no specific screen → always suppress when focused

    const paths = Array.isArray(relevantPath) ? relevantPath : [relevantPath];
    if (paths.some((p) => activePath === p || activePath.startsWith(p + "/"))) {
      return true;
    }
  }

  return false;
}

function truncate(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Show the window and send a navigate IPC to the renderer. */
function focusAndNavigate(path: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible())  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("navigate", path);
}

// ---------------------------------------------------------------------------
// Sound playback
// Platform-native, fire-and-forget subprocess.
// All sounds are < 1 second and in assets/sounds/.
// ---------------------------------------------------------------------------

type SoundName = "nudge" | "message" | "buddy-online";

function soundsDir(): string {
  // In packaged builds, sounds are unpacked from asar via asarUnpack rule.
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "assets",
      "sounds"
    );
  }
  return path.join(__dirname, "../assets/sounds");
}

function playSound(name: SoundName): void {
  if (!getNotificationPrefs().sounds) return;

  const file = path.join(soundsDir(), `${name}.wav`);

  let cmd: string;
  let args: string[];

  switch (process.platform) {
    case "darwin":
      cmd  = "afplay";
      args = [file];
      break;
    case "linux":
      cmd  = "aplay";
      args = ["--quiet", file];
      break;
    case "win32":
      cmd  = "powershell";
      // Use single-quotes inside the PS string to avoid injection via file path
      args = [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(New-Object System.Media.SoundPlayer([string]'${file.replace(/'/g, "''")}')).PlaySync()`,
      ];
      break;
    default:
      return;
  }

  // detached + unref so it outlives this process's event loop tick without blocking
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

// ---------------------------------------------------------------------------
// Notification factory — centralises creation + default click handler
// ---------------------------------------------------------------------------

interface NotifOptions {
  title:        string;
  body:         string;
  navigateTo?:  string;
  sound?:       SoundName;
  /** macOS only. Buttons shown in the notification banner. */
  actions?:     { text: string; onAction: () => void }[];
}

function fire({ title, body, navigateTo, sound, actions }: NotifOptions): void {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title,
    body,
    // macOS action buttons (up to 2 shown in banner)
    ...(process.platform === "darwin" && actions?.length
      ? {
          actions: actions.map((a) => ({ type: "button" as const, text: a.text })),
        }
      : {}),
  });

  notification.on("click", () => {
    if (navigateTo) focusAndNavigate(navigateTo);
  });

  if (process.platform === "darwin" && actions?.length) {
    notification.on("action", (_e, index) => {
      actions[index]?.onAction();
    });
  }

  notification.show();

  if (sound) playSound(sound);
}

// ---------------------------------------------------------------------------
// Public notification functions
// ---------------------------------------------------------------------------

export function notifyBuddyRequest(screenname: string): void {
  if (suppressed("buddyRequests", "/buddies")) return;

  fire({
    title:      "buddy request",
    body:       `${screenname} wants to be your buddy`,
    navigateTo: "/buddies",
    sound:      "buddy-online",
    actions: [
      {
        text: "Accept",
        onAction: () => {
          // Tell the renderer to call the accept API
          mainWindow?.webContents.send("buddy-request-accept", screenname);
        },
      },
      {
        text: "View",
        onAction: () => focusAndNavigate("/buddies"),
      },
    ],
  });
}

export function notifyBuddyAccepted(screenname: string): void {
  if (suppressed("buddyRequests", ["/buddies", `/u/${screenname}`])) return;

  fire({
    title:      "buddy request accepted",
    body:       `${screenname} is now your buddy`,
    navigateTo: `/u/${screenname}`,
    sound:      "buddy-online",
  });
}

export function notifyPostNudged(screenname: string, postId: string, preview: string): void {
  if (suppressed("nudges", `/post/${postId}`)) return;

  fire({
    title:      "nudge",
    body:       `${screenname} nudged: ${truncate(preview)}`,
    navigateTo: `/post/${postId}`,
    sound:      "nudge",
  });
}

export function notifyPostReplied(screenname: string, postId: string, preview: string): void {
  if (suppressed("replies", `/post/${postId}`)) return;

  fire({
    title:      "new reply",
    body:       `${screenname}: ${truncate(preview)}`,
    navigateTo: `/post/${postId}`,
    sound:      "message",
  });
}

export function notifyBoardComment(
  boardName:  string,
  screenname: string,
  postId:     string,
  postTitle:  string
): void {
  if (suppressed("boardActivity", `/board/${boardName}/post/${postId}`)) return;

  fire({
    title:      boardName,
    body:       `${screenname} commented on "${truncate(postTitle, 50)}"`,
    navigateTo: `/board/${boardName}/post/${postId}`,
    sound:      "message",
  });
}

/**
 * channelMessage — only fires when the window is hidden OR the user is not
 * on that specific channel screen.  The general suppression logic in
 * suppressed() already handles the focused+on-screen case; this function
 * adds no extra logic.
 */
export function notifyChannelMessage(
  channelName: string,
  screenname:  string,
  preview:     string
): void {
  if (suppressed("channelMessages", `/channel/${channelName}`)) return;

  fire({
    title:      `#${channelName}`,
    body:       `${screenname}: ${truncate(preview)}`,
    navigateTo: `/channel/${channelName}`,
    sound:      "message",
  });
}

export function notifyDirectMessage(
  fromUserId: string,
  screenname: string,
  preview: string
): void {
  if (suppressed("channelMessages", `/dm/${fromUserId}`)) return;

  fire({
    title:      "direct message",
    body:       `${screenname}: ${truncate(preview)}`,
    navigateTo: `/dm/${fromUserId}`,
    sound:      "message",
  });
}

export function notifyTipReceived(screenname: string, amountCents: number): void {
  if (suppressed("tips", "/profile")) return;

  const dollars = (amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2);

  fire({
    title:      "tip received",
    body:       `${screenname} sent you $${dollars}`,
    navigateTo: "/profile",
    // No sound — tips are rare and surprising enough on their own
  });
}
