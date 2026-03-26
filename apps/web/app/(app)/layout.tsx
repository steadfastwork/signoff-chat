import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { EncryptionSetupPrompt } from "@/components/EncryptionSetupPrompt";
import { getFeatureFlag, BOARDS_ENABLED } from "@/lib/featureFlags";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const boardsEnabled = await getFeatureFlag(BOARDS_ENABLED);

  return (
    <>
      {/* Fixed left sidebar — hidden on mobile */}
      <Sidebar boardsEnabled={boardsEnabled} />

      {/* Main content — offset for navbar (52px top) and sidebar (220px left on md+) */}
      <main
        className="pt-[52px] md:ml-[220px] min-h-screen"
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
