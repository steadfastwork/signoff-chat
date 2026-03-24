/**
 * Preferences window — 500×440, frameless, dark-themed, inline HTML.
 *
 * Sections:
 *   1. Notifications (toggles per event type + master sounds toggle)
 *   2. Keyboard shortcuts (view-only reference table)
 *   3. Behavior (launch at login, close behavior: hide | quit)
 *   4. Local storage (info text + "Clear local history" with confirmation)
 *   5. Updates (version + "Check for updates" button)
 *   6. Account ("Delete account" → opens in main window)
 */

import { BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import Store from "electron-store";
import { getAutoLaunchEnabled, setAutoLaunch } from "./autoLaunch";

// ---------------------------------------------------------------------------
// Store schema (shared with main.ts StoreSchema — prefs-specific keys)
// ---------------------------------------------------------------------------

interface PrefsStoreSchema {
  closeBehavior: "hide" | "quit";
}

const prefsStore = new Store<PrefsStoreSchema>({
  name: "behavior-preferences",
  defaults: {
    closeBehavior: "hide",
  },
});

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let prefsWindow: BrowserWindow | null = null;

// ---------------------------------------------------------------------------
// IPC handlers — registered once at startup
// ---------------------------------------------------------------------------

export function registerPrefsIpcHandlers(): void {
  ipcMain.handle("prefs-get-close-behavior", () =>
    prefsStore.get("closeBehavior")
  );

  ipcMain.handle("prefs-set-close-behavior", (_e, value: "hide" | "quit") => {
    prefsStore.set("closeBehavior", value);
  });

  ipcMain.handle("prefs-get-launch-at-login", () => getAutoLaunchEnabled());

  ipcMain.handle("prefs-set-launch-at-login", (_e, value: boolean) =>
    setAutoLaunch(value)
  );

  ipcMain.on("prefs-close", () => {
    prefsWindow?.close();
  });

  ipcMain.on("prefs-open-delete-account", () => {
    // Close the prefs window and ask the main window to navigate to /settings/delete
    prefsWindow?.close();
  });
}

// ---------------------------------------------------------------------------
// getCloseBehavior — read by main.ts close handler
// ---------------------------------------------------------------------------

export function getCloseBehavior(): "hide" | "quit" {
  return prefsStore.get("closeBehavior");
}

// ---------------------------------------------------------------------------
// openPreferences — idempotent; focuses existing window if already open
// ---------------------------------------------------------------------------

export function openPreferences(parentWin: BrowserWindow): void {
  if (prefsWindow && !prefsWindow.isDestroyed()) {
    prefsWindow.focus();
    return;
  }

  prefsWindow = new BrowserWindow({
    width:           500,
    height:          440,
    resizable:       false,
    minimizable:     false,
    maximizable:     false,
    fullscreenable:  false,
    titleBarStyle:   process.platform === "darwin" ? "hiddenInset" : "default",
    title:           "Preferences",
    backgroundColor: "#0d0d0b",
    show:            false,
    parent:          parentWin,
    webPreferences: {
      preload:          path.join(__dirname, "preload-preferences.js"),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  prefsWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildHtml())}`
  );

  prefsWindow.once("ready-to-show", () => prefsWindow?.show());

  prefsWindow.on("closed", () => {
    prefsWindow = null;
  });
}

// ---------------------------------------------------------------------------
// HTML — fully inline, dark themed, VT323 heading
// ---------------------------------------------------------------------------

function buildHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preferences</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0d0d0b;
    --surface:   #1a1a17;
    --border:    #2a2a26;
    --text:      #e8e8e2;
    --muted:     #888880;
    --accent:    #f5c542;
    --danger:    #e05c5c;
    --radius:    6px;
    --font:      -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  html, body {
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 13px;
    line-height: 1.4;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }

  /* macOS traffic lights need clearance */
  .title-bar {
    height: 28px;
    -webkit-app-region: drag;
    flex-shrink: 0;
  }

  .container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 28px);
    overflow: hidden;
  }

  /* ── Tab bar ── */
  .tabs {
    display: flex;
    gap: 2px;
    padding: 0 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tab {
    padding: 8px 14px;
    cursor: pointer;
    color: var(--muted);
    font-size: 12px;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.1s;
  }
  .tab:hover  { color: var(--text); }
  .tab.active { color: var(--text); border-bottom-color: var(--accent); }

  /* ── Scroll pane ── */
  .pane {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
  .pane::-webkit-scrollbar { width: 6px; }
  .pane::-webkit-scrollbar-track  { background: transparent; }
  .pane::-webkit-scrollbar-thumb  { background: var(--border); border-radius: 3px; }

  /* ── Section heading ── */
  .section-title {
    font-family: "VT323", monospace;
    font-size: 18px;
    color: var(--accent);
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  /* ── Row (toggle / radio / etc.) ── */
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .row:last-child { border-bottom: none; }
  .row-label { flex: 1; }
  .row-label small { display: block; color: var(--muted); font-size: 11px; margin-top: 1px; }

  /* ── Toggle ── */
  .toggle-wrap { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
  .toggle-wrap input { opacity: 0; width: 0; height: 0; position: absolute; }
  .toggle-track {
    position: absolute; inset: 0;
    background: var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .toggle-wrap input:checked + .toggle-track { background: var(--accent); }
  .toggle-track::after {
    content: "";
    position: absolute;
    left: 3px; top: 3px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }
  .toggle-wrap input:checked + .toggle-track::after { transform: translateX(16px); }

  /* ── Radio group ── */
  .radio-group { display: flex; gap: 8px; }
  .radio-btn {
    display: flex; align-items: center; gap: 5px;
    cursor: pointer; font-size: 12px; color: var(--muted);
    padding: 4px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: border-color 0.1s, color 0.1s;
  }
  .radio-btn input { display: none; }
  .radio-btn.selected { border-color: var(--accent); color: var(--text); }
  .radio-btn:hover    { border-color: var(--muted); color: var(--text); }

  /* ── Shortcut table ── */
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; color: var(--muted); padding: 4px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
  tr:last-child td { border-bottom: none; }
  kbd {
    font-family: var(--font);
    font-size: 11px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 1px 5px;
    color: var(--text);
  }

  /* ── Buttons ── */
  .btn {
    display: inline-block;
    padding: 6px 14px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.1s, opacity 0.1s;
  }
  .btn:hover   { border-color: var(--muted); }
  .btn:active  { opacity: 0.7; }
  .btn-danger  { border-color: var(--danger); color: var(--danger); }
  .btn-danger:hover { background: var(--danger); color: #fff; }

  /* ── Info text ── */
  .info {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.6;
    margin-bottom: 12px;
  }

  .version-line {
    font-size: 12px;
    color: var(--muted);
  }

  /* ── Separator ── */
  .sep { height: 1px; background: var(--border); margin: 16px 0; }

  /* VT323 — load from Google Fonts inline or fall back */
  @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
</style>
</head>
<body>

<div class="title-bar"></div>

<div class="container">
  <!-- Tab bar -->
  <div class="tabs" id="tabs">
    <div class="tab active" data-tab="notifications">notifications</div>
    <div class="tab" data-tab="shortcuts">shortcuts</div>
    <div class="tab" data-tab="behavior">behavior</div>
    <div class="tab" data-tab="storage">storage</div>
    <div class="tab" data-tab="about">about</div>
  </div>

  <!-- ── NOTIFICATIONS ── -->
  <div class="pane" id="pane-notifications">
    <div class="section-title">notifications.</div>

    <div class="row">
      <div class="row-label">
        Enable notifications
        <small>Show system notifications for activity</small>
      </div>
      <label class="toggle-wrap">
        <input type="checkbox" id="notif-enabled">
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="row">
      <div class="row-label">Buddy requests</div>
      <label class="toggle-wrap">
        <input type="checkbox" id="notif-buddyRequests">
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="row">
      <div class="row-label">Nudges on your posts</div>
      <label class="toggle-wrap">
        <input type="checkbox" id="notif-nudges">
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="row">
      <div class="row-label">Replies to your posts</div>
      <label class="toggle-wrap">
        <input type="checkbox" id="notif-replies">
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="row">
      <div class="row-label">Channel messages</div>
      <label class="toggle-wrap">
        <input type="checkbox" id="notif-channelMessages">
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="row">
      <div class="row-label">Board activity</div>
      <label class="toggle-wrap">
        <input type="checkbox" id="notif-boardActivity">
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="row">
      <div class="row-label">Tips received</div>
      <label class="toggle-wrap">
        <input type="checkbox" id="notif-tips">
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="sep"></div>

    <div class="row">
      <div class="row-label">
        Notification sounds
        <small>Play audio with notifications</small>
      </div>
      <label class="toggle-wrap">
        <input type="checkbox" id="notif-sounds">
        <span class="toggle-track"></span>
      </label>
    </div>
  </div>

  <!-- ── SHORTCUTS ── -->
  <div class="pane" id="pane-shortcuts" style="display:none">
    <div class="section-title">shortcuts.</div>

    <table>
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody id="shortcuts-table-body">
      </tbody>
    </table>
  </div>

  <!-- ── BEHAVIOR ── -->
  <div class="pane" id="pane-behavior" style="display:none">
    <div class="section-title">behavior.</div>

    <div class="row">
      <div class="row-label">
        Launch at login
        <small>Start Signoff Chat when you log in</small>
      </div>
      <label class="toggle-wrap">
        <input type="checkbox" id="launch-at-login">
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="row">
      <div class="row-label">
        Close window
        <small>What happens when you close the window</small>
      </div>
      <div class="radio-group" id="close-behavior-group">
        <label class="radio-btn selected" data-value="hide">
          <input type="radio" name="closeBehavior" value="hide" checked>
          Hide to tray
        </label>
        <label class="radio-btn" data-value="quit">
          <input type="radio" name="closeBehavior" value="quit">
          Quit app
        </label>
      </div>
    </div>
  </div>

  <!-- ── STORAGE ── -->
  <div class="pane" id="pane-storage" style="display:none">
    <div class="section-title">storage.</div>

    <p class="info">
      Messages and feed posts are stored locally on this device so they load
      instantly. They are kept permanently and are never deleted automatically.
      Clearing history only removes the local cache — your data on the server
      is unaffected.
    </p>

    <button class="btn btn-danger" id="clear-history-btn">
      Clear local history
    </button>
  </div>

  <!-- ── ABOUT ── -->
  <div class="pane" id="pane-about" style="display:none">
    <div class="section-title">about.</div>

    <p class="version-line" id="version-line">Version —</p>

    <div class="sep"></div>

    <div style="display:flex; flex-direction:column; gap:10px; margin-top:4px">
      <button class="btn" id="check-updates-btn">Check for updates</button>
    </div>

    <div class="sep"></div>

    <p class="info">
      Your account and all server-side data can be permanently deleted from
      your profile settings.
    </p>

    <button class="btn btn-danger" id="delete-account-btn">
      Delete account…
    </button>
  </div>
</div>

<script>
(async () => {
  const api = window.prefsAPI;

  // ── Tab switching ─────────────────────────────────────────────────────────
  const tabs  = document.querySelectorAll(".tab");
  const panes = document.querySelectorAll(".pane");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const id = "pane-" + tab.dataset.tab;
      panes.forEach((p) => {
        p.style.display = p.id === id ? "" : "none";
      });
    });
  });

  // ── Helper: toggle ────────────────────────────────────────────────────────
  function bindToggle(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      api.setNotifPrefs({ [key]: el.checked });
    });
  }

  // ── Load notification prefs ───────────────────────────────────────────────
  try {
    const prefs = await api.getNotifPrefs();
    const map = {
      "notif-enabled":        "enabled",
      "notif-buddyRequests":  "buddyRequests",
      "notif-nudges":         "nudges",
      "notif-replies":        "replies",
      "notif-channelMessages":"channelMessages",
      "notif-boardActivity":  "boardActivity",
      "notif-tips":           "tips",
      "notif-sounds":         "sounds",
    };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.checked = prefs[key] ?? true;
      bindToggle(id, key);
    }
  } catch (_) {}

  // ── Shortcuts table ───────────────────────────────────────────────────────
  const isMac = api.getPlatform() === "darwin";
  const mod   = isMac ? "⌘" : "Ctrl";
  const rows  = [
    ["Show / hide window",    mod + "+Shift+S (global)"],
    ["New post",              mod + "+Shift+N (global)"],
    ["Away message",          mod + "+Shift+A (global)"],
    ["Quit (double-press)",   "⌘Q × 2   (macOS)"],
    ["Feed",                  mod + "+1"],
    ["Channels",              mod + "+2"],
    ["Boards",                mod + "+3"],
    ["Buddies",               mod + "+4"],
    ["Profile",               mod + "+5"],
    ["Focus composer",        mod + "+N"],
    ["Search",                mod + "+K"],
    ["Preferences",           mod + "+,"],
    ["Refresh view",          mod + "+R"],
    ["Previous channel",      mod + "+["],
    ["Next channel",          mod + "+]"],
    ["Close panel",           "Esc"],
  ];
  const tbody = document.getElementById("shortcuts-table-body");
  rows.forEach(([action, shortcut]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td>" + action + "</td><td><kbd>" + shortcut + "</kbd></td>";
    tbody.appendChild(tr);
  });

  // ── Launch at login ───────────────────────────────────────────────────────
  try {
    const atLogin = await api.getLaunchAtLogin();
    const el = document.getElementById("launch-at-login");
    if (el) {
      el.checked = atLogin;
      el.addEventListener("change", () => api.setLaunchAtLogin(el.checked));
    }
  } catch (_) {}

  // ── Close behavior ────────────────────────────────────────────────────────
  try {
    const behavior = await api.getCloseBehavior();
    const btns = document.querySelectorAll(".radio-btn");
    btns.forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.value === behavior);
      const radio = btn.querySelector("input[type=radio]");
      if (radio) radio.checked = btn.dataset.value === behavior;
      btn.addEventListener("click", () => {
        btns.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        api.setCloseBehavior(btn.dataset.value);
      });
    });
  } catch (_) {}

  // ── Version ───────────────────────────────────────────────────────────────
  try {
    const ver = await api.getVersion();
    const el  = document.getElementById("version-line");
    if (el) el.textContent = "Version " + ver;
  } catch (_) {}

  // ── Clear local history ───────────────────────────────────────────────────
  document.getElementById("clear-history-btn")?.addEventListener("click", async () => {
    const ok = confirm("Clear all locally cached messages and posts?\\nThis cannot be undone.");
    if (!ok) return;
    await api.clearLocalHistory();
    alert("Local history cleared.");
  });

  // ── Check for updates ─────────────────────────────────────────────────────
  document.getElementById("check-updates-btn")?.addEventListener("click", () => {
    api.checkForUpdates();
  });

  // ── Delete account ────────────────────────────────────────────────────────
  document.getElementById("delete-account-btn")?.addEventListener("click", () => {
    api.openDeleteAccount();
  });
})();
</script>

</body>
</html>`;
}
