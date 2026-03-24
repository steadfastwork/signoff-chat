/**
 * Lightweight module-level unread counter for the Electron dock badge.
 *
 * Components call incrementElectronUnread() when a notification-worthy
 * event arrives while the window is not focused.
 * ElectronBridge listens for the "electron:unread-change" DOM event and
 * forwards the total to reportUnread().
 *
 * Usage:
 *   import { incrementElectronUnread } from "@/lib/electronUnread";
 *   // inside a Soketi event handler when window.document.hidden:
 *   incrementElectronUnread();
 */

let count = 0;

export function incrementElectronUnread(by = 1) {
  if (typeof window === "undefined") return;
  count += by;
  window.dispatchEvent(
    new CustomEvent("electron:unread-change", { detail: { count } })
  );
}

export function clearElectronUnread() {
  if (typeof window === "undefined") return;
  count = 0;
  window.dispatchEvent(
    new CustomEvent("electron:unread-change", { detail: { count: 0 } })
  );
}
