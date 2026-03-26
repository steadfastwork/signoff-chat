import type { Metadata } from "next";
import { IBM_Plex_Mono, VT323, DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { PresenceProvider } from "@/components/PresenceProvider";
import { ThemeProvider, ThemeScript } from "@/components/ThemeProvider";
import { Navbar } from "@/components/layout/Navbar";
import { ElectronBridge } from "@/components/ElectronBridge";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  subsets: ["latin"],
  weight: "400",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Signoff Chat",
  description: "A retro-styled social chat app",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const boardsEnabled = await getFeatureFlag(BOARDS_ENABLED);

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${ibmPlexMono.variable} ${vt323.variable} ${dmSans.variable} ${dmSerifDisplay.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <PresenceProvider>
              {/* Electron IPC bridge — renders nothing, wires all main↔renderer comms */}
              <ElectronBridge />
              {/* Fixed top navbar — always visible */}
              <Navbar boardsEnabled={boardsEnabled} />
              {children}
            </PresenceProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
