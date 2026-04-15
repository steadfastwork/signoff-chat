"use client";
import { useEffect } from "react";

const NAVBAR_H = 52; // fixed navbar height in px

/**
 * Computes --chat-h on :root: the correct height for a full-bleed chat
 * container (below the navbar, above the tab bar / keyboard).
 *
 * iOS Safari problems this solves:
 *  1. 100dvh can exceed the actual visible area when Safari's browser
 *     chrome (address bar / toolbar) is partially shown — causing the
 *     container to extend behind the toolbar and the input to sit in
 *     the wrong position.
 *  2. When the virtual keyboard opens, 100dvh does NOT shrink on iOS,
 *     so the input bar slides under the keyboard.
 *
 * Fix: window.visualViewport.height DOES correctly shrink when the
 * keyboard opens (iOS 16+). We use it to compute the right height:
 *
 *   chatH = min(vv.height, innerHeight - tabBarH) - NAVBAR_H
 *
 *   • Keyboard closed: vv.height ≥ innerHeight - tabBarH
 *                      → uses innerHeight - tabBarH - NAVBAR_H  ✓
 *   • Keyboard open:   vv.height < innerHeight - tabBarH
 *                      → uses vv.height - NAVBAR_H  (shrinks with keyboard) ✓
 */
export function VisualViewportTracker() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;

    // Measure the actual rendered tab-bar height once (resolves safe-area-inset-bottom).
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;bottom:0;height:var(--tab-bar-h,0px);visibility:hidden;pointer-events:none;z-index:-1";
    document.body.appendChild(probe);
    const tabBarH = probe.offsetHeight;
    document.body.removeChild(probe);

    const update = () => {
      if (window.innerWidth >= 768) {
        // Desktop: let CSS handle it; remove the JS override.
        root.style.removeProperty("--chat-h");
        return;
      }
      const chatH = Math.max(
        Math.min(vv.height, window.innerHeight - tabBarH) - NAVBAR_H,
        100
      );
      root.style.setProperty("--chat-h", `${chatH}px`);
    };

    vv.addEventListener("resize", update);
    window.addEventListener("resize", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      root.style.removeProperty("--chat-h");
    };
  }, []);

  return null;
}
