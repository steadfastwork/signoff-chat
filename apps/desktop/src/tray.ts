/**
 * Tray — icon, badge, context menu, away-message dialog.
 *
 * Icon variants (provide all files in assets/):
 *   tray-template.png      macOS OFFLINE/INVISIBLE — template image, auto dark/light
 *   tray-base.png          macOS base for compositing (used when adding status dot)
 *   tray-icon.png          Windows + Linux base icon
 *   tray-template@2x.png   macOS Retina template
 *   tray-base@2x.png       macOS Retina base
 *   tray-icon@2x.png       Windows/Linux Retina
 *
 * Status dot: drawn at runtime onto the base bitmap — no extra deps needed.
 * macOS OFFLINE/INVISIBLE skips the dot and uses the template image instead,
 * so it adapts cleanly to both dark and light menu bars.
 */

import {
  app,
  Menu,
  Tray,
  BrowserWindow,
  shell,
  nativeImage,
  ipcMain,
  dialog,
} from "electron";
import Store from "electron-store";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserStatus = "ONLINE" | "AWAY" | "IDLE" | "OFFLINE" | "INVISIBLE";
type NotificationPref  = "all" | "buddy-requests-only" | "none";

interface TrayState {
  screenname:       string;
  status:           UserStatus;
  awayMessage:      string;
  unreadCount:      number;
}

interface TrayPrefs {
  notificationPref: NotificationPref;
}

// ---------------------------------------------------------------------------
// Status dot colors — RGBA
// ---------------------------------------------------------------------------

const DOT_COLOR: Partial<Record<UserStatus, readonly [number, number, number, number]>> = {
  ONLINE: [34,  197, 94,  255], // green
  AWAY:   [245, 200, 66,  255], // amber
  IDLE:   [148, 163, 184, 255], // slate-400
};

const STATUS_LABEL: Record<UserStatus, string> = {
  ONLINE:    "● Online",
  AWAY:      "● Away",
  IDLE:      "● Idle",
  OFFLINE:   "○ Offline",
  INVISIBLE: "○ Invisible",
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let tray:    Tray          | null = null;
let awayWin: BrowserWindow | null = null;

let state: TrayState = {
  screenname:  "",
  status:      "OFFLINE",
  awayMessage: "",
  unreadCount: 0,
};

const trayStore = new Store<TrayPrefs>({
  name: "tray-preferences",
  defaults: { notificationPref: "all" },
});

// ---------------------------------------------------------------------------
// Status dot compositing
// Draws a filled circle + dark outline onto a raw RGBA bitmap buffer.
// ---------------------------------------------------------------------------

function drawStatusDot(
  bitmap: Buffer,
  width:  number,
  height: number,
  color:  readonly [number, number, number, number]
): Buffer {
  const buf = Buffer.from(bitmap); // copy — don't mutate the original

  // Position: bottom-right at (width−4, height−4), radius 3 px, border radius 4 px
  const cx = width  - 4;
  const cy = height - 4;

  // Outer border (1 px dark ring for contrast on any background)
  fillCircle(buf, width, cx, cy, 4, [15, 14, 12, 210]);
  // Colored dot
  fillCircle(buf, width, cx, cy, 3, color);

  return buf;
}

function fillCircle(
  buf:    Buffer,
  stride: number,
  cx:     number,
  cy:     number,
  r:      number,
  color:  readonly [number, number, number, number]
): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0) continue;
      const i = (y * stride + x) * 4;
      if (i + 3 >= buf.length) continue;
      buf[i]     = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = color[3];
    }
  }
}

// ---------------------------------------------------------------------------
// Build the tray icon for the current status
// ---------------------------------------------------------------------------

