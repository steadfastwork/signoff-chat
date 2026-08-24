"use client";
import { useEffect, useState } from "react";

// True on phone/tablet viewports (< 1024px) — the breakpoint from PROMPTS #9
// (desktop multi-window ≥1024, single-window mobile below).
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}
