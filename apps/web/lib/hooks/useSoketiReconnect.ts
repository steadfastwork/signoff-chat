"use client";

/**
 * useSoketiReconnect — reconnects Soketi after the system wakes from sleep.
 *
 * Flow:
 *   1. main process powerMonitor 'resume' → sends "check-soketi-state" IPC
 *   2. This hook receives it, checks soketiClient.connection.state
 *   3. Reports state via reportSoketiState({ connected, unreadCount })
 *   4. If main responds with "reconnect-soketi", we call soketiClient.connect()
 *
 * unreadCount: messages that arrived on Soketi between last disconnect and now.
 * Main uses this to navigate to /channels if > 0.
 */

import { useEffect, useRef } from "react";
import { soketiClient } from "@/lib/soketi";

const isElectron = () =>
  typeof window !== "undefined" && "electronAPI" in window;

export function useSoketiReconnect() {
  // Count messages that arrive while Soketi is not in "connected" state
  const unreadSinceDisconnect = useRef(0);
  const trackingDisconnect    = useRef(false);

  useEffect(() => {
    if (!isElectron() || !soketiClient) return;

    // Track messages that arrive during a disconnected period
    const handleStateChange = ({ current }: { current: string }) => {
      if (current === "disconnected" || current === "failed") {
        trackingDisconnect.current = true;
      } else if (current === "connected") {
        trackingDisconnect.current = false;
      }
    };
    soketiClient.connection.bind("state_change", handleStateChange);

    // Listen for main process asking for our connection state (on system wake)
    const offCheck = window.electronAPI!.onCheckSoketiState(() => {
      const connected = soketiClient.connection.state === "connected";
      const unreadCount = unreadSinceDisconnect.current;
      unreadSinceDisconnect.current = 0; // reset after reporting
      window.electronAPI!.reportSoketiState({ connected, unreadCount });
    });

    // Listen for main process asking us to reconnect
    const offReconnect = window.electronAPI!.onReconnectSoketi(() => {
      // Disconnect and reconnect to get a fresh WebSocket
      soketiClient.disconnect();
      soketiClient.connect();
    });

    return () => {
      soketiClient.connection.unbind("state_change", handleStateChange);
      offCheck();
      offReconnect();
    };
  }, []);

  // Expose a function components can call to count an unread message
  return {
    countUnread: () => {
      if (trackingDisconnect.current) {
        unreadSinceDisconnect.current += 1;
      }
    },
  };
}
