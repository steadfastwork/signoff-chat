"use client";

/**
 * useElectronBridge — root-level Electron IPC wiring.
 *
 * Mount once in the root layout via <ElectronBridge />.
 * Handles everything that needs router/session/presence access:
 *
 *   Main → Renderer:
 *     onNavigate          → router.push(path)
 *     onFocusComposer     → dispatches "electron:focus-composer" DOM event
 *     onSetStatus         → updateStatus() via PresenceProvider
 *     onSetAwayMessage    → PATCH /api/user/status + dispatches DOM event
 *     onDeepLink          → parse signoffchat:// → router.push
 *     onBuddyRequestAccept→ POST /api/buddies/[screenname]/accept
 *
 *   Renderer → Main (kept in sync):
 *     reportAuthState     → on session change
 *     reportActivePath    → on pathname change
 *     reportUnread        → on window focus (clears badge)
 */

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePresence, type UserStatus } from "@/components/PresenceProvider";

const isElectron = () =>
  typeof window !== "undefined" && "electronAPI" in window;

// ---------------------------------------------------------------------------
// Deep-link parser  signoffchat://invite/xyz → /invite/xyz
// ---------------------------------------------------------------------------

function deepLinkToPath(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    return `/${hostname}${pathname}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useElectronBridge() {
  const router   = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const { status, updateStatus } = usePresence();

  // Keep stable refs to avoid stale closures in IPC callbacks
  const routerRef   = useRef(router);
  const statusRef   = useRef(status);
  routerRef.current = router;
  statusRef.current = status;

  // ── Report active path on every navigation ────────────────────────────────
  useEffect(() => {
    if (!isElectron()) return;
    window.electronAPI!.reportActivePath(pathname);
  }, [pathname]);

  // ── Report auth state on session change ───────────────────────────────────
  useEffect(() => {
    if (!isElectron()) return;

    if (sessionStatus === "authenticated" && session?.user) {
      window.electronAPI!.reportAuthState({
        screenname: session.user.screenname,
        status:     statusRef.current,
      });
    } else if (sessionStatus === "unauthenticated") {
      window.electronAPI!.reportAuthState(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session?.user?.id]);

  // Keep main process in sync when status changes (tray icon + menu)
  useEffect(() => {
    if (!isElectron() || sessionStatus !== "authenticated") return;
    window.electronAPI!.reportStatus(status);
  }, [status, sessionStatus]);

  // ── Listen for commands from main / tray ──────────────────────────────────
  useEffect(() => {
    if (!isElectron()) return;

    const api = window.electronAPI!;

    // Tray / global shortcut → navigate
    const offNavigate = api.onNavigate((path) => {
      routerRef.current.push(path);
    });

    // Cmd+Shift+N or tray → focus composer
    const offComposer = api.onFocusComposer(() => {
      window.dispatchEvent(new CustomEvent("electron:focus-composer"));
    });

    // Tray status submenu
    const offStatus = api.onSetStatus((s) => {
      updateStatus(s as UserStatus);
    });

    // Tray away message dialog
    const offAway = api.onSetAwayMessage(async (message) => {
      try {
        await fetch("/api/user/status", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ status: "AWAY", awayMessage: message }),
        });
        await updateStatus("AWAY");
      } catch { /* best-effort */ }
      window.electronAPI!.reportAwayMessage(message);
      window.dispatchEvent(
        new CustomEvent("electron:set-away-message", { detail: { message } })
      );
    });

    // signoffchat:// deep links
    const offDeepLink = api.onDeepLink((url) => {
      const path = deepLinkToPath(url);
      if (path) routerRef.current.push(path);
    });

    // macOS notification banner "Accept" button for buddy requests
    const offBuddyAccept = api.onBuddyRequestAccept(async (screenname) => {
      try {
        await fetch(`/api/buddies/${encodeURIComponent(screenname)}/accept`, {
          method: "POST",
        });
      } catch { /* best-effort */ }
    });

    // Clear dock badge when the user focuses the window
    const onFocus = () => {
      if (isElectron()) window.electronAPI!.reportUnread(0);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      offNavigate();
      offComposer();
      offStatus();
      offAway();
      offDeepLink();
      offBuddyAccept();
      window.removeEventListener("focus", onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
