"use client";

import { createContext, useContext, useState } from "react";
import type { PostType } from "@/components/radical/PostComposer";

// ---------------------------------------------------------------------------
// Shared types used across the radical layout
// ---------------------------------------------------------------------------

export type AwayStatusValue = "ONLINE" | "AWAY" | "OFFLINE";

export interface BuddyData {
  userId:      string;
  screenname:  string;
  isGold:      boolean;
  isOnline:    boolean;
  isAway:      boolean;
  awayMessage: string;
  currently:   { emoji: string; label: string }[];
  avatarColor: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface RadicalLayoutContextType {
  activeBuddy:      BuddyData | null;
  setActiveBuddy:   (buddy: BuddyData | null) => void;
  activeTag:        string | null;
  setActiveTag:     (tag: string | null) => void;
  composerOpen:     boolean;
  setComposerOpen:  (open: boolean) => void;
  composerType:     PostType;
  setComposerType:  (type: PostType) => void;
  /** Mobile: which screen is active */
  mobileScreen:     "feed" | "talk" | "you";
  setMobileScreen:  (screen: "feed" | "talk" | "you") => void;
}

const RadicalLayoutContext = createContext<RadicalLayoutContextType | null>(null);

export function useRadicalLayout(): RadicalLayoutContextType {
  const ctx = useContext(RadicalLayoutContext);
  if (!ctx) throw new Error("useRadicalLayout must be used within RadicalLayoutProvider");
  return ctx;
}

export function RadicalLayoutProvider({ children }: { children: React.ReactNode }) {
  const [activeBuddy,  setActiveBuddy]  = useState<BuddyData | null>(null);
  const [activeTag,    setActiveTag]    = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<PostType>("AWAY");
  const [mobileScreen, setMobileScreen] = useState<"feed" | "talk" | "you">("feed");

  return (
    <RadicalLayoutContext.Provider value={{
      activeBuddy, setActiveBuddy,
      activeTag, setActiveTag,
      composerOpen, setComposerOpen,
      composerType, setComposerType,
      mobileScreen, setMobileScreen,
    }}>
      {children}
    </RadicalLayoutContext.Provider>
  );
}
