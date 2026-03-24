/**
 * Auto-updater — electron-updater + GitHub Releases.
 *
 * Behaviour:
 *   - Check 3 s after startup, then every 4 hours.
 *   - Update available  → tray/system notification (never intrusive).
 *   - Update downloaded → dialog asking to restart now or later.
 *   - Never force-install. User always has the final say.
 */

import { autoUpdater, type UpdateInfo } from "electron-updater";
import { dialog, Notification, BrowserWindow, app } from "electron";

// Four-hour check interval in milliseconds
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// initUpdater — call after window is created (packaged builds only)
// ---------------------------------------------------------------------------

export function initUpdater(win: BrowserWindow): void {
  // Surface errors ourselves; suppress the default electron-updater logger
  autoUpdater.logger         = null;
  autoUpdater.autoDownload   = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // ── Update available ─────────────────────────────────────────────────────
  // Show a non-intrusive notification so the user knows a download started.
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    if (!Notification.isSupported()) return;
    new Notification({
      title:  "Update downloading…",
      body:   `Signoff Chat ${info.version} is downloading in the background.`,
      silent: true,
    }).show();
  });

  // ── No update ────────────────────────────────────────────────────────────
  autoUpdater.on("update-not-available", () => {
    // Intentionally silent — only log in dev
    if (!app.isPackaged) console.info("[updater] Up to date.");
  });

  // ── Error ────────────────────────────────────────────────────────────────
  autoUpdater.on("error", (err: Error) => {
    console.warn("[updater] Error:", err.message);
  });

  // ── Download progress → renderer subtle indicator ────────────────────────
  autoUpdater.on("download-progress", ({ percent }: { percent: number }) => {
    if (!win.isDestroyed()) {
      win.webContents.send("update-download-progress", Math.floor(percent));
    }
  });

  // ── Update downloaded → ask user ─────────────────────────────────────────
  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    if (win.isDestroyed()) {
      // Window gone — install on next quit (already default via autoInstallOnAppQuit)
      return;
    }

    dialog
      .showMessageBox(win, {
        type:      "info",
        title:     "Update ready",
        message:   `Signoff Chat ${info.version} is ready to install.`,
        detail:
          "Restart now to apply the update, or it will install automatically " +
          "the next time you quit.",
        buttons:   ["Restart now", "Later"],
        defaultId: 0,
        cancelId:  1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      })
      .catch(() => {
        // Dialog dismissed (window destroyed mid-flight) — do nothing
      });
  });

  // ── Initial check (3 s delay — let the app finish initialising) ──────────
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
      console.warn("[updater] Initial check failed:", err.message);
    });
  }, 3_000);

  // ── Periodic check every 4 hours ─────────────────────────────────────────
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
      console.warn("[updater] Periodic check failed:", err.message);
    });
  }, CHECK_INTERVAL_MS);
}
