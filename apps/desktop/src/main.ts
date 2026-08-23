/**
 * Signoff Chat — Electron main process
 *
 * Architecture:
 *   1. Acquire single-instance lock
 *   2. Register signoffchat:// deep-link protocol
 *   3. Spawn Next.js (dev: `next dev` | prod: standalone server.js)
 *   4. Poll localhost:3000 until ready
 *   5. Open BrowserWindow — titleBarStyle hiddenInset on macOS
 *   6. Init local SQLite DB, IPC handlers, tray, shortcuts, updater
 *
 * Window lifecycle:
 *   Close button  → hide to tray (first hide shows a one-time hint)
 *   Cmd+Q ×2/2s  → quit
 *   Tray → Quit  → quit immediately
 */

import {
  app,
  BrowserWindow,
  shell,
  screen,
  ipcMain,
  powerMonitor,
} from "electron";
import { utilityProcess, type UtilityProcess } from "electron";
import { spawn, type ChildProcess } from "child_process";
import * as http from "http";
import * as path from "path";
import Store from "electron-store";

import { initDb, closeDb }                                          from "./localDb";
import { registerIpcHandlers }                                      from "./ipc";
import { createTray, showTrayHint, destroyTray, triggerAwayDialog } from "./tray";
import { registerShortcuts, unregisterShortcuts }                   from "./shortcuts";
import { initUpdater }                                              from "./updater";
import { initNotifications }                                        from "./notifications";
import { openPreferences, registerPrefsIpcHandlers, getCloseBehavior } from "./preferences";
import { initAutoLaunch, wasLaunchedHidden } from "./autoLaunch";

// ---------------------------------------------------------------------------
// Persistent preferences (electron-store)
// ---------------------------------------------------------------------------

interface StoreSchema {
  windowBounds: { x?: number; y?: number; width: number; height: number };
  hasShownTrayHint: boolean;
}

const store = new Store<StoreSchema>({
  name: "preferences",
  defaults: {
    windowBounds:     { width: 1200, height: 800 },
    hasShownTrayHint: false,
  },
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let mainWindow:  BrowserWindow | null = null;
// Deployed web client the shell loads. Override for local dev.
const APP_URL = process.env.SIGNOFF_APP_URL || "https://www.signoff.chat";
let nextServer:  UtilityProcess | ChildProcess | null = null;
let allowQuit  = false;

// ---------------------------------------------------------------------------
// Protocol / deep links
// ---------------------------------------------------------------------------

// Register signoffchat:// as the default protocol client.
// In dev with defaultApp, pass the entry script so the URL isn't ambiguous.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("signoffchat", process.execPath, [
    path.resolve(process.argv[1]),
  ]);
} else {
  app.setAsDefaultProtocolClient("signoffchat");
}

// ---------------------------------------------------------------------------
// Single instance
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  // A second instance tried to open — quit immediately.
  // The first instance handles the deep link in 'second-instance' below.
  app.quit();
  process.exit(0);
}

