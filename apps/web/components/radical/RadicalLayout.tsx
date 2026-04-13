"use client";

// ---------------------------------------------------------------------------
// RadicalLayout — root of the RADICAL_UX experience.
//
// Uses CSS media queries (not JS) to switch between desktop and mobile
// layouts, avoiding hydration mismatches during SSR.
//
// Add class="radical-ux" here so all tokens.css variables cascade to
// every child component automatically.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { TopBar } from "./layout/TopBar";
import { Sidebar } from "./layout/Sidebar";
import { MainFeed } from "./layout/MainFeed";
import { RightPanel } from "./layout/RightPanel";
import { MobileLayout } from "./layout/MobileLayout";
import { PostComposer } from "./PostComposer";
import { RadicalLayoutProvider, useRadicalLayout } from "./layout/RadicalLayoutContext";

// ---------------------------------------------------------------------------
// Inner shell — needs access to context
// ---------------------------------------------------------------------------

function RadicalShell() {
  const {
    activeBuddy, setActiveBuddy,
    composerOpen, setComposerOpen,
    composerType,
  } = useRadicalLayout();

  // Track window width for desktop vs mobile decision.
  // Using a state + effect instead of pure CSS so we can fully unmount the
  // mobile layout on desktop (avoids duplicate API fetches).
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // First paint: render nothing until we know which layout to show.
  // This avoids a flash of wrong layout.
  if (isDesktop === null) return null;

  const openBuddy = (screenname: string) => {
    // For now just set activeBuddy from the screenname — caller has full data
    // MainFeed passes BuddyData directly via onOpenChat → setActiveBuddy in context
  };

  return (
    <>
      {/* Desktop layout (1024px+) */}
      {isDesktop ? (
        <div style={{
          display: "flex", flexDirection: "column",
          height: "100vh", overflow: "hidden",
          background: "var(--ink)",
        }}>
          <TopBar />
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <Sidebar />
            <MainFeed
              onOpenChat={(screenname) => {
                // MainFeed sets activeBuddy via context directly from BuddyData
                // This callback fires when clicking a person bubble or username
              }}
            />
            <RightPanel />
          </div>
        </div>
      ) : (
        /* Mobile layout (< 1024px) */
        <MobileLayout />
      )}

      {/* Desktop PostComposer (mobile has its own inline) */}
      {isDesktop && (
        <PostComposer
          isOpen={composerOpen}
          onClose={() => setComposerOpen(false)}
          onPost={async (postData) => {
            await fetch("/api/posts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(postData),
            });
            setComposerOpen(false);
          }}
          mobile={false}
          defaultType={composerType}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// RadicalLayout — exported root (wraps provider + .radical-ux class)
// ---------------------------------------------------------------------------

export function RadicalLayout() {
  return (
    <div className="radical-ux" style={{ height: "100vh", overflow: "hidden" }}>
      <RadicalLayoutProvider>
        <RadicalShell />
      </RadicalLayoutProvider>
    </div>
  );
}
