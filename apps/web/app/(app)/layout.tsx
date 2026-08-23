import { VisualViewportTracker } from "@/components/VisualViewportTracker";

// Minimal app shell for the retro Online Messenger. The old Sidebar / MobileNav /
// EncryptionSetupPrompt were removed in the strip — the Messenger carries its own
// buddy list, and encryption is gone.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VisualViewportTracker />
      <main className="pt-[52px] min-h-screen">{children}</main>
    </>
  );
}
