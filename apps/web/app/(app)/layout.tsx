import { VisualViewportTracker } from "@/components/VisualViewportTracker";
import { MobileShell } from "@/components/MobileShell";

// Desktop (≥1024px): multi-window pages render in <main>. Mobile (<1024px):
// MobileShell overlays the single-window Buddies/Channels/Away/Setup experience
// (approved SIGNOFF Retro Mobile design). MobileShell self-gates on viewport.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VisualViewportTracker />
      <main className="pt-[52px] min-h-screen">{children}</main>
      <MobileShell />
    </>
  );
}
