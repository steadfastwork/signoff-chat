"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
export type ColorScheme = "default" | "midnight" | "forest" | "ocean" | "rose" | "matrix" | "sepia";

export const COLOR_SCHEMES: Array<{
  id: ColorScheme;
  label: string;
  bg: string;
  accent: string;
  preview: string; // text preview color
}> = [
  { id: "default",  label: "default",  bg: "#0d0d0b", accent: "#c8860a", preview: "#e8e4d0" },
  { id: "midnight", label: "midnight", bg: "#07071a", accent: "#a78bfa", preview: "#e0ddff" },
  { id: "forest",   label: "forest",   bg: "#04100a", accent: "#4ade80", preview: "#ccf0dc" },
  { id: "ocean",    label: "ocean",    bg: "#04091a", accent: "#38bdf8", preview: "#c8dff8" },
  { id: "rose",     label: "rose",     bg: "#140409", accent: "#fb7185", preview: "#fcdde8" },
  { id: "matrix",   label: "matrix",   bg: "#000000", accent: "#00ff41", preview: "#00ff41" },
  { id: "sepia",    label: "sepia",    bg: "#100c06", accent: "#d4a017", preview: "#f0e0c0" },
];

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
  colorScheme: "default",
  setColorScheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyColorScheme(scheme: ColorScheme) {
  if (scheme === "default") {
    document.documentElement.removeAttribute("data-color-scheme");
  } else {
    document.documentElement.setAttribute("data-color-scheme", scheme);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("default");

  useEffect(() => {
    // Restore dark/light
    const stored = localStorage.getItem("sc-theme") as Theme | null;
    const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const resolved = stored ?? sys;
    setTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);

    // Restore color scheme from localStorage, or fall back to DB
    const storedScheme = localStorage.getItem("sc-color-scheme") as ColorScheme | null;
    if (storedScheme && storedScheme !== "default") {
      setColorSchemeState(storedScheme);
      applyColorScheme(storedScheme);
    } else {
      // No local scheme — fetch from profile to sync DB → localStorage
      fetch("/api/profile")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.profileTheme) {
            const scheme = d.profileTheme as ColorScheme;
            setColorSchemeState(scheme);
            localStorage.setItem("sc-color-scheme", scheme);
            applyColorScheme(scheme);
          }
        })
        .catch(() => {});
    }

    requestAnimationFrame(() => {
      document.body.classList.add("theme-ready");
    });
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("sc-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    localStorage.setItem("sc-color-scheme", scheme);
    applyColorScheme(scheme);
    // Persist to DB (fire-and-forget)
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileTheme: scheme === "default" ? null : scheme }),
    }).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, colorScheme, setColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeScript() {
  const script = `
(function(){
  try {
    var t = localStorage.getItem('sc-theme');
    var sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t || sys);
    var s = localStorage.getItem('sc-color-scheme');
    if (s && s !== 'default') document.documentElement.setAttribute('data-color-scheme', s);
  } catch(e) {}
})();`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
