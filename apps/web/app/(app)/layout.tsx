import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { EncryptionSetupPrompt } from "@/components/EncryptionSetupPrompt";
import { getFeatureFlag, BOARDS_ENABLED, isRadicalUXEnabled } from "@/lib/featureFlags";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const isRadical = await isRadicalUXEnabled(session?.user?.id);

  // When RADICAL_UX is active the feed page renders a full-page layout shell.
  // Skip the existing sidebar / main wrapper so it doesn't duplicate.
  if (isRadical) {
    return <>{children}</>;
  }

  const boardsEnabled = await getFeatureFlag(BOARDS_ENABLED);

  return (
    <>
      {/* Fixed left sidebar — hidden on mobile */}
      <Sidebar boardsEnabled={boardsEnabled} />

      {/* Main content — offset for navbar (52px top) and sidebar (220px left on md+) */}
      {/* pb-tab-bar adds bottom padding on mobile to prevent tab bar overlap on normal-scroll pages */}
      <main
        className="pt-[52px] md:ml-[220px] min-h-screen pb-tab-bar md:pb-0"
        style={{ background: "var(--bg)" }}
      >
        {children}
      </main>

      {/* Bottom tab bar — mobile only */}
      <MobileNav boardsEnabled={boardsEnabled} />

      {/* Prompt existing users without encryption keys to set them up */}
      <EncryptionSetupPrompt />
    </>
  );
}
