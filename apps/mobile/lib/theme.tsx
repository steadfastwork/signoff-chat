import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { tokens } from "@signoff/config";

type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: typeof tokens.dark;
  toggle: () => void;
}

const THEME_KEY = "signoff_theme";

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  colors: tokens.dark,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setMode(saved);
    });
  }, []);

  const toggle = () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    SecureStore.setItemAsync(THEME_KEY, next);
  };

  const colors = mode === "dark" ? tokens.dark : tokens.light;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
