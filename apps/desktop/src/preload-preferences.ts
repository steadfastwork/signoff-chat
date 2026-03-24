/**
 * Preload for the Preferences window.
 *
 * Exposes window.prefsAPI — a narrow, typed surface for the preferences
 * window HTML to call back into the main process.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("prefsAPI", {
  // ── Notification preferences ──────────────────────────────────────────────
  getNotifPrefs: (): Promise<{
    enabled: boolean; buddyRequests: boolean; nudges: boolean;
    replies: boolean; channelMessages: boolean; boardActivity: boolean;
    tips: boolean; sounds: boolean;
  }> => ipcRenderer.invoke("notif-get-prefs"),

  setNotifPrefs: (partial: Record<string, boolean>): Promise<void> =>
    ipcRenderer.invoke("notif-set-prefs", partial),

  // ── Close behavior ────────────────────────────────────────────────────────
  getCloseBehavior: (): Promise<"hide" | "quit"> =>
    ipcRenderer.invoke("prefs-get-close-behavior"),

  setCloseBehavior: (value: "hide" | "quit"): Promise<void> =>
    ipcRenderer.invoke("prefs-set-close-behavior", value),

  // ── Launch at login ───────────────────────────────────────────────────────
  getLaunchAtLogin: (): Promise<boolean> =>
    ipcRenderer.invoke("prefs-get-launch-at-login"),

  setLaunchAtLogin: (value: boolean): Promise<void> =>
    ipcRenderer.invoke("prefs-set-launch-at-login", value),

  // ── App metadata ──────────────────────────────────────────────────────────
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke("get-version"),

  getPlatform: (): string =>
    process.platform,

  // ── Local storage ─────────────────────────────────────────────────────────
  clearLocalHistory: (): Promise<void> =>
    ipcRenderer.invoke("db-clear-all"),

  // ── Updates ───────────────────────────────────────────────────────────────
  checkForUpdates: (): void =>
    ipcRenderer.send("check-for-updates"),

  // ── Account ───────────────────────────────────────────────────────────────
  openDeleteAccount: (): void =>
    ipcRenderer.send("prefs-open-delete-account"),

  // ── Window ────────────────────────────────────────────────────────────────
  close: (): void =>
    ipcRenderer.send("prefs-close"),
});
