// The (auth) group renders as a full-screen overlay so the root layout's
// navbar, global background, and scanline effect are hidden behind it.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        background: "var(--bg, #0d0d0b)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {children}
    </div>
  );
}
