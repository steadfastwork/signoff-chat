/**
 * Keyboard shortcuts — global and local.
 *
 * GLOBAL (work from any app, via globalShortcut):
 *   Cmd+Shift+S / Ctrl+Shift+S  — show / hide window
 *   Cmd+Shift+N / Ctrl+Shift+N  — show window + focus post composer
 *   Cmd+Shift+A / Ctrl+Shift+A  — open away message dialog
 *   Cmd+Q (macOS)               — double-press within 2 s to quit
 *
 * LOCAL (window focused, via webContents before-input-event):
 *   Cmd/Ctrl+1–5    navigate tabs (feed/channels/boards/buddies/profile)
 *   Cmd/Ctrl+N      focus post composer
 *   Cmd/Ctrl+K      search
 *   Cmd/Ctrl+,      open preferences window
 *   Cmd/Ctrl+R      refresh view (prevents default page reload)
 *   Cmd/Ctrl+[      previous channel
 *   Cmd/Ctrl+]      next channel
 *   Escape          close panel (forwarded to renderer)
 */

import { globalShortcut, BrowserWindow } from "electron";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let quitTimer: ReturnType<typeof setTimeout> | null = null;

const MOD = process.platform === "darwin" ? "Command" : "Control";

// ---------------------------------------------------------------------------
// registerShortcuts — call once after window is created
// ---------------------------------------------------------------------------

export function registerShortcuts(
  win:          BrowserWindow,
  onQuit:       () => void,
  onAwayDialog: () => void,
  onPrefs:      () => void
): void {
  registerGlobalShortcuts(win, onQuit, onAwayDialog);
  registerLocalShortcuts(win, onPrefs);
}

// ---------------------------------------------------------------------------
// Global shortcuts
// ---------------------------------------------------------------------------

function registerGlobalShortcuts(
  win:          BrowserWindow,
  onQuit:       () => void,
  onAwayDialog: () => void
): void {
  // ── Cmd+Q double-press guard (macOS only) ─────────────────────────────────
  if (process.platform === "darwin") {
    globalShortcut.register("Command+Q", () => {
      if (quitTimer) {
        clearTimeout(quitTimer);
        quitTimer = null;
        onQuit();
      } else {
        quitTimer = setTimeout(() => { quitTimer = null; }, 2000);
        win.webContents
          .executeJavaScript(
            `document.title = "Press ⌘Q again to quit — " + document.title`
          )
          .catch(() => {});
        setTimeout(() => {
          win.webContents
            .executeJavaScript(
              `document.title = document.title.replace(/^Press ⌘Q again to quit — /, "")`
            )
            .catch(() => {});
        }, 2000);
      }
    }) || console.warn("[shortcuts] Could not register Command+Q override");
  }

  // ── Show / hide ───────────────────────────────────────────────────────────
  globalShortcut.register(`${MOD}+Shift+S`, () => {
    if (win.isVisible() && !win.isMinimized() && win.isFocused()) {
      win.hide();
    } else {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  // ── Global new post ───────────────────────────────────────────────────────
  globalShortcut.register(`${MOD}+Shift+N`, () => {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send("navigate", "/feed");
    win.webContents.send("focus-composer");
  });

  // ── Away message dialog ───────────────────────────────────────────────────
  globalShortcut.register(`${MOD}+Shift+A`, onAwayDialog);
}

// ---------------------------------------------------------------------------
// Local shortcuts — before-input-event on the focused window
// ---------------------------------------------------------------------------

const NAV_PATHS: Record<string, string> = {
  "1": "/feed",
  "2": "/channels",
  "3": "/boards",
  "4": "/buddies",
  "5": "/profile",
};

function registerLocalShortcuts(win: BrowserWindow, onPrefs: () => void): void {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    const mod  = process.platform === "darwin" ? input.meta : input.control;
    const noShift = !input.shift;
    const noAlt   = !input.alt;

    // ── Navigation: Cmd/Ctrl+1–5 ──────────────────────────────────────────
    if (mod && noShift && noAlt && NAV_PATHS[input.key]) {
      event.preventDefault();
      win.webContents.send("navigate", NAV_PATHS[input.key]);
      return;
    }

    // ── Focus composer: Cmd/Ctrl+N ────────────────────────────────────────
    if (mod && noShift && noAlt && input.key === "n") {
      event.preventDefault();
      win.webContents.send("focus-composer");
      return;
    }

    // ── Search: Cmd/Ctrl+K ────────────────────────────────────────────────
    if (mod && noShift && noAlt && input.key === "k") {
      event.preventDefault();
      win.webContents.send("shortcut-search");
      return;
    }

    // ── Preferences: Cmd/Ctrl+, ───────────────────────────────────────────
    if (mod && noShift && noAlt && input.key === ",") {
      event.preventDefault();
      onPrefs();
      return;
    }

    // ── Refresh: Cmd/Ctrl+R (prevent page reload, send view-refresh) ─────
    if (mod && noShift && noAlt && input.key === "r") {
      event.preventDefault();
      win.webContents.send("shortcut-refresh");
      return;
    }

    // ── Channel navigation: Cmd/Ctrl+[ and ] ─────────────────────────────
    if (mod && noShift && noAlt && input.key === "[") {
      event.preventDefault();
      win.webContents.send("shortcut-prev-channel");
      return;
    }
    if (mod && noShift && noAlt && input.key === "]") {
      event.preventDefault();
      win.webContents.send("shortcut-next-channel");
      return;
    }

    // ── Close panel: Escape ───────────────────────────────────────────────
    // Only intercept bare Escape — let Shift/Alt/Ctrl+Escape pass through.
    if (
      input.key === "Escape" &&
      !input.meta && !input.control && !input.alt && !input.shift
    ) {
      // Do NOT call preventDefault — we forward as IPC and let the renderer
      // decide whether a panel is open. Native web inputs also use Escape,
      // so we send the IPC alongside the normal key event.
      win.webContents.send("shortcut-close-panel");
    }
  });
}

// ---------------------------------------------------------------------------
// unregisterShortcuts — call on will-quit
// ---------------------------------------------------------------------------

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
  if (quitTimer) {
    clearTimeout(quitTimer);
    quitTimer = null;
  }
}
