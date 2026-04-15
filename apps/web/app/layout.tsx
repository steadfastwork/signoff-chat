import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, VT323, DM_Sans, DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "@/components/radical/tokens.css";
import { SessionProvider } from "@/components/SessionProvider";
import { PresenceProvider } from "@/components/PresenceProvider";
import { ThemeProvider, ThemeScript } from "@/components/ThemeProvider";
import { SidebarProvider } from "@/components/SidebarProvider";
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

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Signoff Chat",
  description: "A retro-styled social chat app.", // trigger redeploy
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Signoff",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111110",
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
      className={`${ibmPlexMono.variable} ${vt323.variable} ${dmSans.variable} ${dmSerifDisplay.variable} ${plusJakartaSans.variable}`}
    >
      <head>
        <ThemeScript />
        {/* Prevent wallet extension crashes — stubs window.ethereum so injected
            scripts don't throw when the extension loads before its own setup */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(!window.ethereum)window.ethereum={}}catch(e){}` }} />
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <PresenceProvider>
              <SidebarProvider>
                {/* Electron IPC bridge — renders nothing, wires all main↔renderer comms */}
                <ElectronBridge />
                {/* Fixed top navbar — always visible */}
                <Navbar boardsEnabled={boardsEnabled} />
                {children}
              </SidebarProvider>
            </PresenceProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
