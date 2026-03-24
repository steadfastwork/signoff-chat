/**
 * Type declarations for window.electronAPI — injected by the Electron preload
 * script when the web app runs inside the desktop wrapper.
 *
 * Detect Electron:
 *   const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
 *
 * Minimal integration pattern (add to _app or a root layout):
 *
 *   useEffect(() => {
 *     if (!window.electronAPI) return;
 *
 *     // 1. Tell the tray who's logged in
 *     window.electronAPI.reportAuthState({
 *       screenname: session.screenname,
 *       status: currentStatus,
 *       awayMessage: currentAway,
 *     });
 *
 *     // 2. Keep main process informed of route changes (notification suppression)
 *     window.electronAPI.reportActivePath(router.pathname);
 *
 *     // 3. Handle tray-driven navigation
 *     const cleanupNav  = window.electronAPI.onNavigate((p) => router.push(p));
 *     const cleanupAccept = window.electronAPI.onBuddyRequestAccept(acceptBuddy);
 *     return () => { cleanupNav(); cleanupAccept(); };
 *   }, []);
 */

interface ElectronNotifPrefs {
  enabled:         boolean;
  buddyRequests:   boolean;
  nudges:          boolean;
  replies:         boolean;
  channelMessages: boolean;
  boardActivity:   boolean;
  tips:            boolean;
  sounds:          boolean;
}

interface ElectronLocalMessage {
  id:               string;
  channelId:        string;
  senderId:         string;
  screenname:       string;
  encryptedContent?: string | null;
  decryptedContent?: string | null;
  iv?:               string | null;
  createdAt:        string;
  isThread:         boolean;
  parentMessageId?:  string | null;
  localOnly:        boolean;
  cachedAt:         string;
}

interface ElectronLocalPost {
  id:            string;
  authorId?:     string | null;
  screenname?:   string | null;
  content?:      string | null;
  mediaUrl?:     string | null;
  isAwayMessage: boolean;
  privacy?:      string | null;
  nudgeCount:    number;
  createdAt?:    string | null;
  cachedAt:      string;
}

declare global {
  interface Window {
    electronAPI?: {
      // ── Local message archive ───────────────────────────────────────────
      db: {
        getMessages(channelId: string, limit?: number): Promise<ElectronLocalMessage[]>;
        saveMessage(message: ElectronLocalMessage): Promise<void>;
        getFeed(limit?: number): Promise<ElectronLocalPost[]>;
        savePost(post: ElectronLocalPost): Promise<void>;
        clearChannel(channelId: string): Promise<void>;
        clearAll(): Promise<void>;
      };

      // ── Tray / main → renderer (return cleanup fn for useEffect) ────────
      onNavigate(cb: (path: string) => void): () => void;
      onFocusComposer(cb: () => void): () => void;
      onSetStatus(cb: (status: string) => void): () => void;
      onSetAwayMessage(cb: (message: string) => void): () => void;
      onUpdateProgress(cb: (pct: number) => void): () => void;
      onDeepLink(cb: (url: string) => void): () => void;

      /** Cmd/Ctrl+K — open search */
      onSearch(cb: () => void): () => void;
      /** Cmd/Ctrl+R — refresh current view (page reload suppressed) */
      onRefresh(cb: () => void): () => void;
      /** Cmd/Ctrl+[ — navigate to previous channel */
      onPrevChannel(cb: () => void): () => void;
      /** Cmd/Ctrl+] — navigate to next channel */
      onNextChannel(cb: () => void): () => void;
      /** Escape — close open panel (fired alongside native key event) */
      onClosePanel(cb: () => void): () => void;

      // ── Soketi reconnection ───────────────────────────────────────────────
      /**
       * Fired by main after powerMonitor 'resume'. Renderer should check
       * its Soketi connection and call reportSoketiState().
       */
      onCheckSoketiState(cb: () => void): () => void;
      /** Report Soketi connection state back to main. */
      reportSoketiState(state: { connected: boolean; unreadCount: number }): void;
      /** Main asks renderer to re-init Soketi after a disconnect. */
      onReconnectSoketi(cb: () => void): () => void;

      // ── Window / app control ─────────────────────────────────────────────
      showWindow(): Promise<void>;
      hideWindow(): Promise<void>;
      quitApp(): Promise<void>;
      getPreferences(): Promise<{ closeBehavior: string; autoLaunch: boolean }>;
      setPreference(key: string, value: unknown): Promise<void>;
      getAutoLaunch(): Promise<boolean>;
      setAutoLaunch(enabled: boolean): Promise<void>;

      /**
       * macOS only: fires when the user taps "Accept" on a buddy request
       * notification banner without opening the app.
       * Renderer should call the accept API for the given screenname.
       */
      onBuddyRequestAccept(cb: (screenname: string) => void): () => void;

      // ── Renderer → main ────────────────────────────────────────────────
      /**
       * Call on mount + after every login/logout.
       * Null = logged out (resets tray badge and menu).
       */
      reportAuthState(
        payload: { screenname: string; status: string; awayMessage?: string } | null
      ): void;

      /**
       * Call on every route change.
       * Used to suppress notifications when the user is already on the
       * relevant screen (e.g. don't notify channel message if focused on that channel).
       */
      reportActivePath(path: string): void;

      /** Call when the user's online status changes. */
      reportStatus(status: string): void;

      /** Call when total unread count changes (drives dock/taskbar badge). */
      reportUnread(count: number): void;

      /** Call when away message is updated from within the web UI. */
      reportAwayMessage(message: string): void;

      // ── Notification preferences ────────────────────────────────────────
      /** Read the current notification preferences from electron-store. */
      getNotifPrefs(): Promise<ElectronNotifPrefs>;

      /** Merge a partial update into the notification preferences. */
      setNotifPrefs(partial: Partial<ElectronNotifPrefs>): Promise<void>;

      // ── App metadata ────────────────────────────────────────────────────
      getVersion(): Promise<string>;
    };
  }
}