function buildTrayIcon(status: UserStatus): Electron.NativeImage {
  const dotColor = DOT_COLOR[status];

  // macOS + no dot: use template image (adapts to dark/light menu bar)
  if (process.platform === "darwin" && !dotColor) {
    const img = nativeImage.createFromPath(
      path.join(__dirname, "../assets/tray-template.png")
    );
    img.isMacTemplateImage = true;
    return img;
  }

  // Load base PNG for compositing
  const baseName =
    process.platform === "darwin" ? "tray-base.png" : "tray-icon.png";
  const base = nativeImage.createFromPath(
    path.join(__dirname, "../assets", baseName)
  );

  if (base.isEmpty() || !dotColor) return base;

  const { width, height } = base.getSize();
  const bitmap     = base.toBitmap();
  const composited = drawStatusDot(bitmap, width, height, dotColor);

  return nativeImage.createFromBitmap(composited, { width, height });
}

// ---------------------------------------------------------------------------
// Badge / unread count
// ---------------------------------------------------------------------------

function updateBadge(count: number): void {
  if (process.platform === "darwin") {
    app.setBadgeCount(count);
    return;
  }

  // Windows / Linux: taskbar overlay icon
  if (!tray) return;
  if (count === 0) {
    // Clear overlay — use null image
    // (Overlay is on BrowserWindow, not tray; handled separately in main.ts)
    return;
  }
}

// ---------------------------------------------------------------------------
// Away message dialog
// 300×130, frameless, always-on-top, pre-filled with current message.
// ---------------------------------------------------------------------------

