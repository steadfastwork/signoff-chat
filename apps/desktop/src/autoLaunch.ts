/**
 * Auto-launch — start Signoff Chat when the user logs in.
 *
 * Uses the `auto-launch` npm package (cross-platform: launchd on macOS,
 * registry on Windows, .desktop entry on Linux).
 *
 * Separate from Electron's built-in app.setLoginItemSettings() so that
 * we can pass the --hidden flag for "start minimized" support.
 *
 * Usage:
 *   initAutoLaunch()           — call once after app.whenReady()
 *   getAutoLaunchEnabled()     — returns Promise<boolean>
 *   setAutoLaunch(true/false)  — enable / disable
 *   wasLaunchedHidden()        — true if app was auto-launched with --hidden
 */

import { app } from "electron";
// auto-launch ships CommonJS; require() avoids ESM interop issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AutoLaunch = require("auto-launch");

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let launcher: {
  enable():    Promise<void>;
  disable():   Promise<void>;
  isEnabled(): Promise<boolean>;
} | null = null;

// ---------------------------------------------------------------------------
// initAutoLaunch — call once after app is ready
// ---------------------------------------------------------------------------

export function initAutoLaunch(): void {
  launcher = new AutoLaunch({
    name:     app.getName(),
    mac:      { useLaunchAgent: true },
    // Pass --hidden so wasLaunchedHidden() can detect start-minimized
    path:     app.getPath("exe"),
    isHidden: true, // always register with --hidden; main.ts decides whether to show
  });
}

// ---------------------------------------------------------------------------
// getAutoLaunchEnabled
// ---------------------------------------------------------------------------

export async function getAutoLaunchEnabled(): Promise<boolean> {
  if (!launcher) return false;
  try {
    return await launcher.isEnabled();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// setAutoLaunch
// ---------------------------------------------------------------------------

export async function setAutoLaunch(enabled: boolean): Promise<void> {
  if (!launcher) return;
  if (enabled) {
    await launcher.enable();
  } else {
    await launcher.disable();
  }
}

// ---------------------------------------------------------------------------
// wasLaunchedHidden — detect auto-launch with --hidden flag
// ---------------------------------------------------------------------------

export function wasLaunchedHidden(): boolean {
  if (process.platform === "darwin") {
    // Electron sets this when the app was launched via a login item with
    // the "start hidden" flag (LSUIElement or --hidden arg)
    return app.getLoginItemSettings().wasOpenedAsHidden ?? false;
  }
  return process.argv.includes("--hidden");
}
