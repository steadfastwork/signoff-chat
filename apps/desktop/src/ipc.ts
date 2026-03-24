/**
 * IPC handlers — bridge between the renderer (Next.js) and the main process.
 *
 * All DB access goes through here. The renderer calls these via the
 * contextBridge API exposed in preload.ts — never directly.
 */

import { ipcMain, app, BrowserWindow } from "electron";
import {
  getMessages,
  saveMessage,
  getFeedPosts,
  saveFeedPost,
  clearChannel,
  clearAllData,
  type LocalMessage,
  type LocalPost,
} from "./localDb";
import { getAutoLaunchEnabled, setAutoLaunch } from "./autoLaunch";
import { getCloseBehavior } from "./preferences";

export function registerIpcHandlers(win: BrowserWindow): void {
  // ── Message archive ──────────────────────────────────────────────────────

  ipcMain.handle(
    "db-get-messages",
    (_event, { channelId, limit }: { channelId: string; limit?: number }) => {
      return getMessages(channelId, limit);
    }
  );

  ipcMain.handle(
    "db-save-message",
    (_event, { message }: { message: LocalMessage }) => {
      saveMessage(message);
    }
  );

  // ── Feed post cache ──────────────────────────────────────────────────────

  ipcMain.handle(
    "db-get-feed",
    (_event, { limit }: { limit?: number }) => {
      return getFeedPosts(limit);
    }
  );

  ipcMain.handle(
    "db-save-post",
    (_event, { post }: { post: LocalPost }) => {
      saveFeedPost(post);
    }
  );

  // ── Channel management ───────────────────────────────────────────────────

  ipcMain.handle(
    "db-clear-channel",
    (_event, { channelId }: { channelId: string }) => {
      clearChannel(channelId);
    }
  );

  // ── Account deletion — wipes local archive ───────────────────────────────

  ipcMain.handle("db-clear-all", () => {
    clearAllData();
  });

  // ── App info ─────────────────────────────────────────────────────────────

  ipcMain.handle("get-version", () => app.getVersion());

  // ── Auto-launch ──────────────────────────────────────────────────────────

  ipcMain.handle("get-auto-launch", () => getAutoLaunchEnabled());

  ipcMain.handle(
    "set-auto-launch",
    (_event, { enabled }: { enabled: boolean }) => setAutoLaunch(enabled)
  );

  // ── Preferences snapshot (flat merged object for renderer) ───────────────
  // Returns the user-configurable behavior prefs so the renderer can read
  // them in one round-trip (e.g., for a settings page in the web UI).

  ipcMain.handle("get-preferences", async () => {
    const [autoLaunch] = await Promise.all([getAutoLaunchEnabled()]);
    return {
      closeBehavior: getCloseBehavior(),
      autoLaunch,
    };
  });

  ipcMain.handle(
    "set-preference",
    async (
      _event,
      { key, value }: { key: string; value: unknown }
    ) => {
      if (key === "autoLaunch" && typeof value === "boolean") {
        await setAutoLaunch(value);
      }
      // closeBehavior is handled by prefs-set-close-behavior in preferences.ts
    }
  );

  // ── App lifecycle ─────────────────────────────────────────────────────────

  ipcMain.handle("quit-app", () => {
    app.quit();
  });

  ipcMain.handle("show-window", () => {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  ipcMain.handle("hide-window", () => {
    win.hide();
  });

  // ── Update check (also registered as ipcMain.on in main.ts for tray) ─────

  ipcMain.handle("check-for-updates", () => {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  });
}
