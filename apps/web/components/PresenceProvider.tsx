"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserStatus = "ONLINE" | "AWAY" | "IDLE" | "INVISIBLE" | "OFFLINE";

interface PresenceContextValue {
  /** The user's current status (their real status, not the externally-visible one). */
  status: UserStatus;
  /** Call to update status via API and keep context in sync. */
  updateStatus: (next: UserStatus) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PresenceContext = createContext<PresenceContextValue>({
  status: "OFFLINE",
  updateStatus: async () => {},
});

export function usePresence() {
  return useContext(PresenceContext);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDLE_MS = 10 * 60 * 1000; // 10 minutes

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

// ---------------------------------------------------------------------------
// Helper — fire-and-forget PATCH
// ---------------------------------------------------------------------------

async function patchStatus(s: UserStatus): Promise<boolean> {
  try {
    const res = await fetch("/api/user/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const [status, setStatus] = useState<UserStatus>("OFFLINE");

  // Keep a ref in sync so callbacks closed over it always read the latest value
  // without needing to be re-created on every render.
  const statusRef = useRef<UserStatus>("OFFLINE");
  function syncStatus(next: UserStatus) {
    statusRef.current = next;
    setStatus(next);
  }

  // Public updater — used by StatusSelector and the Navbar sign-off
  const updateStatus = useCallback(async (next: UserStatus) => {
    const prev = statusRef.current;
    // Optimistic update so the UI responds immediately on mobile
    syncStatus(next);
    const ok = await patchStatus(next);
    if (!ok) {
      // Roll back to previous if the server rejected it
      syncStatus(prev);
      console.warn("[presence] status update failed for", next);
    } else {
      // Keep the tray icon and menu in sync
      if (typeof window !== "undefined" && "electronAPI" in window) {
        window.electronAPI!.reportStatus(next);
      }
    }
  }, []);

  // ---- Login → ONLINE ----------------------------------------------------
  const initialised = useRef(false);
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !session?.user?.id) return;
    if (initialised.current) return;
    initialised.current = true;
    patchStatus("ONLINE").then((ok) => { if (ok) syncStatus("ONLINE"); });
  }, [sessionStatus, session?.user?.id]);

  // ---- Idle detection ----------------------------------------------------
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      // Only auto-idle if the user is still ONLINE
      if (statusRef.current === "ONLINE") {
        patchStatus("IDLE").then((ok) => { if (ok) syncStatus("IDLE"); });
      }
    }, IDLE_MS);
  }, []);

  const onActivity = useCallback(() => {
    // Restore ONLINE if we auto-idled them
    if (statusRef.current === "IDLE") {
      patchStatus("ONLINE").then((ok) => { if (ok) syncStatus("ONLINE"); });
    }
    scheduleIdle();
  }, [scheduleIdle]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    scheduleIdle(); // start initial idle countdown

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true })
    );

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [sessionStatus, onActivity, scheduleIdle]);

  // ---- Page unload → OFFLINE (best-effort beacon) ------------------------
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    const handleUnload = () => {
      const body = JSON.stringify({ status: "OFFLINE" });
      navigator.sendBeacon?.(
        "/api/user/status",
        new Blob([body], { type: "application/json" })
      );
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [sessionStatus]);

  return (
    <PresenceContext.Provider value={{ status, updateStatus }}>
      {children}
    </PresenceContext.Provider>
  );
}
