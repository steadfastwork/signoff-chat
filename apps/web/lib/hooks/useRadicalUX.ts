"use client";

import { useSession } from "next-auth/react";

/**
 * Client-side hook: reads the radicalUXEnabled flag that the server
 * embedded in the session during getServerSession().
 *
 * Returns false during loading / when unauthenticated.
 */
export function useRadicalUX(): boolean {
  const { data: session } = useSession();
  return session?.radicalUXEnabled ?? false;
}
