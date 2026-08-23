import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-ibm-plex-mono)", "Courier New", "monospace"],
        vt323: ["var(--font-vt323)", "monospace"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Amber accent used throughout auth + Gold member UI
        amber: {
          DEFAULT: "#d4a017",
          dim: "#8a6810",
          glow: "#f0bc20",
        },
        // Retro "Online Messenger" palette — mirrors the `retro` token object in
        // components/retro/retro-components.tsx so Tailwind classes and inline
        // styles stay in sync.
        retro: {
          desktop: "#3f4778",
          paper: "#f6f4ee",
          chrome: "#fdfcf9",
          border: "#8f8c82",
          hairline: "#e2dfd6",
          "input-border": "#a9b4cf",
          well: "#ffffff",
          "well-border": "#d5d2c8",
          ink: "#26262b",
          "ink-soft": "#4a4a52",
          "ink-muted": "#9a978e",
          blue: "#3a44b5",
          "blue-bright": "#4a5cc4",
          gold: "#f2cf5b",
          "gold-dim": "#c9a030",
          green: "#4caf7d",
          "green-deep": "#2c7a52",
          amber: "#dca24e",
          "amber-deep": "#8a6420",
          red: "#b05050",
          "red-deep": "#a04a3a",
          selection: "#faf0c8",
          "away-banner": "#fbf3d2",
          "away-border": "#dcc27a",
        },
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.8" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.6" },
          "97%": { opacity: "1" },
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        flicker: "flicker 4s linear infinite",
        "status-glow": "status-glow 2s ease-in-out infinite",
        "status-idle": "status-idle-pulse 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