function openAwayDialog(win: BrowserWindow): void {
  if (awayWin && !awayWin.isDestroyed()) {
    awayWin.focus();
    return;
  }

  awayWin = new BrowserWindow({
    width:       300,
    height:      130,
    frame:       false,
    alwaysOnTop: true,
    resizable:   false,
    movable:     true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload:          path.join(__dirname, "preload-away.js"),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  // Load inline HTML — no separate file needed
  awayWin.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(awayDialogHtml())
  );

  // Inject the current away message after load
  awayWin.webContents.once("did-finish-load", () => {
    awayWin?.webContents
      .executeJavaScript(
        `document.getElementById("msg").value = ${JSON.stringify(state.awayMessage)};
         document.getElementById("msg").select();`
      )
      .catch(() => {});
  });

  // Result handlers — once each, cleaned up on window close
  const onSet = (_e: Electron.IpcMainEvent, message: string) => {
    state.awayMessage = message;
    win.webContents.send("set-away-message", message);
    awayWin?.close();
  };
  const onCancel = () => awayWin?.close();

  ipcMain.once("away-dialog-set",    onSet);
  ipcMain.once("away-dialog-cancel", onCancel);

  awayWin.on("closed", () => {
    ipcMain.removeListener("away-dialog-set",    onSet);
    ipcMain.removeListener("away-dialog-cancel", onCancel);
    awayWin = null;
  });
}

function awayDialogHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:     #191714;
    --card:   #0f0e0c;
    --border: #2c2820;
    --text:   #e8e4d9;
    --muted:  #7a7060;
    --amber:  #f5c842;
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 13px;
    padding: 14px;
    user-select: none;
    -webkit-app-region: drag;
    overflow: hidden;
  }
  .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .8px;
    color: var(--muted);
    margin-bottom: 7px;
  }
  input {
    -webkit-app-region: no-drag;
    display: block;
    width: 100%;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 7px 9px;
    font-size: 13px;
    margin-bottom: 10px;
    outline: none;
    border-radius: 2px;
  }
  input::placeholder { color: var(--muted); }
  input:focus { border-color: var(--amber); }
  .row {
    -webkit-app-region: no-drag;
    display: flex;
    justify-content: flex-end;
    gap: 7px;
  }
  button {
    background: none;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 5px 14px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 2px;
  }
  button:hover { border-color: var(--muted); }
  .primary {
    background: var(--amber);
    border-color: var(--amber);
    color: #0d0d0b;
    font-weight: 600;
  }
  .primary:hover { background: #e8ba30; border-color: #e8ba30; }
</style>
</head>
<body>
<div class="label">away message</div>
<input id="msg" type="text" maxlength="140"
       placeholder="brb. back when i'm back." autocomplete="off" spellcheck="false" />
<div class="row">
  <button onclick="window.awayAPI.cancel()">cancel</button>
  <button class="primary" onclick="doSet()">set</button>
</div>
<script>
  document.getElementById("msg").addEventListener("keydown", function (e) {
    if (e.key === "Enter")  doSet();
    if (e.key === "Escape") window.awayAPI.cancel();
  });
  function doSet() {
    window.awayAPI.set(document.getElementById("msg").value.trim());
  }
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Build the full context menu
// ---------------------------------------------------------------------------

function buildMenu(win: BrowserWindow, onQuit: () => void): Electron.Menu {
  const notifPref = trayStore.get("notificationPref");
  const launchAtLogin = app.getLoginItemSettings().openAtLogin;
  const authenticated = state.screenname.length > 0;

  const send = (channel: string, ...args: unknown[]) =>
    win.webContents.send(channel, ...args);

  const navigate = (path: string) => {
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
    send("navigate", path);
  };

  return Menu.buildFromTemplate([
    // ── Identity ────────────────────────────────────────────────────────────
    {
      label:   "SIGNOFF.CHAT",
      enabled: false,
    },
    {
      label:   authenticated
        ? `${state.screenname}  ${STATUS_LABEL[state.status]}`
        : "Not signed in",
      enabled: false,
    },
    { type: "separator" },

    // ── Status picker ────────────────────────────────────────────────────────
    {
      label:   "● Online",
      type:    "radio",
      checked: state.status === "ONLINE",
      enabled: authenticated,
      click:   () => { state.status = "ONLINE"; applyStatusChange(win, onQuit); send("set-status", "ONLINE"); },
    },
    {
      label:   "◌ Away",
      type:    "radio",
      checked: state.status === "AWAY",
      enabled: authenticated,
      click:   () => { state.status = "AWAY"; applyStatusChange(win, onQuit); send("set-status", "AWAY"); },
    },
    {
      label:   "◌ Idle",
      type:    "radio",
      checked: state.status === "IDLE",
      enabled: authenticated,
      click:   () => { state.status = "IDLE"; applyStatusChange(win, onQuit); send("set-status", "IDLE"); },
    },
    {
      label:   "◌ Invisible",
      type:    "radio",
      checked: state.status === "INVISIBLE",
      enabled: authenticated,
      click:   () => { state.status = "INVISIBLE"; applyStatusChange(win, onQuit); send("set-status", "INVISIBLE"); },
    },
    { type: "separator" },

    // ── Navigation ───────────────────────────────────────────────────────────
    {
      label:        "Feed",
      accelerator:  "CmdOrCtrl+1",
      enabled:      authenticated,
      click:        () => navigate("/feed"),
    },
    {
      label:        "Channels",
      accelerator:  "CmdOrCtrl+2",
      enabled:      authenticated,
      click:        () => navigate("/channels"),
    },
    {
      label:        "Boards",
      accelerator:  "CmdOrCtrl+3",
      enabled:      authenticated,
      click:        () => navigate("/boards"),
    },
    {
      label:        "Buddies",
      accelerator:  "CmdOrCtrl+4",
      enabled:      authenticated,
      click:        () => navigate("/buddies"),
    },
    { type: "separator" },

    // ── Actions ───────────────────────────────────────────────────────────────
    {
      label:       "New post\u2026",
      accelerator: "CmdOrCtrl+N",
      enabled:     authenticated,
      click:       () => { navigate("/feed"); send("focus-composer"); },
    },
    {
      label:       "Set away message",
      accelerator: process.platform === "darwin" ? "Command+Shift+A" : "Ctrl+Shift+A",
      enabled:     authenticated,
      click:       () => openAwayDialog(win),
    },
    { type: "separator" },

    // ── Notification preference (submenu) ─────────────────────────────────────
    {
      label: "Notifications",
      submenu: [
        {
          label:   "✓ All",
          type:    "radio",
          checked: notifPref === "all",
          click:   () => { trayStore.set("notificationPref", "all"); rebuildMenu(win, onQuit); },
        },
        {
          label:   "Buddy requests only",
          type:    "radio",
          checked: notifPref === "buddy-requests-only",
          click:   () => { trayStore.set("notificationPref", "buddy-requests-only"); rebuildMenu(win, onQuit); },
        },
        {
          label:   "None",
          type:    "radio",
          checked: notifPref === "none",
          click:   () => { trayStore.set("notificationPref", "none"); rebuildMenu(win, onQuit); },
        },
      ],
    },
    { type: "separator" },

    // ── System ────────────────────────────────────────────────────────────────
    {
      label:   "Launch at login",
      type:    "checkbox",
      checked: launchAtLogin,
      click:   (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: "separator" },

    {
      label: "About",
      click: () => {
        dialog.showMessageBox(win, {
          type:    "info",
          title:   "Signoff Chat",
          message: `Signoff Chat ${app.getVersion()}`,
          detail:  "speak freely. disconnect proudly.\n\nsignoffchat.com",
          buttons: ["OK"],
        });
      },
    },
    {
      label: "Check for updates\u2026",
      click: () => win.webContents.send("check-for-updates"),
    },
    { type: "separator" },

    {
      label: "Quit Signoff",
      click: onQuit,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function applyStatusChange(win: BrowserWindow, onQuit: () => void): void {
  tray?.setImage(buildTrayIcon(state.status));
  rebuildMenu(win, onQuit);
}

function rebuildMenu(win: BrowserWindow, onQuit: () => void): void {
  tray?.setContextMenu(buildMenu(win, onQuit));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createTray(
  win:    BrowserWindow,
  onQuit: () => void
): Tray {
  tray = new Tray(buildTrayIcon(state.status));
  tray.setToolTip("Signoff Chat");
  tray.setContextMenu(buildMenu(win, onQuit));

  // ── Click behaviour ────────────────────────────────────────────────────
  if (process.platform === "win32") {
    // Windows: double-click to show
    tray.on("double-click", () => showWindow(win));
  } else {
    // macOS + Linux: left-click toggles
    tray.on("click", () => {
      if (win.isVisible() && !win.isMinimized()) {
        win.hide();
      } else {
        showWindow(win);
      }
    });
  }

  // ── IPC from renderer ──────────────────────────────────────────────────

  // Renderer reports current auth state on mount + after login/logout
  ipcMain.on(
    "auth-state",
    (_e, payload: { screenname: string; status: UserStatus; awayMessage?: string } | null) => {
      if (payload) {
        state.screenname  = payload.screenname;
        state.status      = payload.status;
        state.awayMessage = payload.awayMessage ?? "";
      } else {
        // Logged out
        state.screenname  = "";
        state.status      = "OFFLINE";
        state.awayMessage = "";
        state.unreadCount = 0;
        updateBadge(0);
      }
      tray?.setImage(buildTrayIcon(state.status));
      rebuildMenu(win, onQuit);
    }
  );

  ipcMain.on("status-changed", (_e, status: UserStatus) => {
    state.status = status;
    tray?.setImage(buildTrayIcon(status));
    rebuildMenu(win, onQuit);
  });

  ipcMain.on("unread-changed", (_e, count: number) => {
    state.unreadCount = count;
    updateBadge(count);
  });

  ipcMain.on("away-message-changed", (_e, message: string) => {
    state.awayMessage = message;
    // no menu rebuild needed — message isn't shown in menu
  });

  return tray;
}

/** Called directly by the Cmd+Shift+A global shortcut. */
export function triggerAwayDialog(win: BrowserWindow): void {
  openAwayDialog(win);
}

export function showTrayHint(): void {
  if (!tray || process.platform === "darwin") return;
  tray.setToolTip("Signoff Chat is still running here. Right-click to quit.");
  setTimeout(() => tray?.setToolTip("Signoff Chat"), 6000);
}

export function destroyTray(): void {
  awayWin?.close();
  tray?.destroy();
  tray    = null;
  awayWin = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
