"use client";

/**
 * ElectronBridge — mounts all Electron IPC hooks at the app root.
 *
 * Renders nothing. Add once inside <SessionProvider> + <PresenceProvider>
 * in the root layout so it has access to session and presence context.
 */

import { useEffect } from "react";
import { useElectronBridge }    from "@/lib/hooks/useElectronBridge";
import { useSoketiReconnect }   from "@/lib/hooks/useSoketiReconnect";
import { useElectronShortcuts } from "@/lib/hooks/useElectronShortcuts";

const isElectron = () =>
  typeof window !== "undefined" && "electronAPI" in window;

export function ElectronBridge() {
  useElectronBridge();
  useSoketiReconnect();
  useElectronShortcuts();

  // Forward unread-change events to the main process dock/taskbar badge
  useEffect(() => {
    if (!isElectron()) return;

    const handler = (e: Event) => {
      const { count } = (e as CustomEvent<{ count: number }>).detail;
      window.electronAPI!.reportUnread(count);
    };

    // Clear badge when window gains focus
    const onFocus = () => {
      window.electronAPI!.reportUnread(0);
    };

    window.addEventListener("electron:unread-change", handler);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("electron:unread-change", handler);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
