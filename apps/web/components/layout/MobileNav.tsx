"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

interface Tab {
  href: string;
  label: string;
  icon: string;
  match: (p: string) => boolean;
  accent?: "amber" | "teal";
}

const TABS: Tab[] = [
  {
    href: "/feed",
    label: "Feed",
    icon: "◉",
    match: (p) => p.startsWith("/feed"),
    accent: "amber",
  },
  {
    href: "/channels",
    label: "Channels",
    icon: "#",
    match: (p) => p.startsWith("/channels"),
    accent: "amber",
  },
  {
    href: "/boards",
    label: "Boards",
    icon: "◈",
    match: (p) => p.startsWith("/boards"),
    accent: "teal",
  },
  {
    href: "/u/me",
    label: "Profile",
    icon: "◎",
    match: (p) => p.startsWith("/u/"),
    accent: "amber",
  },
];

export function MobileNav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session?.user?.id) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-stretch h-14">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const color =
            tab.accent === "teal" ? "var(--teal)" : "var(--amber)";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{ color: active ? color : "var(--text-dim)" }}
            >
              <span
                className="text-base leading-none font-mono"
                style={{ color: active ? color : "var(--text-muted)" }}
              >
                {tab.icon}
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: active ? color : "var(--text-dim)" }}
              >
                {tab.label}
              </span>
              {active && (
                <span
                  className="absolute bottom-0 w-8 h-0.5 rounded-full"
                  style={{ background: color }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
