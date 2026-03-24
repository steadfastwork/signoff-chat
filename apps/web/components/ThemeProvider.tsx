"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Resolve: explicit localStorage > system preference
    const stored = localStorage.getItem("sc-theme") as Theme | null;
    const sys = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const resolved = stored ?? sys;
    setTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);

    // Enable transitions only after theme is determined (avoids flash)
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

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Inline script — injected in <head> to prevent theme flash before hydration
// ---------------------------------------------------------------------------

export function ThemeScript() {
  const script = `
(function(){
  try{
    var t=localStorage.getItem('sc-theme');
    var sys=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
    document.documentElement.setAttribute('data-theme',t||sys);
  }catch(e){}
})();`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