app.on("second-instance", (_event, argv) => {
  // Windows/Linux: the protocol URL is the last argv entry
  const url = argv.find((arg) => arg.startsWith("signoffchat://"));
  if (url) handleDeepLink(url);

  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// macOS: protocol URL fires as 'open-url' (app may already be running)
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// ---------------------------------------------------------------------------
// Spawn Next.js server
// ---------------------------------------------------------------------------

function spawnNextJs(): UtilityProcess | ChildProcess {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT:                    "3000",
    HOSTNAME:                "127.0.0.1",
    NEXT_PUBLIC_IS_ELECTRON: "true",
  };

  if (app.isPackaged) {
    // Production: bundled standalone build (copied by electron-builder extraResources)
    const serverPath = path.join(process.resourcesPath, "web", "server.js");
    const webDir     = path.join(process.resourcesPath, "web");

    // utilityProcess.fork runs a Node.js script inside Electron's Node runtime —
    // no separate `node` binary needed, works out of the box when packaged.
    return utilityProcess.fork(serverPath, [], {
      cwd: webDir,
      env,
      stdio: "pipe",
    });
  } else {
    // Development: run `next dev` from the web workspace
    const webDir = path.resolve(__dirname, "../../../web");
    const cmd    = process.platform === "win32" ? "npm.cmd" : "npm";

    const child = spawn(cmd, ["run", "dev"], {
      cwd:   webDir,
      env,
      stdio: "pipe",
      shell: false,
    });

    child.stdout?.on("data", (d: Buffer) =>
      process.stdout.write(`[next] ${d}`)
    );
    child.stderr?.on("data", (d: Buffer) =>
      process.stderr.write(`[next] ${d}`)
    );

    return child;
  }
}

// ---------------------------------------------------------------------------
// Wait for the Next.js server to be reachable
// ---------------------------------------------------------------------------

function waitForServer(
  maxAttempts = 30,
  intervalMs  = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const attempt = () => {
      const req = http.get("http://127.0.0.1:3000", (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (++attempts >= maxAttempts) {
          reject(
            new Error(
              "Next.js server did not become ready within the timeout."
            )
          );
        } else {
          setTimeout(attempt, intervalMs);
        }
      });
      req.end();
    };

    attempt();
  });
}

// ---------------------------------------------------------------------------
// Deep-link handler
// ---------------------------------------------------------------------------

function handleDeepLink(url: string): void {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible())  mainWindow.show();
  mainWindow.focus();

  mainWindow.webContents.send("deep-link", url);
}

// ---------------------------------------------------------------------------
// Parse deep-link path for internal navigation
// signoffchat://invite/{token}  → /invite/{token}
// signoffchat://u/{screenname}  → /u/{screenname}
// signoffchat://board/{name}    → /board/{name}
// ---------------------------------------------------------------------------

function deepLinkToPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host   = parsed.hostname; // e.g. "invite", "u", "board"
    const rest   = parsed.pathname; // e.g. "/some-token"
    return `/${host}${rest}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// BrowserWindow — with saved bounds and off-screen guard
// ---------------------------------------------------------------------------

function createWindow(): BrowserWindow {
  const savedBounds = store.get("windowBounds");

  // Guard against saved position being off-screen (e.g. after monitor removal)
  const displays = screen.getAllDisplays();
  const onScreen = displays.some((d) => {
    const b = d.bounds;
    return (
      savedBounds.x !== undefined &&
      savedBounds.x >= b.x &&
      savedBounds.x < b.x + b.width &&
      savedBounds.y !== undefined &&
      savedBounds.y >= b.y &&
      savedBounds.y < b.y + b.height
    );
  });

  const windowOptions = {
    width:  savedBounds.width,
    height: savedBounds.height,
    ...(onScreen && savedBounds.x !== undefined
      ? { x: savedBounds.x, y: savedBounds.y }
      : {}),
  };

  const win = new BrowserWindow({
    ...windowOptions,
    minWidth:       900,
    minHeight:      600,
    titleBarStyle:  process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#0d0d0b",
    show:           false, // reveal after ready-to-show to avoid white flash
    icon:
      process.platform === "linux"
        ? path.join(__dirname, "../assets/icon.png")
        : undefined,
    webPreferences: {
      preload:          path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false, // preload needs Node APIs via contextBridge
      webSecurity:      true,
    },
  });

  // ── Load the app ──────────────────────────────────────────────────────────
  // Thin shell: load the deployed web client directly (no bundled Next server).
  // Override with SIGNOFF_APP_URL for local dev (e.g. http://localhost:3000).
  win.loadURL(APP_URL);

  // ── Show after first paint ────────────────────────────────────────────────
  win.once("ready-to-show", () => win.show());

  // ── Save window bounds on resize / move ───────────────────────────────────
  const saveBounds = () => {
    if (!win.isMaximized() && !win.isMinimized()) {
      store.set("windowBounds", win.getBounds());
    }
  };
  win.on("resize", saveBounds);
  win.on("move",   saveBounds);

  // ── Close → hide to tray or quit, based on user preference ──────────────
  win.on("close", (event) => {
    if (allowQuit) return; // real quit — let it through

    if (getCloseBehavior() === "quit") {
      quitApp();
      return;
    }

    event.preventDefault();
    win.hide();

    // On macOS, hide the dock icon so the app truly disappears from the UI
    if (process.platform === "darwin") {
      app.dock?.hide();
    }

    if (!store.get("hasShownTrayHint")) {
      store.set("hasShownTrayHint", true);
      showTrayHint();
    }
  });

  // Restore dock icon when window is shown again
  win.on("show", () => {
    if (process.platform === "darwin") {
      app.dock?.show();
    }
  });

  // ── External links → system browser ──────────────────────────────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Keep in-window navigation to our own app; open everything else externally.
  win.webContents.on("will-navigate", (event, url) => {
    const parsed = new URL(url);
    const isOwn =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "signoff.chat" ||
      parsed.hostname.endsWith(".signoff.chat");
    if (!isOwn) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // ── Keyboard shortcut Cmd+Shift+A → re-emit to tray module ───────────────
  // tray.ts listens on the same "shortcut-away-message" channel via ipcMain.
  // Nothing needed here — tray.ts has registered its own ipcMain.on listener.

  return win;
}

// ---------------------------------------------------------------------------
// Quit helpers
// ---------------------------------------------------------------------------

function quitApp(): void {
  allowQuit = true;
  app.quit();
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  // Thin shell: no bundled Next.js server — we load the deployed web client.
  // (SIGNOFF_APP_URL can point at a local dev server instead.)

  // 3. Init local DB
  initDb();

  // 4. Init auto-launch (must be after app is ready)
  initAutoLaunch();

  // 5. Create window
  mainWindow = createWindow();

  // 6a. Register IPC handlers (needs mainWindow reference)
  registerIpcHandlers(mainWindow);
  registerPrefsIpcHandlers();

  // 6b. If auto-launched with start-minimized, keep window hidden initially
  if (wasLaunchedHidden()) {
    mainWindow.hide();
    if (process.platform === "darwin") app.dock?.hide();
  }

  // 7. Tray
  createTray(mainWindow, quitApp);

  // 8. Shortcuts
  registerShortcuts(
    mainWindow,
    quitApp,
    () => triggerAwayDialog(mainWindow!),
    () => openPreferences(mainWindow!)
  );

  // 9. Notification system
  initNotifications(mainWindow);

  // 10. Auto-updater (packaged builds only)
  if (app.isPackaged) {
    initUpdater(mainWindow);
  }

  // 11. Reconnect Soketi after system sleep/wake
  powerMonitor.on("resume", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("check-soketi-state");
  });

  // Renderer responds with its Soketi connection state
  ipcMain.on(
    "soketi-state",
    (_event, { connected, unreadCount }: { connected: boolean; unreadCount: number }) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (!connected) {
        mainWindow.webContents.send("reconnect-soketi");
      }
      // Show a notification if messages arrived while the machine was asleep
      if (unreadCount > 0) {
        mainWindow.webContents.send("navigate", "/channels");
      }
    }
  );

  // macOS: re-open window when dock icon is clicked and no windows are visible
  app.on("activate", () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Handle cold-start deep link (macOS)
  // The 'open-url' event fires before app.whenReady in some cases;
  // if it fired before we were ready, the URL is in process.argv on Windows/Linux.
  const coldStartUrl = process.argv
    .slice(1)
    .find((a) => a.startsWith("signoffchat://"));
  if (coldStartUrl && mainWindow) {
    mainWindow.once("ready-to-show", () => handleDeepLink(coldStartUrl));
  }
});

// Don't quit when all windows are closed on macOS — tray keeps the app alive
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    quitApp();
  }
});

app.on("will-quit", () => {
  unregisterShortcuts();
  destroyTray();
  closeDb();

  // Terminate the Next.js server process
  if (nextServer) {
    if ("kill" in nextServer) {
      (nextServer as ChildProcess).kill("SIGTERM");
    } else {
      (nextServer as UtilityProcess).kill();
    }
    nextServer = null;
  }
});
