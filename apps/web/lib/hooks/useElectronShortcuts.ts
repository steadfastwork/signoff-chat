"use client";

/**
 * useElectronShortcuts — wires Electron keyboard shortcut IPC to DOM events.
 *
 * The main process intercepts key combos via before-input-event and forwards
 * them as IPC messages. This hook translates those into browser CustomEvents
 * that any component can listen to — no prop drilling needed.
 *
 * Dispatched events:
 *   "electron:search"        ← Cmd/Ctrl+K
 *   "electron:refresh"       ← Cmd/Ctrl+R
 *   "electron:prev-channel"  ← Cmd/Ctrl+[
 *   "electron:next-channel"  ← Cmd/Ctrl+]
 *   "electron:close-panel"   ← Escape (bare)
 *
 * Usage in any component:
 *   useEffect(() => {
 *     const handler = () => openSearch();
 *     window.addEventListener("electron:search", handler);
 *     return () => window.removeEventListener("electron:search", handler);
 *   }, []);
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const isElectron = () =>
  typeof window !== "undefined" && "electronAPI" in window;

export function useElectronShortcuts() {
  const router = useRouter();

  useEffect(() => {
    if (!isElectron()) return;

    const api = window.electronAPI!;

    const offSearch = api.onSearch(() => {
      window.dispatchEvent(new CustomEvent("electron:search"));
    });

    const offRefresh = api.onRefresh(() => {
      // router.refresh() re-fetches server components without a full reload
      router.refresh();
      window.dispatchEvent(new CustomEvent("electron:refresh"));
    });

    const offPrev = api.onPrevChannel(() => {
      window.dispatchEvent(new CustomEvent("electron:prev-channel"));
    });

    const offNext = api.onNextChannel(() => {
      window.dispatchEvent(new CustomEvent("electron:next-channel"));
    });

    const offClose = api.onClosePanel(() => {
      window.dispatchEvent(new CustomEvent("electron:close-panel"));
    });

    return () => {
      offSearch();
      offRefresh();
      offPrev();
      offNext();
      offClose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
