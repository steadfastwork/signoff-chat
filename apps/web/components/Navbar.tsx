"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePresence } from "@/components/PresenceProvider";

export function Navbar() {
  const { data: session, status } = useSession();
  const { updateStatus } = usePresence();

  async function handleSignOff() {
    await updateStatus("OFFLINE");
    signOut({ callbackUrl: "/login" });
  }

  return (
    <nav className="border-b border-green-900 bg-black sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-vt323 text-2xl text-green-400 tracking-wider">
            SIGNOFF.CHAT
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {status === "loading" && (
            <span className="text-green-700 font-mono text-xs animate-pulse">...</span>
          )}

          {status === "authenticated" && session && (
            <>
              <Link
                href="/profile"
                className="font-mono text-sm text-green-400 hover:text-green-200 transition-colors"
              >
                {session.user.screenname}
                {session.user.isGoldMember && (
                  <span className="ml-1 text-xs" style={{ color: "#d4a017" }}>★</span>
                )}
              </Link>
              <button
                onClick={handleSignOff}
                className="font-mono text-xs text-green-700 hover:text-green-400 border border-green-900 hover:border-green-700 px-2 py-1 transition-colors"
              >
                [sign off]
              </button>
            </>
          )}

          {status === "unauthenticated" && (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="font-mono text-xs text-green-600 hover:text-green-400 border border-green-900 hover:border-green-700 px-2 py-1 transition-colors"
              >
                [login]
              </Link>
              <Link
                href="/register"
                className="font-mono text-xs text-green-400 hover:text-green-200 border border-green-700 hover:border-green-500 px-2 py-1 transition-colors"
              >
                [register]
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
