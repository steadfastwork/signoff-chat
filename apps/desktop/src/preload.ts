/**
 * Preload script — runs in renderer context with Node integration disabled.
 *
 * contextBridge.exposeInMainWorld creates window.electronAPI with ONLY the
 * explicitly listed methods. No Node.js APIs leak through to the web app.
 *
 * The web app detects Electron by checking:
 *   typeof window !== 'undefined' && 'electronAPI' in window
 */

import { contextBridge, ipcRenderer } from "electron";

type IpcListener = (payload: unknown) => void;

function on(channel: string, cb: IpcListener): () => void {
  const handler = (_e: Electron.IpcRendererEvent, payload: unknown) =>
    cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Local message archive ────────────────────────────────────────────────
  db: {
    getMessages: (channelId: string, limit?: number) =>
      ipcRenderer.invoke("db-get-messages", { channelId, limit }),

    saveMessage: (message: unknown) =>
      ipcRenderer.invoke("db-save-message", { message }),

    getFeed: (limit?: number) =>
      ipcRenderer.invoke("db-get-feed", { limit }),

    savePost: (post: unknown) =>
      ipcRenderer.invoke("db-save-post", { post }),

    clearChannel: (channelId: string) =>
      ipcRenderer.invoke("db-clear-channel", { channelId }),

    clearAll: () =>
      ipcRenderer.invoke("db-clear-all"),
  },

  // ── Tray → renderer (each returns a cleanup fn for useEffect) ────────────

  onNavigate:       (cb: (path: string) => void)    => on("navigate",                 cb as IpcListener),
  onFocusComposer:  (cb: () => void)                => on("focus-composer",           cb as IpcListener),
  onSetStatus:      (cb: (status: string) => void)  => on("set-status",               cb as IpcListener),
  onSetAwayMessage: (cb: (msg: string) => void)     => on("set-away-message",         cb as IpcListener),
  onUpdateProgress: (cb: (pct: number) => void)     => on("update-download-progress", cb as IpcListener),

  // ── Keyboard shortcuts forwarded from main process ───────────────────────
  onSearch:      (cb: () => void) => on("shortcut-search",       cb as IpcListener),
  onRefresh:     (cb: () => void) => on("shortcut-refresh",      cb as IpcListener),
  onPrevChannel: (cb: () => void) => on("shortcut-prev-channel", cb as IpcListener),
  onNextChannel: (cb: () => void) => on("shortcut-next-channel", cb as IpcListener),
  onClosePanel:  (cb: () => void) => on("shortcut-close-panel",  cb as IpcListener),

  // ── Soketi reconnection on system wake ───────────────────────────────────
  /**
   * Main fires this after powerMonitor 'resume'. Renderer should check its
   * Soketi connection and call reportSoketiState() with the result.
   */
  onCheckSoketiState: (cb: () => void) => on("check-soketi-state", cb as IpcListener),

  /**
   * Call in response to onCheckSoketiState — reports current connection state.
   * Main will send 'reconnect-soketi' back if connected === false.
   */
  reportSoketiState: (state: { connected: boolean; unreadCount: number }) =>
    ipcRenderer.send("soketi-state", state),

  /**
   * Main sends this when the connection needs to be re-established.
   * Renderer should re-init its Soketi client.
   */
  onReconnectSoketi: (cb: () => void) => on("reconnect-soketi", cb as IpcListener),

  // ── Window / app control ─────────────────────────────────────────────────
  showWindow:     (): Promise<void> => ipcRenderer.invoke("show-window"),
  hideWindow:     (): Promise<void> => ipcRenderer.invoke("hide-window"),
  quitApp:        (): Promise<void> => ipcRenderer.invoke("quit-app"),
  getPreferences: (): Promise<{ closeBehavior: string; autoLaunch: boolean }> =>
    ipcRenderer.invoke("get-preferences"),
  setPreference:  (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke("set-preference", { key, value }),
  getAutoLaunch:  (): Promise<boolean> => ipcRenderer.invoke("get-auto-launch"),
  setAutoLaunch:  (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("set-auto-launch", { enabled }),

  // macOS: "Accept" button tapped on a buddy request notification banner.
  // Renderer should call the accept API for this screenname.
  onBuddyRequestAccept: (cb: (screenname: string) => void) =>
    on("buddy-request-accept", cb as IpcListener),

  // ── Deep-link ─────────────────────────────────────────────────────────────
  onDeepLink: (cb: (url: string) => void) => on("deep-link", cb as IpcListener),

  // ── Renderer → main ──────────────────────────────────────────────────────

  /** Report auth state on mount + after every login/logout. Null = logged out. */
  reportAuthState: (
    payload: { screenname: string; status: string; awayMessage?: string } | null
  ) => ipcRenderer.send("auth-state", payload),

  /** Call on every route change so main can decide whether to suppress notifications. */
  reportActivePath: (path: string) =>
    ipcRenderer.send("active-path", path),

  /** Call when the user's online status changes. */
  reportStatus: (status: string) =>
    ipcRenderer.send("status-changed", status),

  /** Call when the total unread count changes (drives dock/taskbar badge). */
  reportUnread: (count: number) =>
    ipcRenderer.send("unread-changed", count),

  /** Call when the away message is updated from within the web UI. */
  reportAwayMessage: (message: string) =>
    ipcRenderer.send("away-message-changed", message),

  // ── Notification preferences ─────────────────────────────────────────────

  getNotifPrefs: (): Promise<{
    enabled: boolean; buddyRequests: boolean; nudges: boolean;
    replies: boolean; channelMessages: boolean; boardActivity: boolean;
    tips: boolean; sounds: boolean;
  }> => ipcRenderer.invoke("notif-get-prefs"),

  setNotifPrefs: (partial: Record<string, boolean>): Promise<void> =>
    ipcRenderer.invoke("notif-set-prefs", partial),

  // ── App metadata ─────────────────────────────────────────────────────────
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke("get-version"),
});
