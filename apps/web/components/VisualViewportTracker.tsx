"use client";
import { useEffect } from "react";

/**
 * Sets --vvh (visual viewport height in px) on :root whenever the visual
 * viewport resizes — e.g. when the iOS virtual keyboard appears or the
 * Safari browser chrome shows/hides.
 *
 * Use in height calculations instead of 100dvh:
 *   height: min(calc(var(--vvh, 100svh) - 52px), calc(100dvh - 52px - var(--tab-bar-h)))
 *
 * When keyboard is closed: --vvh ≈ 100dvh  →  min picks the smaller (tab-bar-h subtracted) value
 * When keyboard is open:   --vvh shrinks    →  min picks vvh - 52px, keeping input visible
 */
export function VisualViewportTracker() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--vvh", `${vv.height}px`);
    vv.addEventListener("resize", update);
    update();
    return () => vv.removeEventListener("resize", update);
  }, []);
  return null;
}
