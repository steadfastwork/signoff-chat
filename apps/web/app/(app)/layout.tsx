import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Fixed left sidebar — hidden on mobile */}
      <Sidebar />

      {/* Main content — offset for navbar (52px top) and sidebar (220px left on md+) */}
      <main
        className="pt-[52px] md:ml-[220px] min-h-screen"
        style={{ background: "var(--bg)" }}
      >
        {children}
      </main>

      {/* Bottom tab bar — mobile only */}
      <MobileNav />
    </>
  );
}
